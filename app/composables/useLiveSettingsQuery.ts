import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'

import { onScopeDispose, ref, shallowRef, watch } from 'vue'

const SETTINGS_QUERY_TIMEOUT_MS = 10_000

export function useLiveSettingsQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  readArgs: () => FunctionArgs<Query> | null
) {
  const nuxtApp = useNuxtApp()
  const data = shallowRef<FunctionReturnType<Query> | null>(null)
  const status = ref<'error' | 'idle' | 'pending' | 'success'>('idle')
  let stop: (() => void) | undefined

  // EFFECT: Replace the subscription so a retry starts a fresh query.
  function refresh(): Promise<void> {
    stop?.()
    const args = readArgs()
    data.value = null
    status.value = args ? 'pending' : 'idle'
    if (!args)
      return Promise.resolve()

    return new Promise<void>((resolve) => {
      let active = true
      let unsubscribe: (() => void) | undefined
      const timer = setTimeout(() => settle('error'), SETTINGS_QUERY_TIMEOUT_MS)

      function settle(next: 'error' | 'success', result: FunctionReturnType<Query> | null = null) {
        if (!active)
          return
        clearTimeout(timer)
        data.value = result
        status.value = next
        resolve()
      }

      stop = () => {
        active = false
        clearTimeout(timer)
        unsubscribe?.()
        resolve()
      }

      try {
        const client = nuxtApp.$convex
        if (!client) {
          settle('error')
          return
        }
        unsubscribe = client.onUpdate(query, args, result => settle('success', result), () => settle('error'))
      } catch {
        settle('error')
      }
    })
  }

  if (import.meta.client) {
    watch(readArgs, refresh, { immediate: true })
    onScopeDispose(() => stop?.())
  }

  return { data, refresh, status }
}
