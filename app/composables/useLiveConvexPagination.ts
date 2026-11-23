import type { ConvexClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import type { MaybeRefOrGetter, WatchStopHandle } from 'vue'

import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'

export interface LivePaginationPagePayload<TItem> {
  continueCursor: null | string
  isDone: boolean
  items: TItem[]
  pageStatus?: 'SplitRecommended' | 'SplitRequired' | null
  splitCursor?: null | string
}

interface ExtraPageState<TItem> {
  continueCursor: null | string
  cursor: string
  endCursor: null | string
  error: Error | null
  isDone: boolean
  items: TItem[]
  key: number
  pending: boolean
  unsubscribe: (() => void) | null
}

interface StagedSegmentState<TItem> {
  cursor: null | string
  endCursor: null | string
  key: number
  payload: LivePaginationPagePayload<TItem> | null
  unsubscribe: (() => void) | null
}

interface OngoingSplit<TItem> {
  activeId: number
  committed: boolean
  segments: StagedSegmentState<TItem>[]
}

interface FirstPageOverrideState<TItem> {
  activeId: number
  key: number
  payload: LivePaginationPagePayload<TItem>
  replacedRawData: unknown
  unsubscribe: (() => void) | null
}

export function isConvexInvalidCursorError(err: Error | null): boolean {
  if (!err)
    return false
  if (err.message.includes('InvalidCursor'))
    return true
  const data = (err as { data?: unknown }).data
  return (
    typeof data === 'object'
    && data !== null
    && 'paginationError' in data
    && (data as { paginationError?: unknown }).paginationError === 'InvalidCursor'
  )
}

function shouldSplitPage(payload: {
  pageStatus?: 'SplitRecommended' | 'SplitRequired' | null
  splitCursor?: null | string
}): payload is { pageStatus: 'SplitRecommended' | 'SplitRequired', splitCursor: string } {
  return (
    (payload.pageStatus === 'SplitRecommended' || payload.pageStatus === 'SplitRequired')
    && typeof payload.splitCursor === 'string'
    && payload.splitCursor.length > 0
  )
}

function canSplitRange(
  cursor: null | string,
  endCursor: null | string,
  payload: LivePaginationPagePayload<unknown>
): payload is LivePaginationPagePayload<unknown> & { splitCursor: string } {
  return (
    shouldSplitPage(payload)
    && payload.splitCursor !== cursor
    && payload.splitCursor !== endCursor
  )
}

function normalizeError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}

/**
 * Shared reactive cursor pagination for `{ ok, data }` Convex queries.
 * Keeps loaded ranges subscribed with sealed `endCursor` boundaries,
 * stages Convex `splitCursor` splits (including nested `SplitRequired`)
 * atomically without dropping rows or fetching past the loaded range,
 * preserves complete snapshots during `SplitRequired`, resets cleanly on
 * `InvalidCursor`, and binds all watchers and cleanup to the caller's
 * effect scope before `await`.
 */
export async function useLiveConvexPagination<
  TRawResult,
  TItem,
  TId extends string = string
