import { defineContentConfig, defineCollection } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      source: '**',
      type: 'page',
    }),
    posts: defineCollection({
      source: 'posts/**',
      type: 'page',
    }),
  },
})
