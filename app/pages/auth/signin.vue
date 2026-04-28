<script setup lang="ts">
import { safeInternalPath } from '~/utils/safe-internal-path'

definePageMeta({
  layout: 'default'
})

const route = useRoute()

const { isAuthenticated, isPending, refreshAuth, signIn } = useConvexAuth()

const email = ref('')
const password = ref('')
const formError = ref<string | null>(null)
const isSubmitting = ref(false)

const defaultAfterLogin = '/admin'

onMounted(async () => {
  if (import.meta.server) {
    return
  }
  await nextTick()
  if (isAuthenticated.value && !isPending.value) {
    const target = safeInternalPath(route.query.redirect, defaultAfterLogin)
    await navigateTo(target)
  }
})

async function onSubmit() {
  formError.value = null
  const trimmedEmail = email.value.trim()
  if (!trimmedEmail || !password.value) {
    formError.value = 'Enter your email and password.'
    return
  }
  isSubmitting.value = true
  try {
    const result = await signIn.email({
      email: trimmedEmail,
      password: password.value
    })
    if (result.error) {
      formError.value = 'Sign-in failed. Check your email and password.'
      return
    }
    await refreshAuth()
    const target = safeInternalPath(route.query.redirect, defaultAfterLogin)
    await navigateTo(target)
  } catch {
    formError.value = 'Sign-in failed. Try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
    <M3Card variant="elevated">
      <h1 class="mb-2 font-display text-display-sm text-slate-900 dark:text-white">
        Admin sign in
      </h1>
      <p class="mb-8 text-sm text-slate-600 dark:text-slate-400">
        Board and site administrators only.
      </p>

      <form
        class="space-y-5"
        @submit.prevent="onSubmit"
      >
        <div>
          <label
            for="admin-email"
            class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >Email</label>
          <input
            id="admin-email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="username"
            required
            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
        </div>
        <div>
          <label
            for="admin-password"
            class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >Password</label>
          <input
            id="admin-password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
        </div>

        <p
          v-if="formError"
          class="text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {{ formError }}
        </p>

        <button
          type="submit"
          class="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </M3Card>
  </div>
</template>
