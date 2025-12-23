<script setup lang="ts">
const { data: posts } = await useAsyncData('all-posts', () =>
  queryCollection('posts')
    .sort({ publishedAt: -1 })
    .find(),
)
</script>

<template>
  <div>
    <!-- Hero Section -->
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
          All Posts
        </h1>
        <p class="text-body-lg text-slate-600 dark:text-slate-400">
          Stay informed about meetings, events, and important announcements from the Fox Ridge HOA.
        </p>
      </div>
    </M3Section>

    <!-- Posts Grid -->
    <M3Section
      id="posts-list"
      background="dim"
      padding="lg"
    >
      <div
        v-if="posts && posts.length > 0"
        class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        <M3Card
          v-for="post in posts"
          :key="post._path"
          variant="elevated"
          hoverable
          as="article"
        >
          <div class="mb-4 flex flex-wrap gap-2">
            <M3Badge
              v-for="tag in post.tags"
              :key="tag"
              variant="muted"
              size="sm"
            >
              {{ tag }}
            </M3Badge>
          </div>
          <h2 class="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
            {{ post.title }}
          </h2>
          <p class="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ post.description }}
          </p>
          <div class="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Icon
              name="heroicons:user-circle"
              class="h-4 w-4"
            />
            <span>{{ post.author }}</span>
            <span class="text-slate-300 dark:text-slate-600">•</span>
            <time :datetime="post.publishedAt">
              {{ new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
            </time>
          </div>
          <M3Button
            variant="ghost"
            size="sm"
            :to="post._path"
            icon="heroicons:arrow-right"
            icon-position="right"
          >
            Read Article
          </M3Button>
        </M3Card>
      </div>
      <div
        v-else
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
        <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
          No posts yet
        </h3>
        <p class="text-body-lg text-slate-600 dark:text-slate-400">
          Check back soon for community updates and announcements.
        </p>
      </div>
    </M3Section>
  </div>
</template>
