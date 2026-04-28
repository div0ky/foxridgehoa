<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { computed, watch } from 'vue'
import { api } from '~~/convex/_generated/api'

import CommunityUpdateMarkdown from '~/components/CommunityUpdateMarkdown.vue'
import { communityUpdateHeadline } from '~/utils/communityUpdateExcerpt'

const route = useRoute()

const updateId = computed(() => route.params.id as Id<'communityUpdates'>)

const queryState = await useConvexQuery(
  api.communityUpdates.getCommunityUpdatePublic,
  () => ({ updateId: updateId.value })
)

const update = computed(() => queryState.data.value?.data.update ?? null)
const pending = computed(() => queryState.status.value === 'pending')
const toast = useToast()

const authorHandle = computed(() => {
  const name = update.value?.authorDisplayName ?? 'Fox Ridge HOA'
  const compact = name.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `@${compact || 'foxridgehoa'}`
})

const formattedPostedAt = computed(() => {
  if (!update.value)
    return ''

  const postDate = new Date(update.value.postedAt)
  const time = postDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
  const date = postDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  return `${time} · ${date}`
})

async function copyUpdateLink() {
  if (!import.meta.client)
    return

  await navigator.clipboard.writeText(window.location.href)
  toast.add({
    color: 'success',
    description: 'The share link is copied.',
    title: 'Copied'
  })
}

watch(
  () => ({
    pending: pending.value,
    resolved: update.value
  }),
  ({ pending: isPending, resolved }) => {
    if (isPending)
      return
    if (!resolved) {
      throw createError({
        fatal: true,
        statusCode: 404,
        statusMessage: 'Update not found'
      })
    }
    const titleSuffix = communityUpdateHeadline(resolved.bodyMarkdown, 60)
    useSeoMeta({
      description: resolved.bodyMarkdown.replace(/\s+/g, ' ').trim().slice(0, 160),
      title: `${titleSuffix} · Fox Ridge HOA`
    })
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <M3Section
      v-if="pending"
      background="mesh"
      padding="lg"
    >
      <div class="mx-auto flex max-w-2xl items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-6 py-5 text-slate-600 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        <Icon
          name="heroicons:arrow-path"
          class="h-5 w-5 animate-spin text-primary-500"
        />
        <p role="status">
          Loading community update…
        </p>
      </div>
    </M3Section>

    <template v-else-if="update">
      <M3Section
        background="mesh"
        padding="md"
      >
        <template #background>
          <div class="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />
          <div class="pointer-events-none absolute left-1/2 top-32 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
          <div class="pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-primary-600/10 blur-3xl" />
        </template>

        <div class="mx-auto max-w-2xl">
          <M3Button
            variant="ghost"
            size="sm"
            to="/updates"
            icon="heroicons:arrow-left"
            class="mb-6"
          >
            View all updates
          </M3Button>

          <article class="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-surface-elevated text-slate-950 shadow-2xl shadow-slate-950/10 ring-1 ring-white/50 dark:border-slate-800 dark:text-white dark:shadow-black/30 dark:ring-white/5">
            <h1 class="sr-only">
              Community update from {{ update.authorDisplayName }}
            </h1>

            <header class="flex items-start gap-3 px-5 pb-3 pt-5 sm:px-6">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-orange-500 shadow-md shadow-orange-500/20">
                <Icon
                  name="heroicons:home-modern"
                  class="h-6 w-6 text-white"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-1.5">
                  <p class="truncate font-bold text-slate-950 dark:text-white">
                    {{ update.authorDisplayName }}
                  </p>
                  <Icon
                    name="heroicons:check-badge-solid"
                    class="h-5 w-5 shrink-0 text-sky-500"
                    aria-label="Verified"
                  />
                </div>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ authorHandle }} · Follow
                </p>
              </div>

              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 dark:border-slate-800 dark:text-slate-300 dark:hover:border-primary-900 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                @click="copyUpdateLink"
              >
                <Icon
                  name="heroicons:link"
                  class="h-4 w-4"
                />
                Copy link
              </button>
            </header>

            <div class="px-5 pb-4 sm:px-6">
              <CommunityUpdateMarkdown
                :markdown="update.bodyMarkdown"
                class="text-[1.35rem] leading-8 text-slate-950 prose-headings:text-slate-950 prose-strong:text-slate-950 dark:text-white dark:prose-headings:text-white dark:prose-strong:text-white"
              />

              <div
                v-if="update.imageUrls.length > 0"
                class="mt-5 grid grid-cols-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 sm:grid-cols-2 dark:border-slate-800"
              >
                <img
                  v-for="(src, idx) in update.imageUrls"
                  :key="`${update.id}-${idx}`"
                  :src="src"
                  :alt="`Attachment ${idx + 1}`"
                  class="max-h-[30rem] w-full object-cover"
                  loading="lazy"
                >
              </div>
            </div>

            <footer class="px-5 pb-5 sm:px-6">
              <time
                :datetime="String(update.postedAt)"
                class="block text-sm text-slate-500 dark:text-slate-400"
              >
                {{ formattedPostedAt }}
              </time>
            </footer>
          </article>
        </div>
      </M3Section>
    </template>
  </div>
</template>
