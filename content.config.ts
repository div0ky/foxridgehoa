import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      source: '**',
      type: 'page',
    }),
    posts: defineCollection({
      source: 'posts/**',
      type: 'page',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        author: z.string(),
        publishedAt: z.string(),
        image: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    }),
  },
})
