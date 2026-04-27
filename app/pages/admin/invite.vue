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

const provision = useConvexMutation(api.operators.provisionOperator)

const email = ref('')
const password = ref('')
const name = ref('')
const role = ref<HoaOperatorRole>('managementCompany')

const formError = ref<string | null>(null)
const submitting = ref(false)

async function submitInvite() {
  formError.value = null
  if (!email.value.trim() || !password.value || !name.value.trim()) {
    formError.value = 'Enter name, email, and password.'
    return
  }

  submitting.value = true
  try {
    await provision.execute({
      email: email.value.trim(),
      name: name.value.trim(),
      password: password.value,
      role: role.value
    })
    toast.add({
      color: 'success',
      description: `Created account for ${email.value.trim()}.`,
      title: 'User invited'
    })
    email.value = ''
    password.value = ''
    name.value = ''
    role.value = 'managementCompany'
    await navigateTo('/admin')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invitation failed.'
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
</script>

<template>
  <div class="mx-auto max-w-xl">
    <UAlert
      v-if="!loadingProfile && !isBoardMember"
      class="mb-6"
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
            Provision an email-password account with an HOA role.
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
            maxlength="254"
            name="email"
            placeholder="they@association.org"
            size="lg"
            type="email"
          />
        </UFormField>

        <UFormField
          label="Password"
          name="invite-password"
          required
        >
          <UInput
            id="invite-password"
            v-model="password"
            class="w-full"
            autocomplete="new-password"
            placeholder="Temporary password"
            size="lg"
            type="password"
          />
        </UFormField>

        <UFormField
          description="Enable home owner in ~/config/product-features when the homeowner portal ships."
          label="Role"
        >
          <InviteRoleSelect v-model="role" />
        </UFormField>

        <UAlert
          v-if="formError"
          color="error"
          variant="soft"
          :title="formError"
        />

        <div class="flex justify-end">
          <UButton
            icon="i-lucide-send"
            label="Invite"
            type="submit"
            trailing
            :loading="submitting"
          />
        </div>
      </form>
    </UCard>
  </div>
</template>
