# CHS Mesh - Charleston's Meshtastic Community Hub

A community-driven static website showcasing Charleston's Meshtastic mesh network ecosystem. Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), this site features local mesh network nodes, community meetups, educational guides, and hardware resources.

**Live Site**: [chsmesh.org](https://chsmesh.org)

## About CHS Mesh

CHS Mesh promotes off-grid communication resilience and community collaboration through the Meshtastic protocol. Our website documents:

- **Network Map**: A directory of community-registered mesh nodes — routers, relays, clients, and solar-powered infrastructure. Node records are submitted by their owners rather than polled from the mesh, so none of it is live telemetry, and the map shows a "No Nodes Registered" empty state until the first node is added
- **Community Meetups**: Scheduled gatherings for testing, learning, and networking
- **Educational Guides**: Beginner-to-advanced tutorials covering setup, hardware, and troubleshooting
- **Hardware Resources**: Device specifications and software links for Meshtastic devices

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

## Environment variables

The submission forms POST to the URLs below. Point them at `/api/submit/<kind>`
to use the built-in submissions service; see
[docs/cms-and-submissions.md](docs/cms-and-submissions.md) for that service,
the CMS at `/admin/`, and their configuration.

| Variable | Used by |
| --- | --- |
| `PUBLIC_N8N_WEBHOOK_URL` | Node submission form (also derives the CSP `connect-src` origin) |
| `PUBLIC_N8N_GUIDES_WEBHOOK_URL` | Guide submission form |
| `PUBLIC_N8N_MEETUPS_WEBHOOK_URL` | Meetup submission form |
| `PUBLIC_N8N_RESOURCES_WEBHOOK_URL` | Resource submission form |

**Local development**: copy the template and fill in your own webhook URLs.

```bash
cp .env.example .env
npm run dev
```

**Docker**: the variables are `ARG`s in the `Dockerfile`, so pass them at build
time with `--build-arg`, or via `build.args` in `docker-compose.yml`:

```bash
docker build --build-arg PUBLIC_N8N_WEBHOOK_URL="https://n8n.example.com/webhook/submit-node" ... -t chsmesh .
```

Because the site is static, these values are **baked into the generated HTML/JS
at build time**. They are public by design — never put a secret in a `PUBLIC_*`
variable. Rotating a webhook URL therefore requires a rebuild and, for
production, a new image digest in `docker-compose.server.yml`; changing the
running container's environment has no effect. The nginx CSP `connect-src` is
derived from `PUBLIC_N8N_WEBHOOK_URL` at build time for the same reason.

## Project Structure

```
src/
├── components/          # Reusable Astro components
├── content/
│   ├── config.ts       # Zod schemas for every collection
│   ├── guides/         # Tutorial content (Markdown) — 4 entries
│   ├── meetups/        # Community events (Markdown) — no entries yet (.gitkeep)
│   ├── nodes/          # Mesh network node definitions (JSON) — no entries yet (.gitkeep)
│   ├── resources/      # Hardware and software resources (Markdown) — 7 entries
│   ├── taxonomies/     # Category/difficulty/status labels and icons (default.md)
│   └── global/         # Site configuration and page copy — 11 Markdown files
├── layouts/            # Page templates
├── pages/              # Static and dynamic routes
├── styles/             # Global Tailwind CSS
└── utils/              # Helper functions
```

Two collections are defined and routed but currently hold no entries:

- **meetups** — `src/content/meetups/` exists and is kept in git by a `.gitkeep`
  file; it just has no entries. Add the first `.md` file there. The `/meetups`
  and `/meetups/<slug>` routes are already wired up.
- **nodes** — `src/content/nodes/` exists and is kept in git by a `.gitkeep`
  file; it just has no entries. Add the first `.json` file there. Until then
  `/map` counts zero nodes and renders its "No Nodes Registered" panel.

The 11 files in `src/content/global/` are `site.md`, `navigation.md`,
`footer.md`, `home.md`, `about.md`, `map.md`, `guides.md`, `guides-detail.md`,
`meetups.md`, `meetups-detail.md`, and `resources.md`. Each one carries a `type`
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

**Nodes**: Add a `.json` file to `src/content/nodes/` (the directory already
exists, kept by a `.gitkeep`; it simply has no entries yet):
```json
{
  "name": "Node Name",
  "description": "Short description of the node",
  "type": "router",
  "coordinates": { "lat": 32.776, "lng": -79.931 },
  "elevation": 30,
  "active": true,
  "owner": "Community Member",
  "lastSeen": "2026-04-21"
}
```

## Deployment

### Docker

A multi-stage Dockerfile is included for containerized builds:

```bash
docker build \
  --build-arg PUBLIC_N8N_WEBHOOK_URL="https://n8n.example.com/webhook/submit-node" \
  --build-arg PUBLIC_N8N_GUIDES_WEBHOOK_URL="https://n8n.example.com/webhook/submit-guide" \
  --build-arg PUBLIC_N8N_MEETUPS_WEBHOOK_URL="https://n8n.example.com/webhook/submit-meetup" \
  --build-arg PUBLIC_N8N_RESOURCES_WEBHOOK_URL="https://n8n.example.com/webhook/submit-resource" \
  -t chsmesh .
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
- **The CSP `connect-src` is baked at build time.** `security-headers.conf`
  ships a `__N8N_ORIGIN__` placeholder; the Dockerfile builder stage derives
  `scheme://host` from `PUBLIC_N8N_WEBHOOK_URL` and substitutes it. With no
  build arg the placeholder collapses to nothing, `connect-src` stays `'self'`,
  and the browser blocks form submissions.

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
`release/**`. It installs dependencies with `npm ci`, runs `npm test`,
`npm run build`, and `npm run check`, then builds the Docker image and smoke
tests the running container:

- `/` returns 200 with `Content-Security-Policy` and `Strict-Transport-Security`
  headers (the request is sent with `X-Forwarded-Proto: https` so HSTS applies)
- `/guides/what-is-meshtastic/` returns 200
- `/guides/what-is-meshtastic.md/` returns **301** to
  `/guides/what-is-meshtastic/`, covering the legacy redirects above
- an unknown URL returns a real 404

CI does **not** build, push, or deploy images. There is no release workflow in
this repository.

### Release and deploy (Komodo)

Image build/publish and production deployment live in [Komodo](https://komo.do),
outside this repository. Two Komodo Builds clone `main` and push to the
registry: `chsmesh` (this Dockerfile, with the production `PUBLIC_*` build
args) and `chsmesh-submissions` (`services/submissions/Dockerfile`). Each has
a Deployment on the production host, on the Docker network shared with
Traefik, which terminates TLS; the deployments redeploy automatically when
their build finishes. Komodo is reachable only on the private network, so
builds are started from the Komodo UI rather than by a GitHub webhook.

To release: merge to `main`, run the `chsmesh-submissions` build if the
service changed, then run the `chsmesh` build. The site container listens on
port 8080 and the Traefik service label must point at that port.

`docker-compose.server.yml` and `scripts/server-update.sh` are a standalone
alternative for running the pinned site image on a host without Komodo.

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
