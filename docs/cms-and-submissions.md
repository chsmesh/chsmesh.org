# Content editing and public submissions

This document describes the two paths content takes into the repository once
the n8n webhooks are retired, and how to set them up. Both end in a pull
request against `main`, so review and approval happen in one place regardless
of who submitted.

| Who | Path | Needs a GitHub account | Result |
| --- | --- | --- | --- |
| Maintainers and trusted contributors | Sveltia CMS at `/admin/` | Yes (write access to the repo) | PR on a `cms/<collection>/<slug>` branch, moved through Draft, In review, Ready, then merged from the CMS |
| Anyone (public forms on the site) | Submissions service behind `/api/submit/<kind>` | No | PR on a `submissions/<kind>/<slug>-<id>` branch, labelled `submission`, plus a Discord ping with the submitter's contact |

The site stays fully static. nginx serves the built HTML as before and proxies
one path prefix, `/api/`, to a small Node service on the compose network.

## Pieces

| File | Role |
| --- | --- |
| `public/admin/config.yml` | Sveltia CMS configuration. Field definitions mirror `src/content/config.ts`. |
| `src/pages/admin/index.astro` | The CMS shell. Imports `@sveltia/cms` from npm so the bundle ships as a hashed `/_astro/` file and the `script-src 'self'` CSP holds. |
| `services/submissions/` | Dependency-free Node 22 service: validates form payloads, opens PRs, notifies Discord, and runs the GitHub OAuth handshake for the CMS. `lib.mjs` is pure and unit tested. |
| `nginx.conf` | `location ^~ /api/` proxies to the service (rate limited, 64 KB bodies). `location ^~ /admin/` serves the CMS with `no-store` and `noindex`. Three `map` variables widen the CSP for `/admin/` only. |
| `security-headers.conf` | The single CSP now splices in `$csp_admin_*` variables, empty everywhere except `/admin/`. |
| `Dockerfile` | Webhook URLs beginning with `/` are accepted as same-origin paths instead of failing the build. |
| `docker-compose.yml` | Adds the `submissions` service, hardened like the nginx container. |
| `.env.example` | New variables, documented inline. |

## Cutting the forms over from n8n

No form code changes. Set the four webhook variables to the same-origin paths
and rebuild the image:

```
PUBLIC_N8N_WEBHOOK_URL=/api/submit/node
PUBLIC_N8N_GUIDES_WEBHOOK_URL=/api/submit/guide
PUBLIC_N8N_MEETUPS_WEBHOOK_URL=/api/submit/meetup
PUBLIC_N8N_RESOURCES_WEBHOOK_URL=/api/submit/resource
```

The service accepts exactly the JSON the `SubmissionForm` component already
sends (including the nested `coordinates`, `prerequisites` arrays and
`links` objects), validates it against a per-kind allow-list, and drops
anything else, so a submitter cannot smuggle extra front matter in. The
`submitterEmail` field is required but never written to the repository: it is
sent to the Discord webhook, which should point at a private moderators
channel.

Spam controls, in order of cost:

1. nginx `limit_req` (10 per minute per address, burst 5) and the service's
   own limit (5 per hour per address per kind).
2. Honeypot: a payload with a non-empty `website` field is silently dropped
   with a 200. Add a visually hidden `website` input to `SubmissionForm.astro`
   to activate this.
3. Optional Cloudflare Turnstile: set `TURNSTILE_SECRET` and the service
   requires a valid `turnstileToken` in the payload. The widget is not in the
   form yet.

## Setting up the service

1. Create a fine-grained personal access token (or a GitHub App installation
   token) scoped to `chsmesh/chsmesh.org` with **Contents: read and write** and
   **Pull requests: read and write**. Put it in `GITHUB_TOKEN`.
2. Create the `submission`, `node`, `guide`, `meetup` and `resource` labels
   in the repo (the service tolerates missing labels but the queue is easier
   to filter with them).
3. Create a Discord webhook in a private channel and set `DISCORD_WEBHOOK_URL`.
4. Set `SITE_ORIGIN=https://chsmesh.org`. Submissions carrying a different
   `Origin` header are refused.
5. Deploy: `docker compose up --build`. In production, add the same service
   to `docker-compose.server.yml` with a digest-pinned image, and pin
   `services/submissions/Dockerfile`'s base image the same way the main
   Dockerfile does.

Endpoints:

| Method and path | Purpose |
| --- | --- |
| `POST /api/submit/{node,guide,meetup,resource}` | Public submission. Returns `{ ok: true, pullRequest }`, or 400 with `errors`, 429, 403, 502. |
| `GET /api/auth` | Starts the CMS GitHub sign-in (Decap/Sveltia protocol). |
| `GET /api/auth/callback` | OAuth callback; posts the token to the CMS window. |
| `GET /healthz` | Container health check. |

## Setting up the CMS

1. Create a GitHub OAuth App (organisation settings, Developer settings).
   Homepage `https://chsmesh.org`, authorization callback URL
   `https://chsmesh.org/api/auth/callback`. Put the client id and secret in
   `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
2. Protect `main`: require a pull request before merging, and require the CI
   status check. The CMS never commits to `main` directly in editorial
   workflow mode, and this guarantees it even if the mode is switched off.
3. Give editors write access to the repository. Sveltia commits with the
   editor's own token, so their GitHub account is the audit trail.
4. Open `https://chsmesh.org/admin/`, sign in, and check the browser console
   on first use: if the CSP blocks something the CMS needs, the console names
   the directive. Adjust the `$csp_admin_*` maps in `nginx.conf`, not the
   shared policy.

How editing works: every new or changed entry lives on a
`cms/<collection>/<slug>` branch with a pull request the CMS opens. Editors
move it through Draft, In review and Ready; publishing merges the PR. Public
submissions arrive as ordinary PRs, so an editor can check one out in the CMS
by opening the branch, or simply review the file on GitHub.

## Follow-ups not in this sketch

- Add the honeypot input (and optionally the Turnstile widget) to
  `SubmissionForm.astro`, and rename `webhookEnvVar` and friends once n8n is
  gone. The `PUBLIC_N8N_*` names are kept so the cutover is a config change.
- Add the remaining `src/content/global/*.md` page files to the `global`
  collection in `config.yml`.
- Meetup times from the public form carry no timezone (the input is
  `datetime-local`). The PR checklist flags it; a nicer fix is to append the
  Charleston offset in the service or switch the form to a date plus time
  with an explicit zone.
- CI: the smoke test could assert that `/api/healthz` returns 502 (not a
  crash) from the nginx-only container, and a second job could run the
  service's tests, which `npm test` already picks up.
- Once the forms point at `/api/`, the build-time origin derivation in the
  Dockerfile and the `__N8N_ORIGIN__` placeholder can be deleted.
