/// <reference types="vite/client" />

import type { FunctionReturnType } from 'convex/server'

import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'

import { api } from '../../convex/_generated/api'
import schema from '../../convex/schema'
import { createLiveConvexPagination } from './useLiveConvexPagination'

const modules = import.meta.glob(['../../convex/**/*.ts', '!../../convex/**/*.test.ts'])

test('live update ranges retain rows on failure, follow reordered posts, and discard old requests', async () => {
  const backend = convexTest(schema, modules)
  const query = api.communityUpdates.paginateCommunityUpdatesPublic
  const [newest, boundary, older, oldest] = await backend.run(async ({ db }) => {
    const ids = []
    for (const postedAt of [40, 30, 20, 10]) {
      ids.push(await db.insert('communityUpdates', {
        authorDisplayName: 'Test Board',
        bodyMarkdown: `Update ${postedAt}`,
        createdAt: postedAt,
        images: [],
        postedAt,
        postedByAuthUserId: 'test_author',
        updatedAt: postedAt
      }))
    }
    return ids
  })

  function selectPage({ data }: FunctionReturnType<typeof query>) {
    return { continueCursor: data.continueCursor, isDone: data.isDone, rows: data.updates }
  }

  type Row = ReturnType<typeof selectPage>['rows'][number]
  type SubscribePage = Parameters<typeof createLiveConvexPagination<Row>>[0]['subscribe']
  const requests: (Parameters<SubscribePage>[0] & { stopped: boolean })[] = []
  const pagination = createLiveConvexPagination<Row>({
    pageSize: 2,
    subscribe: (request) => {
      const subscription = { ...request, stopped: false }
      requests.push(subscription)
      return () => {
        subscription.stopped = true
      }
    }
  })
  const publishSnapshots = async () => {
    const deliveries = await Promise.all(requests.filter(request => !request.stopped).map(async request => ({
      page: selectPage(await backend.query(query, { paginationOpts: request.paginationOpts })),
      request
    })))
    for (const { page, request } of deliveries)
      request.onPage(page)
  }
  const bodies = () => pagination.rows.value.map(row => row.bodyMarkdown)

  const firstPage = selectPage(await backend.query(query, { paginationOpts: { cursor: null, numItems: 2 } }))
  pagination.seedFirstPage({ error: null, page: firstPage })
  expect(bodies()).toEqual(['Update 40', 'Update 30'])
  pagination.start()
  await publishSnapshots()

  pagination.loadMore()
  const firstRequest = requests[0]!
  const boundedRequest = requests[1]!
  const failedRequest = requests[2]!
  expect(boundedRequest.paginationOpts.endCursor).toBe(failedRequest.paginationOpts.cursor)
  failedRequest.onError(new Error('Later page failed'))
  expect(bodies()).toEqual(['Update 40', 'Update 30'])
  expect(pagination.error.value?.message).toBe('Later page failed')

  pagination.retry()
  const retryRequest = requests[3]!
  expect(failedRequest.stopped).toBe(true)
  expect(retryRequest.paginationOpts).toEqual({ ...failedRequest.paginationOpts, id: expect.any(Number) })
  expect(retryRequest.paginationOpts.id).not.toBe(failedRequest.paginationOpts.id)
  await publishSnapshots()
  expect(firstRequest.stopped).toBe(true)
  expect(bodies()).toEqual(['Update 40', 'Update 30', 'Update 20', 'Update 10'])

  await backend.run(async ({ db }) => {
    await db.patch('communityUpdates', newest!, { bodyMarkdown: 'Edited newest', postedAt: 15 })
    await db.patch('communityUpdates', oldest!, { bodyMarkdown: 'Edited oldest', postedAt: 35 })
    await db.delete('communityUpdates', boundary!)
  })
  await publishSnapshots()
  expect(bodies()).toEqual(['Edited oldest', 'Update 20', 'Edited newest'])

  await backend.run(({ db }) => db.delete('communityUpdates', older!))
  await publishSnapshots()
  expect(bodies()).toEqual(['Edited oldest', 'Edited newest'])

  pagination.clear()
  retryRequest.onPage(firstPage)
  expect(requests.every(request => request.stopped)).toBe(true)
  expect(bodies()).toEqual([])
  expect(pagination.initialized.value).toBe(false)

  pagination.seedFirstPage({ error: new Error('Server-rendered page failed'), page: null })
  pagination.start()
  expect(pagination.error.value).toBeNull()
  expect(pagination.isPending.value).toBe(true)
  const failedInitial = requests.at(-1)!
  failedInitial.onError(new Error('Initial page failed'))
  expect(pagination.error.value?.message).toBe('Initial page failed')
  pagination.retry()
  expect(requests.at(-1)!.paginationOpts).toMatchObject({ cursor: null, numItems: 2 })
  expect(requests.at(-1)!.paginationOpts.id).not.toBe(failedInitial.paginationOpts.id)
  failedInitial.onPage(firstPage)
  expect(bodies()).toEqual([])
  await publishSnapshots()
  expect(pagination.error.value).toBeNull()
  expect(bodies()).toEqual(['Edited oldest', 'Edited newest'])
})

test('a connection that never responds can be retried', () => {
  vi.useFakeTimers()
  const pagination = createLiveConvexPagination<string>({
    pageSize: 2,
    subscribe: vi.fn()
      .mockReturnValueOnce(() => undefined)
      .mockImplementationOnce(({ onPage }) => {
        onPage({ continueCursor: '', isDone: true, rows: ['Current update'] })
        return () => undefined
      })
  })

  try {
    pagination.start()
    vi.advanceTimersByTime(10_000)
    expect(pagination.error.value).toBeInstanceOf(Error)
    expect(pagination.isPending.value).toBe(false)

    pagination.retry()
    expect(pagination.error.value).toBeNull()
    expect(pagination.rows.value).toEqual(['Current update'])
  } finally {
    pagination.clear()
    vi.useRealTimers()
  }
})
