# CHS Mesh - Charleston's Meshtastic Community Hub

A community-driven static website showcasing Charleston's Meshtastic mesh network ecosystem. Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), this site features live network status, community meetups, educational guides, and hardware resources.

**Live Site**: [chsmesh.org](https://chsmesh.org)

## About CHS Mesh

CHS Mesh promotes off-grid communication resilience and community collaboration through the Meshtastic protocol. Our website documents:

- **Community Meetups**: Scheduled gatherings for testing, learning, and networking
- **Educational Guides**: Beginner-to-advanced tutorials covering setup, hardware, and troubleshooting
- **Hardware Resources**: Device specifications and software links for Meshtastic devices
- **Relay Sites**: A "help wanted" page at `/relay-sites` that lists the neighborhoods needing coverage and lets building owners offer a site; offers go privately to the moderators and are never published
- **Network Status**: Live health of the LoCoMesh network at `/status` - infrastructure, gateways, activity, channel load, and a list and map of the nodes gateways hear (the map shows those that broadcast a position) - from the status service (see [docs/status.md](docs/status.md))

## Tech Stack

- **Framework**: [Astro 5](https://astro.build)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **Language**: TypeScript
- **Content**: Markdown with YAML frontmatter

## Getting Started

### Prerequisites

- Node.js 20 LTS or newer (22 LTS or 24 LTS recommended as of April 2026)
- npm or pnpm

### Installation

```bash
git clone https://github.com/chsmesh/chsmesh.org.git
cd chsmesh.org
npm install
```

### Development

```bash
npm run dev
```

Visit `http://localhost:4321` to see your changes live.

### Building for Production

```bash
npm run check     # astro check — TypeScript and content-collection schema validation
npm run build     # static output in dist/
npm run preview   # serve dist/ locally
```

`npm run check` is a separate gate, not part of `npm run build`; CI runs both.

### Offline PDFs

Every guide has a "Download PDF" link, and `/handbook/` bundles the guides
marked `handbook: true` with the whole glossary into one field handbook. The
PDFs are **not in git and not produced by `npm run build`**: a second step
prints the built pages with headless Chromium into `dist/downloads/`.

```bash
npx playwright-core install chromium-headless-shell   # once
npm run build && npm run build:pdf
```

The `Dockerfile` runs both, so the production image always has the PDFs; under
`npm run dev` and after a plain `npm run build` the download links 404. Set
`PDF_CHROMIUM_PATH` to print with an already-installed Chromium or Chrome
instead of the downloaded one.

The PDFs use the site's print stylesheet (the `@media print` block at the end
of `src/styles/global.css`), which also makes the browser's own "Print / Save
as PDF" clean on every page. Add the `no-print` class to anything that should
stay off paper. File names and URLs live in `src/utils/downloads.mjs`.

### Offline mode

After one visit, the guides, the field handbook, the glossary and the other
core pages open without a connection, and the site can be installed to a
phone's home screen. Nothing is committed for this; `npm run build` writes it:

| Piece | Where |
| --- | --- |
| Service worker, `/sw.js` | Written into `dist/` when the build finishes by `src/integrations/offline.mjs`, from the worker in `src/sw/service-worker.js` |
| Web app manifest | `public/manifest.webmanifest` |
| App icons, `/icons/*.png` | Drawn at build time from the favicon mark (`src/utils/appIcons.mjs`) |
| "Available offline" badge and offline banner | `src/components/OfflineIndicator.astro` and `Layout.astro`, driven by `src/utils/offlineClient.mjs` |
| Page for a URL that was never saved | `src/pages/offline.astro`, copy in `src/content/global/offline.md` |

How it behaves:

- **At install** the worker saves every built page except `/admin/` and
  `/status/`, with the CSS, scripts and images those pages use (about 0.9 MB
  today; `npm run test:build` fails if any one file is over 500 kB). The PDFs
  and the build gallery's photos are not included.
- **Anything else a visitor opens** - a meetup page, a downloaded PDF - is
  saved as they go, in a second cache that deploys do not clear. After each
  deploy the worker drops the hashed `/_astro/` files in it that no saved page
  uses any more.
- **Pages are network first**, so an edit shows as soon as it is deployed. The
  saved copy is used when the request fails, the server answers 5xx, or there
  is no answer within three seconds (a phone with signal but no connection).
  A page that was never saved gets ten seconds, then the offline page.
- **Updates**: `sw.js` carries a fingerprint of everything it saves. A deploy
  that changes any of it changes `sw.js`, and each visitor's browser then
  saves the new copies in the background on their next visit. nginx serves
  `sw.js` with `Cache-Control: no-cache` for this reason.
- **Never cached**: `/api/` (forms, live status data) and `/admin/`.

A new page is saved automatically. To keep one out of the install download,
add it to `NOT_PRECACHED` in `src/integrations/offline.mjs`.

`npm run dev` has no service worker (and removes one left on that port by a
preview). To try offline mode locally, serve a build: `npm run build && npm run
preview`, load a page, then switch DevTools to offline.

The build also emits a sitemap:
[`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
is registered in `astro.config.mjs`, so `dist/` gets `sitemap-index.xml` and
`sitemap-0.xml`, generated from the configured `site: 'https://chsmesh.org'`
origin. `public/robots.txt` allows all crawlers and points at that index.

### Site-wide pages and assets

| Path | Purpose |
| --- | --- |
| `src/pages/404.astro` | Builds to `dist/404.html`; nginx serves it through `error_page 404` |
| `public/robots.txt` | Crawler policy plus the `Sitemap:` pointer |
| `public/og-image.png` | 1200×630 default Open Graph / Twitter card, used by `Layout.astro` when a page passes no `ogImage` |
| `public/manifest.webmanifest`, `src/pages/icons/` | Web app manifest and its generated icons; see [Offline mode](#offline-mode) |
| `src/pages/og/` | Per-page 1200×630 share cards, built to `/og/guides/<slug>.png` and `/og/meetups/<slug>.png` and used as that page's `og:image` |

Each guide and meetup gets its own share card, so a link pasted into Discord,
Signal or Facebook shows the guide's title, difficulty and category, or the
meetup's title, date and time (Charleston time) and venue. The cards are drawn
at build time by `src/utils/ogImage.mjs` (Satori for layout, the WebAssembly
build of resvg for the PNG) with the Inter font from `@fontsource/inter`, all
read from `node_modules`, so the build fetches nothing. Apps cache a share
image by its URL, so each `og:image` URL ends in a `?v=` fingerprint of the
card's content: an edited title or a rescheduled meetup gets a fresh image.
Characters outside Latin and Latin Extended (emoji, arrows, other scripts)
are left off the card, as the bundled fonts cannot draw them.

## Environment variables

The submission forms POST to the same-origin submissions service at
`/api/submit/<kind>`; see [docs/cms-and-submissions.md](docs/cms-and-submissions.md)
for that service, the CMS at `/admin/`, and their configuration.

| Variable | Used by |
| --- | --- |
| `PUBLIC_SUBMIT_BASE` | Path prefix the forms POST to. Optional; defaults to `/api/submit`. Must be a same-origin path that nginx and the submissions service route. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile widget on the forms. Empty disables it. |

The status service (`services/status`) reads `STATUS_MQTT_PASSWORD` and a few
optional `STATUS_*` variables at runtime; see [docs/status.md](docs/status.md).

**Local development**: copy the template and fill in the values you need.

```bash
cp .env.example .env
npm run dev
```

**Docker**: the variables are `ARG`s in the `Dockerfile`, so pass them at build
time with `--build-arg`, or via `build.args` in `docker-compose.yml`.

Because the site is static, these values are **baked into the generated HTML/JS
at build time**. They are public by design — never put a secret in a `PUBLIC_*`
variable. Changing one therefore requires a rebuild and, for production, a new
rebuild and redeploy; changing the running container's environment has no
effect.

## Project Structure

```
src/
├── components/          # Reusable Astro components
├── content/
│   ├── config.ts       # Zod schemas for every collection
│   ├── glossary/       # Glossary terms (JSON, one per term) — auto-linked from guides
│   ├── guides/         # Tutorial content (Markdown) — 4 entries
│   ├── meetups/        # Community events (Markdown) — no entries yet (.gitkeep)
│   ├── resources/      # Hardware and software resources (Markdown) — 7 entries
│   ├── builds/         # Member build gallery (Markdown) — no entries yet (.gitkeep); photos in src/assets/builds/
│   ├── taxonomies/     # Category/difficulty/status labels and icons (default.md)
│   └── global/         # Site configuration and page copy — 16 Markdown files
├── integrations/       # Build hooks (writes the offline service worker)
├── layouts/            # Page templates
├── pages/              # Static and dynamic routes
├── styles/             # Global Tailwind CSS
├── sw/                 # Service worker source (see Offline mode)
└── utils/              # Helper functions
```

Two collections are defined and routed but currently hold no entries:

- **meetups** — `src/content/meetups/` exists and is kept in git by a `.gitkeep`
  file; it just has no entries. Add the first `.md` file there. The `/meetups`
  and `/meetups/<slug>` routes are already wired up.
- **builds** — the member build gallery at `/builds` and `/builds/<slug>`.
  Entries normally arrive through the "Share Your Build" form on `/builds`,
  which uploads photos and opens a pull request; see
  [docs/cms-and-submissions.md](docs/cms-and-submissions.md#build-photos).

There is no node directory to maintain: `/status` maps the nodes gateways
actually hear, and `/map` redirects there. Fixed infrastructure is listed in
`services/status/infrastructure.json` (see [docs/status.md](docs/status.md)).

The 16 files in `src/content/global/` are `site.md`, `navigation.md`,
`footer.md`, `home.md`, `about.md`, `relay-sites.md`, `status.md`, `builds.md`, `guides.md`,
`guides-detail.md`, `handbook.md`, `offline.md`, `glossary.md`, `meetups.md`, `meetups-detail.md`, and `resources.md`. Each one carries a `type`
field that selects its branch of the discriminated-union schema.

### Adding Content

**Guides**: Create a `.md` file in `src/content/guides/` with frontmatter:
```yaml
---
title: "Guide Title"
description: "Brief description"
difficulty: "beginner" # or intermediate/advanced
category: "getting-started" # or hardware/software/network/troubleshooting
order: 1
featured: false
---
```

**Meetups**: Create a `.md` file in `src/content/meetups/` (the directory already exists, kept by a `.gitkeep`; it simply has no entries yet):
```yaml
---
title: "Event Name"
date: "2026-05-15"
location: "Charleston, SC"
description: "Brief description of the event"
coordinates:
  lat: 32.7765
  lng: -79.9311
---
```

**Glossary terms**: Add a `.json` file to `src/content/glossary/`. The file name
(lower-case, hyphenated) becomes the entry's anchor on `/glossary/`:
```json
{
  "term": "Hop limit",
  "definition": "One or two plain sentences, 200 characters at most.",
  "explanation": "Optional longer text. Blank lines separate paragraphs.",
  "aliases": ["hop count"],
  "related": ["hop", "traceroute"]
}
```
The first mention of each term or alias in a guide links to its entry
automatically (`src/utils/rehypeGlossaryLinks.mjs`), with the short definition
as a hover tooltip. Matching ignores case (except for an alias written in all capitals, which
must match exactly) and accepts a plural "s"; headings, code and existing links
are skipped. A file name starting with `_` is treated as a draft. Restart `npm run dev` after editing the
glossary to see the links change in guides.

## Deployment

### Docker

A multi-stage Dockerfile is included for containerized builds:

```bash
docker build -t chsmesh .
docker run --read-only \
  --tmpfs /var/cache/nginx --tmpfs /var/run --tmpfs /tmp \
  -p 8080:8080 chsmesh
```

The nginx container runs as a non-root user and listens on port **8080**
internally; the example above maps it to host port 8080. The `--tmpfs` mounts
are required: nginx runs as an unprivileged user and keeps its pid file and
temp directories under `/tmp` (see the top of `nginx.conf`), so with
`--read-only` and no writable `/tmp` it exits immediately. The other two mounts
match the compose files. `docker-compose.yml`
provides the same mounts and maps host 8081 to container 8080 so it can run
alongside another local service; `docker compose up --build` is the simpler
path.

### nginx security headers — read before editing `nginx.conf`

Every security response header (`Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
`X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`) lives in
**`security-headers.conf`**, which the `Dockerfile` copies to
`/etc/nginx/security-headers.conf` and `nginx.conf` `include`s once in the
`server` block.

**nginx does not inherit `add_header` into a `location` block that declares an
`add_header` of its own.** A location that sets even a single header of its own
silently drops *every* header from the enclosing server block — no warning, no
config error, just responses with no security headers. So **every `location`
that uses `add_header` must re-include the file**:

```nginx
location ^~ /_astro/ {
    expires 1y;
    add_header Cache-Control "public, immutable" always;
    include /etc/nginx/security-headers.conf;   # required, or this location ships zero security headers
}
```

Today that applies to `^~ /_astro/`, the static-asset regex location, the
`.html` location, and `= /404.html`. `test/security/nginx-headers.test.mjs`
parses `nginx.conf` into blocks and fails `npm test` if any location uses
`add_header` without the include, so a new caching location cannot quietly
regress this.

Two related behaviours worth knowing:

- **HSTS is conditional by design.** `Strict-Transport-Security` comes from a
  `map` on `$http_x_forwarded_proto` and is empty unless the TLS edge forwards
  `X-Forwarded-Proto: https`. A plain HTTP request straight to the container
  correctly gets no HSTS header — that is not a missing header.
- **The CSP `connect-src` is `'self'` plus `https://stats.sendtrl.com`.** The
  forms only POST to the same-origin `/api/` path; the one extra origin outside
  `/admin/` is the self-hosted Umami analytics instance, which also appears in
  `script-src` so its tracker can load.

### Analytics

`src/utils/analytics.mjs` loads the cookieless Umami tracker from the layout.
It loads only on `chsmesh.org` (so local dev and previews stay out of the
stats), and is skipped entirely for visitors who send Do Not Track or Global
Privacy Control. Besides page views it records three events:

| Event | When | Data |
| --- | --- | --- |
| `form-open` | A submission modal is opened | `form` (form id, e.g. `node-form`) |
| `form-submit` | A submission succeeds | `form` (same form id) |
| `resource-click` | A link on a resource card is clicked | `resource`, `link` (link type, `other` if unset) |

The About page FAQ describes this to visitors; update it if the events change.

### Legacy `.md` URL redirects

The live site previously served guide and meetup URLs carrying the `.md`
extension (`/guides/what-is-meshtastic.md/`), because those legacy
`type: 'content'` collections keep the extension in `entry.id`. The pages now
emit clean URLs, so `nginx.conf` holds two permanent redirects that keep old
links, bookmarks, and search results working:

```nginx
rewrite "^/guides/(.+)\.md/?$"  /guides/$1/  permanent;
rewrite "^/meetups/(.+)\.md/?$" /meetups/$1/ permanent;
```

They return **301**, with or without the trailing slash. CI smoke tests the
guides rewrite against the running container. Do not drop these without first
checking inbound links.

### Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main` and
`release/**`, as separate jobs:

- **`site`**: `npm ci`, `npm run test:site` (every `*.test.mjs` outside
  `test/submissions/`, `test/status/` and `test/build/`), `npm run build`, `npm run test:build` (checks `dist/` itself:
  every guide and meetup page must point at a share image the build emitted,
  and the service worker must list the guides and only files that exist),
  a check that `dist/` has no inline executable `<script>` tags (the CSP would
  block them), `npm run check`, `npm run build:pdf` with a check that every
  guide and the handbook got a PDF, and an internal link check of `dist/`
  (`npm run check:links`, see [Link checking](#link-checking)).
- **`submissions`**: the service tests in `test/submissions/` on Node 22, the
  service's runtime version (`npm run test:submissions`). Locally, `npm test`
  still runs both suites.
- **`submissions-image`**: builds `services/submissions/Dockerfile` and checks
  that the container answers `/healthz`.
- **`status`**: the status service tests in `test/status/` on Node 22
  (`npm run test:status`).
- **`status-image`**: builds `services/status/Dockerfile` and checks that the
  container answers `/healthz` and serves an empty `/api/status/summary`.
- **`container`**: builds the site's Docker image and smoke tests the running
  container:
  - `/` returns 200 with `Content-Security-Policy` and
    `Strict-Transport-Security` headers (the request is sent with
    `X-Forwarded-Proto: https` so HSTS applies)
  - `/guides/what-is-meshtastic/` returns 200
  - a guide PDF and the handbook PDF under `/downloads/` return 200 as
    `application/pdf`
  - `/guides/what-is-meshtastic.md/` returns **301** to
    `/guides/what-is-meshtastic/`, covering the legacy redirects above
  - an unknown URL returns a real 404, and a hashed `/_astro/` asset is
    served immutable, both with the security headers
  - `/api/healthz` returns **502** with the security headers when no
    submissions container is running, and nginx keeps serving the site
  - the image also starts under a plain `docker run` with no tmpfs mounts
- **`ci-ok`**: always runs and fails if any other job failed or was
  cancelled. This is the one required status check on `main`.

On pull requests, `submissions-image`, `status-image` and `container` run only when the pull
request changes a file outside the content paths (`src/content/**`,
`public/images/**`, and `docs/**/*.md`). A content-only pull request, such as
a CMS draft, runs `site` and `submissions` and skips the image builds; a
skipped job counts as passing in `ci-ok`. Pushes to `main` and `release/**`
always run every job.

CI does **not** build, push, or deploy images. There is no release workflow in
this repository.

### Link checking

[lychee](https://lychee.cli.rs/) checks the links in the built site, in two
modes run by `scripts/check-links.sh`, plus a checklist for the links neither
can cover:

- **Internal** (`npm run check:links`): offline, against `dist/`. Covers links
  between pages, assets, `#fragment` anchors, canonical URLs and the sitemap.
  It runs in the CI `site` job, so a broken internal link fails the pull
  request.
- **External** (`npm run check:links:external`): requests every outbound link.
  `.github/workflows/links.yml` runs it every Monday (and on demand from the
  Actions tab), outside CI and the `ci-ok` check, so a third-party outage
  never blocks a merge. When links are broken it opens an issue labelled
  `broken-links`, or updates the open one, and closes it once every link
  passes again.
- **Manual review** (`npm run check:links:manual`): AliExpress, Amazon and
  Silicon Labs answer automated requests the same way whether or not the page
  exists, so they are on the allowlist (`exclude`) in `lychee.toml` and the
  external check **does not check them at all**. Instead, on the 1st of each
  month `links.yml` opens a "Manual link review" issue labelled `link-review`:
  a checklist of those links and the pages they are on, for a person to open
  in a browser. If the previous month's issue is still open it gets a
  reminder comment rather than a second issue.

GitHub disables scheduled workflows in a public repository after 60 days
without a commit. If the repository goes quiet for that long, re-enable
`links.yml` from the Actions tab, or both the weekly check and the monthly
review stop silently.

All three need `npm run build` first and
[lychee installed](https://lychee.cli.rs/guides/getting-started/) locally. The internal check
also needs `npm run build:pdf`, because pages link to the PDFs in
`dist/downloads/`. Settings live
in `lychee.toml`. Discord invites are checked through Discord's invite API, because the
`discord.gg` page answers 200 even for an expired invite.

### Release and deploy (Komodo)

Image build/publish and production deployment live in [Komodo](https://komo.do),
outside this repository. Three Komodo Builds clone `main` and push to
`ghcr.io/chsmesh`: `chsmesh` (this Dockerfile, with the production `PUBLIC_*`
build args), `chsmesh-submissions` (`services/submissions/Dockerfile`) and
`chsmesh-status` (`services/status/Dockerfile`). The
`chsmesh` Komodo Stack runs the images on the production host from
`docker-compose.komodo.yml`: the site joins the Docker network shared with
Traefik, which terminates TLS, and the submissions service stays on the
stack's private network, as does the status service. The stack's environment
(secrets come from Komodo Variables) reaches the submissions service; the
status service receives only its own `STATUS_*` variables, including
`STATUS_MQTT_PASSWORD`.

Releases are automatic. When CI passes on a push to `main` (including commits
the CMS makes), `.github/workflows/deploy.yml` calls an n8n webhook, which
runs the `chsmesh-release` Procedure over the private network Komodo lives on
and waits for it: the Procedure builds the images and redeploys the stack,
and the Deploy job passes or fails with it. To release by hand, run the Deploy
workflow from the Actions tab or the `chsmesh-release` Procedure in Komodo.
The site container listens on port 8080 and the Traefik service label must
point at that port.

### Self-hosting without Komodo

`docker-compose.server.yml` runs the whole site on any Docker host from a
checkout of this repository: it builds the nginx site image, the
submissions service and the status service from source (base images are pinned by digest) and needs
no registry, so a fork can be hosted the same way.

```bash
git clone https://github.com/chsmesh/chsmesh.org.git && cd chsmesh.org
cp .env.example .env      # set SITE_ORIGIN, GITHUB_TOKEN and the rest
scripts/server-update.sh  # build both images and start them
```

Rerun `scripts/server-update.sh` to update: it fast-forwards the checkout,
rebuilds, and restarts what changed (`SKIP_GIT_PULL=1` deploys the checkout as
it is). See [docs/cms-and-submissions.md](docs/cms-and-submissions.md) for the
`.env` values, the GitHub token and the OAuth App.

The site listens on host port 8081 over plain HTTP. Put a reverse proxy that
terminates TLS in front of it (Caddy, Traefik, nginx) and have it send
`X-Forwarded-Proto: https`, which turns on HSTS, and `X-Forwarded-For`, which
nginx trusts from private addresses for per-visitor rate limits.

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Community

- **Discord (Charleston)**: [CHS Mesh Discord](https://discord.gg/8Btn3fck2U)
- **Discord (Global)**: [Official Meshtastic Discord](https://discord.gg/meshtastic)
- **GitHub Issues**: Report bugs or request features
- **Meetups**: Check the events page for upcoming gatherings

## License

Everything in this repository — code and content alike — is licensed under
[CC-BY-SA-4.0](LICENSE). This is a single license, not a dual-license split.

You are free to use, modify, and distribute this project with appropriate attribution and under the same license. See [LICENSE](LICENSE) for details.

**Open question**: CC-BY-SA-4.0 is a content license and [Creative Commons does
not recommend it for software](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software).
Whether to relicense the code portion (for example MIT or Apache-2.0) while
keeping CC-BY-SA-4.0 for the guides and documentation is an open discussion, not
a decision — relicensing would need sign-off from past contributors. Open an
issue if you have a view.

## Acknowledgments

Built with support from the Meshtastic community and local Charleston tech enthusiasts.
