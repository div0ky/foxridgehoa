---
name: Fox Ridge HOA
description: Calm community UI for thefoxridgehoa.org (public pages + restrained admin tooling).
colors:
  fox-orange-500: "#f97316"
  fox-orange-600: "#ea580c"
  fox-orange-400: "#fb923c"
  fox-orange-100: "#ffedd5"
  fox-orange-950: "#431407"
  surface-page-light: "#ffffff"
  surface-dim-light: "#f8fafc"
  surface-overlay-light: "#f1f5f9"
  surface-page-dark: "#0f172a"
  surface-dim-dark: "#020617"
  surface-elevated-dark: "#1e293b"
  surface-overlay-dark: "#334155"
  ink-strong-light: "#0f172a"
  ink-body-light: "#1e293b"
  ink-muted-light: "#475569"
  ink-strong-dark: "#ffffff"
  ink-body-dark: "#f1f5f9"
  ink-muted-dark: "#94a3b8"
  divider-light: "#e2e8f0"
  divider-dark: "#1e293b"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.4rem + 1.2vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 1.55rem + 2.2vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body-lg:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.875
  body-md:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label-md:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.05em"
  label-sm:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0.06em"
rounded:
  pill: "9999px"
  card: "24px"
  control: "8px"
spacing:
  section-gutter-x: "32px"
  card-padding: "24px"
  button-gap: "12px"
components:
  button-primary:
    backgroundColor: "{colors.fox-orange-500}"
    textColor: "{colors.surface-page-light}"
    rounded: "{rounded.pill}"
    padding: "16px 24px"
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.fox-orange-600}"
    textColor: "{colors.surface-page-light}"
    rounded: "{rounded.pill}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "{colors.fox-orange-100}"
    textColor: "{colors.fox-orange-600}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
    typography: "{typography.label-md}"
  card-elevated:
    backgroundColor: "{colors.surface-page-light}"
    textColor: "{colors.ink-body-light}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  badge-soft:
    backgroundColor: "{colors.fox-orange-100}"
    textColor: "{colors.fox-orange-600}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: Fox Ridge HOA

## Overview

**Creative North Star: "The Front-Porch Bulletin"**

The interface reads like a trustworthy neighborhood notice surface: daylight-friendly, calm hierarchy, orange used as a sparing signal for "tap here" and "what changed," not theater. Public pages favor scan-friendly sections, roomy line height, and slates keyed to HOA paperwork and civic calm rather than SaaS dashboards. Darkness is respectful (resident kitchen-table phone at night), not noir tech.

PRODUCT.md rejects treating the HOA like venture growth UX. Visually, this means rejecting hero-metrics templates, gratuitous novelty, and restless motion. Prefer honest labels, repeatable section rhythm, and the same accents from top to bottom of the funnel.

The system pairs **Restrained tint strategy** overall: tinted neutrals and surfaces carry the page; **fox orange (~`#f97316`)** anchors interactive emphasis and warmth. Decorative mesh and soft gradients appear only where they support depth without stealing focus (hero wash, crest-style icon badges).

**Key Characteristics:**
- Tinted slate surfaces layered through CSS variables (`--surface`, `--surface-dim`, `--surface-elevated`, `--surface-overlay`).
- Expressive-but-neighborly rounded geometry: pill buttons (`rounded-full`), generous cards (`24px`).
- Typography split: Plus Jakarta Sans for headings (`--font-display`), Inter for prose and UI chrome (`--font-sans`).
- Motion defaults to **300ms** transitions on interaction states only; avoids layout-driving animation clutter.

## Colors

The palette anchors **Warm Fox Ember orange** against **cool blue-slate infrastructure neutrals**. Orange is optimism and local identity; slate is readability and seriousness for governance content.

### Primary
- **Fox Ember 500** (`#f97316`): Default interactive highlight, crest fills, underline links on bright surfaces.
- **Fox Ember 600** (`#ea580c`): Hover emphasis, darker gradient stops, stronger anchors on light backgrounds.
- **Fox Ember 400** (`#fb923c`): Decorative gradient ramps, softened emphasis in dark mode primary highlights (see CSS `--color-primary` dark).

### Neutral
- **Snow Page (`#ffffff` / `#0f172a`)**: Default body surface alternating light/dark.
- **Mist Slate Dim (`#f8fafc` / `#020617`)**: Alternate section grounding, subdued panels.
- **Ledger Overlay (`#f1f5f9` / `#334155`)**: Nested panels, subdued cards, separators.
- **Ink Strong / Body / Muted**: `#0f172a`, `#1e293b`, `#475569` in light mode; `#ffffff`, `#f1f5f9`, `#94a3b8` in dark mode for heading, paragraph, tertiary copy.

