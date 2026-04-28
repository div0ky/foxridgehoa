import { computed, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

/** Public community updates feed (Convex reactive query). */
export async function usePublicCommunityUpdates(limit = 50) {
  const state = await useConvexQuery(
    api.communityUpdates.listCommunityUpdatesPublic,
    () => ({ limit })
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
  const paginationOpts = ref<{ cursor: null | string, numItems: number }>({
    cursor: null,
    numItems: pageSize
  })

  const state = await useConvexQuery(
    api.communityUpdates.paginateCommunityUpdatesPublic,
    () => ({ paginationOpts: paginationOpts.value })
  )

  const pageUpdates = computed(() => state.data.value?.data.updates ?? [])
  const isDone = computed(() => state.data.value?.data.isDone ?? true)
  const continueCursor = computed(() => state.data.value?.data.continueCursor ?? null)
  const updates = ref<typeof pageUpdates.value>([])
  const initialized = ref(false)

  watch(
    () =>
      ({
        cursor: paginationOpts.value.cursor,
        loading: state.status.value === 'pending',
        page: pageUpdates.value
      }) as const,
    ({ cursor, loading, page }) => {
      if (loading || !state.data.value?.ok)
        return

      if (cursor === null) {
        updates.value = page
        initialized.value = true
        return
      }

      const seenUpdateIds = new Set(updates.value.map(update => update.id))
      updates.value = [
        ...updates.value,
        ...page.filter(update => !seenUpdateIds.has(update.id))
      ]
    },
    { deep: true, immediate: true }
  )

  const isPending = computed(() => state.status.value === 'pending')
  const canLoadMore = computed(() => !isPending.value && !isDone.value && continueCursor.value !== null)

  function loadMore() {
    if (!canLoadMore.value || !continueCursor.value)
      return

    paginationOpts.value = {
      cursor: continueCursor.value,
      numItems: pageSize
    }
  }

  function refresh() {
    updates.value = []
    initialized.value = false
    paginationOpts.value = { cursor: null, numItems: pageSize }
  }

  return {
    canLoadMore,
    initialized,
    isDone,
    isPending,
    loadMore,
    refresh,
    state,
    updates
  }
}
