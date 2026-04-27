<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminSiteBannerPage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const adminBannerState = await useConvexQuery(
  api.siteBanner.getAdminSiteBanner,
  {},
  { enabled: computed(() => isBoardMember.value) }
)

const serverBanner = computed(() => adminBannerState.data.value?.data.banner ?? null)
const loadingBanner = computed(() => {
  if (!isBoardMember.value)
    return false
  return adminBannerState.status.value === 'pending'
})

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

const body = ref('')
const showUntilInput = ref(defaultShowUntilLocal())

watch(
  () =>
    ({
      banner: serverBanner.value,
      loading: loadingBanner.value
    }) as const,
  ({ banner, loading }) => {
    if (loading)
      return

    body.value = banner?.body ?? ''
    showUntilInput.value = banner
      ? formatForDatetimeLocal(banner.showUntil)
      : defaultShowUntilLocal()
  },
  { immediate: true }
)

const setBanner = useConvexMutation(api.siteBanner.setSiteBanner)
const clearBanner = useConvexMutation(api.siteBanner.clearSiteBanner)

const saving = ref(false)
const clearing = ref(false)

async function submitSave() {
  const trimmed = body.value.trim()
  if (!trimmed) {
    toast.add({
      color: 'error',
      description: 'Enter banner text.',
      title: 'Validation'
    })
    return
  }

  const showUntil = new Date(showUntilInput.value).getTime()
  if (!Number.isFinite(showUntil)) {
    toast.add({
      color: 'error',
      description: 'Choose a valid show-until date and time.',
      title: 'Validation'
    })
    return
  }

  saving.value = true
  try {
    await setBanner.execute({ body: trimmed, showUntil })
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
  } finally {
    saving.value = false
  }
}

async function submitClear() {
  clearing.value = true
  try {
    await clearBanner.execute({})
    body.value = ''
    showUntilInput.value = defaultShowUntilLocal()
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
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      class="mb-6"
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

      <div
        v-if="loadingProfile || loadingBanner"
        aria-live="polite"
        class="text-sm text-muted"
        role="status"
      >
        Loading…
      </div>

      <form
        v-else
        class="space-y-5"
        novalidate
        @submit.prevent="submitSave"
      >
        <UFormField
          label="Message"
          name="banner-body"
          required
        >
          <UTextarea
            id="banner-body"
            v-model="body"
            :rows="4"
            class="w-full"
            autoresize
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
            v-model="showUntilInput"
            class="w-full max-w-md"
            type="datetime-local"
          />
        </UFormField>

        <div class="flex flex-wrap gap-3">
          <UButton
            color="primary"
            :loading="saving"
            type="submit"
          >
            Save banner
          </UButton>
          <UButton
            color="neutral"
            :disabled="!serverBanner"
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
