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

type AuthClientResult = Promise<{
  data?: unknown
  error?: { message?: string } | null
}>

/** Better Auth exposes account settings through generated client helpers. */
type AuthClientAccount = {
  changePassword?: (
    opts: {
      currentPassword: string
      newPassword: string
      revokeOtherSessions?: boolean
    },
    opts2?: Record<string, unknown>
  ) => AuthClientResult
  updateUser?: (
    opts: {
      image?: string
      name?: string
    },
    opts2?: Record<string, unknown>
  ) => AuthClientResult
}

const displayNameDraft = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

watch(
  convexUser,
  (u) => {
    displayNameDraft.value = typeof u?.name === 'string' ? u.name : ''
  },
  { immediate: true }
)

const saving = ref(false)
const changingPassword = ref(false)

function authResultMessage(
  result: Awaited<AuthClientResult> | undefined,
  fallback: string
): string | null {
  if (!result?.error)
    return null

  return typeof result.error.message === 'string'
    ? result.error.message
    : fallback
}

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

  const updater = (client as AuthClientAccount).updateUser
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
    const msg = authResultMessage(result, 'Could not save display name.')
    if (msg) {
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

async function changeAccountPassword() {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.add({
      color: 'warning',
      description: 'Enter your current password and the new password twice.',
      title: 'Required'
    })
    return
  }

  if (newPassword.value.length < 8) {
    toast.add({
      color: 'warning',
      description: 'Use at least 8 characters for the new password.',
      title: 'Password too short'
    })
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.add({
      color: 'warning',
      description: 'The new password fields do not match.',
      title: 'Check password'
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

  const passwordChanger = (client as AuthClientAccount).changePassword
  if (typeof passwordChanger !== 'function') {
    toast.add({
      color: 'error',
      description: 'Better Auth password change is not available — upgrade Better Auth wiring.',
      title: 'Cannot update password'
    })
    return
  }

  changingPassword.value = true
  try {
    const result = await passwordChanger({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: true
    })
    const msg = authResultMessage(result, 'Could not update password.')
    if (msg) {
      toast.add({ color: 'error', description: msg, title: 'Update failed' })
      return
    }

    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    await refreshAuth()
    toast.add({
      color: 'success',
      description: 'Your password is updated.',
      title: 'Password changed'
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Could not update password.'
    toast.add({
      color: 'error',
      description: msg,
      title: 'Error'
    })
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
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

    <UCard v-if="convexUser">
      <template #header>
        <div>
          <h2 class="font-semibold text-highlighted">
            Password
          </h2>
          <p class="mt-1 text-sm text-muted">
            Change the password used for this admin account. Other active sessions will be signed out.
          </p>
        </div>
      </template>

      <form
        class="space-y-5"
        novalidate
        @submit.prevent="changeAccountPassword"
      >
        <UFormField
          label="Current password"
          name="current-password"
          required
        >
          <UInput
            id="current-password"
            v-model="currentPassword"
            autocomplete="current-password"
            class="w-full"
            type="password"
          />
        </UFormField>

        <UFormField
          label="New password"
          name="new-password"
          required
          hint="Minimum 8 characters."
        >
          <UInput
            id="new-password"
            v-model="newPassword"
            autocomplete="new-password"
            class="w-full"
            type="password"
          />
        </UFormField>

        <UFormField
          label="Confirm new password"
          name="confirm-password"
          required
        >
          <UInput
            id="confirm-password"
            v-model="confirmPassword"
            autocomplete="new-password"
            class="w-full"
            type="password"
          />
        </UFormField>

        <UButton
          color="primary"
          icon="i-lucide-key-round"
          :loading="changingPassword"
          type="submit"
        >
          Change password
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