### Secondary & Tertiary

Not used as distinct brand hues yet; badges and outlines borrow **Fox Ember tints at low chroma (`#ffedd5`, `#431407`-family dark stops)** paired with slate borders.

### Named Rules

**The Front-Porch Voice Rule.** Keep Fox Ember at conversational volume: if more than roughly one tenth of above-the-fold pixels reads as saturated orange, pull back into slate surfaces and typography weight instead of adding another orange block.

**The Dark-Mode Tint Rule.** Never pure black or pure white fills: derive surfaces from layered slate blues and softened orange accents so nighttime reading stays neighbor-calm (`main.css` dark RGB tokens).

## Typography

**Display Font:** Plus Jakarta Sans (via `family=Plus Jakarta Sans` in Nuxt Fonts, stack `system-ui`)  
**Body Font:** Inter (via Nuxt Fonts, stack `system-ui`)  
**Label Font:** Inter (semi-bold uppercase treatment for section labels via Tailwind utilities)

**Character:** Friendly structural authority: display face adds approachability without script whimsy; Inter keeps dense HOA copy legible.

### Hierarchy

- **Display (sm/md/lg clamps, 600–700 weight, tight negative tracking): Section heroes and flagship statements (`.text-display-sm|md|lg` utilities mirror token clamps).
- **Headline (.prose h1/h2 ramps + `Plus Jakarta Sans`)**: Markdown page titles (`~2.75rem`) and sectional headlines (`text-4xl`).
- **Title (semi-bold Inter at `text-xl`):** In-card headings, tertiary titles.
- **Body (`body-md` / `body-lg` vars, relaxed leading ~1.75–1.875): Residential reading comfort; wrap near **65–70ch** in prose widths.
- **Label (`label-md`, `label-sm`, uppercase footer labels): Compact navigation/meta (footer column headings use `tracking-wider` uppercase).

### Named Rules

**The Two-Family Maximum Rule.** Only Plus Jakarta Sans and Inter participate in semantic roles; reach for weight and size before introducing a novelty face.

## Icons

