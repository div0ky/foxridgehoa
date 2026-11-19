import type { Ref } from 'vue'

import { computed, ref, shallowRef, watch } from 'vue'

export interface ServerDraftSnapshot<Fields extends object> {
  fields: Fields
  id?: string
  updatedAt: number | null
}

/** Draft fields are JSON values. An undefined snapshot means the query is unavailable. */
export function useServerDraft<Fields extends object>(
  initialFields: Fields,
  latest: Readonly<Ref<ServerDraftSnapshot<Fields> | undefined>>,
  refreshLatest?: () => Promise<void>
) {
  const draft = ref(initialFields) as Ref<Fields>
  const baseline = shallowRef<{ fields: string, id?: string, updatedAt: number | null }>()
  const isWriting = ref(false)
  const writeConflict = ref(false)
  const loadAfterWrite = ref(false)

  const hasDraft = computed(() => baseline.value !== undefined)
  const isReady = computed(() => hasDraft.value && latest.value !== undefined)
  const isDirty = computed(() => hasDraft.value && JSON.stringify(draft.value) !== baseline.value?.fields)
  const hasNewVersion = computed(() => {
    const snapshot = latest.value
    const base = baseline.value
    return !!snapshot && !!base && (snapshot.updatedAt !== base.updatedAt || snapshot.id !== base.id)
  })
  const hasConflict = computed(() => writeConflict.value || hasNewVersion.value)
  const canLoadLatest = computed(() =>
    isReady.value && !isWriting.value && (hasNewVersion.value || (writeConflict.value && !!refreshLatest))
  )
  const canWrite = computed(() => isReady.value && !isWriting.value && !hasConflict.value && !loadAfterWrite.value)

  function acceptSnapshot(snapshot: ServerDraftSnapshot<Fields>) {
    const fields = JSON.stringify(snapshot.fields)
    baseline.value = { fields, id: snapshot.id, updatedAt: snapshot.updatedAt }
    draft.value = JSON.parse(fields) as Fields
    writeConflict.value = false
    loadAfterWrite.value = false
  }

  async function loadLatest() {
    if (!canLoadLatest.value)
      return
    if (!hasNewVersion.value)
      await refreshLatest?.()
    if (canLoadLatest.value && latest.value)
      acceptSnapshot(latest.value)
  }

  function reset() {
    baseline.value = undefined
    writeConflict.value = false
    loadAfterWrite.value = false
  }

  watch([latest, isDirty, isWriting, loadAfterWrite], ([snapshot, dirty, writing, saved]) => {
    if (snapshot && !writing && (saved || (!dirty && !writeConflict.value)))
      acceptSnapshot(snapshot)
  }, { immediate: true })

  // EFFECT: Submit against the version that seeded the draft and adopt the server's saved values.
  async function write(save: (expectedUpdatedAt: number | null) => Promise<unknown>): Promise<boolean> {
    if (!canWrite.value || !baseline.value)
      return false

    isWriting.value = true
    try {
      await save(baseline.value.updatedAt)
      // Convex reflects successful writes in subscribed results before resolving the mutation.
      loadAfterWrite.value = true
      return true
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'STALE_SERVER_DRAFT') {
        writeConflict.value = true
        return false
      }
      throw error
    } finally {
      isWriting.value = false
    }
  }

  return { canLoadLatest, canWrite, draft, hasConflict, hasDraft, isDirty, isReady, isWriting, loadLatest, reset, write }
}
