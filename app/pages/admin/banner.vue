<script setup lang="ts">
import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

import { useLiveSettingsQuery } from '~/composables/useLiveSettingsQuery'
import { useServerDraft } from '~/composables/useServerDraft'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminSiteBannerPage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const profileFailed = computed(() => profileState.status.value === 'error')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const adminBannerState = useLiveSettingsQuery(
  api.siteBanner.getAdminSiteBanner,
  () => isBoardMember.value ? {} : null
)

const serverBanner = computed(() => adminBannerState.data.value?.data.banner ?? null)
const bannerFailed = computed(() => adminBannerState.status.value === 'error')

function formatForDatetimeLocal(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultShowUntilLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  return formatForDatetimeLocal(d.getTime())
}

const initialFields = { body: '', showUntil: defaultShowUntilLocal() }
const latest = computed(() => {
  if (!isBoardMember.value || adminBannerState.status.value !== 'success' || !adminBannerState.data.value?.ok)
    return

  const banner = serverBanner.value
  return {
    fields: banner ? { body: banner.body, showUntil: formatForDatetimeLocal(banner.showUntil) } : initialFields,
    id: banner?.id,
    updatedAt: banner?.updatedAt ?? null
  }
})
const { canLoadLatest, canWrite, draft, hasConflict, hasDraft, isReady, isWriting, loadLatest, write }
  = useServerDraft(initialFields, latest, adminBannerState.refresh)

const setBanner = useConvexMutation(api.siteBanner.setSiteBanner)
const clearBanner = useConvexMutation(api.siteBanner.clearSiteBanner)

const saving = setBanner.pending
const clearing = clearBanner.pending

async function submitSave() {
  if (!canWrite.value)
    return

  const trimmed = draft.value.body.trim()
  if (!trimmed) {
    toast.add({
      color: 'error',
      description: 'Enter banner text.',
      title: 'Validation'
    })
    return
  }

  const showUntil = new Date(draft.value.showUntil).getTime()
  if (!Number.isFinite(showUntil)) {
    toast.add({
      color: 'error',
      description: 'Choose a valid show-until date and time.',
      title: 'Validation'
    })
    return
  }

  try {
    const expectedBannerId = serverBanner.value?.id
    const saved = await write(expectedUpdatedAt => setBanner({
      body: trimmed,
      expectedBannerId,
      expectedUpdatedAt,
      showUntil
    }))
    if (!saved)
      return

    toast.add({
      color: 'success',
      description: 'The site banner is updated.',
      title: 'Saved'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed.'
    toast.add({
      color: 'error',
      description: message,
      title: 'Could not save'
    })
  }
}

async function submitClear() {
  const expectedBannerId = serverBanner.value?.id
  if (!canWrite.value || !expectedBannerId)
    return

  try {
    const cleared = await write(expectedUpdatedAt => clearBanner({ expectedBannerId, expectedUpdatedAt }))
    if (!cleared)
      return

    toast.add({
      color: 'success',
      description: 'The site banner was removed.',
      title: 'Cleared'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clear failed.'
    toast.add({
      color: 'error',
      description: message,
      title: 'Could not clear'
    })
  }
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-xl space-y-6">
    <UAlert
      v-if="profileFailed"
      color="error"
      variant="soft"
      title="Could not load your board profile"
      :actions="[{ label: 'Reload page', onClick: () => reloadNuxtApp() }]"
    />
    <UAlert
      v-else-if="!loadingProfile && !isBoardMember"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members can manage the site banner."
      icon="i-lucide-lock"
    />

    <UCard v-if="loadingProfile || isBoardMember">
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            Site banner
          </h1>
          <p class="mt-1 text-sm text-muted">
            Show an announcement at the top of the public site until a date and time you choose (your local timezone). Expired banners are removed automatically (at least once per day).
          </p>
        </div>
      </template>

      <UAlert
        v-if="bannerFailed"
        class="mb-5"
        color="error"
        variant="soft"
        title="Could not load the site banner"
        :actions="[{ label: 'Retry', disabled: isWriting, onClick: () => adminBannerState.refresh() }]"
      />
      <div
        v-else-if="!isReady"
        aria-live="polite"
        class="text-sm text-muted"
        role="status"
      >
        Loading…
      </div>

      <form
        v-if="hasDraft"
        class="space-y-5"
        novalidate
        @submit.prevent="submitSave"
      >
        <UAlert
          v-if="hasConflict && !isWriting"
          role="status"
          color="warning"
          variant="soft"
          title="The site banner changed"
          description="Load the latest version to replace your draft before saving or clearing the banner."
          :actions="[{ label: 'Load latest', disabled: !canLoadLatest, onClick: loadLatest }]"
        />
        <UFormField
          label="Message"
          name="banner-body"
          required
        >
          <UTextarea
            id="banner-body"
            v-model="draft.body"
            :disabled="!isReady || isWriting"
            :rows="4"
            class="w-full"
            autoresize
            maxlength="2000"
            placeholder="Pool closed for maintenance this weekend…"
          />
        </UFormField>

        <UFormField
          label="Show until"
          name="banner-until"
          required
        >
          <UInput
            id="banner-until"
            v-model="draft.showUntil"
            :disabled="!isReady || isWriting"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>

        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <UButton
            color="primary"
            class="w-full sm:w-auto"
            :disabled="!canWrite"
            :loading="saving"
            type="submit"
          >
            Save banner
          </UButton>
          <UButton
            color="neutral"
            class="w-full sm:w-auto"
            :disabled="!serverBanner || !canWrite"
            :loading="clearing"
            type="button"
            variant="outline"
            @click="submitClear"
          >
            Clear banner
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
