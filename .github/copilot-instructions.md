# Copilot Instructions for CHS Mesh

## Project Overview

CHS Mesh is an Astro-based static website for Charleston's Meshtastic community. It showcases local mesh network nodes, community meetups, educational guides, and hardware resources. The site emphasizes off-grid communication and community-driven content.

**Tech Stack**: Astro 5, Tailwind CSS 4, TypeScript, Markdown (content)

## Architecture & Data Flow

### Content Collections (Astro Content API)
Content is organized in `src/content/` with schema validation in `src/content/config.ts`:
- **meetups**: Community events with dates, locations, optional coordinates for map display. `src/content/meetups/` exists (kept in git by a `.gitkeep`) but holds no entries yet — add the first `.md` file there.
- **guides**: Tutorials with difficulty levels (beginner/intermediate/advanced) and categories (getting-started, hardware, software, network, troubleshooting). 4 entries in `src/content/guides/`.
- **resources**: Hardware device specifications and community links. 7 entries in `src/content/resources/`.
- **nodes**: JSON files describing community-registered mesh network nodes. `type` is one of `relay`, `router`, `client`, `solar` (default `client`). No entries yet: `src/content/nodes/` is empty and has no `.gitkeep`, so git does not carry it and a fresh clone has no such directory — create it alongside the first node file. `/map` counts zero nodes and renders its "No Nodes Registered" empty state until then; the records are owner-submitted, not live telemetry.
- **taxonomies**: Display labels, descriptions, and icons for guide categories/difficulties, resource categories, and meetup statuses/badges. A single entry, `src/content/taxonomies/default.md`, read through `src/utils/taxonomy.ts`.
- **global**: Site metadata and per-page copy — 11 Markdown files in `src/content/global/`: `site.md`, `navigation.md`, `footer.md`, `home.md`, `about.md`, `map.md`, `guides.md`, `guides-detail.md`, `meetups.md`, `meetups-detail.md`, `resources.md`. The schema is a discriminated union on the `type` frontmatter field, so each file must declare its `type`.

### Page Generation
- Static routes: `src/pages/` → predictable URLs (index.astro → /, about.astro → /about)
- Dynamic content routes: `[slug].astro` files generate pages from collections (e.g., `/guides/[slug]`, `/meetups/[slug]`)
- Dynamic routes use `getStaticPaths()` to generate all collection items at build time
- Uses `getCollection()` and `render()` from `astro:content` for content access

### Styling
- Tailwind CSS 4 with @tailwindcss/vite plugin configured in `astro.config.mjs`
- Global styles in `src/styles/global.css` (utility classes like `.btn-primary`, `.stat-card`, badge variants)
- Component-scoped styles use `<style>` tags in .astro files
- Grid-based layouts use Tailwind's grid system with responsive breakpoints (md:, lg:)

## Key Workflows

### Adding Content
1. Create markdown file in `src/content/{collection}/` with YAML frontmatter matching schema
2. For guides: Must include `title`, `description`, `difficulty`, `category`, `order` (determines page sort)
3. For meetups: Must include `title`, `date`, `endDate` (optional), `location`, `coordinates` (optional, for map)
4. Markdown content uses standard GFM syntax; rendered via Astro's render() function
5. Build automatically generates pages; no manual registration needed

### Adding Components
- All components in `src/components/` use .astro format (not JSX/React)
- Component naming: `PascalCase.astro` (e.g., `GuideCard.astro`, `MeetupCard.astro`)
- Import components and collections in page frontmatter (YAML before first ---)
- Use component props for data passing; define Props interface with TypeScript for type safety
- Example: `GuideCard.astro` accepts `{guide: CollectionEntry<'guides'>}` and destructures `guide.data` properties

### Development Commands
```bash
npm run dev        # Start localhost:4321 with hot reload
npm test           # node --test — security/config suites under test/
npm run check      # astro check — types plus content-collection schemas
npm run build      # Generate dist/ for production (also emits sitemap-index.xml)
npm run preview    # Test built site locally
npm run astro ...  # Pass through Astro CLI commands
```

`check` is not part of `build`; CI runs both.

## Project-Specific Conventions

### Content Frontmatter Patterns
- Dates use ISO format (e.g., `2026-02-15`) and are coerced to JS Date objects via schema
- Difficulty badges: `badge-beginner` (green), `badge-intermediate` (yellow), `badge-advanced` (red)
- Featured items: Use `featured: true` in frontmatter to highlight on index/listing pages
- Ordering: `order` field controls sort precedence in collections (lower = earlier in list)

### Layout Structure
- All pages extend `src/layouts/Layout.astro`, which handles SEO metadata, header/footer
- Pass `title`, `description`, and `ogImage` props to Layout for page-specific metadata
- Header navigation comes from `src/content/global/navigation.md`; the footer (brand blurb, quick links, community links, copyright, trademark) comes from `src/content/global/footer.md`. Update the matching file — editing `navigation.md` does not change the footer.