>(options: {
  auth?: 'auto' | 'none'
  enabled?: MaybeRefOrGetter<boolean>
  extractPage: (raw: TRawResult | null) => LivePaginationPagePayload<TItem> | null
  getItemId: (item: TItem) => TId
  pageSize: number
  query: FunctionReference<'query'>
}) {
  const nuxtApp = useNuxtApp()
  const ownerScope = getCurrentScope()
  const stopWatchers: WatchStopHandle[] = []
  let isDisposed = false
  let nextPageKey = 1

  const paginationId = ref(0)
  const firstPageEndCursor = ref<null | string>(null)
  const extraPages = shallowRef<ExtraPageState<TItem>[]>([])
  const ongoingExtraSplits = shallowRef<Map<number, OngoingSplit<TItem>>>(new Map())
  const stagedFirstPageSplit = shallowRef<OngoingSplit<TItem> | null>(null)
  const firstPageOverride = shallowRef<FirstPageOverrideState<TItem> | null>(null)
  const awaitingFreshFirstPage = shallowRef<{ replacedRawData: unknown } | null>(null)
  const lastCompleteFirstPage = shallowRef<LivePaginationPagePayload<TItem> | null>(null)
  const firstPageSplitError = ref<Error | null>(null)
  const isEnabled = computed(() => (options.enabled === undefined ? true : Boolean(toValue(options.enabled))))

  function unsubscribeSplitSegments(split: OngoingSplit<TItem>) {
    for (const segment of split.segments)
      segment.unsubscribe?.()
  }

  function clearFirstPageOverride() {
    firstPageOverride.value?.unsubscribe?.()
    firstPageOverride.value = null
  }

  function clearStagedFirstPageSplit() {
    const staged = stagedFirstPageSplit.value
    if (!staged)
      return
    unsubscribeSplitSegments(staged)
    stagedFirstPageSplit.value = null
  }

  function clearStagedSplits() {
    clearStagedFirstPageSplit()
    clearFirstPageOverride()
    firstPageSplitError.value = null

    for (const split of ongoingExtraSplits.value.values())
      unsubscribeSplitSegments(split)
    if (ongoingExtraSplits.value.size > 0)
      ongoingExtraSplits.value = new Map()
  }

  function clearExtraPages() {
    clearStagedSplits()
    lastCompleteFirstPage.value = null
    for (const page of extraPages.value)
      page.unsubscribe?.()
    extraPages.value = []
  }

  // Register cleanup synchronously before awaiting so Vue binds it to the active effect scope.
  onScopeDispose(() => {
    isDisposed = true
    for (const stop of stopWatchers)
      stop()
    stopWatchers.length = 0
    clearExtraPages()
  })

  const state = await useConvexQuery(
    options.query,
    () =>
      isEnabled.value
        ? {
          paginationOpts: {
            cursor: null,
            ...(firstPageEndCursor.value !== null ? { endCursor: firstPageEndCursor.value } : {}),
            id: paginationId.value,
            numItems: options.pageSize
          }
        }
        : 'skip',
    {
      ...(options.auth !== undefined ? { auth: options.auth } : {}),
      keepPreviousData: true
    }
  )

  function getConvexClient(): ConvexClient | undefined {
    if (isDisposed || import.meta.server || !isEnabled.value)
      return undefined
    return nuxtApp.$convex as ConvexClient | undefined
  }

  function attachUnsubscribeToExtraPage(pageKey: number, unsubscribe: () => void) {
    const currentIndex = extraPages.value.findIndex(entry => entry.key === pageKey)
    if (currentIndex !== -1 && !isDisposed) {
      const nextPages = [...extraPages.value]
      nextPages[currentIndex] = { ...nextPages[currentIndex]!, unsubscribe }
      extraPages.value = nextPages
    } else {
      unsubscribe()
    }
  }

  function applyExtraPageUpdate(pageKey: number, activeId: number, rawResult: unknown) {
    if (isDisposed || paginationId.value !== activeId)
      return
    const payload = options.extractPage(rawResult as TRawResult)
    if (!payload)
      return

    const targetIndex = extraPages.value.findIndex(entry => entry.key === pageKey)
    if (targetIndex === -1)
      return

    const target = extraPages.value[targetIndex]!
    const isIncompleteSplit = payload.pageStatus === 'SplitRequired' && shouldSplitPage(payload)

    // Keep the last complete snapshot visible when Convex reports an incomplete SplitRequired page.
    if (!isIncompleteSplit || target.items.length === 0) {
      const nextPages = [...extraPages.value]
      nextPages[targetIndex] = {
        ...target,
        continueCursor: payload.continueCursor ?? null,
        error: null,
        isDone: payload.isDone,
        items: payload.items,
        pending: false
      }
      extraPages.value = nextPages
    } else if (target.error !== null || target.pending) {
      const nextPages = [...extraPages.value]
      nextPages[targetIndex] = {
        ...target,
        error: null,
        pending: false
      }
      extraPages.value = nextPages
    }

    if (shouldSplitPage(payload))
      startExtraPageSplit(pageKey, payload)
  }

  function applyExtraPageError(pageKey: number, activeId: number, err: unknown) {
    if (isDisposed || paginationId.value !== activeId)
      return
    const targetIndex = extraPages.value.findIndex(entry => entry.key === pageKey)
    if (targetIndex === -1)
      return

    const nextPages = [...extraPages.value]
    const target = nextPages[targetIndex]!
    nextPages[targetIndex] = {
      ...target,
      error: normalizeError(err),
      pending: false
    }
    extraPages.value = nextPages
  }

  function subscribeExtraPage(pageIndex: number) {
    const convex = getConvexClient()
    const page = extraPages.value[pageIndex]
    if (!convex || !page)
      return

    page.unsubscribe?.()
    const activeId = paginationId.value
    const pageKey = page.key
    const unsubscribe = convex.onUpdate(
      options.query,
      {
        paginationOpts: {
          cursor: page.cursor,
          ...(page.endCursor !== null ? { endCursor: page.endCursor } : {}),
          id: activeId,
          numItems: options.pageSize
        }
      },
      (rawResult) => {
        applyExtraPageUpdate(pageKey, activeId, rawResult)
      },
      (err) => {
        applyExtraPageError(pageKey, activeId, err)
      }
    )

    attachUnsubscribeToExtraPage(pageKey, unsubscribe)
  }

  function removeOngoingExtraSplit(parentKey: number) {
    if (!ongoingExtraSplits.value.has(parentKey))
      return
    const nextSplits = new Map(ongoingExtraSplits.value)
    nextSplits.delete(parentKey)
    ongoingExtraSplits.value = nextSplits
  }

  function cancelOngoingExtraSplit(parentKey: number) {
    const existing = ongoingExtraSplits.value.get(parentKey)
    if (!existing)
      return
    unsubscribeSplitSegments(existing)
    removeOngoingExtraSplit(parentKey)
  }

  function toExtraPageState(segment: StagedSegmentState<TItem>): ExtraPageState<TItem> {
    const payload = segment.payload!
    return {
      continueCursor: payload.continueCursor ?? null,
      cursor: segment.cursor!,
      endCursor: segment.endCursor,
      error: null,
      isDone: payload.isDone,
      items: payload.items,
      key: segment.key,
      pending: false,
      unsubscribe: segment.unsubscribe
    }
  }

  /**
   * Subscribes one segment of an in-flight split. If the segment itself returns an incomplete
   * `SplitRequired` payload, it is subdivided in place before the parent split commits so no
   * visible rows are dropped while nested splits load.
   */
  function subscribeStagedSegment(args: {
    convex: ConvexClient
    isCurrentSplit: () => boolean
    onCommittedError: (segment: StagedSegmentState<TItem>, err: unknown) => void
    onCommittedResult: (segment: StagedSegmentState<TItem>, rawResult: unknown) => void
    onStageError: (err: unknown) => void
    onTryCommit: () => void
    segment: StagedSegmentState<TItem>
    split: OngoingSplit<TItem>
  }) {
    const {
      convex,
      isCurrentSplit,
      onCommittedError,
      onCommittedResult,
      onStageError,
      onTryCommit,
      segment,
      split
    } = args

    const unsub = convex.onUpdate(
      options.query,
      {
        paginationOpts: {
          cursor: segment.cursor,
          ...(segment.endCursor !== null ? { endCursor: segment.endCursor } : {}),
          id: split.activeId,
          numItems: options.pageSize
        }
      },
      (rawResult) => {
        if (isDisposed || paginationId.value !== split.activeId)
          return
        if (split.committed) {
          onCommittedResult(segment, rawResult)
          return
        }
        if (!isCurrentSplit())
          return

        const segIndex = split.segments.indexOf(segment)
        if (segIndex === -1)
          return

        const segPayload = options.extractPage(rawResult as TRawResult)
        if (!segPayload)
          return

        const rightEnd = segment.endCursor ?? segPayload.continueCursor
        if (segPayload.pageStatus === 'SplitRequired' && canSplitRange(segment.cursor, rightEnd, segPayload)) {
          segment.unsubscribe?.()
          const subLeft: StagedSegmentState<TItem> = {
            cursor: segment.cursor,
            endCursor: segPayload.splitCursor,
            key: nextPageKey++,
            payload: null,
            unsubscribe: null
          }
          const subRight: StagedSegmentState<TItem> = {
            cursor: segPayload.splitCursor,
            endCursor: rightEnd,
            key: nextPageKey++,
            payload: null,
            unsubscribe: null
          }
          split.segments.splice(segIndex, 1, subLeft, subRight)

          subscribeStagedSegment({ ...args, segment: subLeft })
          if (isCurrentSplit() || split.committed)
            subscribeStagedSegment({ ...args, segment: subRight })
          return
        }

        segment.payload = segPayload
        onTryCommit()
      },
      (err) => {
        if (isDisposed || paginationId.value !== split.activeId)
          return
        if (split.committed) {
          onCommittedError(segment, err)
          return
        }
        if (!isCurrentSplit())
          return
        onStageError(err)
      }
    )

    segment.unsubscribe = unsub
    if (split.committed) {
      if (segment.cursor === null) {
        if (firstPageOverride.value?.key === segment.key && !isDisposed) {
          firstPageOverride.value = {
            ...firstPageOverride.value,
            unsubscribe: unsub
          }
        } else {
          unsub()
        }
      } else {
        attachUnsubscribeToExtraPage(segment.key, unsub)
      }
    } else if (!isCurrentSplit() || !split.segments.includes(segment) || isDisposed) {
      unsub()
    }
  }

  function tryCommitExtraSplit(parentKey: number, splitState: OngoingSplit<TItem>) {
    if (splitState.committed || splitState.segments.some(seg => seg.payload === null))
      return

    const parentIndex = extraPages.value.findIndex(entry => entry.key === parentKey)
    if (isDisposed || paginationId.value !== splitState.activeId || parentIndex === -1) {
      cancelOngoingExtraSplit(parentKey)
      return
    }

    splitState.committed = true
    removeOngoingExtraSplit(parentKey)

    const parent = extraPages.value[parentIndex]!
    parent.unsubscribe?.()

    const committedPages = splitState.segments.map(toExtraPageState)
    const nextPages = [...extraPages.value]
    nextPages.splice(parentIndex, 1, ...committedPages)
    extraPages.value = nextPages

    for (const seg of splitState.segments) {
      if (seg.payload && shouldSplitPage(seg.payload))
        startExtraPageSplit(seg.key, seg.payload)
    }
  }

  function startExtraPageSplit(
    parentKey: number,
    payload: LivePaginationPagePayload<TItem> & { splitCursor: string }
  ) {
    const convex = getConvexClient()
    if (!convex || ongoingExtraSplits.value.has(parentKey))
      return

    const parent = extraPages.value.find(entry => entry.key === parentKey)
    if (!parent)
      return

    const rightEndCursor = parent.endCursor
      ?? (payload.pageStatus === 'SplitRequired'
        ? (parent.continueCursor ?? payload.continueCursor)
        : payload.continueCursor)
    if (!canSplitRange(parent.cursor, rightEndCursor, payload))
      return

    const activeId = paginationId.value
    const leftSegment: StagedSegmentState<TItem> = {
      cursor: parent.cursor,
      endCursor: payload.splitCursor,
      key: nextPageKey++,
      payload: null,
      unsubscribe: null
    }
    const rightSegment: StagedSegmentState<TItem> = {
      cursor: payload.splitCursor,
      endCursor: rightEndCursor,
      key: nextPageKey++,
      payload: null,
      unsubscribe: null
    }
    const splitState: OngoingSplit<TItem> = {
      activeId,
      committed: false,
      segments: [leftSegment, rightSegment]
    }

    const nextSplits = new Map(ongoingExtraSplits.value)
    nextSplits.set(parentKey, splitState)
    ongoingExtraSplits.value = nextSplits

    const commonArgs = {
      convex,
      isCurrentSplit: () => ongoingExtraSplits.value.get(parentKey) === splitState,
      onCommittedError: (segment: StagedSegmentState<TItem>, err: unknown) => {
        applyExtraPageError(segment.key, activeId, err)
      },
      onCommittedResult: (segment: StagedSegmentState<TItem>, rawResult: unknown) => {
        applyExtraPageUpdate(segment.key, activeId, rawResult)
      },
      onStageError: (err: unknown) => {
        cancelOngoingExtraSplit(parentKey)
        applyExtraPageError(parentKey, activeId, err)
      },
      onTryCommit: () => {
        tryCommitExtraSplit(parentKey, splitState)
      },
      split: splitState
    }

    subscribeStagedSegment({ ...commonArgs, segment: leftSegment })
    if (commonArgs.isCurrentSplit() || splitState.committed)
      subscribeStagedSegment({ ...commonArgs, segment: rightSegment })
  }

  function tryCommitFirstPageSplit(staged: OngoingSplit<TItem>) {
    if (staged.committed || staged.segments.some(seg => seg.payload === null))
      return

    if (isDisposed || paginationId.value !== staged.activeId || stagedFirstPageSplit.value !== staged) {
      unsubscribeSplitSegments(staged)
      if (stagedFirstPageSplit.value === staged)
        stagedFirstPageSplit.value = null
      return
    }

    const [firstSegment, ...tailSegments] = staged.segments
    if (!firstSegment || !firstSegment.payload || firstSegment.endCursor === null) {
      clearStagedFirstPageSplit()
      return
    }

    staged.committed = true
    stagedFirstPageSplit.value = null

    const replacedRawData = state.data.value
    clearFirstPageOverride()
    firstPageOverride.value = {
      activeId: staged.activeId,
      key: firstSegment.key,
      payload: firstSegment.payload,
      replacedRawData,
      unsubscribe: firstSegment.unsubscribe
    }
    if (firstSegment.payload.pageStatus !== 'SplitRequired')
      lastCompleteFirstPage.value = firstSegment.payload

    const committedTailPages = tailSegments.map(toExtraPageState)
    extraPages.value = [...committedTailPages, ...extraPages.value]
    firstPageEndCursor.value = firstSegment.endCursor

    for (const seg of tailSegments) {
      if (seg.payload && shouldSplitPage(seg.payload))
        startExtraPageSplit(seg.key, seg.payload)
    }
  }

  function startFirstPageSplit(
    payload: LivePaginationPagePayload<TItem> & { splitCursor: string }
  ) {
    const convex = getConvexClient()
    if (!convex || stagedFirstPageSplit.value)
      return

    const rightEndCursor = firstPageEndCursor.value
      ?? (payload.pageStatus === 'SplitRequired'
        ? (lastCompleteFirstPage.value?.continueCursor ?? payload.continueCursor)
        : payload.continueCursor)
    if (payload.splitCursor === firstPageEndCursor.value || payload.splitCursor === rightEndCursor)
      return

    const activeId = paginationId.value
    const leftSegment: StagedSegmentState<TItem> = {
      cursor: null,
      endCursor: payload.splitCursor,
      key: nextPageKey++,
      payload: null,
      unsubscribe: null
    }
    const rightSegment: StagedSegmentState<TItem> = {
      cursor: payload.splitCursor,
      endCursor: rightEndCursor,
      key: nextPageKey++,
      payload: null,
      unsubscribe: null
    }
    const staged: OngoingSplit<TItem> = {
      activeId,
      committed: false,
      segments: [leftSegment, rightSegment]
    }
    stagedFirstPageSplit.value = staged
    firstPageSplitError.value = null

    const commonArgs = {
      convex,
      isCurrentSplit: () => stagedFirstPageSplit.value === staged,
      onCommittedError: (segment: StagedSegmentState<TItem>, err: unknown) => {
        if (segment.cursor === null) {
          if (firstPageOverride.value?.key === segment.key) {
            clearFirstPageOverride()
            firstPageSplitError.value = normalizeError(err)
          }
          return
        }
        applyExtraPageError(segment.key, activeId, err)
      },
      onCommittedResult: (segment: StagedSegmentState<TItem>, rawResult: unknown) => {
        if (segment.cursor === null) {
          if (firstPageOverride.value?.key === segment.key) {
            const nextLeft = options.extractPage(rawResult as TRawResult)
            if (nextLeft && nextLeft.pageStatus !== 'SplitRequired') {
              firstPageOverride.value = {
                ...firstPageOverride.value,
                payload: nextLeft
              }
              lastCompleteFirstPage.value = nextLeft
            }
          }
          return
        }
        applyExtraPageUpdate(segment.key, activeId, rawResult)
      },
      onStageError: (err: unknown) => {
        clearStagedFirstPageSplit()
        firstPageSplitError.value = normalizeError(err)
      },
      onTryCommit: () => {
        tryCommitFirstPageSplit(staged)
      },
      split: staged
    }

    subscribeStagedSegment({ ...commonArgs, segment: leftSegment })
    if (commonArgs.isCurrentSplit() || staged.committed)
      subscribeStagedSegment({ ...commonArgs, segment: rightSegment })
  }

  const isFirstPageRequestPending = computed(() =>
    state.status.value === 'pending'
    || Boolean(state.pending?.value)
    || Boolean(state.isStale?.value)
  )

  const rawFirstPagePayload = computed(() =>
    options.extractPage(state.data.value as TRawResult | null)
  )

  const effectiveFirstPagePayload = computed(() => {
    if (firstPageOverride.value)
      return firstPageOverride.value.payload
    const raw = rawFirstPagePayload.value
    if (
      raw
      && raw.pageStatus === 'SplitRequired'
      && shouldSplitPage(raw)
      && lastCompleteFirstPage.value
    ) {
      return lastCompleteFirstPage.value
    }
    return raw
  })

  function registerScopedWatch(setupWatch: () => WatchStopHandle) {
    if (isDisposed)
      return
    const stop = ownerScope ? ownerScope.run(setupWatch) : setupWatch()
    if (stop)
      stopWatchers.push(stop)
  }

  if (!isDisposed) {
    registerScopedWatch(() =>
      watch(
        [
          () => state.data.value,
          () => state.error.value,
          () => isFirstPageRequestPending.value
        ],
        ([rawData, queryError, requestPending]) => {
          if (isDisposed)
            return

          const override = firstPageOverride.value
          if (override) {
            // Keep the staged left-half override active until useConvexQuery settles on the narrowed range.
            if (rawData === override.replacedRawData || requestPending)
              return
            clearFirstPageOverride()
          }

          const awaitingFresh = awaitingFreshFirstPage.value
          if (awaitingFresh) {
            if (queryError !== null) {
              awaitingFreshFirstPage.value = null
            } else if (!isEnabled.value || requestPending || rawData === awaitingFresh.replacedRawData) {
              return
            } else {
              awaitingFreshFirstPage.value = null
            }
          }

          if (requestPending)
            return

          const payload = rawFirstPagePayload.value
          if (!payload)
            return

          if (payload.pageStatus !== 'SplitRequired')
            lastCompleteFirstPage.value = payload

          if (shouldSplitPage(payload))
            startFirstPageSplit(payload)
        },
        { immediate: true }
      )
    )

    registerScopedWatch(() =>
      watch(isEnabled, (enabled) => {
        if (isDisposed)
          return
        if (!enabled) {
          clearExtraPages()
          awaitingFreshFirstPage.value = { replacedRawData: state.data.value }
          firstPageEndCursor.value = null
          paginationId.value += 1
        }
      })
    )
  }

  const initialized = computed(() => effectiveFirstPagePayload.value !== null)

  const items = computed<TItem[]>(() => {
    const merged: TItem[] = []
    const seen = new Set<TId>()
    const firstItems = effectiveFirstPagePayload.value?.items ?? []

    for (const item of firstItems) {
      const id = options.getItemId(item)
      if (!seen.has(id)) {
        seen.add(id)
        merged.push(item)
      }
    }

    for (const page of extraPages.value) {
      for (const item of page.items) {
        const id = options.getItemId(item)
        if (!seen.has(id)) {
          seen.add(id)
          merged.push(item)
        }
      }
    }

    return merged
  })

  const lastExtraPage = computed(() =>
    extraPages.value.length > 0 ? extraPages.value[extraPages.value.length - 1] ?? null : null
  )

  const isDone = computed(() => {
    if (lastExtraPage.value)
      return lastExtraPage.value.isDone
    return effectiveFirstPagePayload.value?.isDone ?? true
  })

  const continueCursor = computed(() => {
    if (lastExtraPage.value)
      return lastExtraPage.value.continueCursor
    return effectiveFirstPagePayload.value?.continueCursor ?? null
  })

  const extraPageError = computed<Error | null>(() => {
    for (const page of extraPages.value) {
      if (page.error)
        return page.error
    }
    return null
  })

  const error = computed<Error | null>(
    () => state.error.value ?? firstPageSplitError.value ?? extraPageError.value
  )

  const isTransitioningSplit = computed(
    () =>
      stagedFirstPageSplit.value !== null
      || firstPageOverride.value !== null
      || ongoingExtraSplits.value.size > 0
  )

  const isPending = computed(() => {
    if (!isEnabled.value)
      return false
    const firstPagePending = (isFirstPageRequestPending.value || awaitingFreshFirstPage.value !== null)
      && firstPageOverride.value === null
    return firstPagePending || extraPages.value.some(page => page.pending)
  })

  const canLoadMore = computed(
    () =>
      isEnabled.value
      && !isPending.value
      && !isTransitioningSplit.value
      && awaitingFreshFirstPage.value === null
      && !isFirstPageRequestPending.value
      && !isDone.value
      && continueCursor.value !== null
      && error.value === null
  )

  function loadMore() {
    if (isDisposed || import.meta.server || !canLoadMore.value || !continueCursor.value)
      return

    const nextCursor = continueCursor.value
    if (extraPages.value.length === 0) {
      firstPageEndCursor.value = nextCursor
    } else {
      const previousIndex = extraPages.value.length - 1
      const previousPage = extraPages.value[previousIndex]
      if (previousPage && previousPage.endCursor !== nextCursor) {
        const nextPages = [...extraPages.value]
        nextPages[previousIndex] = { ...previousPage, endCursor: nextCursor }
        extraPages.value = nextPages
        subscribeExtraPage(previousIndex)
      }
    }

    const newIndex = extraPages.value.length
    extraPages.value = [
      ...extraPages.value,
      {
        continueCursor: null,
        cursor: nextCursor,
        endCursor: null,
        error: null,
        isDone: false,
        items: [],
        key: nextPageKey++,
        pending: true,
        unsubscribe: null
      }
    ]
    subscribeExtraPage(newIndex)
  }

  function refresh() {
    if (isDisposed)
      return
    clearExtraPages()
    if (isEnabled.value)
      awaitingFreshFirstPage.value = { replacedRawData: state.data.value }
    firstPageEndCursor.value = null
    paginationId.value += 1
  }

  function retryFailedPages() {
    if (isDisposed)
      return

    if (state.status.value === 'error' || state.error.value) {
      refresh()
      return
    }

    if (firstPageSplitError.value) {
      const splitErr = firstPageSplitError.value
      firstPageSplitError.value = null
      if (isConvexInvalidCursorError(splitErr)) {
        refresh()
        return
      }
      const payload = rawFirstPagePayload.value
      if (payload && shouldSplitPage(payload)) {
        startFirstPageSplit(payload)
        return
      }
      refresh()
      return
    }

    const failedIndices = extraPages.value
      .map((page, index) => (page.error ? index : -1))
      .filter(index => index >= 0)

    const hasInvalidCursor = extraPages.value.some(
      page => isConvexInvalidCursorError(page.error)
    )

    if (failedIndices.length === 0 || hasInvalidCursor) {
      refresh()
      return
    }

    const nextPages = [...extraPages.value]
    for (const idx of failedIndices) {
      const page = nextPages[idx]
      if (page) {
        cancelOngoingExtraSplit(page.key)
        nextPages[idx] = { ...page, error: null, pending: true }
      }
    }
    extraPages.value = nextPages

    for (const idx of failedIndices)
      subscribeExtraPage(idx)
  }

  return {
    canLoadMore,
    error,
    initialized,
    isDone,
    isPending,
    items,
    loadMore,
    refresh,
    retryFailedPages,
    state
  }
}
