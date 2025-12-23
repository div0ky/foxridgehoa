<script setup lang="ts">
const { data: posts } = await useAsyncData('recent-posts', () =>
  queryCollection('posts')
    .sort({ publishedAt: -1 })
    .limit(3)
    .find(),
)

const boardMembers = [
  {
    name: 'Tim Soberg',
    role: 'President',
    termYear: 2026,
  },
  {
    name: 'Andrew Martin',
    role: 'Board Member',
    termYear: 2027,
  },
  {
    name: 'Aaron Spurlock',
    role: 'Board Member',
    termYear: 2028,
  },
]

const amenities = [
  {
    description: 'Well-maintained properties in a family-friendly neighborhood',
    icon: 'heroicons:home-modern',
    title: 'Beautiful Homes',
  },
  {
    description: 'Scenic paths throughout the neighborhood for walking and jogging',
    icon: 'heroicons:map',
    title: 'Walking Paths',
  },
  {
    description: 'Safe outdoor play areas for children and families',
    icon: 'heroicons:puzzle-piece',
    title: 'Playgrounds',
  },
  {
    description: 'Located in the highly-rated Wentzville School District',
    icon: 'heroicons:academic-cap',
    title: 'Excellent Schools',
  },
]

const documents = [
  {
    description: 'Complete governing documents for the association',
    icon: 'heroicons:document-text',
    link: '#',
    title: 'HOA Bylaws',
  },
  {
    description: 'Guidelines for maintaining our beautiful community',
    icon: 'heroicons:clipboard-document-list',
    link: '#',
    title: 'Community Rules',
  },
  {
    description: 'Standards for home improvements and modifications',
    icon: 'heroicons:pencil-square',
    link: '#',
    title: 'Architectural Guidelines',
  },
]
</script>

