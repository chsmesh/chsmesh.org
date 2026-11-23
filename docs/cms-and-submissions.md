# Content editing and public submissions

chsmesh.org is a static site whose content lives in this repository under
`src/content/`. There are two ways content gets in, and both end in a pull
request against `main`, so every change is reviewed in one place no matter
who made it.

| Who | How | GitHub account needed | What it produces |
| --- | --- | --- | --- |
| Maintainers and trusted contributors | The CMS at `https://chsmesh.org/admin/` | Yes, with write access to the repository | A pull request on a `cms/<collection>/<slug>` branch, published from inside the CMS |
| Anyone | The submission forms on the public site | No | A pull request on a `cms/<collection>/<slug>` branch, labelled `submission` and `cms/pending_review`, plus a notice in the moderators' Discord channel. It appears in the CMS under **In review** |

This guide covers the three audiences involved:

- [Editing content in the CMS](#editing-content-in-the-cms), for maintainers.
- [Reviewing public submissions](#reviewing-public-submissions), for whoever
  handles the pull request queue.
- [Setup and operations](#setup-and-operations), for whoever deploys the site.

## Editing content in the CMS

The CMS is [Sveltia CMS](https://github.com/sveltia/sveltia-cms), served from
the site itself at `/admin/`. It edits the files in this repository directly,
using your own GitHub account, so your name is on every commit.

### Signing in

1. Open `https://chsmesh.org/admin/` and choose **Sign in with GitHub**.
2. Approve the CHS Mesh application when GitHub asks. You only need to do
   this once per browser.

You need write access to the `chsmesh/chsmesh.org` repository. If sign-in
fails with a message about an unknown site, make sure you opened the CMS at
exactly `https://chsmesh.org/admin/` and not another hostname.

### What you can edit

| Section | Files | Notes |
| --- | --- | --- |
| Meetups | `src/content/meetups/*.md` | Date, location, description |
| Guides | `src/content/guides/*.md` | Markdown body, category, difficulty, prerequisites |
| Glossary | `src/content/glossary/*.json` | Term, short definition (also the tooltip in guides), aliases, related terms. Terms and aliases are linked automatically at their first mention in each guide |
| Resources | `src/content/resources/*.md` | Links to devices, software, firmware, communities |
| Builds | `src/content/builds/*.md`, photos in `src/assets/builds/` | The member build gallery at `/builds/`. One to six photos; the first is the cover. Tick **Featured** to show a build on the home page |
| Taxonomies | `src/content/taxonomies/*` | The allowed categories and difficulties |
| Site settings | `src/content/global/*` | Site links, navigation, footer, and each page's copy, including the areas that need coverage on the relay sites page |

Images uploaded through the CMS go to `public/images/` and are referenced as
`/images/<file>`. Build photos are the exception: they go to
`src/assets/builds/` and the entry refers to them by a path relative to
itself (`../../assets/builds/<file>`).

**The CMS does not strip photo metadata.** A photo straight off a phone
carries the GPS position it was taken at, and a file uploaded here is
committed as it is. Photos that arrive through the public form have already
had this removed (see [Build photos](#build-photos)); for one you upload
yourself, remove the location data first, or re-export or screenshot it.

### Publishing a change

The CMS uses an editorial workflow. Nothing you save is live until it is
published, and publishing is a pull request merge.

1. Create or edit an entry and choose **Save**. The CMS creates a branch and a
   pull request for you; the entry appears under **Drafts** in the Workflow
   view.
2. Move the entry to **In review** when it is ready for someone else to look
   at, then to **Ready**.
3. Choose **Publish**. The CMS merges the pull request into `main`. The site
   rebuilds and deploys from `main` through the normal release process.

You can also review a pull request on GitHub as usual. The CMS and GitHub
show the same branch.

### Things to know

- **A draft can be saved with required fields empty.** The CI check on the
  pull request will fail until the entry is complete. That is expected and
  nothing reaches the live site until you publish.
- **Meetup times are Charleston time.** The date picker uses Charleston
  time even if your computer is set to another zone, and saves the value
  with its UTC offset (`-04:00` in summer, `-05:00` in winter). The site
  always shows meetup times in Charleston time. If you edit a meetup file by
  hand, keep the offset; without one the time is not read as Charleston time.
- **Public submissions appear in the Workflow view** under **In review**,
  alongside editors' own drafts. Open one to edit it, then move it to
  **Ready** and publish, exactly as for your own entries. They are also
  labelled `submission` on GitHub.

## Reviewing public submissions

The submission forms on the site (submit a guide, suggest a meetup,
share a resource, share a build) do not require an account. Each submission becomes
a pull request opened by the submissions service, in the same shape the CMS
uses for its own drafts, so you can review it either in the CMS Workflow view
or on GitHub.

### What a submission looks like

- **Branch** `cms/<collection>/<slug>`, one file under `src/content/`
  named `<slug>`. If that slug is already taken on `main` or by another open
  workflow branch, a short random suffix is added.
- **Title** `<Kind> submission: <entry title>`.
- **Labels** `cms/pending_review`, `submission` and the kind (`guide`,
  `meetup`, `resource` or `build`). The `cms/` label is what puts the entry in
  the CMS Workflow view. Filter the GitHub queue with `label:submission`.
- **Body** shows the file path, a table of the submitted fields, and a review
  checklist.
- **Contact details** are never in the pull request. The submitter's email
  goes only to the private moderators' Discord channel, in a message that
  links to the pull request.

### Build photos

A build submission is the one kind that carries files. Its pull request adds
the entry and one to six photos, named `src/assets/builds/<slug>-<n>.<ext>`,
in a single commit.

Photos of an install at someone's home are the sensitive part, so they are
cleaned twice before they reach this public repository:

1. **In the browser.** The form redraws each photo on a canvas, scales it to
   at most 1600 pixels on its longest side and re-encodes it as a JPEG. Only
   pixels survive that, so the EXIF block, GPS position included, never leaves
   the submitter's device.
2. **In the service.** The endpoint is public, so the service does not rely
   on step 1. It accepts only JPEG, PNG and WebP, identified from the file's
   own structure, and rebuilds each file from the parts a decoder needs.
   EXIF, XMP, IPTC, comments, embedded thumbnails and anything after the end
   of the image are dropped. A JPEG keeps one EXIF tag, its orientation, so
   it is not published on its side. Photos over 1.5 MB or 4096 pixels on a
   side, and animated images, are refused.

The pull request's table lists each photo's type, size and dimensions. None
of this can see what is *in* a photo, which is what the extra items on the
review checklist are for: look for house numbers, street signs, licence
plates, a recognisable view of a home, and people. If a photo should not be
published, delete it from the entry (and its file from the branch) before
merging; closing the pull request and deleting the branch removes everything.

The form asks for a neighborhood, never an address, and warns that a map link
shows where the node is.

### Relay host offers

The "I can host" form on `/relay-sites/` is the exception: it never becomes a
pull request. An offer describes someone's property, and this repository is
public, so the service sends the whole offer (name, kind of site,
neighborhood, notes, email, phone) to the moderators' Discord channel and
writes nothing anywhere else. Reply to the person directly from there.

- The form asks for a neighborhood, not an address. Get the address
  privately when you follow up, and keep it out of GitHub, the CMS and
  public Discord channels.
- The list of areas that need coverage is edited in the CMS under
  **Site settings → Relay sites page**. Keep it at neighborhood level: never
  name an address, a building or a host. Set **Last reviewed** when you
  change it.
- The form needs `DISCORD_WEBHOOK_URL`. Without it the service answers 503
  and the form tells the visitor to reach out on Discord, so an offer is
  never silently dropped.

### Reviewing

1. Read the file in the pull request. Check the content is accurate, not a
   duplicate, and appropriate for the site. Follow every link.
2. For meetups, confirm the date and time. The form asks for Charleston time
   and the service saves it with the Charleston offset for that date, so
   check the wall-clock time is what the submitter meant. A time that falls
   in a daylight saving change (it never happens, or happens twice) is
   adjusted and listed under **Needs a look** in the pull request. So is a
   time sent with some other offset (for example UTC): the service stores
   the same moment in Charleston time, which may not be the clock time the
   submitter typed.
3. Edit the entry if it needs changes, either in the CMS (open it from
   **In review**) or on the branch in GitHub. Small fixes are quicker than a
   round trip with the submitter.
4. Wait for the CI check. It runs the content schema validation, so a green
   check means the entry will build.
5. To publish, move the entry to **Ready** and choose **Publish** in the CMS,
   or merge the pull request on GitHub. To reject, delete the entry from the
   Workflow view or close the pull request and delete the branch.

Submissions are validated before the pull request is opened. The service only
accepts the fields each form sends and drops anything else, so a pull request
never contains front matter the form did not ask for.

### How the forms are protected

Three layers reduce spam before it reaches the queue:

1. **Rate limits.** nginx allows 10 submissions per minute per address with a
   short burst, and the service allows 5 per hour per address per form.
2. **A honeypot field.** Bots that fill every input are dropped silently.
   A relay host offer that trips it is still delivered, titled
   "Possible spam", because nothing else would record it.
3. **Cloudflare Turnstile.** When configured, each form shows a Turnstile
   check on first interaction and the service verifies the result with
   Cloudflare before doing anything else.

## Setup and operations

The site remains fully static. nginx serves the built HTML and proxies a
single path prefix, `/api/`, to a small Node service on the same Docker
network. That service handles form submissions and the GitHub sign-in for the
CMS. It has no dependencies beyond Node 22 and lives in
`services/submissions/`.

### Configuration reference

Build-time values are baked into the static output. Changing one requires a
rebuild and, in production, a new image digest.

| Build argument | Purpose |
| --- | --- |
| `PUBLIC_SUBMIT_BASE` | Path prefix the forms POST to, as `<base>/<kind>`. Optional; defaults to `/api/submit`. Must start with `/`: the CSP `connect-src` is `'self'`, so the build refuses a cross-origin value. nginx's `/api/` proxy and rate limit and the service's routes all assume `/api/submit`; change them together. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key. Empty disables the widget. |

Runtime values are read by the submissions service when it starts.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SITE_ORIGIN` | Yes | Public origin of the site, e.g. `https://chsmesh.org`. Submissions from any other origin are refused, and the CMS sign-in only ever returns a token to this origin. |
| `GITHUB_TOKEN` | Yes | Token the service uses to open pull requests. See [GitHub setup](#github-setup). |
| `GITHUB_REPO` | No | Defaults to `chsmesh/chsmesh.org`. |
| `GITHUB_BASE_BRANCH` | No | Defaults to `main`. |
| `DISCORD_WEBHOOK_URL` | Recommended; required for relay host offers | Webhook for a private moderators' channel. Receives the pull request link and the submitter's email, and the full text of each relay host offer. Without it a content submitter's email is only in the service logs, and relay host offers are refused with 503. |
| `TURNSTILE_SECRET` | No | Cloudflare Turnstile secret. When set, every submission must carry a valid token. Set it together with `PUBLIC_TURNSTILE_SITE_KEY`. |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | For the CMS | Credentials of the GitHub OAuth App used for CMS sign-in. Leave empty to disable sign-in. |
| `GITHUB_OAUTH_SCOPE` | No | Defaults to `public_repo`. |
| `PORT` | No | Defaults to `3000`. |

`.env.example` documents the same variables with comments.

### GitHub setup

1. **Service token.** Create a fine-grained personal access token (or a
   GitHub App installation token) for `chsmesh/chsmesh.org` with **Contents:
   read and write** and **Pull requests: read and write**. Put it in
   `GITHUB_TOKEN`. For an organisation repository, the organisation must
   allow fine-grained tokens and the token must be granted access to the
   organisation. Fine-grained tokens expire within a year, so note the date.
2. **OAuth App for the CMS.** In the organisation's developer settings,
   create an OAuth App with homepage `https://chsmesh.org` and authorization
   callback URL `https://chsmesh.org/api/auth/callback`. Put the client id
   and secret in the two `GITHUB_OAUTH_*` variables. GitHub accepts one
   callback URL per app, so local testing needs a second app (see
   [Local development](#local-development)).
3. **Labels.** Create `submission`, `guide`, `meetup`, `resource` and `build`.
   GitHub creates any missing label the first time the service applies it, so
   this is only for colours and descriptions. The service also applies
   `cms/pending_review`; the CMS manages the `cms/` labels from then on. If
   labelling fails twice the pull request is still opened and the Discord
   notice says so, but it will not appear in the CMS until someone adds
   `cms/pending_review` by hand.
4. **Branch protection on `main`.** Require a pull request before merging,
   require the `ci-ok` CI status check, and require at least one approval. The CMS
   editorial workflow and the service both work through pull requests, and
   this makes sure nothing else does.
5. **Editors** need write access to the repository. They sign in to the CMS
   with their own account.

### Turnstile setup

1. In the Cloudflare dashboard, create a Turnstile widget. Add `chsmesh.org`
   to its hostnames, and `localhost` if you want to test locally.
2. Put the site key in `PUBLIC_TURNSTILE_SITE_KEY` (a build argument) and the
   secret in `TURNSTILE_SECRET` (service only).

The forms render the widget with action `submit-<kind>`. The service accepts
a token only if Cloudflare reports success for this site's hostname and that
action, so a token minted on another page or site is rejected. Tokens are
single use and the widget resets after each attempt. CI builds with
Cloudflare's public test key, which always passes.

### Deploying the service

`docker-compose.yml` runs both containers for development and is the
reference for the production configuration. The `submissions` container:

- is built from `services/submissions/Dockerfile` (Node 22 on Alpine, runs as
  the `node` user);
- reads its variables from `.env`;
- runs read-only with all capabilities dropped and a `/tmp` tmpfs;
- exposes port 3000 only on the compose network. nginx reaches it as
  `http://submissions:3000`;
- answers `GET /healthz` for the container health check.

`docker-compose.server.yml` runs the same two containers for production
without Komodo, built from the checkout, and requires `.env` on the host (see
"Self-hosting without Komodo" in the README). The nginx container works
without the service present (`/api/` returns 502), so the two can be rolled
out independently.

nginx trusts `X-Forwarded-For` from private networks, which is where the
reverse proxy (Traefik in production) lives, so rate limits and the address
passed to the service are per visitor rather than per proxy. If the proxy is
ever on a public address, add it with `set_real_ip_from` in `nginx.conf`.

### What nginx does

- `location ^~ /api/` proxies to the service with the client address and
  protocol forwarded, limits request bodies to 64 KB, and applies the
  submission rate limit to `/api/submit/` only. Sign-in requests are not
  throttled.
- `location ^~ /api/submit/build` is the same proxy with a 13 MB body limit
  and a 60 second timeout, because build submissions carry their photos
  base64-encoded in the JSON body. The service enforces the same limit
  (`maxBodyBytes` on the `build` kind in `services/submissions/lib.mjs`);
  change the two together. Uploads are buffered in the nginx container's
  `/tmp` tmpfs.
- `location ^~ /admin/` serves the CMS with `Cache-Control: no-store` and
  `X-Robots-Tag: noindex`. `robots.txt` and the sitemap also exclude it.
- The Content Security Policy is widened for `/admin/` only, through `map`
  variables spliced into the single `add_header` line in
  `security-headers.conf`. They add what Sveltia needs: GitHub's API and
  avatars, fonts from jsdelivr, and `blob:` URLs. On every page the policy
  allows `https://challenges.cloudflare.com` for the Turnstile script and
  iframe.

If something on the CMS page is blocked, the browser console names the
directive. Adjust the `$csp_admin_*` maps in `nginx.conf`, not the shared
policy.

### Local development

1. Copy `.env.example` to `.env` and set:
   - `SITE_ORIGIN=http://localhost:8081`;
   - a `GITHUB_TOKEN` if you want submissions to open real pull requests
     (leave it empty and the form gets a 503 after validation);
   - for CMS sign-in, a second GitHub OAuth App whose callback is
     `http://localhost:8081/api/auth/callback`, with its credentials in the
     `GITHUB_OAUTH_*` variables;
   - optionally the Turnstile keys, with `localhost` added to the widget's
     hostnames.
2. Run `docker compose up --build`. The site is at `http://localhost:8081`.
3. Open the CMS at `http://localhost:8081/admin/`. Use `localhost`, not
   `127.0.0.1`: the service refuses other hosts and the sign-in popup only
   returns the token to the origin the page was opened from.

`npm run dev` serves the site without nginx or the service, so the forms and
the CMS sign-in do not work there.

### API reference

| Method and path | Purpose |
| --- | --- |
| `POST /api/submit/{guide,meetup,resource}` | Public submission. Body is the JSON the site's forms send. |
| `POST /api/submit/build` | Build gallery submission. The same, plus `photos`: a list of one to six `{ "data": "<base64 JPEG, PNG or WebP>", "alt": "<optional description>" }`. |
| `POST /api/submit/host` | Relay host offer from `/relay-sites/`. Forwarded to Discord only; no pull request. |
| `GET /api/auth?provider=github&site_id=<host>` | Starts CMS sign-in. Redirects to GitHub. |
| `GET /api/auth/callback` | GitHub returns here. Posts the token to the CMS window and closes. |
| `GET /healthz` | Health check. Not proxied by nginx. |

Submission responses:

| Status | Meaning |
| --- | --- |
| `200 { ok: true, pullRequest }` | Pull request opened. `pullRequest` is its URL. A host offer returns `200 { ok: true }` once Discord has accepted it. |
| `400 { ok: false, errors }` | Validation failed. `errors` lists the fields. |
| `400 { ok: false, error }` | Turnstile verification failed. |
| `403` | The request's `Origin` is not `SITE_ORIGIN`. |
| `413` | The body is over the limit: 64 KB, or 13 MB for a build. |
| `429` | Rate limited. |
| `503` | The service has no `GITHUB_TOKEN` (for a host offer: no `DISCORD_WEBHOOK_URL`). |
| `502` | GitHub or the network failed while opening the pull request (for a host offer: the Discord webhook failed). |

### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| CMS sign-in says `unknown site <host>` | The CMS was opened on a hostname other than `SITE_ORIGIN`'s. Open it at exactly that host. |
| GitHub says the `redirect_uri` is not associated with this application | The OAuth App's callback URL is not `<SITE_ORIGIN>/api/auth/callback`. Fix it in the app settings; no restart needed. |
| CMS sign-in returns 503 | `GITHUB_OAUTH_CLIENT_ID` or `GITHUB_OAUTH_CLIENT_SECRET` is empty. |
| Forms fail and `/api/` returns 502 | nginx cannot reach the service. Check that the `submissions` container is running and healthy. |
| Form says verification failed | Turnstile rejected the token. The service log names the reason. A hostname mismatch means the widget's hostnames do not include this site. |
| The CI check on a CMS pull request is red | Usually a draft with empty required fields. Finish the entry; it will go green. |
| A submission pull request exists but is not in the CMS Workflow view | It is missing the `cms/pending_review` label (the Discord notice flags this and the service log says why), or its branch was renamed. Add the label on GitHub; the branch must stay `cms/<collection>/<slug>`. |
| A build photo is refused as "not a complete JPEG" (or PNG, WebP) | The file is truncated or is not really that type. The form re-encodes photos before sending, so this normally means something posted to the API directly. |
| The CMS page is blank or a request is blocked | Check the browser console for a Content Security Policy message and adjust the `$csp_admin_*` maps. |

### Why it is built this way

- **Static site, one proxied prefix.** The site keeps its static build and
  hardened nginx image. The service is the only dynamic piece, isolated
  behind `/api/`.
- **Server-side sign-in.** GitHub does not support browser-only (PKCE) sign-in
  for OAuth Apps, so the CMS uses the authorization code flow with the service
  holding the client secret. The service accepts the token only for
  `SITE_ORIGIN` and returns it only to that origin.
- **CMS bundled from npm.** `src/pages/admin/index.astro` imports
  `@sveltia/cms` so the bundle ships as a hashed file under `/_astro/` and the
  `script-src 'self'` policy holds on the CMS page too.
- **Photos travel in the JSON body and are cleaned without an image
  library.** Keeping one request format means the same validation, honeypot
  and Turnstile path covers every form, and stripping metadata by rebuilding
  the file's container keeps the service free of dependencies. The price is
  that the service cannot resize: the browser does that, and the size and
  dimension limits hold for anything that skips the browser.
- **Contact details stay out of the repository.** The submitter's email is
  required by the forms but is sent only to Discord, never written to a file
  or a pull request.