**Standard set: [Lucide](https://lucide.dev)** (via `@iconify-json/lucide` and `@nuxt/icon`). One stroke weight and geometry keeps the HOA UI quiet and legible; avoid mixing other open-icon families in new work.

### Usage in Nuxt

- **`<Icon name="…" />`:** `lucide:<kebab-case-name>` (example: `lucide:house`, `lucide:arrow-right`).
- **Props / config strings** (for example `M3Button` `icon`, toolbar items): prefer the collection prefix form `i-lucide-<kebab-case>` (example: `i-lucide-mail`, `i-lucide-calendar`) so Nuxt Icon resolves the same glyphs consistently.

Pick the closest Lucide glyph to the meaning you need; **do not** introduce parallel Heroicons (or other sets) for new UI. Some existing routes and config still reference legacy `heroicons:*` names; migrate those to Lucide when touching the file, so the surface converges on one family.

### Named rules

**The Single-Stroke Rule.** Icons support labels and actions; they are not decoration. Default to outline-weight Lucide at readable sizes (`16–24px` inline, larger only for crest tiles or empty states).

**The Masthead Glyph Rule.** The brand crest tile uses a single **home / residence** Lucide metaphor (for example `lucide:house`), orange gradient tile, rounded square; keep that pairing stable across header and footer.

## Elevation

The system favors **flat tonal layering**: surfaces step through tinted backgrounds before introducing shadow. Shadows are diffuse and soft, emphasizing lift on interactive cards—not harsh drop dialogs.

### Shadow Vocabulary

- **Soft Halo (`shadow-soft-lg` = `0 10px 40px -10px rgb(0 0 0 / 10%), 0 2px 10px -2px rgb(0 0 0 / 4%)`): Large marketing cards, expressive tiles.
- **Primary Glow (`shadow-lg shadow-primary-500/25` on `.gradient-primary`):** Crest icon tiles and branded buttons; restrained chroma halo.
- **Dark Mode Plate:** Omit heavy shadows (`dark:shadow-none` on `M3Card` elevated variant) when surfaces already carry depth via border contrast.

### Named Rules

**The Earned Lift Rule.** Cards sit flat (`border` + tonal fill) until interaction or purposeful emphasis; translateY lifts (`hover:-translate-y-1`) only accompany existing interactive affordances (`.card-interactive` utility).

## Components

### Buttons

- **Character:** Friendly pills with confident orange fills; gradients express warmth on primary—not startup neon.
- **Shape:** Fully rounded capsules (`rounded-full`), min heights `44px` (`sm` shares min height for tap targets).
- **Primary Fill:** Gradient `primary-500→600`, softened hover lighten, elongated shadow tinted orange.
- **Secondary:** Transparent fill with tinted `fox-orange` border tones and subtle background wash (`primary-50/50`).
- **Ghost:** Text-first with gentle hover washes (`primary-50`/`primary-950/50`).
- **Focus:** `.focus-ring` applies `focus-visible` ring (`ring-primary-500`, `2px`, offset respecting light/dark base).

### Chips / Badges

- **Default (`soft`):** Low-chroma tinted pill (`fox-orange` 100 bg / dark translucent 900) with **`tracking-wide`** and rounded-full silhouette.
- **Variants:** Outline + muted slate for metadata; saturated `primary` fill reserved for standout tags.

### Cards / Containers (`M3Card`)

- **Corner Style:** **`24px`** (`rounded-3xl`), generous breathing room (`p-5` mobile, `sm:p-6`).
- **Elevated Variant:** Surface elevated fill with light border `(slate-100)` + `shadow-soft` in light mode; flattened for dark slate mode.
- **Filled Variant:** Transparently tinted fox-orange wash signaling featured content buckets.
- **Interactive Layer:** Applies `.card-interactive` for hover elevation + `-translate-y-1`.

### Sections (`M3Section`)

- Background modes: baseline surface, muted dim slab, tonal hero gradient, or **orange-tint mesh** overlays with restrained radial fades.
- **Padding Scale:** Vertical rhythm climbs `py-14 → py-32` responsive to keep sections feeling like stacked bulletin boards, not cramped feeds.

### Navigation

- **Header:** Sticky translucent bar (`backdrop-blur`, `border-b` tinted slate); brand cluster uses crest tile with **`gradient-to-br`** fox palette.
- **Desktop:** Slate text hover shifts to tinted hover wash; maintain `text-sm font-medium`.
- **Mobile Slideover (`USlideover`):** Rounded inset menu cluster with bordered slate shell; footer hosts admin/sign-out `M3Button`.

### Masthead crest & icon badge

Rounded square tile (**`rounded-xl` ~12px**) with gradient fox orange + Lucide residence glyph (`lucide:house` or agreed equivalent); duplicates in footer at smaller scale—signature brand garnish (not faux enterprise logo chrome).

### Prose surfaces

Markdown body uses Tailwind Typography customizations: anchor color inherits primary with underline offset; blockquotes cite `border-l-4 primary-400` (existing pattern—do **not** add new asymmetric accent stripes elsewhere).

### Signature utilities

`.mesh-gradient`, `.glass`, `.glass-subtle`, `.focus-ring`, `.animate-fade-in`, `.animate-slide-up` live in `app/assets/css/main.css` for hero washes, overlays, onboarding fades; treat them as guarded spices, default calm surfaces first.

## Do's and Don'ts

PRODUCT.md forbids interfaces that imitate **generic SaaS landing patterns**. Reflect that verbatim in guardrails below.

### Do:

- **Do** keep fox orange concentrated on actionable controls, crest chips, sincere links—pair with expansive negative space (`max-w-6xl` gutters, roomy section spacing).
- **Do** leverage Plus Jakarta Sans headlines + Inter paragraphs for HOA copy; align body widths to readable measure (~`65–70ch`).
- **Do** use tonal surfaces (`surface`, `dim`, `overlay`) prior to stacking shadows; reference CSS variables listed in `@layer base`.
- **Do** respect **`prefers-reduced-motion`** by ensuring critical info never depends on Decorative slides (animations are enhancement-only fades).
- **Do** cite **the Front-Porch Bulletin** metaphor when debating new ornament: ask whether a printed HOA flyer would include the element.
- **Do** use **Lucide** for icons (see Icons section); when editing older files, swap remaining `heroicons:*` IDs to Lucide equivalents.

### Don't:

- **Don't** recreate **generic SaaS landing clichés**: fake urgency microcopy, giant vanity metrics blocks, homogeneous icon-grids promising "growth," hollow testimonial scaffolding.
- **Don't** sprinkle **Fox Ember patches** arbitrarily on static text blocks; emphasize through typography before color.
- **Don't** bolt on **novel gradient-text headlines** (`bg-clip-text` treatment) except where legacy utility already exists—and never for essential reading content.
- **Don't** thicken **accent side-stripes** arbitrarily on structural cards/lists (avoid new `border-l` thicker than informational needs; aligns with immaculate ban on ornamental side rails).
- **Don't** darken the HOA site into nightclub contrast; dark mode stays slate-blue layered, softened orange—not neon cyber.
