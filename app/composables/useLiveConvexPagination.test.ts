import type { FunctionReference } from 'convex/server'

import { afterEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

import {
  isConvexInvalidCursorError,
  useLiveConvexPagination
} from './useLiveConvexPagination'

interface MockPageResponse {
  data: {
    continueCursor: null | string
    isDone: boolean
    items: Array<{ id: string }>
    pageStatus?: 'SplitRecommended' | 'SplitRequired' | null
    splitCursor?: null | string
  }
  ok: true
}

interface SubscriptionRecord {
  active: boolean
  emit: (result: MockPageResponse) => void
  emitError: (err: unknown) => void
  paginationOpts: {
    cursor: null | string
    endCursor?: null | string
    id: number
    numItems: number
  }
}

function createHarness() {
  const firstPageData = shallowRef<MockPageResponse | null>(null)
  const firstPageError = ref<Error | null>(null)
  const firstPageStatus = ref<'error' | 'pending' | 'success'>('success')
  const firstPageArgsHistory: Array<unknown> = []
  const subscriptions: SubscriptionRecord[] = []

  const convexClient = {
    onUpdate: (
      _query: unknown,
      args: { paginationOpts: SubscriptionRecord['paginationOpts'] },
      onResult: (result: MockPageResponse) => void,
      onError: (err: unknown) => void
    ) => {
      const record: SubscriptionRecord = {
        active: true,
        emit: (result) => {
          if (record.active)
            onResult(result)
        },
        emitError: (err) => {
          if (record.active)
            onError(err)
        },
        paginationOpts: args.paginationOpts
      }
      subscriptions.push(record)
      return () => {
        record.active = false
      }
    }
  }

  vi.stubGlobal('useNuxtApp', () => ({ $convex: convexClient }))
  vi.stubGlobal('useConvexQuery', async (_query: unknown, argsGetter: () => unknown) => {
    const reactiveArgs = () => {
      const value = argsGetter()
      firstPageArgsHistory.push(value)
      return value
    }
    reactiveArgs()
    return {
      data: firstPageData,
      error: firstPageError,
      getLatestArgs: argsGetter,
      status: firstPageStatus
    }
  })

  return {
    firstPageArgsHistory,
    firstPageData,
    firstPageError,
    firstPageStatus,
    subscriptions
  }
}

const dummyQuery = {} as FunctionReference<'query'>

function extractMockPage(raw: MockPageResponse | null) {
  if (!raw?.ok)
    return null
  return {
    continueCursor: raw.data.continueCursor,
    isDone: raw.data.isDone,
    items: raw.data.items,
    pageStatus: raw.data.pageStatus,
    splitCursor: raw.data.splitCursor
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('useLiveConvexPagination', () => {
  test('binds watchers to caller effect scope and stops opening subscriptions after dispose', async () => {
    const harness = createHarness()
    harness.firstPageData.value = {
      data: {
        continueCursor: 'c2',
        isDone: false,
        items: [{ id: '1' }, { id: '2' }]
      },
      ok: true
    }

    const scope = effectScope()
    let pagination!: Awaited<ReturnType<typeof useLiveConvexPagination<MockPageResponse, { id: string }>>>
    await scope.run(async () => {
      pagination = await useLiveConvexPagination<MockPageResponse, { id: string }>({
        extractPage: extractMockPage,
        getItemId: item => item.id,
        pageSize: 2,
        query: dummyQuery
      })
    })

    pagination.loadMore()
    expect(harness.subscriptions).toHaveLength(1)
    expect(harness.subscriptions[0]?.active).toBe(true)

    scope.stop()
    expect(harness.subscriptions[0]?.active).toBe(false)

    harness.firstPageData.value = {
      data: {
        continueCursor: 'c2',
        isDone: false,
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
        pageStatus: 'SplitRecommended',
        splitCursor: 'c1'
      },
      ok: true
    }
    await nextTick()

    expect(harness.subscriptions).toHaveLength(1)
  })

  test('bounds right half to continueCursor and preserves rows until both halves resolve on split', async () => {
    const harness = createHarness()
    harness.firstPageData.value = {
      data: {
        continueCursor: 'c2',
        isDone: false,
        items: [{ id: '1' }, { id: '2' }]
      },
      ok: true
    }

    const scope = effectScope()
    let pagination!: Awaited<ReturnType<typeof useLiveConvexPagination<MockPageResponse, { id: string }>>>
    await scope.run(async () => {
      pagination = await useLiveConvexPagination<MockPageResponse, { id: string }>({
        extractPage: extractMockPage,
        getItemId: item => item.id,
        pageSize: 2,
        query: dummyQuery
      })
    })

    pagination.loadMore()
    const page2Sub = harness.subscriptions[0]!
    expect(page2Sub.paginationOpts).toMatchObject({ cursor: 'c2', numItems: 2 })
    expect(page2Sub.paginationOpts.endCursor).toBeUndefined()

    page2Sub.emit({
      data: {
        continueCursor: 'c6',
        isDone: false,
        items: [{ id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }],
        pageStatus: 'SplitRecommended',
        splitCursor: 'c4'
      },
      ok: true
    })

    // Both split halves must be bounded at [c2, c4] and [c4, c6] (never unbounded).
    expect(harness.subscriptions).toHaveLength(3)
    const leftSub = harness.subscriptions[1]!
    const rightSub = harness.subscriptions[2]!
    expect(leftSub.paginationOpts).toMatchObject({ cursor: 'c2', endCursor: 'c4' })
    expect(rightSub.paginationOpts).toMatchObject({ cursor: 'c4', endCursor: 'c6' })

    // Left half resolves first: rows 5 and 6 must remain visible until right half resolves.
    leftSub.emit({
      data: {
        continueCursor: 'c4',
        isDone: false,
        items: [{ id: '3' }, { id: '4' }]
      },
      ok: true
    })
    expect(page2Sub.active).toBe(true)
    expect(pagination.items.value.map(i => i.id)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(pagination.isPending.value).toBe(true)

    // Right half resolves: parent is unsubscribed and both halves swap in atomically.
    rightSub.emit({
      data: {
        continueCursor: 'c6',
        isDone: false,
        items: [{ id: '5' }, { id: '6' }]
      },
      ok: true
    })
    expect(page2Sub.active).toBe(false)
    expect(leftSub.active).toBe(true)
    expect(rightSub.active).toBe(true)
    expect(pagination.items.value.map(i => i.id)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(pagination.isPending.value).toBe(false)

    scope.stop()
  })

  test('stages first-page splits bounded at continueCursor without dropping rows', async () => {
    const harness = createHarness()
    harness.firstPageData.value = {
      data: {
        continueCursor: 'c4',
        isDone: false,
        items: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
        pageStatus: 'SplitRecommended',
        splitCursor: 'c2'
      },
      ok: true
    }

    const scope = effectScope()
    let pagination!: Awaited<ReturnType<typeof useLiveConvexPagination<MockPageResponse, { id: string }>>>
    await scope.run(async () => {
      pagination = await useLiveConvexPagination<MockPageResponse, { id: string }>({
        extractPage: extractMockPage,
        getItemId: item => item.id,
        pageSize: 2,
        query: dummyQuery
      })
    })

    expect(harness.subscriptions).toHaveLength(1)
    const stagedRight = harness.subscriptions[0]!
    expect(stagedRight.paginationOpts).toMatchObject({ cursor: 'c2', endCursor: 'c4' })
    expect(pagination.items.value.map(i => i.id)).toEqual(['1', '2', '3', '4'])
    expect(pagination.isPending.value).toBe(true)

    stagedRight.emit({
      data: {
        continueCursor: 'c4',
        isDone: false,
        items: [{ id: '3' }, { id: '4' }]
      },
      ok: true
    })

    expect(pagination.items.value.map(i => i.id)).toEqual(['1', '2', '3', '4'])
    expect(pagination.isPending.value).toBe(false)

    // Once page 0 shrinks to [1, 2], rows [3, 4] remain present from the committed right half.
    harness.firstPageData.value = {
      data: {
        continueCursor: 'c2',
        isDone: false,
        items: [{ id: '1' }, { id: '2' }]
      },
      ok: true
    }
    await nextTick()
    expect(pagination.items.value.map(i => i.id)).toEqual(['1', '2', '3', '4'])

    scope.stop()
  })

  test('preserves loaded rows on older-page error, retries in place, and resets on InvalidCursor', async () => {
    const harness = createHarness()
    harness.firstPageData.value = {
      data: {
        continueCursor: 'c2',
        isDone: false,
        items: [{ id: '1' }, { id: '2' }]
      },
      ok: true
    }

    const scope = effectScope()
    let pagination!: Awaited<ReturnType<typeof useLiveConvexPagination<MockPageResponse, { id: string }>>>
    await scope.run(async () => {
      pagination = await useLiveConvexPagination<MockPageResponse, { id: string }>({
        extractPage: extractMockPage,
        getItemId: item => item.id,
        pageSize: 2,
        query: dummyQuery
      })
    })

    pagination.loadMore()
    const sub1 = harness.subscriptions[0]!
    sub1.emitError(new Error('Temporary network error'))

    expect(pagination.items.value.map(i => i.id)).toEqual(['1', '2'])
    expect(pagination.error.value?.message).toBe('Temporary network error')
    expect(pagination.canLoadMore.value).toBe(false)

    pagination.retryFailedPages()
    expect(harness.subscriptions).toHaveLength(2)
    const sub2 = harness.subscriptions[1]!
    expect(sub2.paginationOpts.cursor).toBe('c2')

    sub2.emitError(
      Object.assign(new Error('Pagination failed'), { data: { paginationError: 'InvalidCursor' } })
    )
    pagination.retryFailedPages()
    expect(sub2.active).toBe(false)
    expect(pagination.error.value).toBeNull()

    scope.stop()
  })
})
