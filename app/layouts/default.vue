<script setup lang="ts">
const colorMode = useColorMode()
const { isAuthenticated, signOut } = useConvexAuth()

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.value === 'dark')

async function onSignOut() {
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- M3 Expressive: Glass header with subtle backdrop blur -->
    <header class="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-lg dark:border-slate-800/50 dark:bg-slate-900/80">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <NuxtLink
          to="/"
          class="group flex items-center gap-2"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/25">
            <Icon
              name="heroicons:home-modern"
              class="h-5 w-5 text-white"
            />
          </div>
          <span class="text-lg font-bold text-slate-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
            Fox Ridge HOA
          </span>
        </NuxtLink>

        <div class="flex items-center gap-2">
          <NuxtLink
            to="/#about"
            class="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:block"
          >
            About
          </NuxtLink>
          <NuxtLink
            to="/#board"
            class="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:block"
          >
            Board
          </NuxtLink>
          <NuxtLink
            to="/#helpful-links"
            class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Helpful Links
          </NuxtLink>
          <NuxtLink
            to="/posts"
            class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Posts
          </NuxtLink>
          <NuxtLink
            to="/admin"
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Admin
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
      </nav>
    </header>

    <main class="flex-1">
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
                  to="/posts"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Community Posts
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
                <a
                  href="/#contact"
                  class="text-sm text-slate-600 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400"
                >
                  Contact Us
                </a>
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
              <a
                href="mailto:info@thefoxridgehoa.org"
                class="block transition-colors hover:text-primary-600 dark:hover:text-primary-400"
              >
                info@thefoxridgehoa.org
              </a>
            </div>
          </div>
        </div>

        <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 sm:flex-row">
          <p class="text-sm text-slate-500 dark:text-slate-500">
            © {{ new Date().getFullYear() }} Fox Ridge HOA. All rights reserved.
          </p>
          <div class="flex items-center gap-2 text-sm text-slate-500">
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
