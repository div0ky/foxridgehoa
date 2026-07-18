<script setup lang="ts">
import type { HoaOperatorRole } from '~/types/hoa'

import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

import InviteRoleSelect from '~/components/admin/InviteRoleSelect.vue'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminInvitePage' })

const toast = useToast()

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const loadingProfile = computed(() => profileState.status.value === 'pending')
const isBoardMember = computed(() => profile.value?.role === 'boardMember')

const invite = useConvexAction(api.operators.inviteOperator)

const email = ref('')
const name = ref('')
const role = ref<HoaOperatorRole>('managementCompany')

const formError = ref<string | null>(null)
const inviteResult = ref<{
  inviteEmailSent: boolean
  temporaryPassword: string
  userEmail: string
} | null>(null)
const submitting = ref(false)

function inviteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Invitation failed.'
  if (message.includes('ERR_MISSING_RESEND_ENV')) {
    return 'Convex env incomplete: set RESEND_API_KEY and RESEND_FROM before inviting users.'
  }
  if (message.includes('ERR_MISSING_SITE_URL'))
    return 'Convex env incomplete: set SITE_URL before inviting users.'
  return message
}

async function submitInvite() {
  formError.value = null
  inviteResult.value = null
  const trimmedEmail = email.value.trim()
  const trimmedName = name.value.trim()

  if (!trimmedEmail || !trimmedName) {
    formError.value = 'Enter name and email.'
    return
  }

  submitting.value = true
  try {
    const result = await invite({
      email: trimmedEmail,
      name: trimmedName,
      role: role.value
    })
    inviteResult.value = {
      inviteEmailSent: result.data.inviteEmailSent,
      temporaryPassword: result.data.temporaryPassword,
      userEmail: result.data.userEmail
    }
    toast.add({
      color: result.data.inviteEmailSent ? 'success' : 'warning',
      description: result.data.inviteEmailSent
        ? `Invitation email sent to ${result.data.userEmail}. Copy the temporary password before leaving this page.`
        : `Created account for ${result.data.userEmail}, but email delivery failed. Share the temporary password manually.`,
      title: result.data.inviteEmailSent ? 'User invited' : 'User invited, email failed'
    })
    email.value = ''
    name.value = ''
    role.value = 'managementCompany'
  } catch (error) {
    const message = inviteErrorMessage(error)
    formError.value = message
    toast.add({
      color: 'error',
      description: message,
      title: 'Could not invite'
    })
  } finally {
    submitting.value = false
  }
}

async function copyTemporaryPassword() {
  if (!inviteResult.value)
    return

  try {
    await navigator.clipboard.writeText(inviteResult.value.temporaryPassword)
    toast.add({
      color: 'success',
      description: 'Temporary password copied.',
      title: 'Copied'
    })
  } catch {
    toast.add({
      color: 'warning',
      description: 'Copy failed. Select the password and copy it manually.',
      title: 'Could not copy'
    })
  }
}
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-xl space-y-6">
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      color="warning"
      variant="soft"
      title="Restricted"
      description="Only board members may create HOA operator accounts."
      icon="i-lucide-lock"
    />

    <UCard v-if="loadingProfile || isBoardMember">
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            Invite user
          </h1>
          <p class="mt-1 text-sm text-muted">
            Invite someone to sign in here. They use email plus a temporary password you copy for them until they change it.
          </p>
        </div>
      </template>

      <div
        v-if="loadingProfile"
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
        @submit.prevent="submitInvite"
      >
        <UFormField
          label="Name"
          name="invite-name"
          required
        >
          <UInput
            id="invite-name"
            v-model.trim="name"
            class="w-full"
            autocomplete="name"
            :disabled="submitting"
            maxlength="160"
            size="lg"
          />
        </UFormField>

        <UFormField
          label="Email"
          name="invite-email"
          required
        >
          <UInput
            id="invite-email"
            v-model.trim="email"
            class="w-full"
            autocomplete="off"
            :disabled="submitting"
            maxlength="254"
            name="email"
            placeholder="they@association.org"
            size="lg"
            type="email"
          />
        </UFormField>

        <UFormField
          description="The home owner role stays hidden until it is enabled in product configuration for the homeowner portal."
          label="Role"
        >
          <InviteRoleSelect
            v-model="role"
            :disabled="submitting"
          />
        </UFormField>

        <UAlert
          v-if="formError"
          color="error"
          variant="soft"
          :title="formError"
        />

        <div
          v-if="inviteResult"
          class="rounded-lg border border-default bg-muted p-4"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="font-medium text-highlighted">
                Temporary password
              </p>
              <p class="mt-1 text-sm text-muted">
                <span v-if="inviteResult.inviteEmailSent">
                  Invitation email was sent to {{ inviteResult.userEmail }}. Copy this password before leaving this page.
                </span>
                <span v-else>
                  Email delivery failed for {{ inviteResult.userEmail }}. Share this password manually.
                </span>
              </p>
              <code class="mt-3 block break-all rounded-md bg-default px-3 py-2 text-sm text-highlighted">
                {{ inviteResult.temporaryPassword }}
              </code>
            </div>

            <UButton
              color="neutral"
              icon="i-lucide-copy"
              label="Copy"
              class="w-full shrink-0 sm:w-auto"
              size="md"
              variant="soft"
              @click="copyTemporaryPassword"
            />
          </div>
        </div>

        <div class="flex justify-end">
          <UButton
            icon="i-lucide-send"
            label="Invite"
            class="w-full sm:w-auto"
            type="submit"
            trailing
            :loading="submitting"
          />
        </div>
      </form>
    </UCard>
  </div>
</template>
