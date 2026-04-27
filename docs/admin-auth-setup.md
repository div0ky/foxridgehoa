# Admin auth (Better Auth + Convex)

## Dependency versions (dashboard shell)

Frontend admin routes use `@nuxt/ui` with Tailwind CSS v4 imports in [`app/assets/css/main.css`](/app/assets/css/main.css). Pin versions alongside the upstream [nuxt-ui-templates/dashboard](https://github.com/nuxt-ui-templates/dashboard) `package.json` when upgrading.

## Required environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_CONVEX_URL` | Nuxt `.env` | `https://<deployment>.convex.cloud` (WebSocket + HTTP base) |
| `NUXT_PUBLIC_CONVEX_SITE_URL` | Nuxt `.env` | `https://<deployment>.convex.site` (Better Auth on Convex) |
| `SITE_URL` | Nuxt + **Convex `env`** | Public origin of this Nuxt app — **must equal the browser URL** (scheme + host + port, no path), e.g. `http://localhost:3000`. Better Auth `trustedOrigins` is built from this on the server. |
| `TRUSTED_ORIGINS` | Convex `env` optional | Comma-separated **extra** trusted origins ([`convex/auth.ts`](/convex/auth.ts)); use when you truly need multiple (e.g. local + staging) without overwriting `SITE_URL`. |
| `CONVEX_SITE_URL` | Convex `env` | Same as `NUXT_PUBLIC_CONVEX_SITE_URL` |
| `BETTER_AUTH_SECRET` | Convex `env` | Long random secret for Better Auth |
| `OPERATOR_BOOTSTRAP_SECRET` | Convex `env` only | Guards the one-time **`internal`** bootstrap mutation |

Set Convex-side variables with `npx convex env set NAME value`. Restart `nuxt dev` after changing Nuxt env.

### Sign-in fails with `Invalid origin: http://localhost:3000`

That comes from Better Auth — the request’s `Origin` header is not in **`trustedOrigins`**, which is derived from Convex **`SITE_URL`** (and optional **`TRUSTED_ORIGINS`**), not only your local `.env` file.

1. Ensure Convex has the same origin your browser uses:

   ```bash
   npx convex env set SITE_URL http://localhost:3000
   ```

   If you use another port/host, values must match **exactly** (including `http` vs `https`).

2. Run `npx convex dev` (or redeploy) so updated env is live, then retry sign-in.

If you deliberately need multiple origins against one Convex dev deployment:

```bash
npx convex env set TRUSTED_ORIGINS http://localhost:3000,http://127.0.0.1:3000
```

(or keep `SITE_URL` primary and append extras.)

## Accounts and roles (`operatorProfiles`)

- **Roles** (`convex/schema.ts`): `homeOwner`, `boardMember`, `managementCompany`.
- Public HTTP sign-up stays **disabled** via `createAuth` in [`convex/http.ts`](/convex/http.ts). Provisioning runs only from Convex mutations using **`createAuthForProvisioning`** in [`convex/auth.ts**](/convex/auth.ts) (`disableSignUp: false`), never registered on HTTP.
- **Board members** invoke `api.operators.provisionOperator` ([`convex/operators.ts`](/convex/operators.ts)) to invite users; **management** can use `/admin` but cannot mutate invite.
- **Home owner** in invite UI is gated by [`~/config/product-features`](/app/config/product-features.ts): `isHomeownerInviteEnabled` (default **false**) until homeowner portal milestone.

## First board operator — bootstrap CLI

Runs the internal mutation `bootstrapFirstOperator` in [`convex/bootstrapFirst.ts`](/convex/bootstrapFirst.ts) with **`OPERATOR_BOOTSTRAP_SECRET`**, only while **zero** [`operatorProfiles`](/convex/schema.ts) rows exist (greenfield expectation). Creates the first Better Auth user and a profile row with role **`boardMember`** (so they can invite others).

Pick the exact name from **`npx convex run`’s “Available functions”** (or Dashboard ▸ Functions). It is **`bootstrapFirst:bootstrapFirstOperator`**, not `internal/...` (internal mutations still show as `module:function` in the CLI).

```bash
OPERATOR_BOOTSTRAP_SECRET='<long random>'
npx convex env set OPERATOR_BOOTSTRAP_SECRET "$OPERATOR_BOOTSTRAP_SECRET"

# Args: bootstrapSecret (must match Convex env), email, password, display name:
npx convex run bootstrapFirst:bootstrapFirstOperator '{
  "bootstrapSecret": "'"'"'$OPERATOR_BOOTSTRAP_SECRET'"'"'",
  "email": "president@example.org",
  "password": "...",
  "name": "Site bootstrap"
}'
```

If you still have a legacy path, you may also see `admin/bootstrap:bootstrapFirstOperator`; prefer **`bootstrapFirst:bootstrapFirstOperator`** for the root module in this repo.

## URLs and layouts

- **Sign-in:** `/auth/signin` (marketing `default` layout).
- **Dashboard admin:** `/admin`, `/admin/invite` (`admin-dashboard` layout, Nuxt UI dashboard shell vs M3 marketing site).
- Invite form uses **InviteRoleSelect**, which hides `homeOwner` until **`isHomeownerInviteEnabled`** is flipped in [`app/config/product-features.ts`](/app/config/product-features.ts).

## References

- [Nuxt UI dashboard template](https://github.com/nuxt-ui-templates/dashboard)
- [Better Convex Nuxt](https://better-convex-nuxt.vercel.app/)
- [Better Auth · Convex](https://better-auth.com/docs/integrations/convex)
