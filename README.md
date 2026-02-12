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

- Node.js 18.17+ or 21+
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

## Project Structure

```
src/
├── components/          # Reusable Astro components
├── content/
│   ├── guides/         # Tutorial content (Markdown)
│   ├── meetups/        # Community event data
│   ├── nodes/          # Mesh network node definitions (JSON)
│   ├── resources/      # Hardware and software resources
│   └── global/         # Site configuration and metadata
├── layouts/            # Page templates
├── pages/              # Static and dynamic routes
├── styles/             # Global Tailwind CSS
└── utils/              # Helper functions
```

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

**Meetups**: Create a `.md` file in `src/content/meetups/`:
```yaml
---
title: "Event Name"
date: "2026-02-15"
location: "Charleston, SC"
coordinates: [32.7765, -79.9311] # optional, for map display
---
```

**Nodes**: Add a `.json` file to `src/content/nodes/`:
```json
{
  "name": "Node Name",
  "nodeId": "!abc123de",
  "location": "Downtown",
  "type": "router",
  "coordinates": [32.776, -79.931]
}
```

## Deployment

### Docker

A multi-stage Dockerfile is included for containerized builds:

```bash
docker build -t chsmesh .
docker run -p 80:8080 chsmesh
```

### Komodo Webhooks

This repository is configured to automatically build and deploy via Komodo webhooks. Push to `main` to trigger deployment.

### Production image digest update workflow

Production deploys must use immutable image references (`@sha256:<digest>`) in `docker-compose.server.yml`.

When rolling out a new release:

1. Build and push the release image in CI.
2. Retrieve the published image digest from GHCR.
3. Open a PR that updates only the digest in `docker-compose.server.yml`.
4. Require maintainer review/approval before merge.
5. Deploy via the approved server update process (`scripts/server-update.sh` or equivalent CI deploy job).

Do not use mutable tags like `:latest` in production compose files.

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Community

- **Discord**: [Charleston Meshtastic Community](https://discord.gg/meshtastic)
- **GitHub Issues**: Report bugs or request features
- **Meetups**: Check the events page for upcoming gatherings

## License

This project uses a dual licensing approach:

- **Code** (TypeScript, Astro components, configuration): [CC-BY-SA-4.0](LICENSE)
- **Content** (Guides, documentation, meetup info): [CC-BY-SA-4.0](LICENSE)

You are free to use, modify, and distribute this project with appropriate attribution and under the same license. See [LICENSE](LICENSE) for details.

## Acknowledgments

Built with support from the Meshtastic community and local Charleston tech enthusiasts.