### Component Composition
- Cards (GuideCard, MeetupCard, ResourceCard) expect collection item objects with `data` and `id` properties
- Category/difficulty/status labels: resolve them through `getTaxonomyLabels()` in `src/utils/taxonomy.ts`, which reads `src/content/taxonomies/default.md`. Never hand-write a local lookup object — component-private maps drifted from the authored taxonomy (a card said "Device" where the taxonomy says "Devices"). Cards resolve their own labels, so pages do not drill taxonomy props through them
- Upcoming vs. past meetups: use `isUpcomingMeetup()` / `isPastMeetup()` from `src/utils/meetups.ts`. They compare against `endDate ?? date`, so an event that has started but not ended still counts as upcoming; a bare `data.date >= now` test would drop it from the listing mid-event
- Page copy: load it with `getGlobal(id, type)` from `src/utils/global.ts` rather than `getEntry('global', id)` plus `?? ''` fallbacks. It throws on a missing entry or a `type` mismatch, so an authoring mistake fails the build instead of rendering a blank heading
- CTA buttons: build the class with `getCtaClass(variant, size?)` from `src/utils/cta.ts`; every page rendering a `ctaSchema` entry uses it

## Common Patterns & Examples

### Filtering & Sorting Collections
```astro
const allGuides = await getCollection('guides');
const featured = allGuides
  .filter((g) => g.data.category === 'getting-started')
  .sort((a, b) => a.data.order - b.data.order)
  .slice(0, 3);
```

### Rendering Dynamic Content
```astro
const { guide } = Astro.props;
const { Content } = await render(guide);
// Use <Content /> component to render markdown HTML
```

### Shared Utilities (`src/utils/`)

Enum-to-label maps, meetup date logic, page-copy loading, and CTA classes are
centralized. Reach for these instead of re-deriving them in a component:

```astro
---
import { getTaxonomyLabels } from '../utils/taxonomy';
import { isUpcomingMeetup, isPastMeetup } from '../utils/meetups';
import { getGlobal } from '../utils/global';
import { getCtaClass } from '../utils/cta';

// Display labels, straight from src/content/taxonomies/default.md.
// Shape: { guideCategories, guideDifficulties, resourceCategories,
//          meetupStatuses, meetupBadges }, each a Record<string, string>.
const labels = await getTaxonomyLabels();
const difficultyLabel = labels.guideDifficulties[guide.data.difficulty];

// End-date aware: a running event stays "upcoming" until endDate ?? date passes.
const now = new Date();
const upcoming = allMeetups.filter((m) => isUpcomingMeetup(m.data, now));
const past = allMeetups.filter((m) => isPastMeetup(m.data, now));

// Required page copy; throws if the entry is missing or its `type` disagrees.
const guidesPage = await getGlobal('guides', 'guides');

// 'primary' | 'secondary' | 'outline' | 'ghost'; size 'sm' | 'lg' optional.
const ctaClass = getCtaClass(guidesPage.contribute.cta.variant, 'lg');
---
```

Badge *color* classes (`badge-beginner` / `badge-intermediate` /
`badge-advanced`) are still plain Tailwind utility names from
`src/styles/global.css` — only the human-readable text comes from the taxonomy.

### Utility Class Naming
- Buttons: `.btn-primary` (colored), `.btn` (secondary)
- Spacing: `.container-wide` for page padding/centering
- Responsive grids: `grid grid-cols-2 md:grid-cols-4` pattern for mobile-first layouts
- Stats cards: `.stat-card` with `.stat-value` and `.stat-label` child classes

## External Dependencies & Integration Points

- **Astro Content API**: Core data layer; schema validation prevents invalid frontmatter
- **Tailwind CSS**: All styling; no custom CSS classes outside `src/styles/global.css` except component-scoped styles
- **Site Config** (`astro.config.mjs`): `site: 'https://chsmesh.org'` sets canonical URLs for SEO and is the origin `@astrojs/sitemap` uses for `sitemap-index.xml`
- **Community Links**: `src/content/global/site.md` has one `links` map (Discord, GitHub, repo, and the `info@`/`meetups@` mailto addresses) — there is no separate `social` list. Page copy refers to them with `@links.<key>` tokens, resolved by `resolveLink()` in `src/utils/siteLinks.ts`; used in footer/nav and in CTA hrefs
- **nginx** (`nginx.conf` + `security-headers.conf`): security headers live in the include, and **any `location` that declares an `add_header` must re-`include` `security-headers.conf`** or it serves none of them — see the deployment section of `README.md`

## Debugging & Troubleshooting

- Build errors usually indicate schema violations in frontmatter - validate against `src/content/config.ts` schema
- Dynamic routes not generating? Check `getStaticPaths()` returns correct `params` and `props` objects
- Styling issues? Verify Tailwind class names are spelled correctly; check responsive breakpoint syntax
- Collection queries return empty? Confirm markdown files are in `src/content/{collection}/` directory with correct schema

---
**Last Updated**: September 2026 | **Astro Version**: 5.16.11 (from `package.json`)
