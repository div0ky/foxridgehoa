import { expect, test } from 'vitest'

import { safeInternalPath } from './safe-internal-path'

test('safeInternalPath keeps ordinary application paths', () => {
  expect(safeInternalPath('/admin/account?tab=password#change', '/admin')).toBe(
    '/admin/account?tab=password#change'
  )
})

test.each([
  'https://example.com',
  '//example.com',
  '/\\example.com',
  '/admin\\..\\example.com',
  '/admin\n/example.com',
  ''
])('safeInternalPath rejects unsafe redirect %j', (candidate) => {
  expect(safeInternalPath(candidate, '/admin')).toBe('/admin')
})
