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

interface PublicUpdateItem {
  authorDisplayName: string
  bodyMarkdown: string
  createdAt: number
  id: string
  imageUrls: string[]
  postedAt: number
}

interface PaginatedUpdatesResponse {
  data: {
    continueCursor: null | string
    isDone: boolean
    pageStatus?: 'SplitRecommended' | 'SplitRequired' | null
    splitCursor?: null | string
    updates: PublicUpdateItem[]
  }
  ok: true
}

/** Public community updates timeline (live-subscribed cursor pages with sealed endCursor ranges). */
export async function usePaginatedPublicCommunityUpdates(pageSize = 12) {
  const pagination = await useLiveConvexPagination<PaginatedUpdatesResponse, PublicUpdateItem>({
    auth: 'none',
    extractPage: (raw) => {
      if (!raw?.ok)
        return null
      return {
        continueCursor: raw.data.continueCursor ?? null,
        isDone: raw.data.isDone,
        items: raw.data.updates,
        pageStatus: raw.data.pageStatus,
        splitCursor: raw.data.splitCursor
      }
    },
    getItemId: item => item.id,
    pageSize,
    query: api.communityUpdates.paginateCommunityUpdatesPublic
  })

  return {
    canLoadMore: pagination.canLoadMore,
    error: pagination.error,
    initialized: pagination.initialized,
    isDone: pagination.isDone,
    isPending: pagination.isPending,
    loadMore: pagination.loadMore,
    refresh: pagination.refresh,
    retryFailedPages: pagination.retryFailedPages,
    state: pagination.state,
    updates: pagination.items
  }
}
