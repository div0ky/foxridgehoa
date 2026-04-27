import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

/** Public landing-page documents (Convex reactive query). */
export async function useImportantDocuments() {
  const state = await useConvexQuery(api.importantDocuments.listImportantDocumentsPublic, {})

  const documents = computed(() => state.data.value?.data.documents ?? [])
  const isPending = computed(() => state.status.value === 'pending')

  return {
    documents,
    isPending,
    state
  }
}
