<script setup lang="ts">
import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

import { operatorRoleDisplayLabel } from '~/types/hoa'

definePageMeta({
  convexAuth: true,
  layout: 'admin-dashboard'
})

defineOptions({ name: 'AdminOverviewPage' })

const authState = await useConvexQuery(api.auth.getCurrentUser, {})
const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const loading = computed(() => authState.status.value === 'pending')
const user = computed(() => authState.data.value?.user)
const profile = computed(() => profileState.data.value?.data.profile)
const isBoard = computed(() => profile.value?.role === 'boardMember')
</script>

<template>
  <div class="mx-auto max-w-xl">
    <UCard>
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            HOA administration
          </h1>
          <p class="mt-1 text-sm text-muted">
            Convex operator session verified.
          </p>
        </div>
      </template>

      <p
        v-if="loading"
        class="text-sm text-muted"
        role="status"
        aria-live="polite"
      >
        Loading…
      </p>

      <template v-else>
        <p
          v-if="user"
          class="text-sm text-muted"
        >
          Signed in as <strong>{{ user.email ?? user.name }}</strong>
        </p>
        <UAlert
          v-else
          color="warning"
          variant="soft"
          title="Unexpected session"
          description="Reload the page or sign in again."
          icon="i-lucide-alert-triangle"
        />

        <dl
          v-if="profile"
          class="mt-4 border-y border-muted py-4 text-sm"
        >
          <div class="flex justify-between gap-4">
            <dt class="text-muted">
              HOA role
            </dt>
            <dd class="font-medium text-highlighted">
              {{ operatorRoleDisplayLabel(profile.role) }}
            </dd>
          </div>
        </dl>

        <UAlert
          v-if="user && !profile"
          class="mt-4"
          color="neutral"
          variant="outline"
          title="Missing HOA profile"
          description="You are signed in, but no operator profile row exists."
        />

        <div
          v-if="isBoard"
          class="mt-6 flex flex-wrap gap-3"
        >
          <UButton
            color="primary"
            icon="i-lucide-files"
            label="Important Documents"
            leading
            size="lg"
            to="/admin/documents"
          />
          <UButton
            color="neutral"
            icon="i-lucide-user-plus"
            label="Invite user"
            leading
            size="lg"
            to="/admin/invite"
            variant="outline"
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
