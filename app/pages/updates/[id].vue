<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { ConvexHttpClient } from 'convex/browser'
import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'

import CommunityUpdateMarkdown from '~/components/CommunityUpdateMarkdown.vue'
import {
  getCommunityUpdateCanonicalUrl,
  getCommunityUpdatePostedAtLabel,
  getCommunityUpdateSeoDescription,
  getCommunityUpdateSeoTitle
} from '~/utils/communityUpdateExcerpt'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()

const updateId = computed(() => route.params.id as Id<'communityUpdates'>)

const { data: queryResult, error } = await useAsyncData(
  () => `community-update-${route.params.id}`,
  async () => {
    if (!runtimeConfig.public.convexUrl) {
      throw createError({
        fatal: true,
        statusCode: 500,
        statusMessage: 'Convex URL is not configured'
      })
    }

    try {
      const client = new ConvexHttpClient(runtimeConfig.public.convexUrl)
      return await client.query(api.communityUpdates.getCommunityUpdatePublic, {
        updateId: updateId.value
      })
    } catch {
      return {
        data: { update: null },
        ok: true as const
      }
    }
  }
)

const update = computed(() => queryResult.value?.data.update ?? null)
const pending = computed(() => !queryResult.value && !error.value)
const toast = useToast()

if (error.value || (!pending.value && !update.value)) {
  throw createError({
    fatal: true,
    statusCode: 404,
    statusMessage: 'Update not found'
  })
}

const authorHandle = computed(() => {
  const name = update.value?.authorDisplayName ?? 'Fox Ridge HOA'
  const compact = name.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return `@${compact || 'thefoxridgehoa'}`
})

