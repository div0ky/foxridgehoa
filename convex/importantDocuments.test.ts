/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'

import { api } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'])

test('listImportantDocumentsPublic returns empty list when no documents', async () => {
  const t = convexTest(schema, modules)
  const result = await t.query(api.importantDocuments.listImportantDocumentsPublic, {})

  expect(result.ok).toBe(true)
  expect(result.data.documents).toEqual([])
})
