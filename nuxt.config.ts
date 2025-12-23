// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  colorMode: {
    classSuffix: '',
    preference: 'system',
  },
  
  compatibilityDate: 'latest',

  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },

  nitro: {
    preset: 'vercel-static',
  },

  modules: [
    '@nuxt/content',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
  ],
})