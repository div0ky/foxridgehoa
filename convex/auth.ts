import type { DataModel } from './_generated/dataModel'

import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { betterAuth, type BetterAuthOptions } from 'better-auth/minimal'

import { components } from './_generated/api'
import { query } from './_generated/server'
import authConfig from './auth.config'

const siteUrl = process.env.SITE_URL!
const convexSiteUrl = process.env.CONVEX_SITE_URL!

/** Extra origins (e.g. local dev) — must also be set on Convex: `npx convex env set TRUSTED_ORIGINS ...` */
function trustedOriginsForAuth(): string[] {
  const extra = process.env.TRUSTED_ORIGINS?.split(',')
    .map(prefix => prefix.trim())
    .filter(Boolean) ?? []
  return [...new Set([siteUrl, ...extra])]
}

export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: false
})

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return {
    baseURL: convexSiteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      autoSignIn: true,
      disableSignUp: true,
      enabled: true,
      requireEmailVerification: false
    },
    plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: trustedOriginsForAuth()
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx))

/** Convex-only: sign-up API enabled — never pass this to HTTP `registerRoutes` (still uses `createAuth`). */
export function createAuthForProvisioning(ctx: GenericCtx<DataModel>) {
  const base = createAuthOptions(ctx)
  return betterAuth({
    ...base,
    emailAndPassword: {
      ...base.emailAndPassword!,
      disableSignUp: false
    }
  })
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx)
    return { ok: true as const, user: user ?? null }
  }
})
