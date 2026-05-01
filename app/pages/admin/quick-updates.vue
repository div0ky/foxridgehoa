<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminQuickUpdatesPage' })

const toast = useToast()

const authState = await useConvexQuery(api.auth.getCurrentUser, {})
const convexUser = computed(() => authState.data.value?.user ?? null)
const loadingAuthUser = computed(() => authState.status.value === 'pending')
const displayNameConfigured = computed(() => {
  const u = convexUser.value
  if (!u || typeof u !== 'object' || !('name' in u))
    return false
  const n = (u as { name?: string }).name
  return typeof n === 'string' && n.trim().length > 0
})

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const adminListState = await useConvexQuery(
  api.communityUpdates.listCommunityUpdatesAdmin,
  {},
  { enabled: computed(() => isBoardMember.value) }
)

const updates = computed(() => adminListState.data.value?.data.updates ?? [])

const loadingList = computed(() => {
  if (!isBoardMember.value)
    return false
  return adminListState.status.value === 'pending'
})

const deleteUpdate = useConvexMutation(api.communityUpdates.deleteCommunityUpdate)

const composerPendingAuth = computed(() => loadingProfile.value || loadingAuthUser.value)

const deletingId = ref<Id<'communityUpdates'> | null>(null)

async function submitDelete(id: Id<'communityUpdates'>) {
  if (!window.confirm('Delete this community update?'))
    return

  deletingId.value = id
  try {
    await deleteUpdate.execute({ updateId: id })
    toast.add({
      color: 'success',
      description: 'The update was removed.',
      title: 'Deleted'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed.'
    toast.add({
      color: 'error',
      description: message,
      title: 'Could not delete'
    })
  } finally {
    deletingId.value = null
  }
}

function previewSnippet(text: string, max = 160) {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-3xl space-y-10">
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members can publish community updates."
      icon="i-lucide-lock"
    />

    <UCard v-if="loadingProfile || isBoardMember">
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            Community updates
          </h1>
          <p class="mt-1 text-sm text-muted">
            Compose in Markdown with up to three images. Your display name must be set on your account.
          </p>
        </div>
      </template>

      <CommunityUpdateComposer
        class="mt-6"
        :pending-auth="composerPendingAuth"
        :can-publish="!loadingProfile && isBoardMember && !loadingAuthUser && displayNameConfigured"
        :needs-display-name="!loadingProfile && isBoardMember && !loadingAuthUser && !displayNameConfigured"
      />
    </UCard>

    <UCard v-if="loadingProfile || isBoardMember">
      <template #header>
        <h2 class="font-semibold text-highlighted">
          Published updates
        </h2>
      </template>

      <div
        v-if="loadingList && updates.length === 0"
        aria-live="polite"
        class="text-sm text-muted"
        role="status"
      >
        Loading…
      </div>

      <ul
        v-else-if="updates.length > 0"
        class="divide-y divide-default"
      >
        <li
          v-for="u in updates"
          :key="u.id"
          class="flex flex-col gap-2 py-4 first:pt-0"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="break-words font-medium text-highlighted">
                {{ u.authorDisplayName }}
              </p>
              <div class="mt-1 text-xs text-muted">
                <span class="block sm:inline">Posted {{ new Date(u.postedAt).toLocaleString() }}</span>
                <span class="hidden sm:inline"> · </span>
                <span class="block sm:inline">Created {{ new Date(u.createdAt).toLocaleString() }}</span>
                <span class="hidden sm:inline"> · </span>
                <span class="block sm:inline">{{ u.images.length }} image(s)</span>
              </div>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <UButton
                color="neutral"
                class="w-full sm:w-auto"
                size="sm"
                variant="outline"
                :to="`/updates/${u.id}`"
                external
                target="_blank"
              >
                View
              </UButton>
              <UButton
                color="error"
                class="w-full sm:w-auto"
                size="sm"
                variant="soft"
                :loading="deletingId === u.id"
                @click="submitDelete(u.id)"
              >
                Delete
              </UButton>
            </div>
          </div>
          <p class="text-sm text-muted">
            {{ previewSnippet(u.bodyMarkdown) }}
          </p>
        </li>
      </ul>

      <div
        v-else
        class="flex gap-4 rounded-xl border border-dashed border-default px-4 py-5"
      >
        <Icon
          class="size-10 shrink-0 text-muted"
          name="lucide:inbox"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <p class="font-medium text-highlighted">
            Nothing published yet
          </p>
          <p class="mt-1 text-sm text-muted">
            Compose your first announcement above with Markdown (and up to three images). Residents will see it under Updates once you publish.
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
