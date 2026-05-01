/// <reference types="vite/client" />

import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'

import { api, internal } from './_generated/api'
import schema from './schema'

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
