import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

export interface PublicSiteBanner {
  body: string
  showUntil: number
}

/** Public site alert banner (Convex reactive query). */
export async function useSiteBanner() {
  const state = await useConvexQuery(api.siteBanner.getPublicSiteBanner, {})

  const banner = computed((): PublicSiteBanner | null => {
    const raw = state.data.value?.data.banner
    if (!raw)
      return null
    return raw
  })

  const isPending = computed(() => state.status.value === 'pending')

  const isVisible = computed(() => {
    const b = banner.value
    if (!b)
      return false
    return b.showUntil > Date.now()
  })

  return {
    banner,
    isPending,
    isVisible,
    state
  }
}
