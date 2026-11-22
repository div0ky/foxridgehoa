import type { ConvexClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import type { MaybeRefOrGetter } from 'vue'

import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'

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

/**
 * Shared reactive cursor pagination for `{ ok, data }` Convex queries.
 * Keeps every loaded range subscribed with sealed `endCursor` boundaries,
 * handles Convex `splitCursor` splits, resets cleanly on `InvalidCursor`,
 * and registers disposal synchronously before awaiting the first page.
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
  let nextPageKey = 1
  const paginationId = ref(0)
  const firstPageEndCursor = ref<null | string>(null)
  const extraPages = shallowRef<ExtraPageState<TItem>[]>([])
  const isEnabled = computed(() => (options.enabled === undefined ? true : Boolean(toValue(options.enabled))))

  function clearExtraPages() {
    for (const page of extraPages.value)
      page.unsubscribe?.()
    extraPages.value = []
  }

  // Register cleanup synchronously before awaiting so Vue binds it to the active effect scope.
  onScopeDispose(() => {
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

  function subscribeExtraPage(pageIndex: number) {
    if (!import.meta.client || !isEnabled.value)
      return

    const convex = nuxtApp.$convex as ConvexClient | undefined
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
        if (paginationId.value !== activeId)
          return
        const payload = options.extractPage(rawResult as TRawResult)
        if (!payload)
          return

        const targetIndex = extraPages.value.findIndex(entry => entry.key === pageKey)
        if (targetIndex === -1)
          return

        const target = extraPages.value[targetIndex]!
        if (
          shouldSplitPage(payload)
          && payload.splitCursor !== target.cursor
          && payload.splitCursor !== target.endCursor
        ) {
          splitExtraPage(targetIndex, payload.splitCursor)
          return
        }

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
      },
      (err) => {
        if (paginationId.value !== activeId)
          return
        const targetIndex = extraPages.value.findIndex(entry => entry.key === pageKey)
        if (targetIndex === -1)
          return

        const nextPages = [...extraPages.value]
        const target = nextPages[targetIndex]!
        nextPages[targetIndex] = {
          ...target,
          error: err instanceof Error ? err : new Error(String(err)),
          pending: false
        }
        extraPages.value = nextPages
      }
    )

    const currentIndex = extraPages.value.findIndex(entry => entry.key === pageKey)
    if (currentIndex !== -1) {
      const nextPages = [...extraPages.value]
      nextPages[currentIndex] = { ...nextPages[currentIndex]!, unsubscribe }
      extraPages.value = nextPages
    } else {
      unsubscribe()
    }
  }

  function splitExtraPage(pageIndex: number, splitCursor: string) {
    const target = extraPages.value[pageIndex]
    if (!target)
      return

    target.unsubscribe?.()
    const firstHalf: ExtraPageState<TItem> = {
      continueCursor: splitCursor,
      cursor: target.cursor,
      endCursor: splitCursor,
      error: null,
      isDone: false,
      items: target.items,
      key: nextPageKey++,
      pending: true,
      unsubscribe: null
    }
    const secondHalf: ExtraPageState<TItem> = {
      continueCursor: target.continueCursor,
      cursor: splitCursor,
      endCursor: target.endCursor,
      error: null,
      isDone: target.isDone,
      items: [],
      key: nextPageKey++,
      pending: true,
      unsubscribe: null
    }

    const nextPages = [...extraPages.value]
    nextPages.splice(pageIndex, 1, firstHalf, secondHalf)
    extraPages.value = nextPages

    subscribeExtraPage(pageIndex)
    subscribeExtraPage(pageIndex + 1)
  }

  const firstPagePayload = computed(() =>
    options.extractPage(state.data.value as TRawResult | null)
  )

  watch(firstPagePayload, (payload) => {
    if (!import.meta.client || !payload || !shouldSplitPage(payload))
      return
    if (payload.splitCursor === firstPageEndCursor.value)
      return

    const previousEndCursor = firstPageEndCursor.value
    firstPageEndCursor.value = payload.splitCursor

    const secondHalf: ExtraPageState<TItem> = {
      continueCursor: payload.continueCursor,
      cursor: payload.splitCursor,
      endCursor: previousEndCursor,
      error: null,
      isDone: previousEndCursor === null ? payload.isDone : false,
      items: [],
      key: nextPageKey++,
      pending: true,
      unsubscribe: null
    }

    extraPages.value = [secondHalf, ...extraPages.value]
    subscribeExtraPage(0)
  }, { immediate: true })

  watch(isEnabled, (enabled) => {
    if (!enabled) {
      clearExtraPages()
      firstPageEndCursor.value = null
      paginationId.value += 1
    }
  })

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

  const error = computed<Error | null>(() => state.error.value ?? extraPageError.value)

  const isPending = computed(() => {
    if (!isEnabled.value)
      return false
    return state.status.value === 'pending' || extraPages.value.some(page => page.pending)
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
    if (!import.meta.client || !canLoadMore.value || !continueCursor.value)
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
    clearExtraPages()
    firstPageEndCursor.value = null
    paginationId.value += 1
  }

  function retryFailedPages() {
    if (state.status.value === 'error' || state.error.value) {
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
      if (page)
        nextPages[idx] = { ...page, error: null, pending: true }
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
