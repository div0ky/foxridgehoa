<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminAccountPage' })

const toast = useToast()

const authState = await useConvexQuery(api.auth.getCurrentUser, {})

const loadingAuth = computed(() => authState.status.value === 'pending')
type AuthUserLite = {
  email?: string
  id?: string
  name?: string
}
const convexUser = computed((): AuthUserLite | null => {
  const u = authState.data.value?.user
  return u ?? null
})

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})
const operatorProfile = computed(() => profileState.data.value?.data.profile ?? null)

const { client, refreshAuth } = useConvexAuth()

/** Better Auth exposes `POST /update-user` via `updateUser` on the client. */
type AuthClientProfile = {
  updateUser?: (
    opts: {
      image?: string
      name?: string
    },
    opts2?: Record<string, unknown>
  ) => Promise<{
    data?: unknown
    error?: { message?: string } | null
  }>
}

const displayNameDraft = ref('')

watch(
  convexUser,
  (u) => {
    displayNameDraft.value = typeof u?.name === 'string' ? u.name : ''
  },
  { immediate: true }
)

const saving = ref(false)

async function saveDisplayName() {
  const trimmed = displayNameDraft.value.trim()
  if (!trimmed) {
    toast.add({
      color: 'warning',
      description: 'Enter a display name.',
      title: 'Required'
    })
    return
  }

  if (!client) {
    toast.add({
      color: 'error',
      description: 'Auth client unavailable. Reload the page.',
      title: 'Error'
    })
    return
  }

  const updater = (client as AuthClientProfile).updateUser
  if (typeof updater !== 'function') {
    toast.add({
      color: 'error',
      description: 'Better Auth profile update not available — upgrade Better Auth wiring.',
      title: 'Cannot update profile'
    })
    return
  }

  saving.value = true
  try {
    const result = await updater({ name: trimmed })

    if (result?.error) {
      const msg
        = typeof result.error === 'object' && result.error && 'message' in result.error
          && typeof (result.error as { message?: unknown }).message === 'string'
          ? (result.error as { message: string }).message
          : 'Could not save display name.'
      toast.add({ color: 'error', description: msg, title: 'Update failed' })
      return
    }

    await refreshAuth()
    toast.add({
      color: 'success',
      description: 'Your display name is saved.',
      title: 'Saved'
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Could not save display name.'
    toast.add({
      color: 'error',
      description: msg,
      title: 'Error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <UCard>
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            Account
          </h1>
          <p class="mt-1 text-sm text-muted">
            Set how your name appears on community updates published from this site.
          </p>
        </div>
      </template>

      <div
        v-if="loadingAuth"
        aria-live="polite"
        class="text-sm text-muted"
        role="status"
      >
        Loading…
      </div>

      <div
        v-else-if="!convexUser"
        class="text-sm text-muted"
      >
        Sign in required.
      </div>

      <form
        v-else
        class="space-y-5"
        novalidate
        @submit.prevent="saveDisplayName"
      >
        <UFormField
          label="Display name"
          name="display-name"
          required
          hint="Shown as the author name on HOA updates."
        >
          <UInput
            id="display-name"
            v-model="displayNameDraft"
            autocomplete="name"
            class="w-full"
            placeholder="e.g. Jamie Board Member"
          />
        </UFormField>

        <p
          v-if="operatorProfile?.role !== 'boardMember'"
          class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Your operator role is not <strong>board member</strong>, so you cannot publish HOA updates — but you can still save a display name here.
        </p>

        <UButton
          color="primary"
          :loading="saving"
          type="submit"
        >
          Save display name
        </UButton>
      </form>
    </UCard>

    <p
      v-if="convexUser?.email"
      class="mt-6 text-xs text-muted"
    >
      Signed in as {{ convexUser.email }}
    </p>
  </div>
</template>
