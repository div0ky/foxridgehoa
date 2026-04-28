/* eslint-disable perfectionist/sort-objects -- nuxt/nuxt-config-keys-order enforces canonical key order */
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@comark/nuxt',
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/color-mode',
    'better-convex-nuxt'
  ],
  ssr: false,

  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  colorMode: {
    classSuffix: '',
    preference: 'system'
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    preset: 'vercel-static'
  },
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'convex/server',
        '@comark/vue'
      ]
    }
  },
  convex: {
    auth: {
      enabled: true,
      routeProtection: {
        preserveReturnTo: true,
        redirectTo: '/auth/signin'
      }
    },
    siteUrl:
      process.env.NUXT_PUBLIC_CONVEX_SITE_URL
      ?? process.env.CONVEX_SITE_URL,
    url: process.env.NUXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL
  },

  eslint: {
    config: {
      stylistic: {
        braceStyle: '1tbs',
        commaDangle: 'never'
      }
    }
  }
})
