# Fox Ridge HOA

Community website for the Fox Ridge Homeowners Association in Wentzville, Missouri. Nuxt 4 serves the public site and admin dashboard. Convex stores community updates, important documents, meeting schedules, and site banners. Better Auth handles operator sign-in.

## Project structure

- `app/pages/` contains public pages, sign-in, and admin routes.
- `app/components/m3/` contains the public site's Material Design 3-inspired components. The admin dashboard uses Nuxt UI. Both use Tailwind CSS and Lucide icons.
- `convex/` contains the backend schema, queries, mutations, and auth setup. Convex file storage holds update images and document PDFs.
- `public/` contains static assets.

## Local development

Use Node.js 24.15 or later in the 24.x line, or Node.js 26 and newer. Use Bun 1.4.4 for the lockfile's scoped overrides.

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Use a Convex development deployment. Run `bunx convex dev` in a separate terminal to sync the backend. Set `NUXT_PUBLIC_CONVEX_URL` and `NUXT_PUBLIC_CONVEX_SITE_URL` in `.env` to that deployment's cloud and HTTP site URLs. Follow the [admin auth setup](docs/admin-auth-setup.md) to configure auth and bootstrap the first board operator on the development deployment.

```bash
bun run dev
```

Open `http://localhost:3000`. Sign in at `/auth/signin` to access `/admin`.

## Tests and lint

From a clean checkout, install dependencies and run `bun run test`. The test script generates Nuxt's TypeScript and ESLint configuration before running Vitest. Tests use an in-memory Convex backend.

```bash
bun run test
bun run typecheck
bun eslint .
```

## Content updates

Use **Community updates** in the admin dashboard to publish and edit posts. Post bodies support Markdown headings, lists, quotes, links, images, code, and tables. Raw HTML and custom component syntax display as text. The dashboard also has sections for important documents, HOA meetings, and the site banner. Edit the corresponding Vue pages in `app/pages/` to change static page copy or layout.

## Build

`bun run build` uses Nitro's `vercel` preset and outputs a server build to `.vercel/output`. The build environment needs the two public Convex URLs described above. `vercel.json` pins the install command to `bunx bun@1.4.4 install --frozen-lockfile` so Vercel can read the scoped overrides in the lockfile.

For a release that changes both layers, release the Convex functions and schema before the frontend so the new homepage query and editor arguments are available.

For a local production build using the development Convex settings in `.env`:

```bash
bun run build --preset node-server
node --env-file=.env .output/server/index.mjs
```

## M3 Components

Custom Material Design 3-inspired components in `app/components/m3/`:

| Component | Purpose |
|-----------|---------|
| `M3Badge` | Labels, tags, status indicators |
| `M3Button` | CTAs, links, actions |
| `M3Card` | Content containers |
| `M3IconButton` | Icon-only actions |
| `M3Section` | Page sections with spacing |
| `M3SectionHeader` | Section titles |

## License

Private — Fox Ridge HOA © 2025
