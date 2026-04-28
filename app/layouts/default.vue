<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const colorMode = useColorMode()
const { isAuthenticated, signOut } = useConvexAuth()
const route = useRoute()

const { banner, isVisible } = await useSiteBanner()

const mobileNavOpen = ref(false)

const publicNavLinks = [
  {
    label: 'About',
    to: '/#about'
  },
  {
    label: 'Board',
    to: '/#board'
  },
  {
    label: 'Documents',
    to: '/#documents'
  },
  {
    label: 'Helpful Links',
    to: '/#helpful-links'
  },
  {
    label: 'Updates',
    to: '/updates'
  }
]

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.value === 'dark')

function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

async function onSignOut() {
  closeMobileNav()
  await signOut()
  await navigateTo('/')
}

watch(
  () => route.fullPath,
  () => {
    closeMobileNav()
  }
)
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <M3SiteBanner
      v-if="isVisible && banner"
      :body="banner.body"
    />
    <!-- M3 Expressive: Glass header with subtle backdrop blur -->
    <header class="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-lg dark:border-slate-800/50 dark:bg-slate-900/80">
      <nav class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <NuxtLink
          to="/"
          class="group flex min-w-0 items-center gap-2"
          @click="closeMobileNav"
        >
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/25">
            <Icon
              name="heroicons:home-modern"
              class="h-5 w-5 text-white"
            />
          </div>
          <span class="truncate text-lg font-bold text-slate-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
            Fox Ridge HOA
          </span>
        </NuxtLink>

        <div class="hidden items-center gap-2 md:flex">
          <NuxtLink
            v-for="link in publicNavLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {{ link.label }}
          </NuxtLink>
          <M3Button
            v-if="isAuthenticated"
            variant="ghost"
            size="sm"
            @click="onSignOut"
          >
            Sign out
          </M3Button>
          <div class="mx-2 h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <M3IconButton
            :icon="isDark ? 'heroicons:sun' : 'heroicons:moon'"
            :label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            variant="default"
            size="md"
            @click="toggleTheme"
          />
        </div>

        <div class="flex shrink-0 items-center gap-2 md:hidden">
          <M3IconButton
            :icon="isDark ? 'heroicons:sun' : 'heroicons:moon'"
            :label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            variant="default"
            size="md"
            @click="toggleTheme"
          />
          <M3IconButton
            icon="heroicons:bars-3"
            :label="mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'"
            variant="default"
            size="md"
            :aria-controls="'mobile-site-navigation'"
            :aria-expanded="mobileNavOpen"
            @click="toggleMobileNav"
          />
        </div>
      </nav>

      <USlideover
        v-model:open="mobileNavOpen"
        title="Fox Ridge HOA"
        description="Site navigation"
        side="right"
        :ui="{
          overlay: 'bg-slate-950/50 backdrop-blur-sm',
          content: 'md:hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white',
          body: 'flex flex-1 flex-col p-5',
          footer: 'border-t border-slate-200 p-5 dark:border-slate-800'
        }"
      >
        <template #body>
          <div
            id="mobile-site-navigation"
            class="flex flex-1 flex-col"
          >
            <div class="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
              <NuxtLink
                v-for="link in publicNavLinks"
                :key="link.to"
                :to="link.to"
                class="rounded-2xl px-4 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-primary-50 hover:text-primary-700 dark:text-slate-200 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                @click="closeMobileNav"
              >
                {{ link.label }}
              </NuxtLink>
            </div>
          </div>
        </template>

        <template #footer>
          <M3Button
            v-if="isAuthenticated"
            variant="secondary"
            size="md"
            class="w-full"
            @click="onSignOut"
          >
            Sign out
          </M3Button>
          <M3Button
            v-else
            variant="ghost"
            size="md"
            to="/admin"
            class="w-full"
            @click="closeMobileNav"
          >
            Admin
          </M3Button>
        </template>
      </USlideover>
    </header>

    <main class="flex flex-1 flex-col">
      <slot />
    </main>

    <!-- M3 Expressive: Rich footer with gradient accent -->
    <footer class="relative overflow-hidden border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <!-- Decorative gradient -->
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent" />

      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-10 md:grid-cols-4">
          <!-- Brand -->
          <div class="md:col-span-1">
            <div class="flex items-center gap-2">
              <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-600">
                <Icon
                  name="heroicons:home-modern"
                  class="h-4 w-4 text-white"
                />
              </div>
              <span class="font-bold text-slate-900 dark:text-white">Fox Ridge HOA</span>
            </div>
            <p class="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Serving the Fox Ridge community in Wentzville, MO, since 2005. Dedicated to maintaining a beautiful and welcoming neighborhood.
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
              Quick Links
            </h3>
            <ul class="mt-4 space-y-3">
              <li>
                <NuxtLink
                  to="/#about"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  About Us
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/#board"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Board of Directors
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/#documents"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Documents
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/#helpful-links"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Helpful Links
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Resources -->
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
              Resources
            </h3>
            <ul class="mt-4 space-y-3">
              <li>
                <NuxtLink
                  to="/updates"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Community Updates
                </NuxtLink>
              </li>
              <li>
                <a
                  href="https://www.payhoa.com"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Pay HOA Login
                </a>
              </li>
              <li>
                <a
                  href="https://www.gsphillips.com/resale-documents"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Closing / Resale Documents
                </a>
              </li>
              <li>
                <NuxtLink
                  to="/contact-the-board"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Contact the Board
                </NuxtLink>
              </li>
            </ul>
          </div>

          <!-- Contact -->
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-white">
              Contact
            </h3>
            <div class="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <p>Wentzville, MO 63385</p>
              <NuxtLink
                to="/contact-the-board"
                class="block transition-colors hover:text-primary-600 dark:hover:text-primary-400"
              >
                Contact the Board
              </NuxtLink>
            </div>
          </div>
        </div>

        <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 sm:flex-row">
          <p class="text-sm text-slate-500 dark:text-slate-500">
            © {{ new Date().getFullYear() }} Fox Ridge HOA. All rights reserved.
          </p>
          <div class="flex items-center gap-2 text-sm text-slate-500">
            <NuxtLink
              to="/admin"
              class="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400"
            >
              Admin
            </NuxtLink>
            <span class="text-slate-300 dark:text-slate-700">•</span>
            <span>Made with</span>
            <Icon
              name="heroicons:heart-solid"
              class="h-4 w-4 text-primary-500"
            />
            <span>in Wentzville</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
