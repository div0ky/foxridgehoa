import type { FunctionReturnType } from 'convex/server'

import { expect, test, vi } from 'vitest'

import { api } from '../../convex/_generated/api'
import { useLiveSettingsQuery } from './useLiveSettingsQuery'

test('a settings read can recover on a new subscription after a later failure', async () => {
  const query = api.siteBanner.getAdminSiteBanner
  type BannerResult = FunctionReturnType<typeof query>
  const attempts: { onError: () => void, onValue: (result: BannerResult) => void }[] = []
  const unsubscribe = vi.fn()
  vi.stubGlobal('useNuxtApp', () => ({
    $convex: {
      onUpdate(_query: typeof query, _args: object, onValue: (result: BannerResult) => void, onError: () => void) {
        attempts.push({ onError, onValue })
        return unsubscribe
      }
    }
  }))

  try {
    const settings = useLiveSettingsQuery(query, () => ({}))
    const emptyBanner = { data: { banner: null }, ok: true } as const
    const firstRead = settings.refresh()
    const first = attempts[0]!
    first.onValue(emptyBanner)
    await firstRead
    expect(settings.status.value).toBe('success')

    first.onError()
    expect(settings.status.value).toBe('error')
    expect(settings.data.value).toBeNull()

    const retry = settings.refresh()
    expect(unsubscribe).toHaveBeenCalledOnce()
    first.onValue(emptyBanner)
    expect(settings.status.value).toBe('pending')

    attempts[1]!.onValue(emptyBanner)
    await retry
    expect(settings.status.value).toBe('success')
    expect(settings.data.value).toEqual(emptyBanner)
  } finally {
    vi.unstubAllGlobals()
  }
})
