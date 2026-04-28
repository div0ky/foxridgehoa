<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'

import CommunityUpdateComposer from '~/components/CommunityUpdateComposer.vue'
import CommunityUpdateMarkdown from '~/components/CommunityUpdateMarkdown.vue'

const {
  canLoadMore,
  initialized,
  isPending,
  loadMore,
  refresh,
  updates
} = await usePaginatedPublicCommunityUpdates(10)

const authState = await useConvexQuery(api.auth.getCurrentUser, {})
const profileState = await useConvexQuery(api.operatorProfiles.getMyOperatorProfile, {})
const loadMoreTarget = ref<HTMLElement | null>(null)

const convexUser = computed(() => authState.data.value?.user ?? null)
const operatorProfile = computed(() => profileState.data.value?.data.profile ?? null)

const authLoading = computed(() => authState.status.value === 'pending' || profileState.status.value === 'pending')

const displayNameConfigured = computed(() => {
  const u = convexUser.value
  if (!u || typeof u !== 'object' || !('name' in u))
    return false
  const n = (u as { name?: string }).name
  return typeof n === 'string' && n.trim().length > 0
})

const showBoardPublishingCard = computed(
  () =>
    !authLoading.value
    && convexUser.value != null
    && operatorProfile.value?.role === 'boardMember'
)

useIntersectionObserver(
  loadMoreTarget,
  ([entry]) => {
    if (entry?.isIntersecting)
      loadMore()
  },
  { rootMargin: '420px' }
)

function formatCommunityUpdateDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}
</script>

<template>
  <div>
    <M3Section
      background="mesh"
      padding="lg"
    >
      <template #background>
        <div class="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
      </template>
      <div class="mx-auto max-w-3xl text-center">
        <M3Badge
          variant="soft"
          size="md"
          class="mb-4 inline-flex"
        >
          <Icon
            name="heroicons:newspaper"
            class="mr-1.5 h-4 w-4"
          />
          Community Updates
        </M3Badge>
        <h1 class="mb-4 font-display text-display-md text-slate-900 dark:text-white">
          Timeline
        </h1>
        <p class="text-body-lg text-slate-600 dark:text-slate-400">
          News and reminders from the Fox Ridge HOA board. Each post has a share link.
        </p>
      </div>
    </M3Section>

    <div
      v-if="showBoardPublishingCard"
      class="border-primary-200 dark:border-primary-950/70 border-b bg-primary-50/80 dark:bg-primary-950/35"
    >
      <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div class="rounded-2xl border border-primary-200/80 bg-white p-6 shadow-sm dark:border-primary-900/80 dark:bg-slate-950/70">
          <div class="mb-6 flex flex-wrap items-start gap-3">
            <div class="rounded-xl bg-primary-100 p-2 dark:bg-primary-900/60">
              <Icon
                name="heroicons:pencil-square"
                class="h-6 w-6 text-primary-700 dark:text-primary-300"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="font-semibold text-lg text-slate-900 dark:text-white">
                Write an update
              </h2>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Markdown and up to three images — your display name appears as the author.
                {{
                  displayNameConfigured
                    ? ''
                    : ' Add a display name in Admin → Account first.'
                }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <M3Button
                v-if="!displayNameConfigured"
                variant="secondary"
                size="sm"
                to="/admin/account"
                icon="heroicons:user-circle"
              >
                Account
              </M3Button>
              <M3Button
                variant="ghost"
                size="sm"
                to="/admin/quick-updates"
                icon="heroicons:cog-6-tooth"
              >
                Admin tools
              </M3Button>
            </div>
          </div>
          <CommunityUpdateComposer
            :can-publish="displayNameConfigured"
            :needs-display-name="!displayNameConfigured"
            @published="refresh"
          />
        </div>
      </div>
    </div>

    <M3Section
      id="updates-feed"
      background="dim"
      padding="lg"
    >
      <div
        v-if="!initialized && isPending"
        class="mx-auto max-w-3xl text-center text-sm text-slate-500"
        role="status"
      >
        Loading updates…
      </div>

      <div
        v-else-if="initialized && updates.length === 0"
        class="mx-auto max-w-md text-center"
      >
        <div class="mb-4 flex justify-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Icon
              name="heroicons:document-text"
              class="h-8 w-8 text-slate-400"
            />
          </div>
        </div>
        <h2 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
          No updates yet
        </h2>
        <p class="text-body-lg text-slate-600 dark:text-slate-400">
          Check back soon for board announcements.
        </p>
      </div>

      <div
        v-else
        class="mx-auto max-w-3xl"
      >
        <div class="relative space-y-8 before:absolute before:bottom-10 before:left-4 before:top-5 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
          <article
            v-for="item in updates"
            :key="item.id"
            class="relative pl-12 sm:pl-14"
          >
            <div class="absolute left-0 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 shadow-md shadow-primary-500/25 ring-4 ring-surface-dim dark:ring-surface-dim">
              <Icon
                name="heroicons:user"
                class="h-4 w-4 text-white"
              />
            </div>

            <div class="rounded-2xl border border-slate-200/80 bg-surface-elevated p-6 shadow-sm dark:border-slate-800">
              <header class="mb-4 flex flex-wrap items-start gap-3 border-slate-200 border-b pb-4 dark:border-slate-700">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-900 dark:text-white">
                    {{ item.authorDisplayName }}
                  </p>
                  <time
                    :datetime="String(item.postedAt)"
                    class="text-sm text-slate-500 dark:text-slate-400"
                  >
                    {{ formatCommunityUpdateDate(item.postedAt) }}
                  </time>
                </div>
                <NuxtLink
                  :to="`/updates/${item.id}`"
                  class="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 dark:border-slate-800 dark:text-slate-300 dark:hover:border-primary-900 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                >
                  <Icon
                    name="heroicons:link"
                    class="h-4 w-4"
                  />
                  Open / Share
                </NuxtLink>
              </header>

              <CommunityUpdateMarkdown :markdown="item.bodyMarkdown" />

              <div
                v-if="item.imageUrls.length > 0"
                class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                <img
                  v-for="(src, idx) in item.imageUrls"
                  :key="`${item.id}-${idx}`"
                  :src="src"
                  :alt="`Attachment ${idx + 1}`"
                  class="max-h-80 w-full rounded-xl object-cover ring-1 ring-slate-200/80 dark:ring-slate-700"
                  loading="lazy"
                >
              </div>
            </div>
          </article>
        </div>

        <div
          ref="loadMoreTarget"
          class="h-8"
          aria-hidden="true"
        />

        <div
          v-if="isPending && initialized"
          class="mt-6 text-center text-sm text-slate-500 dark:text-slate-400"
          role="status"
        >
          Loading older updates…
        </div>

        <div
          v-else-if="canLoadMore"
          class="mt-6 text-center"
        >
          <M3Button
            variant="secondary"
            size="md"
            icon="heroicons:arrow-down"
            @click="loadMore"
          >
            Load older updates
          </M3Button>
        </div>
      </div>
    </M3Section>
  </div>
</template>
