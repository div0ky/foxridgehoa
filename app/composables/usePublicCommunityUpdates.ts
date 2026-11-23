import { computed } from 'vue'
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

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const merged: T[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      merged.push(item)
    }
  }
  return merged
}

/** Public community updates timeline backed by `useConvexPaginatedQuery`. */
export async function usePaginatedPublicCommunityUpdates(pageSize = 12) {
  const paginated = await useConvexPaginatedQuery(
    api.communityUpdates.paginateCommunityUpdatesPublic,
    {},
    {
      auth: 'none',
      initialNumItems: pageSize,
      keepPreviousData: true,
      transform: deduplicateById
    }
  )

  const initialized = computed(
    () =>
      paginated.status.value !== 'idle'
      && (paginated.status.value !== 'loading-first-page' || paginated.results.value.length > 0)
  )
  const isDone = computed(() => paginated.status.value === 'exhausted')

  function loadMore() {
    if (paginated.hasNextPage.value)
      paginated.loadMore(pageSize)
  }

  function refresh() {
    void paginated.reset()
  }

  return {
    canLoadMore: paginated.hasNextPage,
    error: paginated.error,
    initialized,
    isDone,
    isPending: paginated.isLoading,
    loadMore,
    refresh,
    status: paginated.status,
    updates: paginated.results
  }
}
