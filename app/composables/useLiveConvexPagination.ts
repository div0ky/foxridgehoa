import type { FunctionReference, PaginationOptions } from 'convex/server'
import type { MaybeRefOrGetter } from 'vue'

import { ConvexHttpClient } from 'convex/browser'
import { getFunctionName } from 'convex/server'
import { computed, onMounted, onScopeDispose, shallowReactive, shallowRef, toValue, watch } from 'vue'

type PageOptions = PaginationOptions & { id?: number }
type PageQuery<Result> = FunctionReference<'query', 'public', { paginationOpts: PageOptions }, Result>

interface LivePage<Row> {
  continueCursor: string
  isDone: boolean
  rows: Row[]
}

interface PageRange<Row> {
  error: Error | null
  options: PageOptions
  page: LivePage<Row> | null
  pending: boolean
  stop?: () => void
}

type SubscribePage<Row> = (options: {
  onError: (error: Error) => void
  onPage: (page: LivePage<Row>) => void
  paginationOpts: PageOptions
}) => () => void

type PaginationAccess
  = | { auth: 'none', enabled?: MaybeRefOrGetter<boolean> }
    | { auth: 'required', enabled: MaybeRefOrGetter<boolean> }

const PAGE_TIMEOUT_MS = 10_000
const SSR_PAGE_TIMEOUT_MS = 4_000
let nextSubscriptionId = 0

function createPageRange<Row>(options: PageOptions) {
  return shallowReactive<PageRange<Row>>({
    error: null,
    options,
    page: null,
    pending: true
  })
}

export function createLiveConvexPagination<Row>({
  pageSize,
  subscribe
}: {
  pageSize: number
  subscribe: SubscribePage<Row>
}) {
  const ranges = shallowRef<PageRange<Row>[]>([])
  const nextRanges = shallowRef<[PageRange<Row>, PageRange<Row>] | null>(null)
  const activeRanges = computed(() => [...ranges.value, ...(nextRanges.value ?? [])])
  const tail = computed(() => ranges.value.at(-1))
  const rows = computed(() => ranges.value.flatMap(range => range.page?.rows ?? []))
  const initialized = computed(() => Boolean(ranges.value[0]?.page))
  const error = computed(() => activeRanges.value.find(range => range.error)?.error ?? null)
  const isPending = computed(() => activeRanges.value.some(range => range.pending))
  const canLoadMore = computed(() =>
    !error.value && !isPending.value && tail.value?.page?.isDone === false
  )

  function seedFirstPage({ error, page }: { error: Error | null, page: LivePage<Row> | null }) {
    const range = createPageRange<Row>({ cursor: null, numItems: pageSize })
    range.error = error
    range.page = page
    range.pending = !error && !page
    ranges.value = [range]
    return range
  }

  function promoteNextRanges() {
    const staged = nextRanges.value
    if (!staged?.every(range => range.page && !range.error && !range.pending))
      return

    tail.value?.stop?.()
    ranges.value = [...ranges.value.slice(0, -1), ...staged]
    nextRanges.value = null
  }

  // EFFECT: Reopens the range with its original boundaries and a fresh Convex query key.
  function subscribeRange(range: PageRange<Row>) {
    range.stop?.()
    let active = true
    let unsubscribe: (() => void) | undefined
    const timer = setTimeout(() => onError(new Error('Timed out waiting for a page')), PAGE_TIMEOUT_MS)
    range.stop = () => {
      active = false
      clearTimeout(timer)
      unsubscribe?.()
    }
    range.error = null
    range.pending = !range.page

    function onError(error: Error) {
      if (!active)
        return
      clearTimeout(timer)
      range.error = error
      range.pending = false
    }

    try {
      unsubscribe = subscribe({
        onError,
        onPage: (page) => {
          if (!active)
            return
          clearTimeout(timer)
          range.page = page
          range.error = null
          range.pending = false
          promoteNextRanges()
        },
        paginationOpts: { ...range.options, id: ++nextSubscriptionId }
      })
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  function start() {
    const first = ranges.value[0] ?? seedFirstPage({ error: null, page: null })
    subscribeRange(first)
  }

  function loadMore() {
    const last = tail.value
    if (!canLoadMore.value || !last?.page)
      return

    const boundary = last.page.continueCursor
    const bounded = createPageRange<Row>({ ...last.options, endCursor: boundary })
    const next = createPageRange<Row>({ cursor: boundary, numItems: pageSize })
    // Keep the old tail visible until both sides of the new boundary have settled.
    nextRanges.value = [bounded, next]
    subscribeRange(bounded)
    subscribeRange(next)
  }

  function retry() {
    for (const range of activeRanges.value) {
      if (range.error)
        subscribeRange(range)
    }
  }

  function clear() {
    for (const range of activeRanges.value)
      range.stop?.()
    nextRanges.value = null
    ranges.value = []
  }

  return { canLoadMore, clear, error, initialized, isPending, loadMore, retry, rows, seedFirstPage, start }
}

/** Public queries can seed page one in SSR. Gated queries only subscribe while enabled on the client. */
export async function useLiveConvexPagination<Result, Row>(
  query: PageQuery<Result>,
  { auth, enabled = true, pageSize, selectPage }: PaginationAccess & {
    pageSize: number
    selectPage: (result: Result) => LivePage<Row>
  }
) {
  const nuxtApp = useNuxtApp()
  const session = auth === 'required' ? useConvexAuth() : null
  const subscriptionOwner = computed(() => {
    if (!toValue(enabled))
      return null
    if (!session)
      return 'public'
    if (session.isPending.value || session.authError.value || !session.isAuthenticated.value)
      return null
    return session.user.value?.id ?? null
  })
  const pagination = createLiveConvexPagination<Row>({
    pageSize,
    subscribe: ({ onError, onPage, paginationOpts }) => {
      if (!nuxtApp.$convex)
        throw new Error('Convex client is unavailable')
      return nuxtApp.$convex.onUpdate(query, { paginationOpts }, result => onPage(selectPage(result)), onError)
    }
  })

  let active = false
  if (import.meta.client) {
    onMounted(() => watch(subscriptionOwner, (owner, previousOwner) => {
      if (previousOwner)
        pagination.clear()
      active = owner !== null
      if (active)
        pagination.start()
    }, { flush: 'sync', immediate: true }))
    onScopeDispose(() => {
      active = false
      pagination.clear()
    })
  }

  if (auth === 'none') {
    const convexUrl = useRuntimeConfig().public.convexUrl
    const firstPage = await useAsyncData(
      `convex-first-page:${getFunctionName(query)}:${pageSize}`,
      async () => {
        try {
          const client = new ConvexHttpClient(convexUrl, {
            fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(SSR_PAGE_TIMEOUT_MS) })
          })
          return selectPage(await client.query(query, {
            paginationOpts: { cursor: null, numItems: pageSize }
          }))
        } catch {
          throw new Error('Could not load the first page')
        }
      },
      { deep: false, immediate: import.meta.server }
    )
    pagination.seedFirstPage({ error: firstPage.error.value ?? null, page: firstPage.data.value ?? null })
  }

  const { canLoadMore, error, initialized, isPending, loadMore, retry, rows } = pagination
  function refresh() {
    if (active) {
      pagination.clear()
      pagination.start()
    }
  }

  return { canLoadMore, error, initialized, isPending, loadMore, refresh, retry, rows }
}
