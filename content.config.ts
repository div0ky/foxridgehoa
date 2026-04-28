import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      source: '**',
      type: 'page'
    }),
    updates: defineCollection({
      schema: z.object({
        author: z.string(),
        description: z.string(),
        image: z.string().optional(),
        publishedAt: z.string(),
        tags: z.array(z.string()).optional(),
        title: z.string()
      }),
      source: 'updates/**',
      type: 'page'
    })
  }
})
