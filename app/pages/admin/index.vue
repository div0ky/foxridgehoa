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

const workspaceLinks = [
  {
    hint: 'PDFs surfaced on the home page',
    label: 'Important Documents',
    to: '/admin/documents'
  },
  {
    hint: 'Short posts visible under Updates',
    label: 'Community updates',
    to: '/admin/quick-updates'
  },
  {
    hint: 'Timeboxed notice shown site-wide',
    label: 'Site banner',
    to: '/admin/banner'
  },
  {
    hint: 'Board and annual meetings on the public calendar',
    label: 'HOA meetings',
    to: '/admin/meetings'
  },
  {
    hint: 'Recipients for messages from Contact the Board',
    label: 'Board contact',
    to: '/admin/contact-routing'
  },
  {
    hint: 'Add management, board, or other operators',
    label: 'Invite user',
    to: '/admin/invite'
  },
  {
    hint: 'Display name shown on posts, password changes',
    label: 'Account',
    to: '/admin/account'
  }
] as const
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-2xl space-y-6">
    <UCard>
      <template #header>
        <div>
          <h1 class="font-semibold text-highlighted">
            HOA administration
          </h1>
          <p class="mt-1 text-sm text-muted">
            Signed-in tools for the Fox Ridge HOA site and resident-facing pages.
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
          description="You can sign in, but your account is not linked to an operator profile yet. Ask a board member or site owner to provision access."
        />

        <div
          v-if="user && profile && !isBoard"
          class="mt-6 rounded-lg bg-elevated/50 p-4 text-sm text-muted"
        >
          <p class="font-medium text-highlighted">
            Limited administrator access
          </p>
          <p class="mt-2">
            Publishing controls (documents, meetings, banners, invitations) are limited to board members. You can still use Account to update your password, email, or the name shown on signed content.
          </p>
          <div class="mt-4">
            <UButton
              color="primary"
              icon="i-lucide-user"
              label="Open account settings"
              size="lg"
              to="/admin/account"
            />
          </div>
        </div>

        <div
          v-if="user && profile && isBoard"
          class="mt-6"
        >
          <p class="text-sm text-muted">
            Residents see changes on the public site quickly after you publish. Work from the checklist below or the matching items in the sidebar.
          </p>

          <nav
            aria-label="Publishing areas"
            class="mt-4"
          >
            <ul class="divide-y divide-default rounded-xl border border-default">
              <li
                v-for="item in workspaceLinks"
                :key="item.to"
              >
                <NuxtLink
                  class="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-elevated/60 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  :to="item.to"
                >
                  <span class="font-medium text-highlighted">
                    {{ item.label }}
                  </span>
                  <span class="text-xs text-muted sm:text-end sm:text-sm">
                    {{ item.hint }}
                  </span>
                </NuxtLink>
              </li>
            </ul>
          </nav>
        </div>
      </template>
    </UCard>
  </div>
</template>
