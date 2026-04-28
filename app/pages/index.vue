<script setup lang="ts">
import { computed } from 'vue'

import { defaultImportantDocumentIcon } from '~/config/important-document-icons'
import { communityUpdateHeadline } from '~/utils/communityUpdateExcerpt'

const { documents, isPending: importantDocumentsPending } = await useImportantDocuments()

const {
  displayYear: hoaMeetingsDisplayYear,
  isPending: hoaMeetingsPending,
  meetingRows: hoaMeetingRows,
  schedule: hoaMeetingSchedule
} = await usePublicMeetingSchedule()

const showImportantDocuments = computed(
  () => !importantDocumentsPending.value && documents.value.length > 0
)

const {
  isPending: communityUpdatesPending,
  updates: recentCommunityUpdates
} = await usePublicCommunityUpdates(3)

const showCommunityUpdatesTeaser = computed(
  () => !communityUpdatesPending.value && recentCommunityUpdates.value.length > 0
)

const currentMonth = new Date().getMonth()
const shouldShowHoaPaymentReminder = [0, 1, 11].includes(currentMonth)

const boardMembers = [
  {
    name: 'Tim Soberg',
    role: 'President',
    termYear: 2026
  },
  {
    name: 'Andrew Martin',
    role: 'Board Member',
    termYear: 2027
  },
  {
    name: 'Aaron Spurlock',
    role: 'Board Member',
    termYear: 2028
  }
]

const amenities = [
  {
    description: 'Well-maintained properties in a family-friendly neighborhood',
    icon: 'heroicons:home-modern',
    title: 'Beautiful Homes'
  },
  {
    description: 'Scenic paths throughout the neighborhood for walking and jogging',
    icon: 'heroicons:map',
    title: 'Walking Paths'
  },
  {
    description: 'Safe outdoor play areas for children and families',
    icon: 'heroicons:puzzle-piece',
    title: 'Playgrounds'
  },
  {
    description: 'Located in the highly-rated Wentzville School District',
    icon: 'heroicons:academic-cap',
    title: 'Excellent Schools'
  }
]

const helpfulLinks = [
  {
    description: 'Sign in to PayHOA to review your balance and submit HOA payments online.',
    href: 'https://www.payhoa.com',
    icon: 'heroicons:credit-card',
    linkLabel: 'Open PayHOA',
    title: 'Pay HOA Dues'
  },
  {
    description: 'Request resale and closing documents through GSP Phillips.',
    href: 'https://www.gsphillips.com/resale-documents',
    icon: 'heroicons:document-duplicate',
    linkLabel: 'Request Documents',
    title: 'Closing / Resale Documents'
  }
]