<template>
  <div>
    <!-- Hero Section: M3 Expressive with mesh gradient and decorative elements -->
    <M3Section
      id="hero"
      background="mesh"
      padding="xl"
    >
      <!-- Decorative circles -->
      <template #background>
        <div class="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary-400/10 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
      </template>

      <div class="mx-auto max-w-4xl text-center">
        <M3Badge
          variant="soft"
          size="md"
          class="mb-6 inline-flex"
        >
          <Icon
            name="heroicons:map-pin"
            class="mr-1.5 h-4 w-4"
          />
          Wentzville, Missouri
        </M3Badge>
        <h1 class="mb-6 font-display text-display-lg tracking-tight text-slate-900 dark:text-white">
          Welcome to
          <span class="text-gradient">Fox Ridge</span>
        </h1>
        <p class="mb-10 text-xl leading-relaxed text-slate-600 dark:text-slate-400">
          A beautiful community where neighbors become friends.<br class="hidden sm:block">
          Your home for community updates, board information, and resources.
        </p>
        <div class="flex flex-col justify-center gap-4 sm:flex-row">
          <M3Button
            variant="primary"
            size="lg"
            to="/posts"
            icon="heroicons:newspaper"
          >
            Community Updates
          </M3Button>
          <M3Button
            variant="secondary"
            size="lg"
            href="#about"
            icon="heroicons:arrow-down"
            icon-position="right"
          >
            Learn More
          </M3Button>
        </div>
      </div>
    </M3Section>

    <!-- About Section -->
    <M3Section
      id="about"
      background="dim"
      padding="lg"
    >
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <M3Badge
            variant="soft"
            size="md"
            class="mb-4"
          >
            About Our Community
          </M3Badge>
          <h2 class="mb-6 font-display text-display-sm text-slate-900 dark:text-white">
            A neighborhood built on community values
          </h2>
          <p class="mb-6 text-body-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Fox Ridge was established in 2005 as a family-oriented community dedicated to maintaining high standards of living and fostering a strong sense of community among residents.
          </p>
          <p class="text-body-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Located in the heart of Wentzville, we offer convenient access to excellent schools, shopping centers, parks, and major employment centers while maintaining a peaceful residential atmosphere.
          </p>
        </div>
        <div class="relative">
          <M3Card
            variant="filled"
            class="relative z-10"
          >
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-500 shadow-lg shadow-primary-500/25">
                <Icon
                  name="heroicons:home-modern"
                  class="h-6 w-6 text-white"
                />
              </div>
              <div>
                <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                  Established 2005
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  Nearly 20 years of building community and maintaining excellence in our neighborhood.
                </p>
              </div>
            </div>
          </M3Card>
          <!-- Decorative offset card -->
          <div class="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-3xl bg-gradient-to-br from-primary-200 to-primary-300 dark:from-primary-900/40 dark:to-primary-800/40" />
        </div>
      </div>
    </M3Section>

    <!-- Board of Directors Section -->
    <M3Section
      id="board"
      background="default"
      padding="lg"
    >
      <M3SectionHeader
        label="Leadership"
        title="Board of Directors"
        description="Meet the dedicated volunteers who serve our community."
        size="md"
      />
      <div class="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <M3Card
          v-for="(member, index) in boardMembers"
          :key="member.name"
          variant="elevated"
          hoverable
          as="article"
          :class="`stagger-${index + 1}`"
        >
          <div class="mb-4 flex items-start justify-between">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
              <Icon
                name="heroicons:user"
                class="h-7 w-7 text-slate-500 dark:text-slate-400"
              />
            </div>
            <span class="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              Until {{ member.termYear }}
            </span>
          </div>
          <h3 class="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
            {{ member.name }}
          </h3>
          <p class="text-sm font-medium text-primary-600 dark:text-primary-400">
            {{ member.role }}
          </p>
        </M3Card>
      </div>
    </M3Section>

    <!-- Amenities Section -->
    <M3Section
      id="amenities"
      background="mesh"
      padding="lg"
    >
      <M3SectionHeader
        label="Community Features"
        title="What Makes Fox Ridge Special"
        description="Discover the amenities and benefits that make our community a great place to call home."
        size="md"
      />
      <div class="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <M3Card
          v-for="amenity in amenities"
          :key="amenity.title"
          variant="elevated"
          as="article"
          class="group"
        >
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 transition-colors group-hover:bg-primary-500 dark:bg-primary-900/50 dark:group-hover:bg-primary-600">
            <Icon
              :name="amenity.icon"
              class="h-7 w-7 text-primary-600 transition-colors group-hover:text-white dark:text-primary-400 dark:group-hover:text-white"
            />
          </div>
          <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            {{ amenity.title }}
          </h3>
          <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ amenity.description }}
          </p>
        </M3Card>
      </div>
    </M3Section>

    <!-- Documents Section -->
    <M3Section
      id="documents"
      background="dim"
      padding="lg"
    >
      <M3SectionHeader
        label="Resources"
        title="Important Documents"
        description="Access community guidelines, bylaws, and important forms."
        size="md"
      />
      <div class="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        <M3Card
          v-for="doc in documents"
          :key="doc.title"
          variant="elevated"
          hoverable
          as="article"
          class="group"
        >
          <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-primary-100 dark:bg-slate-800 dark:group-hover:bg-primary-900/50">
            <Icon
              :name="doc.icon"
              class="h-6 w-6 text-slate-500 transition-colors group-hover:text-primary-600 dark:text-slate-400 dark:group-hover:text-primary-400"
            />
          </div>
          <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            {{ doc.title }}
          </h3>
          <p class="mb-4 text-sm text-slate-600 dark:text-slate-400">
            {{ doc.description }}
          </p>
          <M3Button
            variant="ghost"
            size="sm"
            :href="doc.link"
            icon="heroicons:arrow-down-tray"
            icon-position="right"
          >
            Download PDF
          </M3Button>
        </M3Card>
      </div>
    </M3Section>

    <!-- Recent Posts Preview -->
    <M3Section
      v-if="posts && posts.length > 0"
      id="posts"
      background="default"
      padding="lg"
    >
      <M3SectionHeader
        label="Stay Informed"
        title="Community Updates"
        description="The latest news, meeting summaries, and announcements from the HOA board."
        size="md"
      />
      <div class="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
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
          <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            {{ post.title }}
          </h3>
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
            Read More
          </M3Button>
        </M3Card>
      </div>
      <div class="mt-10 text-center">
        <M3Button
          variant="secondary"
          size="md"
          to="/posts"
          icon="heroicons:newspaper"
        >
          View All Posts
        </M3Button>
      </div>
    </M3Section>

    <!-- Contact Section -->
    <M3Section
      id="contact"
      background="mesh"
      padding="lg"
    >
      <div class="grid items-start gap-12 lg:grid-cols-2">
        <div>
          <M3Badge
            variant="soft"
            size="md"
            class="mb-4"
          >
            Get in Touch
          </M3Badge>
          <h2 class="mb-6 font-display text-display-sm text-slate-900 dark:text-white">
            We're here to help
          </h2>
          <p class="mb-8 text-body-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Have questions or concerns? Our board members are always happy to hear from community members. Reach out and we'll get back to you as soon as possible.
          </p>

          <div class="space-y-4">
            <a
              href="mailto:info@thefoxridgehoa.org"
              class="flex items-center gap-4 rounded-2xl bg-surface-elevated p-4 shadow-soft transition-all hover:shadow-soft-lg dark:bg-slate-800"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                <Icon
                  name="heroicons:envelope"
                  class="h-6 w-6 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Email Us</p>
                <p class="font-medium text-slate-900 dark:text-white">info@thefoxridgehoa.org</p>
              </div>
            </a>
            <div class="flex items-center gap-4 rounded-2xl bg-surface-elevated p-4 shadow-soft dark:bg-slate-800">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                <Icon
                  name="heroicons:map-pin"
                  class="h-6 w-6 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Location</p>
                <p class="font-medium text-slate-900 dark:text-white">Wentzville, MO 63385</p>
              </div>
            </div>
          </div>
        </div>

        <M3Card
          variant="elevated"
          class="lg:mt-12"
        >
          <div class="flex items-center gap-4 border-b border-slate-100 pb-6 dark:border-slate-700">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 shadow-lg shadow-primary-500/25">
              <Icon
                name="heroicons:calendar"
                class="h-6 w-6 text-white"
              />
            </div>
            <div>
              <h3 class="font-semibold text-slate-900 dark:text-white">Board Meetings</h3>
              <p class="text-sm text-slate-600 dark:text-slate-400">Open to all residents</p>
            </div>
          </div>
          <div class="pt-6">
            <p class="mb-4 text-slate-600 dark:text-slate-400">
              Monthly board meetings are held on the <strong class="text-slate-900 dark:text-white">second Tuesday</strong> of each month at <strong class="text-slate-900 dark:text-white">7:00 PM</strong>.
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-500">
              All residents are welcome and encouraged to attend. Meeting agendas are posted in advance.
            </p>
          </div>
        </M3Card>
      </div>
    </M3Section>
  </div>
</template>
