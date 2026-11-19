import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

import { useLiveConvexPagination } from '~/composables/useLiveConvexPagination'

/** Recent homepage teasers (Convex reactive query). */
export async function usePublicCommunityUpdates() {
  const state = await useConvexQuery(
    api.communityUpdates.listCommunityUpdatePreviewsPublic,
    {},
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

/** Public community updates timeline (cursor-paginated for infinite scroll). */
export async function usePaginatedPublicCommunityUpdates(pageSize = 12) {
  const { rows: updates, ...pagination } = await useLiveConvexPagination(
    api.communityUpdates.paginateCommunityUpdatesPublic,
    {
      auth: 'none',
      pageSize,
      selectPage: ({ data }) => ({
        continueCursor: data.continueCursor,
        isDone: data.isDone,
        rows: data.updates
      })
    }
  )

  return { ...pagination, updates }
}
