import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import type { operatorRole } from './schema'
import type { Infer } from 'convex/values'

import { ConvexError } from 'convex/values'

import { authComponent, createAuthForProvisioning } from './auth'

type SignUpUser = { email?: string, id: string, name?: string }

async function parseSignUpResult(result: unknown): Promise<SignUpUser> {
  if (result instanceof Response) {
    const parsed = await result.json().catch(() => null) as
      | null
      | { message?: string, user?: SignUpUser }
    if (!parsed?.user?.id)
      throw new ConvexError(parsed?.message ?? 'Sign-up failed.')
    return parsed.user
  }

  if (typeof result === 'object' && result !== null && 'user' in result && typeof (result as { user: SignUpUser }).user?.id === 'string')
    return (result as { user: SignUpUser }).user!

  if (
    typeof result === 'object'
    && result !== null
    && 'data' in result
    && typeof (result as { data?: { user?: SignUpUser } }).data?.user?.id === 'string'
  ) {
    return (result as { data: { user: SignUpUser } }).data.user
  }

  throw new ConvexError('Sign-up response was not recognized.')
}

/** Shared — caller enforces bootstrap secret or board-member authorization. */
export async function signUpAndInsertOperatorProfile(params: {
  ctx: MutationCtx
  email: string
  name: string
  password: string
  role: Infer<typeof operatorRole>
}): Promise<{ data: { authUserId: string, operatorProfileId: Id<'operatorProfiles'>, userEmail?: string }, ok: true }> {
  const { ctx, email, name, password, role } = params

  const { auth, headers } = await authComponent.getAuth(createAuthForProvisioning, ctx)

  try {
    const raw = await auth.api.signUpEmail({
      body: {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        password
      },
      headers
    })
    const user = await parseSignUpResult(raw)
    const authUserId = user.id

    const existingProfile = await ctx.db
      .query('operatorProfiles')
      .withIndex('by_authUserId', q => q.eq('authUserId', authUserId))
      .unique()
      .catch(() => null as Doc<'operatorProfiles'> | null)

    let profileId: Id<'operatorProfiles'>
    if (!existingProfile) {
      profileId = await ctx.db.insert('operatorProfiles', {
        authUserId,
        role
      })
    } else {
      profileId = existingProfile._id
      await ctx.db.patch(existingProfile._id, { role })
    }

    return {
      data: {
        authUserId,
        operatorProfileId: profileId,
        userEmail: user.email ?? email.trim()
      },
      ok: true
    }
  } catch (error) {
    if (error instanceof ConvexError)
      throw error
    const msg = error instanceof Error ? error.message : 'Sign-up failed.'
    throw new ConvexError(msg)
  }
}
