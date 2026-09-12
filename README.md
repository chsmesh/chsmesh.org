# CHS Mesh - Charleston's Meshtastic Community Hub

A community-driven static website showcasing Charleston's Meshtastic mesh network ecosystem. Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), this site features local mesh network nodes, community meetups, educational guides, and hardware resources.

**Live Site**: [chsmesh.org](https://chsmesh.org)

## About CHS Mesh

CHS Mesh promotes off-grid communication resilience and community collaboration through the Meshtastic protocol. Our website documents:

- **Active Network Nodes**: Real-time data on local mesh routers, relays, and solar-powered infrastructure
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
npm run build
npm run preview
```

## Environment variables

The submission forms POST to n8n webhooks. Four public variables configure them:

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
│   ├── nodes/          # Mesh network node definitions (JSON) — 3 entries
│   ├── resources/      # Hardware and software resources (Markdown) — 7 entries
│   ├── taxonomies/     # Category/difficulty/status labels and icons (default.md)
│   └── global/         # Site configuration and page copy — 11 Markdown files
├── layouts/            # Page templates
├── pages/              # Static and dynamic routes
├── styles/             # Global Tailwind CSS
└── utils/              # Helper functions
```

The `meetups` collection is defined in `src/content/config.ts` and has pages at
`/meetups` and `/meetups/<slug>`, but there is **no `src/content/meetups/`
directory yet** — no meetup has been published. Create the directory along with
the first meetup entry.

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

**Meetups**: Create a `.md` file in `src/content/meetups/` (the directory does not exist yet — create it with the first entry):
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

**Nodes**: Add a `.json` file to `src/content/nodes/`:
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
docker run -p 8080:8080 chsmesh
```

The nginx container runs as a non-root user and listens on port **8080**
internally; the example above maps it to host port 8080. `docker-compose.yml`
maps host 8081 to container 8080 so it can run alongside another local service.

### Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main` and
`release/**`. It installs dependencies with `npm ci`, runs `npm test` and
`npm run build`, then builds the Docker image and smoke tests the running
container: `/` must return 200 with `Content-Security-Policy` and
`Strict-Transport-Security` headers, a guide URL must return 200, and an unknown
URL must return a real 404.

CI does **not** build, push, or deploy images. There is no release workflow in
this repository.

### Release and deploy (Komodo)

Image build/publish and production deployment live in [Komodo](https://komo.do),
outside this repository. Komodo is triggered by a webhook on pushes to `main`,
builds the image with the production `PUBLIC_N8N_*` build args, and rolls out the
new container.

Production deploys must use immutable image references (`@sha256:<digest>`) in
`docker-compose.server.yml` — never a mutable tag such as `:latest`. When rolling
out a release:

1. Let Komodo build and publish the release image.
2. Retrieve the published image digest from the registry.
3. Open a PR that updates only the digest in `docker-compose.server.yml`.
4. Require maintainer review/approval before merge.
5. Deploy via the approved server update process (`scripts/server-update.sh`).

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
