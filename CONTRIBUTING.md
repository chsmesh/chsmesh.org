# Contributing to CHS Mesh

Thank you for your interest in contributing to CHS Mesh! We welcome contributions from the Charleston community.

## Ways to Contribute

- **Add Meetups**: Document community gatherings and events
- **Share Nodes**: Submit information about active mesh network nodes
- **Write Guides**: Create tutorials and documentation
- **Update Resources**: Add or update hardware device information
- **Report Bugs**: Open issues for website problems
- **Suggest Features**: Share ideas for improving the site

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes**
5. **Commit with clear messages**: `git commit -m 'Add: description of changes'`
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Open a Pull Request** on the main repository

## Content Contribution Guidelines

### Guides

- Use clear, beginner-friendly language
- Include step-by-step instructions
- Add relevant screenshots or diagrams when helpful
- Test procedures before submitting
- Specify difficulty level: `beginner`, `intermediate`, or `advanced`
- Use standard categories: `getting-started`, `hardware`, `software`, `network`, or `troubleshooting`

### Meetup Events

- Provide accurate date and location information
- Include event description and agenda
- Optionally add coordinates for map display
- Update location if meetup moves
- Archive past events in content (don't delete)

### Network Nodes

- Include the node name, location, and node type: `relay`, `router`, `client`, or `solar` (these are the only values the schema accepts; `type` defaults to `client`)
- Required by the schema: `name` and `coordinates` (`lat`/`lng`)
- Optional: `description`, `elevation` (feet), `active`, `owner`, `lastSeen`
- Describe the node's role in the network
- Keep information current

**Privacy**: if a node sits at a home address, please round its coordinates to
about 3 decimal places (roughly 100 m) before submitting, or use a nearby
landmark instead. Node entries are published as static JSON on a public site and
stay in git history forever. Never submit someone else's home location without
their consent.

### Resources

- Link to official sources when possible
- Include device specifications and pricing (if applicable)
- Provide download links to firmware and drivers
- Update outdated information
- Note any regional availability restrictions

## Code Style

- Use TypeScript for any new components
- Follow Tailwind CSS conventions (no custom CSS unless necessary)
- Keep component logic simple and focused
- Comment complex logic
- Test locally with `npm run dev` before submitting

## Pull Request Process

1. Update relevant documentation
2. Include a clear description of changes
3. Reference any related issues with `Fixes #123`
4. Ensure `npm test` passes locally
5. Ensure `npm run build` succeeds locally
6. Ensure `npm run check` (Astro type and content-schema check) passes locally
7. Add screenshots for UI changes
8. Wait for feedback and review

CI (`.github/workflows/ci.yml`) runs `npm test`, `npm run build` and
`npm run check` on every pull request, then builds the Docker image and smoke
tests the served site. Running all three locally first saves a round trip.

## Code of Conduct

- Treat all community members with respect
- Provide constructive feedback
- Report inappropriate behavior to maintainers
- Focus on the contribution, not the contributor

## Questions?

- Open a GitHub Discussion for questions
- Join our Discord community for real-time chat
- Comment on relevant issues

## License

By contributing, you agree that your contributions will be licensed under the
CC-BY-SA-4.0 license. See [LICENSE](LICENSE) for details.

Thank you for helping make CHS Mesh better! 🙏
