import type { Id } from './_generated/dataModel'
import type { Infer } from 'convex/values'

import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalMutation, internalQuery } from './_generated/server'
import { authComponent } from './auth'
import { signUpAndInsertOperatorProfile } from './operatorProvisioning'
import { operatorRole } from './schema'

const MAX_INVITE_NAME = 160
const MAX_INVITE_EMAIL = 254
const PASSWORD_BYTES = 18

type InviteEmailConfig = {
  apiKey: string
  from: string
  signInUrl: string
}

type ProvisionOperatorResult = {
  data: {
    authUserId: string
    operatorProfileId: Id<'operatorProfiles'>
    userEmail?: string
  }
  ok: true
}

function simpleEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizeInviteInput(args: {
  email: string
  name: string
}): { email: string, name: string } {
  const email = args.email.trim().toLowerCase()
  const name = args.name.trim()

  if (!name)
    throw new ConvexError('Name is required.')
  if (!email)
    throw new ConvexError('Email is required.')
  if (name.length > MAX_INVITE_NAME)
    throw new ConvexError(`Name must be at most ${MAX_INVITE_NAME} characters.`)
  if (email.length > MAX_INVITE_EMAIL)
    throw new ConvexError(`Email must be at most ${MAX_INVITE_EMAIL} characters.`)
  if (!simpleEmailValid(email))
    throw new ConvexError('Enter a valid email address.')

  return { email, name }
}

function readInviteEmailConfig(): InviteEmailConfig {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  const siteUrl = process.env.SITE_URL

  if (!apiKey || !from)
    throw new ConvexError('ERR_MISSING_RESEND_ENV')
  if (!siteUrl)
    throw new ConvexError('ERR_MISSING_SITE_URL')

  return {
    apiKey,
    from,
    signInUrl: `${siteUrl.replace(/\/+$/, '')}/auth/signin`
  }
}

function generateTemporaryPassword(): string {
  const bytes = new Uint8Array(PASSWORD_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function buildInviteEmailBody(args: {
  name: string
  role: Infer<typeof operatorRole>
  signInUrl: string
  temporaryPassword: string
}): string {
  return [
    `Hello ${args.name},`,
    '',
    'A Fox Ridge HOA admin created an account for you.',
    '',
    `Sign in: ${args.signInUrl}`,
    `Temporary password: ${args.temporaryPassword}`,
    `Role: ${args.role}`,
    '',
    'Please sign in and change this temporary password after your first login.'
  ].join('\n')
}

async function sendInviteEmail(args: {
  apiKey: string
  email: string
  from: string
  name: string
  role: Infer<typeof operatorRole>
  signInUrl: string
  temporaryPassword: string
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      body: JSON.stringify({
        from: args.from,
        subject: 'Your Fox Ridge HOA admin invitation',
        text: buildInviteEmailBody(args),
        to: [args.email]
      }),
      headers: {
        'Authorization': `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST'
    })

    return res.ok
  } catch {
    return false
  }
}

export const assertBoardMemberByAuthUserId = internalQuery({
  args: {
    authUserId: v.string()
  },
  handler: async (ctx, { authUserId }) => {
    const profile = await ctx.db
      .query('operatorProfiles')
      .withIndex('by_authUserId', q => q.eq('authUserId', authUserId))
      .unique()
      .catch(() => null)

    if (!profile || profile.role !== 'boardMember')
      throw new ConvexError('Only board members can perform this action.')

    return true
  }
})

export const provisionOperatorInternal = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: operatorRole
  },
  handler: async (ctx, args) => {
    return await signUpAndInsertOperatorProfile({
      ctx,
      email: args.email,
      name: args.name,
      password: args.password,
      role: args.role
    })
  }
})

export const inviteOperator = action({
  args: {
    email: v.string(),
    name: v.string(),
    role: operatorRole
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx)
    if (!user || typeof user._id !== 'string')
      throw new ConvexError('Unauthenticated.')

    const isBoardMember: boolean = await ctx.runQuery(
      internal.operators.assertBoardMemberByAuthUserId,
      { authUserId: user._id }
    )
    if (!isBoardMember)
      throw new ConvexError('Only board members can perform this action.')

    const normalized = normalizeInviteInput(args)
    const emailConfig = readInviteEmailConfig()

    const temporaryPassword = generateTemporaryPassword()
    const provisionResult: ProvisionOperatorResult = await ctx.runMutation(
      internal.operators.provisionOperatorInternal,
      {
        email: normalized.email,
        name: normalized.name,
        password: temporaryPassword,
        role: args.role
      }
    )

    const inviteEmailSent = await sendInviteEmail({
      apiKey: emailConfig.apiKey,
      email: normalized.email,
      from: emailConfig.from,
      name: normalized.name,
      role: args.role,
      signInUrl: emailConfig.signInUrl,
      temporaryPassword
    })

    return {
      data: {
        inviteEmailSent,
        operatorProfileId: provisionResult.data.operatorProfileId,
        temporaryPassword,
        userEmail: provisionResult.data.userEmail ?? normalized.email
      },
      ok: true as const
    }
  }
})
