# Manual auth test checklist

Run with env from `.env.example` configured for both Nuxt and Convex.

1. **Unauthenticated /admin** — Open `/admin` in a private window. Expect redirect to `/auth/signin` (with `redirect` query pointing back to `/admin` when `preserveReturnTo` is on).
2. **Sign-in** — Use a provisioned admin (see [admin-auth-setup.md](./admin-auth-setup.md)). Expect **immediate client redirect** to `/admin` (or the `redirect` target) **without** a hard refresh; the Convex token must load while still on `/auth/signin`.
3. **Session** — Refresh `/admin`; expect to stay on the page and the Convex `getCurrentUser` smoke UI to show your email.
4. **Sign-out** — Use **Sign out** in the site header. Expect redirect to home (layout) and `/admin` to require sign-in again.
5. **Public site** — `/`, `/updates`, and update detail pages still load without auth.
6. **Open redirect** — Open `/auth/signin?redirect=https://evil.com` after sign-in; expect navigation to stay internal (defaults to `/admin` when the path is not a safe same-origin path).

Optional: add Playwright or Vitest when CI requires automated coverage.