const authorDisplayName = computed(() => update.value?.authorDisplayName ?? 'Fox Ridge HOA')
const seoTitle = computed(() =>
  getCommunityUpdateSeoTitle({
    bodyMarkdown: update.value?.bodyMarkdown ?? ''
  })
)
const pageTitle = computed(() => `${seoTitle.value} · Fox Ridge HOA`)
const seoDescription = computed(() =>
  getCommunityUpdateSeoDescription({
    authorDisplayName: authorDisplayName.value,
    bodyMarkdown: update.value?.bodyMarkdown ?? ''
  })
)
const canonicalUrl = computed(() =>
  getCommunityUpdateCanonicalUrl({
    siteUrl: runtimeConfig.public.siteUrl,
    updateId: updateId.value
  })
)
const postedAtLabel = computed(() => {
  if (!update.value)
    return ''

  return getCommunityUpdatePostedAtLabel({ postedAt: update.value.postedAt })
})
const articlePublishedTime = computed(() => {
  if (!update.value)
    return ''

  return new Date(update.value.postedAt).toISOString()
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

useSeoMeta({
  description: seoDescription,
  ogDescription: seoDescription,
  ogTitle: pageTitle,
  ogType: 'article',
  ogUrl: canonicalUrl,
  title: pageTitle,
  twitterCard: 'summary_large_image',
  twitterDescription: seoDescription,
  twitterTitle: pageTitle
})

useHead({
  link: [
    {
      href: canonicalUrl,
      rel: 'canonical'
    }
  ],
  meta: [
    {
      content: articlePublishedTime,
      property: 'article:published_time'
    }
  ]
})

defineOgImage('CommunityUpdate', {
  authorDisplayName,
  description: seoDescription,
  postedAtLabel,
  title: seoTitle
}, [
  {
    cacheMaxAgeSeconds: 60 * 60 * 24 * 7,
    height: 630,
    key: 'og',
    width: 1200
  },
  {
    cacheMaxAgeSeconds: 60 * 60 * 24 * 7,
    height: 800,
    key: 'whatsapp',
    width: 800
  }
])
</script>

<template>
  <div class="flex flex-1 flex-col bg-surface mesh-gradient">
    <M3Section
      v-if="pending"
      background="default"
      padding="lg"
      class="flex flex-1 flex-col justify-center bg-transparent"
    >
      <div class="mx-auto flex max-w-2xl items-center justify-center gap-3 rounded-3xl border border-slate-200/80 bg-surface-elevated px-6 py-5 text-body-md text-slate-600 shadow-soft dark:border-slate-800 dark:text-slate-300">
        <Icon
          name="heroicons:arrow-path"
          class="h-5 w-5 shrink-0 animate-spin text-primary-500"
        />
        <p role="status">
          Loading community update…
        </p>
      </div>
    </M3Section>

    <template v-else-if="update">
      <M3Section
        background="default"
        padding="md"
        class="flex flex-1 flex-col justify-start bg-transparent"
      >
        <template #background>
          <div class="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />
          <div class="pointer-events-none absolute left-1/2 top-32 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-500/10 blur-3xl" />
          <div class="pointer-events-none absolute -bottom-36 -left-24 h-80 w-80 rounded-full bg-primary-600/10 blur-3xl" />
        </template>

        <div class="mx-auto w-full max-w-2xl">
          <M3Button
            variant="ghost"
            size="sm"
            to="/updates"
            icon="heroicons:arrow-left"
            class="mb-4 sm:mb-6"
          >
            View all updates
          </M3Button>

          <article class="overflow-hidden rounded-3xl border border-slate-200/80 bg-surface-elevated text-slate-950 shadow-soft dark:border-slate-800 dark:text-white dark:shadow-none">
            <h1 class="sr-only">
              Community update from {{ update.authorDisplayName }}
            </h1>

            <header class="flex flex-col gap-4 px-4 pb-3 pt-4 sm:flex-row sm:items-start sm:gap-3 sm:px-6 sm:pt-5">
              <div class="flex min-w-0 flex-1 items-start gap-3">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-md shadow-primary-500/25">
                  <Icon
                    name="heroicons:home-modern"
                    class="h-6 w-6 text-white"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <p class="break-words font-bold text-slate-950 dark:text-white">
                      {{ update.authorDisplayName }}
                    </p>
                    <Icon
                      name="heroicons:check-badge-solid"
                      class="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400"
                      aria-hidden="true"
                    />
                    <span class="sr-only">Verified board author</span>
                  </div>
                  <p class="break-words text-sm text-slate-500 dark:text-slate-400">
                    {{ authorHandle }}
                  </p>
                </div>
              </div>

              <M3Button
                variant="secondary"
                size="sm"
                icon="heroicons:link"
                class="w-full min-h-[44px] sm:mt-0 sm:w-auto sm:min-h-11 sm:self-start"
                aria-label="Copy link to this community update"
                @click="copyUpdateLink"
              >
                Copy link
              </M3Button>
            </header>

            <div class="px-4 pb-4 sm:px-6">
              <CommunityUpdateMarkdown
                :markdown="update.bodyMarkdown"
                class="max-w-[70ch] text-lg leading-relaxed text-slate-950 prose-headings:text-slate-950 prose-strong:text-slate-950 sm:text-xl sm:leading-8 dark:text-white dark:prose-headings:text-white dark:prose-strong:text-white"
              />

              <div
                v-if="update.imageUrls.length > 0"
                class="mt-5 grid grid-cols-1 gap-3 overflow-hidden rounded-2xl border border-slate-200/80 sm:grid-cols-2 dark:border-slate-800"
              >
                <img
                  v-for="(src, idx) in update.imageUrls"
                  :key="`${update.id}-${idx}`"
                  :src="src"
                  :alt="`Image ${idx + 1} of ${update.imageUrls.length} attached to this update`"
                  class="max-h-[min(30rem,70svh)] w-full object-cover sm:max-h-[30rem]"
                  loading="lazy"
                >
              </div>
            </div>

            <footer class="border-slate-200/80 border-t px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5 dark:border-slate-800">
              <time
                :datetime="String(update.postedAt)"
                class="block text-sm text-slate-500 dark:text-slate-400"
                :aria-label="`Posted ${formattedPostedAt}`"
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
