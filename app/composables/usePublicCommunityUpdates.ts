import type { ConvexClient } from 'convex/browser'

import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { api } from '~~/convex/_generated/api'

/** Public community updates feed (Convex reactive query). */
export async function usePublicCommunityUpdates(limit = 50) {
  const state = await useConvexQuery(
    api.communityUpdates.listCommunityUpdatesPublic,
    () => ({ limit }),
    { auth: 'none' }
  )

  const updates = computed(() => state.data.value?.data.updates ?? [])
  const isPending = computed(() => state.status.value === 'pending')

  return {
    isPending,
    state,
    updates
  }
}

/** Public community updates timeline (live-subscribed cursor pages with sealed endCursor ranges). */
export async function usePaginatedPublicCommunityUpdates(pageSize = 12) {
  const nuxtApp = useNuxtApp()
  const paginationId = ref(0)
  const firstPageEndCursor = ref<null | string>(null)

  type PublicUpdateItem = {
    authorDisplayName: string
    bodyMarkdown: string
    createdAt: number
    id: string
    imageUrls: string[]
    postedAt: number
  }
  interface ExtraUpdatePage {
    continueCursor: null | string
    cursor: string
    endCursor: null | string
    error: Error | null
    isDone: boolean
    items: PublicUpdateItem[]
    pending: boolean
    unsubscribe: (() => void) | null
  }

  const extraPages = shallowRef<ExtraUpdatePage[]>([])

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
    api.communityUpdates.paginateCommunityUpdatesPublic,
    () => ({
      paginationOpts: {
        cursor: null,
        ...(firstPageEndCursor.value !== null ? { endCursor: firstPageEndCursor.value } : {}),
        id: paginationId.value,
        numItems: pageSize
      }
    }),
    { auth: 'none', keepPreviousData: true }
  )

  function subscribeExtraPage(pageIndex: number) {
    if (!import.meta.client)
      return

    const convex = nuxtApp.$convex as ConvexClient | undefined
    const page = extraPages.value[pageIndex]
    if (!convex || !page)
      return

    page.unsubscribe?.()
    const activeId = paginationId.value
    const unsubscribe = convex.onUpdate(
      api.communityUpdates.paginateCommunityUpdatesPublic,
      {
        paginationOpts: {
          cursor: page.cursor,
          ...(page.endCursor !== null ? { endCursor: page.endCursor } : {}),
          id: activeId,
          numItems: pageSize
        }
      },
      (result) => {
        if (paginationId.value !== activeId)
          return
        const nextPages = [...extraPages.value]
        const target = nextPages[pageIndex]
        if (!target)
          return
        nextPages[pageIndex] = {
          ...target,
          continueCursor: result.data.continueCursor ?? null,
          error: null,
          isDone: result.data.isDone,
          items: result.data.updates,
          pending: false
        }
        extraPages.value = nextPages
      },
      (err) => {
        if (paginationId.value !== activeId)
          return
        const nextPages = [...extraPages.value]
        const target = nextPages[pageIndex]
        if (!target)
          return
        nextPages[pageIndex] = {
          ...target,
          error: err instanceof Error ? err : new Error(String(err)),
          pending: false
        }
        extraPages.value = nextPages
      }
    )

    const nextPages = [...extraPages.value]
    const target = nextPages[pageIndex]
    if (target) {
      nextPages[pageIndex] = { ...target, unsubscribe }
      extraPages.value = nextPages
    } else {
      unsubscribe()
    }
  }

  const firstPageItems = computed(() => state.data.value?.data.updates ?? [])
  const initialized = computed(() => Boolean(state.data.value?.ok))

  const updates = computed<PublicUpdateItem[]>(() => {
    const merged: PublicUpdateItem[] = []
    const seen = new Set<string>()
    for (const item of firstPageItems.value) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
    for (const page of extraPages.value) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
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
    return state.data.value?.data.isDone ?? true
  })

  const continueCursor = computed(() => {
    if (lastExtraPage.value)
      return lastExtraPage.value.continueCursor
    return state.data.value?.data.continueCursor ?? null
  })

  const extraPageError = computed<Error | null>(() => {
    for (const page of extraPages.value) {
      if (page.error)
        return page.error
    }
    return null
  })

  const error = computed<Error | null>(() => state.error.value ?? extraPageError.value)
  const isPending = computed(
    () => state.status.value === 'pending' || extraPages.value.some(page => page.pending)
  )
  const canLoadMore = computed(
    () => !isPending.value && !isDone.value && continueCursor.value !== null && error.value === null
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

  return {
    canLoadMore,
    error,
    initialized,
    isDone,
    isPending,
    loadMore,
    refresh,
    state,
    updates
  }
}
