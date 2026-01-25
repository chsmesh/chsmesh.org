# Copilot Instructions for CHS Mesh

## Project Overview

CHS Mesh is an Astro-based static website for Charleston's Meshtastic community. It showcases local mesh network nodes, community meetups, educational guides, and hardware resources. The site emphasizes off-grid communication and community-driven content.

**Tech Stack**: Astro 5, Tailwind CSS 4, TypeScript, Markdown (content)

## Architecture & Data Flow

### Content Collections (Astro Content API)
Content is organized in `src/content/` with schema validation in `src/content/config.ts`:
- **meetups**: Community events with dates, locations, optional coordinates for map display
- **guides**: Tutorials with difficulty levels (beginner/intermediate/advanced) and categories (getting-started, hardware, software, network, troubleshooting)
- **resources**: Hardware device specifications and community links
- **nodes**: JSON files describing active mesh network nodes (routers, relays, solar-powered)
- **global**: Site metadata (site.md) and navigation configuration (navigation.md)

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
npm run build      # Generate dist/ for production
npm run preview    # Test built site locally
npm run astro ...  # Pass through Astro CLI commands
```

## Project-Specific Conventions

### Content Frontmatter Patterns
- Dates use ISO format (e.g., `2026-02-15`) and are coerced to JS Date objects via schema
- Difficulty badges: `badge-beginner` (green), `badge-intermediate` (yellow), `badge-advanced` (red)
- Featured items: Use `featured: true` in frontmatter to highlight on index/listing pages
- Ordering: `order` field controls sort precedence in collections (lower = earlier in list)

### Layout Structure
- All pages extend `src/layouts/Layout.astro`, which handles SEO metadata, header/footer
- Pass `title`, `description`, and `ogImage` props to Layout for page-specific metadata
- Header/footer sourced from global navigation config; update `src/content/global/navigation.md` to modify site-wide links

### Component Composition
- Cards (GuideCard, MeetupCard, ResourceCard) expect collection item objects with `data` and `id` properties
- Category/difficulty labels: Use `.map()` with lookup objects to convert enum values to display labels
- Time calculations: Always use `new Date()` for current date; filter by comparing `date >= now` for "upcoming" items

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

### Enum Mapping Pattern
```astro
const difficultyColors = {
  beginner: 'badge-beginner',
  intermediate: 'badge-intermediate',
  advanced: 'badge-advanced',
};
```

### Utility Class Naming
- Buttons: `.btn-primary` (colored), `.btn` (secondary)
- Spacing: `.container-wide` for page padding/centering
- Responsive grids: `grid grid-cols-2 md:grid-cols-4` pattern for mobile-first layouts
- Stats cards: `.stat-card` with `.stat-value` and `.stat-label` child classes

## External Dependencies & Integration Points

- **Astro Content API**: Core data layer; schema validation prevents invalid frontmatter
- **Tailwind CSS**: All styling; no custom CSS classes outside `src/styles/global.css` except component-scoped styles
- **Site Config** (`astro.config.mjs`): `site: 'https://chsmesh.org'` sets canonical URLs for SEO
- **Social/Community Links**: Stored in `src/content/global/site.md` global data; used in footer/nav

## Debugging & Troubleshooting

- Build errors usually indicate schema violations in frontmatter - validate against `src/content/config.ts` schema
- Dynamic routes not generating? Check `getStaticPaths()` returns correct `params` and `props` objects
- Styling issues? Verify Tailwind class names are spelled correctly; check responsive breakpoint syntax
- Collection queries return empty? Confirm markdown files are in `src/content/{collection}/` directory with correct schema

---
**Last Updated**: January 2026 | **Astro Version**: 5.16.11
