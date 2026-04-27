<script setup lang="ts">
const { data: posts } = await useAsyncData('all-posts', () =>
  queryCollection('posts')
    .order('publishedAt', 'DESC')
    .all()
)

const selectedTag = ref<string | null>(null)

const allTags = computed(() => {
  if (!posts.value) return []
  const tags = new Set<string>()
  for (const post of posts.value) {
    if (post.tags) {
      for (const tag of post.tags) {
        tags.add(tag)
      }
    }
  }
  return Array.from(tags).sort()
})

const filteredPosts = computed(() => {
  if (!posts.value) return []
  if (!selectedTag.value) return posts.value
  return posts.value.filter(post => post.tags?.includes(selectedTag.value!))
})

function selectTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}
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
      <!-- Tag Filter -->
      <div
        v-if="allTags.length > 0"
        class="mb-8"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="mr-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            Filter by:
          </span>
          <button
            v-for="tag in allTags"
            :key="tag"
            class="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
            :class="selectedTag === tag
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'"
            @click="selectTag(tag)"
          >
            {{ tag }}
          </button>
          <button
            v-if="selectedTag"
            class="ml-2 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
            @click="selectedTag = null"
          >
            <Icon
              name="heroicons:x-mark"
              class="h-3 w-3"
            />
            Clear
          </button>
        </div>
      </div>

      <div
        v-if="filteredPosts.length > 0"
        class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        <M3Card
          v-for="post in filteredPosts"
          :key="post.path"
          variant="elevated"
          hoverable
          as="article"
        >
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              v-for="tag in post.tags"
              :key="tag"
              class="rounded-full px-2 py-0.5 text-xs font-medium transition-all"
              :class="selectedTag === tag
                ? 'bg-primary-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-primary-900/30 dark:hover:text-primary-400'"
              @click.stop="selectTag(tag)"
            >
              {{ tag }}
            </button>
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
          <NuxtLink
            :to="post.path"
            class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-600 transition-all hover:bg-primary-50 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
          >
            Read Article
            <Icon
              name="heroicons:arrow-right"
              class="h-4 w-4 shrink-0"
            />
          </NuxtLink>
        </M3Card>
      </div>
      <!-- Empty state: no posts matching filter -->
      <div
        v-else-if="selectedTag && posts && posts.length > 0"
        class="mx-auto max-w-md text-center"
      >
        <div class="mb-4 flex justify-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <Icon
              name="heroicons:funnel"
              class="h-8 w-8 text-slate-400"
            />
          </div>
        </div>
        <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
          No posts match "{{ selectedTag }}"
        </h3>
        <p class="mb-4 text-body-lg text-slate-600 dark:text-slate-400">
          Try selecting a different tag or clear the filter.
        </p>
        <M3Button
          variant="secondary"
          size="sm"
          @click="selectedTag = null"
        >
          Clear Filter
        </M3Button>
      </div>

      <!-- Empty state: no posts at all -->
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
