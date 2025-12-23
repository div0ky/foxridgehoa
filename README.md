# Fox Ridge HOA

Community website for the Fox Ridge Homeowners Association in Wentzville, MO. Built with Nuxt 4 and Nuxt Content for a fast, modern, and maintainable site.

## Tech Stack

- **[Nuxt 4](https://nuxt.com)** — Vue meta-framework
- **[Nuxt Content 3](https://content.nuxt.com)** — Markdown-driven content
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling
- **[Nuxt Icon](https://nuxt.com/modules/icon)** — Heroicons integration
- **[@nuxtjs/color-mode](https://color-mode.nuxtjs.org)** — Dark mode support

## Project Structure

```
foxridgehoa/
├── app/
│   ├── components/
│   │   └── m3/           # M3 design system components
│   ├── layouts/
│   │   └── default.vue   # Main layout with header/footer
│   └── pages/
│       ├── index.vue     # Homepage
│       └── posts/        # Community posts
├── content/
│   ├── index.md          # Homepage content
│   ├── about.md          # About page
│   └── posts/            # Blog posts (Markdown)
└── public/               # Static assets
```

## Setup

Install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# bun
bun install
```

## Development

Start the development server on `http://localhost:3000`:

```bash
bun run dev
```

## Production

Build for production (Vercel static deployment):

```bash
bun run build
```

Preview the production build locally:

```bash
bun run preview
```

## Content Management

### Adding Posts

Create a new Markdown file in `content/posts/`:

```markdown
---
title: Your Post Title
description: A brief description
date: 2025-01-15
---

Your content here...
```

### Editing Pages

Modify files in `content/` directory. Changes hot-reload in development.

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

## Deployment

Configured for **Vercel static** deployment via `nitro.preset: 'vercel-static'`.

## License

Private — Fox Ridge HOA © 2025
