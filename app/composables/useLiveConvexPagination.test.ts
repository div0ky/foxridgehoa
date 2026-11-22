import { describe, expect, test } from 'vitest'

import { isConvexInvalidCursorError } from './useLiveConvexPagination'

describe('isConvexInvalidCursorError', () => {
  test('matches InvalidCursor in error message', () => {
    expect(isConvexInvalidCursorError(new Error('InvalidCursor: cursor expired'))).toBe(true)
  })

  test('matches InvalidCursor in structured ConvexError data', () => {
    const structuredError = Object.assign(new Error('Pagination failed'), {
      data: { paginationError: 'InvalidCursor' }
    })

    expect(isConvexInvalidCursorError(structuredError)).toBe(true)
  })

  test('returns false for unrelated or null errors', () => {
    expect(isConvexInvalidCursorError(null)).toBe(false)
    expect(isConvexInvalidCursorError(new Error('Network offline'))).toBe(false)
    expect(
      isConvexInvalidCursorError(
        Object.assign(new Error('Other error'), { data: { paginationError: 'Other' } })
      )
    ).toBe(false)
  })
})
