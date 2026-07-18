/* eslint-disable perfectionist/sort-objects -- nuxt/nuxt-config-keys-order enforces canonical key order */
// https://nuxt.com/docs/api/configuration/nuxt-config

function withoutTrailingSlash(url: string | undefined): string | undefined {
  return url?.replace(/\/+$/, '')
}

function publicSiteUrl(): string {
  return withoutTrailingSlash(process.env.NUXT_PUBLIC_SITE_URL)
    ?? withoutTrailingSlash(process.env.SITE_URL)
    ?? 'https://thefoxridgehoa.org'
}

function publicConvexUrl(): string {
  return withoutTrailingSlash(process.env.NUXT_PUBLIC_CONVEX_URL)
    ?? withoutTrailingSlash(process.env.CONVEX_URL)
    ?? ''
}

export default defineNuxtConfig({

  modules: [
    '@comark/nuxt',
    '@nuxt/fonts',
    '@nuxt/eslint',
    '@vueuse/nuxt',
    '@nuxt/ui',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/color-mode',
    'nuxt-og-image',
    'better-convex-nuxt'
  ],

  devtools: { enabled: process.env.NODE_ENV === 'development' },
  css: ['~/assets/css/main.css'],
  site: {
    name: 'Fox Ridge HOA',
    url: publicSiteUrl()
  },
  colorMode: {
    classSuffix: '',
    preference: 'system'
  },
  runtimeConfig: {
    public: {
      convexUrl: publicConvexUrl(),
      siteUrl: publicSiteUrl()
    }
  },

  routeRules: {
    '/**': {
      headers: {
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      },
      ssr: true
    },
    '/_og/**': { ssr: true },
    '/admin/**': { ssr: false },
    '/auth/**': { ssr: false }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    preset: 'vercel'
  },
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'convex/server',
        'convex/browser',
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
      withoutTrailingSlash(process.env.NUXT_PUBLIC_CONVEX_SITE_URL)
      ?? withoutTrailingSlash(process.env.CONVEX_SITE_URL),
    url:
      withoutTrailingSlash(process.env.NUXT_PUBLIC_CONVEX_URL)
      ?? withoutTrailingSlash(process.env.CONVEX_URL)
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
