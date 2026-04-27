<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'

defineOptions({ name: 'AdminDashboardLayout' })

const route = useRoute()
const sidebarOpen = ref(false)

const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})

const profile = computed(() => profileState.data.value?.data.profile)
const navLoading = computed(() => profileState.status.value === 'pending')

const primaryLinks = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    {
      icon: 'i-lucide-layout-dashboard',
      label: 'Overview',
      onSelect: () => {
        sidebarOpen.value = false
      },
      to: '/admin'
    }
  ]

  if (profile.value?.role === 'boardMember') {
    items.push({
      icon: 'i-lucide-user-plus',
      label: 'Invite user',
      onSelect: () => {
        sidebarOpen.value = false
      },
      to: '/admin/invite'
    })
  }

  items.push({
    icon: 'i-lucide-house',
    label: 'Marketing site',
    onSelect: () => {
      sidebarOpen.value = false
    },
    target: '_self',
    to: '/'
  })

  return items
})

const adminTitle = computed(() => {
  if (route.path === '/admin')
    return 'Overview'
  if (route.path === '/admin/invite')
    return 'Invite user'
  return 'Admin'
})

const subtitle = computed(() => {
  if (navLoading.value)
    return 'Loading…'

  switch (profile.value?.role) {
    case 'boardMember':
      return 'Board member'

    case 'homeOwner':
      return 'Home owner'

    case 'managementCompany':
      return 'Management company'

    default:
      return 'No HOA profile linked'
  }
})

const { signOut } = useConvexAuth()

async function onSignOut() {
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="admin-dash"
      v-model:open="sidebarOpen"
      class="bg-elevated/25"
      collapsible
      resizable
      :default-size="22"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex w-full flex-col gap-1">
          <NuxtLink
            class="font-semibold leading-tight"
            to="/admin"
          >
            <span v-if="!collapsed">Fox Ridge HOA</span>
            <span
              v-else
              aria-hidden="true"
              class="text-lg font-bold"
            >FR</span>
          </NuxtLink>

          <p class="text-muted truncate text-xs">
            {{ subtitle }}
          </p>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          class="grow"
          :collapsed="collapsed"
          :items="primaryLinks"
          orientation="vertical"
          popover
          tooltip
        />
      </template>

      <template #footer>
        <div class="flex flex-col gap-2">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="onSignOut"
          >
            Sign out
          </UButton>
        </div>
      </template>
    </UDashboardSidebar>

    <div class="bg-muted flex min-h-[100dvh] min-w-0 flex-1 flex-col">
      <UDashboardNavbar
        class="sticky top-0 z-40 border-muted border-b"
        toggle
        icon="i-lucide-building-2"
        :title="adminTitle"
      />

      <div class="min-w-0 flex-1 overflow-auto p-4 lg:p-6">
        <slot />
      </div>
    </div>
  </UDashboardGroup>
</template>
