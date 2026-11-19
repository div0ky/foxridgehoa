/// <reference types="vite/client" />

import type { ActionCtx, MutationCtx } from './_generated/server'

import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

vi.mock('./auth', () => ({
  authComponent: {
    async safeGetAuthUser(ctx: ActionCtx) {
      const identity = await ctx.auth.getUserIdentity()
      return identity ? { _id: identity.subject } : null
    }
  }
}))

vi.mock('./operatorProvisioning', () => ({
  async signUpAndInsertOperatorProfile({ ctx, email }: { ctx: MutationCtx, email: string }) {
    const authUserId = 'new_operator'
    const operatorProfileId = await ctx.db.insert('operatorProfiles', { authUserId, role: 'managementCompany' })
    return { data: { authUserId, operatorProfileId, userEmail: email }, ok: true }
  }
}))

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'])

test('inviteOperator throws when unauthenticated', async () => {
  const t = convexTest(schema, modules)

  await expect(
    t.action(api.operators.inviteOperator, {
      email: 'new@example.com',
      name: 'New Operator',
      role: 'managementCompany'
    })
  ).rejects.toThrow(/unauthenticated/i)
})

test('assertBoardMemberByAuthUserId rejects non-board operators', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('operatorProfiles', {
      authUserId: 'auth_user_management',
      role: 'managementCompany'
    })
  })

  await expect(
    t.query(internal.operators.assertBoardMemberByAuthUserId, {
      authUserId: 'auth_user_management'
    })
  ).rejects.toThrow(/only board members/i)
})

test('assertBoardMemberByAuthUserId accepts board members', async () => {
  const t = convexTest(schema, modules)

  await t.run(async (ctx) => {
    await ctx.db.insert('operatorProfiles', {
      authUserId: 'auth_user_board',
      role: 'boardMember'
    })
  })

  await expect(
    t.query(internal.operators.assertBoardMemberByAuthUserId, {
      authUserId: 'auth_user_board'
    })
  ).resolves.toBe(true)
})

test('an invitation still returns its temporary password when email times out', async () => {
  const t = convexTest(schema, modules)
  const subject = 'inviting_board_member'
  await t.run(ctx => ctx.db.insert('operatorProfiles', { authUserId: subject, role: 'boardMember' }))

  const { promise: requestStarted, resolve: markStarted } = Promise.withResolvers<AbortSignal | null | undefined>()
  vi.useFakeTimers()
  vi.stubEnv('RESEND_API_KEY', 'test_key')
  vi.stubEnv('RESEND_FROM', 'board@example.com')
  vi.stubEnv('SITE_URL', 'https://example.com')
  vi.stubGlobal('fetch', vi.fn<typeof fetch>((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('Email timed out')), { once: true })
    markStarted(options?.signal)
  })))

  try {
    const invitation = t.withIdentity({ subject }).action(api.operators.inviteOperator, {
      email: 'new@example.com',
      name: 'New Operator',
      role: 'managementCompany'
    })
    const signal = await requestStarted
    await vi.advanceTimersByTimeAsync(8_000)
    expect(signal?.aborted).toBe(true)
    await expect(invitation).resolves.toMatchObject({
      data: { inviteEmailSent: false, temporaryPassword: expect.any(String), userEmail: 'new@example.com' },
      ok: true
    })
  } finally {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  }
})
