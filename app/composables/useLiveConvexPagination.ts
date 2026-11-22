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

interface StagedHalfState<TItem> {
  cursor: string
  endCursor: null | string
  key: number
  payload: LivePaginationPagePayload<TItem> | null
  unsubscribe: (() => void) | null
}

interface OngoingExtraSplit<TItem> {
  activeId: number
  committed: boolean
  left: StagedHalfState<TItem>
  right: StagedHalfState<TItem>
}

interface StagedFirstPageSplit {
  activeId: number
  committed: boolean
  endCursor: null | string
  key: number
  splitCursor: string
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

function normalizeError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}

/**
 * Shared reactive cursor pagination for `{ ok, data }` Convex queries.
 * Keeps loaded ranges subscribed with sealed `endCursor` boundaries,
 * stages Convex `splitCursor` splits atomically without dropping rows or
 * fetching past the loaded range, resets cleanly on `InvalidCursor`,
 * and binds all watchers and cleanup to the caller's effect scope before `await`.
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
  const ongoingExtraSplits = shallowRef<Map<number, OngoingExtraSplit<TItem>>>(new Map())
  const stagedFirstPageSplit = shallowRef<StagedFirstPageSplit | null>(null)
  const firstPageSplitError = ref<Error | null>(null)
  const isEnabled = computed(() => (options.enabled === undefined ? true : Boolean(toValue(options.enabled))))

  function clearStagedSplits() {
    stagedFirstPageSplit.value?.unsubscribe?.()
    stagedFirstPageSplit.value = null
    firstPageSplitError.value = null

    for (const split of ongoingExtraSplits.value.values()) {
      split.left.unsubscribe?.()
      split.right.unsubscribe?.()
    }
    if (ongoingExtraSplits.value.size > 0)
      ongoingExtraSplits.value = new Map()
  }

  function clearExtraPages() {
    clearStagedSplits()
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
    existing.left.unsubscribe?.()
    existing.right.unsubscribe?.()
    removeOngoingExtraSplit(parentKey)
  }

  function tryCommitExtraSplit(parentKey: number, splitState: OngoingExtraSplit<TItem>) {
    if (splitState.committed || !splitState.left.payload || !splitState.right.payload)
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

    const leftPayload = splitState.left.payload
    const rightPayload = splitState.right.payload

    const leftPage: ExtraPageState<TItem> = {
      continueCursor: leftPayload.continueCursor ?? null,
      cursor: splitState.left.cursor,
      endCursor: splitState.left.endCursor,
      error: null,
      isDone: leftPayload.isDone,
      items: leftPayload.items,
      key: splitState.left.key,
      pending: false,
      unsubscribe: splitState.left.unsubscribe
    }
    const rightPage: ExtraPageState<TItem> = {
      continueCursor: rightPayload.continueCursor ?? null,
      cursor: splitState.right.cursor,
      endCursor: splitState.right.endCursor,
      error: null,
      isDone: rightPayload.isDone,
      items: rightPayload.items,
      key: splitState.right.key,
      pending: false,
      unsubscribe: splitState.right.unsubscribe
    }

    const nextPages = [...extraPages.value]
    nextPages.splice(parentIndex, 1, leftPage, rightPage)
    extraPages.value = nextPages

    if (shouldSplitPage(leftPayload))
      startExtraPageSplit(leftPage.key, leftPayload)
    if (shouldSplitPage(rightPayload))
      startExtraPageSplit(rightPage.key, rightPayload)
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

    const rightEndCursor = parent.endCursor ?? payload.continueCursor
    if (payload.splitCursor === parent.cursor || payload.splitCursor === rightEndCursor)
      return

    const activeId = paginationId.value
    const splitState: OngoingExtraSplit<TItem> = {
      activeId,
      committed: false,
      left: {
        cursor: parent.cursor,
        endCursor: payload.splitCursor,
        key: nextPageKey++,
        payload: null,
        unsubscribe: null
      },
      right: {
        cursor: payload.splitCursor,
        endCursor: rightEndCursor,
        key: nextPageKey++,
        payload: null,
        unsubscribe: null
      }
    }

    const nextSplits = new Map(ongoingExtraSplits.value)
    nextSplits.set(parentKey, splitState)
    ongoingExtraSplits.value = nextSplits

    function subscribeHalf(half: StagedHalfState<TItem>) {
      const unsub = convex!.onUpdate(
        options.query,
        {
          paginationOpts: {
            cursor: half.cursor,
            ...(half.endCursor !== null ? { endCursor: half.endCursor } : {}),
            id: activeId,
            numItems: options.pageSize
          }
        },
        (rawResult) => {
          if (isDisposed || paginationId.value !== activeId)
            return
          if (splitState.committed) {
            applyExtraPageUpdate(half.key, activeId, rawResult)
            return
          }
          const halfPayload = options.extractPage(rawResult as TRawResult)
          if (!halfPayload)
            return
          half.payload = halfPayload
          tryCommitExtraSplit(parentKey, splitState)
        },
        (err) => {
          if (isDisposed || paginationId.value !== activeId)
            return
          if (splitState.committed) {
            applyExtraPageError(half.key, activeId, err)
            return
          }
          cancelOngoingExtraSplit(parentKey)
          applyExtraPageError(parentKey, activeId, err)
        }
      )

      half.unsubscribe = unsub
      if (splitState.committed) {
        attachUnsubscribeToExtraPage(half.key, unsub)
      } else if (ongoingExtraSplits.value.get(parentKey) !== splitState || isDisposed) {
        unsub()
      }
    }

    subscribeHalf(splitState.left)
    if (ongoingExtraSplits.value.get(parentKey) === splitState || splitState.committed)
      subscribeHalf(splitState.right)
  }

  function startFirstPageSplit(
    payload: LivePaginationPagePayload<TItem> & { splitCursor: string }
  ) {
    const convex = getConvexClient()
    if (!convex || stagedFirstPageSplit.value)
      return

    const rightEndCursor = firstPageEndCursor.value ?? payload.continueCursor
    if (payload.splitCursor === firstPageEndCursor.value || payload.splitCursor === rightEndCursor)
      return

    const activeId = paginationId.value
    const pageKey = nextPageKey++
    const staged: StagedFirstPageSplit = {
      activeId,
      committed: false,
      endCursor: rightEndCursor,
      key: pageKey,
      splitCursor: payload.splitCursor,
      unsubscribe: null
    }
    stagedFirstPageSplit.value = staged
    firstPageSplitError.value = null

    const unsub = convex.onUpdate(
      options.query,
      {
        paginationOpts: {
          cursor: staged.splitCursor,
          ...(staged.endCursor !== null ? { endCursor: staged.endCursor } : {}),
          id: activeId,
          numItems: options.pageSize
        }
      },
      (rawResult) => {
        if (isDisposed || paginationId.value !== activeId)
          return
        if (staged.committed) {
          applyExtraPageUpdate(pageKey, activeId, rawResult)
          return
        }
        const rightPayload = options.extractPage(rawResult as TRawResult)
        if (!rightPayload)
          return

        staged.committed = true
        if (stagedFirstPageSplit.value === staged)
          stagedFirstPageSplit.value = null

        const secondHalf: ExtraPageState<TItem> = {
          continueCursor: rightPayload.continueCursor ?? null,
          cursor: staged.splitCursor,
          endCursor: staged.endCursor,
          error: null,
          isDone: rightPayload.isDone,
          items: rightPayload.items,
          key: pageKey,
          pending: false,
          unsubscribe: staged.unsubscribe
        }

        extraPages.value = [secondHalf, ...extraPages.value]
        firstPageEndCursor.value = staged.splitCursor

        if (shouldSplitPage(rightPayload))
          startExtraPageSplit(pageKey, rightPayload)
      },
      (err) => {
        if (isDisposed || paginationId.value !== activeId)
          return
        if (staged.committed) {
          applyExtraPageError(pageKey, activeId, err)
          return
        }
        if (stagedFirstPageSplit.value === staged)
          stagedFirstPageSplit.value = null
        staged.unsubscribe?.()
        firstPageSplitError.value = normalizeError(err)
      }
    )

    staged.unsubscribe = unsub
    if (staged.committed) {
      attachUnsubscribeToExtraPage(pageKey, unsub)
    } else if (stagedFirstPageSplit.value !== staged || isDisposed) {
      unsub()
    }
  }

  const firstPagePayload = computed(() =>
    options.extractPage(state.data.value as TRawResult | null)
  )

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
        firstPagePayload,
        (payload) => {
          if (isDisposed || !payload || !shouldSplitPage(payload))
            return
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
          firstPageEndCursor.value = null
          paginationId.value += 1
        }
      })
    )
  }

  const initialized = computed(() => firstPagePayload.value !== null)

  const items = computed<TItem[]>(() => {
    const merged: TItem[] = []
    const seen = new Set<TId>()
    const firstItems = firstPagePayload.value?.items ?? []

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
    return firstPagePayload.value?.isDone ?? true
  })

  const continueCursor = computed(() => {
    if (lastExtraPage.value)
      return lastExtraPage.value.continueCursor
    return firstPagePayload.value?.continueCursor ?? null
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

  const isPending = computed(() => {
    if (!isEnabled.value)
      return false
    return (
      state.status.value === 'pending'
      || stagedFirstPageSplit.value !== null
      || ongoingExtraSplits.value.size > 0
      || extraPages.value.some(page => page.pending)
    )
  })

  const canLoadMore = computed(
    () =>
      isEnabled.value
      && !isPending.value
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
      const payload = firstPagePayload.value
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