function iconForImportantDoc(icon?: string) {
  return icon?.trim() || defaultImportantDocumentIcon
}
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
            to="/updates"
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

        <M3Card
          v-if="shouldShowHoaPaymentReminder"
          variant="elevated"
          class="mx-auto mt-10 max-w-3xl border border-primary-200/80 bg-white/90 text-left shadow-xl shadow-primary-500/10 dark:border-primary-800 dark:bg-slate-900/90"
        >
          <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                <Icon
                  name="heroicons:banknotes"
                  class="h-4 w-4"
                />
                HOA Payments
              </div>
              <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">
                Need to pay your HOA bill?
              </h2>
              <p class="mt-2 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
                Residents can log in to PayHOA to make winter dues payments online during billing season.
              </p>
            </div>
            <M3Button
              variant="primary"
              size="lg"
              href="https://www.payhoa.com"
              icon="heroicons:arrow-top-right-on-square"
              icon-position="right"
            >
              Go to PayHOA
            </M3Button>
          </div>
        </M3Card>
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
            The Fox Ridge subdivision was established on January 19, 2005. Today it is a family-oriented community dedicated to maintaining high standards of living and fostering a strong sense of community among residents.
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
                  Community Focused
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  A neighborhood centered on shared standards, thoughtful stewardship, and resident involvement.
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

    <M3Section
      id="helpful-links"
      background="gradient"
      padding="lg"
    >
      <M3SectionHeader
        label="Resident Resources"
        title="Helpful Links"
        description="Quick access to the resident services people ask for most."
        size="md"
      />
      <div class="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        <M3Card
          v-for="link in helpfulLinks"
          :key="link.title"
          variant="elevated"
          hoverable
          as="article"
          class="group"
        >
          <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 transition-colors group-hover:bg-primary-500 dark:bg-primary-900/50 dark:group-hover:bg-primary-600">
            <Icon
              :name="link.icon"
              class="h-6 w-6 text-primary-600 transition-colors group-hover:text-white dark:text-primary-400 dark:group-hover:text-white"
            />
          </div>
          <h3 class="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
            {{ link.title }}
          </h3>
          <p class="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {{ link.description }}
          </p>
          <M3Button
            variant="ghost"
            size="sm"
            :href="link.href"
            icon="heroicons:arrow-top-right-on-square"
            icon-position="right"
          >
            {{ link.linkLabel }}
          </M3Button>
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

    <!-- Documents Section (Convex — board uploads) -->
    <M3Section
      v-if="showImportantDocuments"
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
          :key="doc.id"
          variant="elevated"
          hoverable
          as="article"
          class="group"
        >
          <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-primary-100 dark:bg-slate-800 dark:group-hover:bg-primary-900/50">
            <Icon
              :name="iconForImportantDoc(doc.icon)"
              class="h-6 w-6 text-slate-500 transition-colors group-hover:text-primary-600 dark:text-slate-400 dark:group-hover:text-primary-400"
            />
          </div>
          <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            {{ doc.title }}
          </h3>
          <p class="mb-4 text-sm text-slate-600 dark:text-slate-400">
            {{ doc.description }}
          </p>
          <div class="flex flex-col gap-2">
            <template
              v-for="(file, fileIndex) in doc.files"
              :key="`${doc.id}-${fileIndex}`"
            >
              <M3Button
                v-if="file.downloadUrl"
                variant="ghost"
                size="sm"
                :href="file.downloadUrl"
                icon="heroicons:arrow-down-tray"
                icon-position="right"
              >
                {{ doc.files.length > 1 ? file.label : 'Download PDF' }}
              </M3Button>
            </template>
          </div>
        </M3Card>
      </div>
    </M3Section>

    <!-- Recent updates preview -->
    <M3Section
      v-if="showCommunityUpdatesTeaser"
      id="updates"
      background="default"
      padding="lg"
    >
      <M3SectionHeader
        label="Stay Informed"
        title="Recent Posts"
        description="Updates and reminders from the board."
        size="md"
      />
      <div class="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        <M3Card
          v-for="update in recentCommunityUpdates"
          :key="update.id"
          variant="elevated"
          hoverable
          as="article"
        >
          <div
            v-if="update.imageUrls[0]"
            class="relative -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-[var(--radius-2xl,1rem)]"
          >
            <img
              :src="update.imageUrls[0]"
              alt=""
              class="h-36 w-full object-cover"
              loading="lazy"
            >
          </div>
          <h3 class="mb-4 line-clamp-4 text-xl font-semibold leading-snug text-slate-900 dark:text-white">
            {{ communityUpdateHeadline(update.bodyMarkdown) }}
          </h3>
          <div class="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Icon
              name="heroicons:user-circle"
              class="h-4 w-4"
            />
            <span>{{ update.authorDisplayName }}</span>
            <span class="text-slate-300 dark:text-slate-600">•</span>
            <time :datetime="String(update.postedAt)">
              {{
                new Date(update.postedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              }}
            </time>
          </div>
          <M3Button
            variant="ghost"
            size="sm"
            :to="`/updates/${update.id}`"
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
          to="/updates"
          icon="heroicons:newspaper"
        >
          View more
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
            <NuxtLink
              to="/contact-the-board"
              class="flex items-center gap-4 rounded-2xl bg-surface-elevated p-4 shadow-soft transition-all hover:shadow-soft-lg dark:bg-slate-800"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                <Icon
                  name="heroicons:envelope"
                  class="h-6 w-6 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Contact the Board
                </p>
                <p class="font-medium text-slate-900 dark:text-white">
                  Send a message
                </p>
              </div>
            </NuxtLink>
            <div class="flex items-center gap-4 rounded-2xl bg-surface-elevated p-4 shadow-soft dark:bg-slate-800">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                <Icon
                  name="heroicons:map-pin"
                  class="h-6 w-6 text-primary-600 dark:text-primary-400"
                />
              </div>
              <div>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Location
                </p>
                <p class="font-medium text-slate-900 dark:text-white">
                  Wentzville, MO 63385
                </p>
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
              <h3 class="font-semibold text-slate-900 dark:text-white">
                {{ hoaMeetingsDisplayYear }} HOA Meetings
              </h3>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                Board meetings are closed to residents
              </p>
            </div>
          </div>
          <div class="pt-6">
            <div
              v-if="hoaMeetingsPending"
              class="text-sm text-slate-500 dark:text-slate-400"
              role="status"
            >
              Loading…
            </div>
            <p
              v-else-if="!hoaMeetingSchedule"
              class="text-sm text-slate-600 dark:text-slate-400"
            >
              New meeting dates for this year are to be determined.
            </p>
            <div
              v-else
              class="space-y-3 text-sm text-slate-600 dark:text-slate-400"
            >
              <div
                v-for="(row, index) in hoaMeetingRows"
                :key="`${row.kind}-${row.atMs}-${index}`"
                class="flex items-center justify-between gap-4"
                :class="[
                  row.kind === 'annual' && 'border-t border-slate-100 pt-3 dark:border-slate-700',
                  row.isPast && 'opacity-80'
                ]"
              >
                <span :class="row.isPast && 'line-through'">{{ row.displayTime }}</span>
                <span
                  class="font-medium text-slate-900 dark:text-white"
                  :class="row.isPast && 'line-through'"
                >{{ row.label }}</span>
              </div>
            </div>
          </div>
        </M3Card>
      </div>
    </M3Section>
  </div>
</template>
