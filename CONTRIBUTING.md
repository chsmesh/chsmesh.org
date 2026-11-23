# Contributing to CHS Mesh

Thank you for your interest in contributing to CHS Mesh! We welcome contributions from the Charleston community.

## Ways to Contribute

- **Add Meetups**: Document community gatherings and events
- **Nominate Infrastructure**: Suggest fixed routers and rooftop nodes for the Network Status page
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

### Glossary Terms

- Guides link the first mention of each glossary term to `/glossary/` automatically, so do not hand-link terms
- Add a term as a `.json` file in `src/content/glossary/` (or through the CMS): `term`, a `definition` of 200 characters at most, and optionally `explanation`, `aliases`, and `related`
- Write the definition for someone who has never used a radio; it is also the tooltip readers see in guides
- Check that an alias is not a common word with another meaning - it will be linked wherever it first appears

### Troubleshooting Steps

- The troubleshooter at `/troubleshooting/` is data: one `.json` file per problem in `src/content/troubleshooting/` (or use the CMS). The README shows the format
- Each question must have a yes or no answer, and every path must end in a fix or in "ask in Discord" with a list of what to include in the post
- Keep a fix short: one paragraph on the likely cause, then numbered instructions. Link to the guide section that covers it instead of repeating it
- `npm run check` and `npm test` report a step that leads nowhere, loops, or cannot be reached

### Meetup Events

- Provide accurate date and location information
- Include event description and agenda
- Optionally add coordinates for map display
- Update location if meetup moves
- Archive past events in content (don't delete)

### Network Nodes

There is no node directory to submit to. The [Network Status](https://chsmesh.org/status/)
page lists every node a gateway hears, so a node appears there on its own once it
is in range of a gateway. It shows on the map only if it also broadcasts a
position on LongFast. To have a fixed router or rooftop node
listed under Infrastructure, ask in the Discord or open a pull request against
`services/status/infrastructure.json` (see `docs/status.md`).

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

CI (`.github/workflows/ci.yml`) runs the tests, `npm run build`, an internal
link check of the build and `npm run check` on every pull request. When the
pull request changes anything outside the content paths, it also builds the
Docker images and smoke tests the served site. Running these locally first
saves a round trip.

A link to a page or `#anchor` that does not exist fails CI. With
[lychee](https://lychee.cli.rs/guides/getting-started/) installed, `npm run check:links`
runs the same check locally after a build. Links to other sites are checked
weekly rather than on pull requests; see "Link checking" in the README.

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
