<script setup lang="ts">
const route = useRoute()

const { data: post } = await useAsyncData(`post-${route.params.slug}`, () =>
  queryCollection('posts')
    .path(`/posts/${route.params.slug}`)
    .first(),
)

if (!post.value) {
  throw createError({ fatal: true, statusCode: 404, statusMessage: 'Post not found' })
}

useSeoMeta({
  description: post.value.description,
  title: post.value.title,
})
</script>

<template>
  <div>
    <!-- Article Header -->
    <M3Section
      background="mesh"
      padding="lg"
    >
      <template #background>
        <div class="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />
      </template>
      <div class="mx-auto max-w-3xl">
        <M3Button
          variant="ghost"
          size="sm"
          to="/posts"
          icon="heroicons:arrow-left"
          class="mb-8"
        >
          Back to Posts
        </M3Button>

        <div class="mb-6 flex flex-wrap gap-2">
          <M3Badge
            v-for="tag in post.tags"
            :key="tag"
            variant="soft"
            size="md"
          >
            {{ tag }}
          </M3Badge>
        </div>

        <h1 class="mb-6 font-display text-display-md text-slate-900 dark:text-white">
          {{ post.title }}
        </h1>

        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/25">
            <Icon
              name="heroicons:user"
              class="h-6 w-6 text-white"
            />
          </div>
          <div>
            <p class="font-semibold text-slate-900 dark:text-white">
              {{ post.author }}
            </p>
            <time
              :datetime="post.publishedAt"
              class="text-sm text-slate-500 dark:text-slate-400"
            >
              {{ new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
            </time>
          </div>
        </div>
      </div>
    </M3Section>

    <!-- Article Content -->
    <M3Section
      id="post-content"
      background="default"
      padding="lg"
    >
      <article class="mx-auto max-w-3xl">
        <div
          v-if="post.description"
          class="mb-10 rounded-2xl border-l-4 border-primary-400 bg-primary-50 p-6 dark:bg-primary-950/30"
        >
          <p class="text-lg leading-relaxed text-primary-800 dark:text-primary-200">
            {{ post.description }}
          </p>
        </div>
        <div class="prose max-w-none">
          <ContentRenderer :value="post" />
        </div>
      </article>
    </M3Section>

    <!-- Navigation -->
    <M3Section
      background="dim"
      padding="md"
    >
      <div class="flex justify-center">
        <M3Button
          variant="secondary"
          size="md"
          to="/posts"
          icon="heroicons:arrow-left"
        >
          Back to All Posts
        </M3Button>
      </div>
    </M3Section>
  </div>
</template>
