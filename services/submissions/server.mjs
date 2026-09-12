// chsmesh.org submissions service.
//
// Two jobs, both same-origin behind nginx (`location ^~ /api/`):
//
//   POST /api/submit/{node,guide,meetup,resource}
//       Accept the JSON payload the site's SubmissionForm already produces,
//       validate it, write the content file to a new branch, open a pull
//       request, and notify a private Discord channel. Anonymous users never
//       touch GitHub directly; the fine-grained token stays here.
//
//   GET  /api/auth, /api/auth/callback
//       Decap/Sveltia-compatible GitHub OAuth handshake for the CMS at
//       /admin/, so no third-party authenticator is needed.
//
// Runtime: Node 22+, no dependencies. See docs/cms-and-submissions.md.

import http from 'node:http';
import crypto from 'node:crypto';
import { KINDS, SPECS, validate, buildFile, slugify, pullRequestBody, turnstileVerdict } from './lib.mjs';

const env = (name, fallback = '') => (process.env[name] ?? fallback).trim();

const PORT = Number(env('PORT', '3000'));
const SITE_ORIGIN = env('SITE_ORIGIN').replace(/\/$/, '');
const GITHUB_TOKEN = env('GITHUB_TOKEN');
const GITHUB_REPO = env('GITHUB_REPO', 'chsmesh/chsmesh.org');
const GITHUB_BASE_BRANCH = env('GITHUB_BASE_BRANCH', 'main');
const DISCORD_WEBHOOK_URL = env('DISCORD_WEBHOOK_URL');
const TURNSTILE_SECRET = env('TURNSTILE_SECRET');
const OAUTH_CLIENT_ID = env('GITHUB_OAUTH_CLIENT_ID');
const OAUTH_CLIENT_SECRET = env('GITHUB_OAUTH_CLIENT_SECRET');
const OAUTH_SCOPE = env('GITHUB_OAUTH_SCOPE', 'public_repo');
const MAX_BODY_BYTES = 64 * 1024;
// `Secure` cookies are dropped by browsers over plain http, which would break
// the OAuth state check when testing against http://localhost.
const COOKIE_SECURE = SITE_ORIGIN.startsWith('https://') ? '; Secure' : '';
const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 }; // per client IP per kind

if (!SITE_ORIGIN) console.warn('SITE_ORIGIN is unset; cross-origin submissions will not be rejected and OAuth is disabled.');
if (!GITHUB_TOKEN) console.warn('GITHUB_TOKEN is unset; submissions will be rejected with 503.');

// ---------------------------------------------------------------------------
// Helpers

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('body is not valid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  // nginx sets X-Real-IP; fall back to the socket for direct local testing.
  return req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
}

const buckets = new Map();
function rateLimited(key) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (hits.length >= RATE_LIMIT.max) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const live = hits.filter((t) => now - t < RATE_LIMIT.windowMs);
    if (live.length) buckets.set(key, live);
    else buckets.delete(key);
  }
}, RATE_LIMIT.windowMs).unref();

async function github(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'chsmesh-submissions',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`GitHub ${method} ${path} responded ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// Server-side Turnstile check. Returns true when the token is valid (or
// Turnstile is not configured), false otherwise; the reason is logged, never
// sent to the client. `kind` must match the `submit-<kind>` action the form
// renders the widget with (see SubmissionForm.astro).
async function verifyTurnstile(token, ip, kind) {
  if (!TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) {
    console.log(`Turnstile: missing token (${kind}) from ${ip}`);
    return false;
  }
  let result;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token, remoteip: ip }),
    });
    result = await res.json();
  } catch (error) {
    console.error(`Turnstile: siteverify request failed: ${error.message}`);
    return false;
  }
  const verdict = turnstileVerdict(result, {
    hostname: SITE_ORIGIN ? new URL(SITE_ORIGIN).hostname : '',
    action: `submit-${kind}`,
  });
  if (!verdict.ok) console.log(`Turnstile: rejected (${kind}) from ${ip}: ${verdict.reason}`);
  return verdict.ok;
}

async function notifyDiscord({ kind, title, email, prUrl }) {
  if (!DISCORD_WEBHOOK_URL) return false;
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: `New ${SPECS[kind].label.toLowerCase()} submission: ${title}`.slice(0, 256),
          url: prUrl,
          fields: [
            { name: 'Pull request', value: prUrl },
            { name: 'Submitter email', value: email },
          ],
        },
      ],
    }),
  });
  if (!res.ok) console.error(`Discord webhook responded ${res.status}`);
  return res.ok;
}

// ---------------------------------------------------------------------------
// Submissions

async function openPullRequest(kind, data) {
  const today = new Date().toISOString().slice(0, 10);
  const shortId = crypto.randomBytes(3).toString('hex');
  let slug = slugify(data.name ?? data.title);

  const probe = buildFile(kind, data, { slug, today });
  const existing = await github(`/repos/${GITHUB_REPO}/contents/${probe.path}?ref=${encodeURIComponent(GITHUB_BASE_BRANCH)}`);
  if (existing) slug = `${slug}-${shortId}`;

  const file = buildFile(kind, data, { slug, today });
  const branch = `submissions/${kind}/${slug}-${shortId}`;

  const base = await github(`/repos/${GITHUB_REPO}/git/ref/heads/${encodeURIComponent(GITHUB_BASE_BRANCH)}`);
  if (!base) throw new Error(`base branch ${GITHUB_BASE_BRANCH} not found`);

  await github(`/repos/${GITHUB_REPO}/git/refs`, {
    method: 'POST',
    body: { ref: `refs/heads/${branch}`, sha: base.object.sha },
  });
  await github(`/repos/${GITHUB_REPO}/contents/${file.path}`, {
    method: 'PUT',
    body: {
      message: `content(${kind}s): add ${slug} from public submission`,
      content: Buffer.from(file.content, 'utf8').toString('base64'),
      branch,
    },
  });
  const pr = await github(`/repos/${GITHUB_REPO}/pulls`, {
    method: 'POST',
    body: {
      title: `${SPECS[kind].label} submission: ${file.title}`.slice(0, 250),
      head: branch,
      base: GITHUB_BASE_BRANCH,
      body: pullRequestBody(kind, data, { path: file.path, hasContact: Boolean(DISCORD_WEBHOOK_URL) }),
    },
  });
  try {
    await github(`/repos/${GITHUB_REPO}/issues/${pr.number}/labels`, { method: 'POST', body: { labels: ['submission', kind] } });
  } catch (error) {
    console.warn(`Could not label PR #${pr.number}: ${error.message}`);
  }
  return { url: pr.html_url, number: pr.number, title: file.title };
}

async function handleSubmit(req, res, kind) {
  if (!KINDS.includes(kind)) return send(res, 404, { ok: false, error: 'unknown submission kind' });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' }, { allow: 'POST' });

  const origin = req.headers.origin;
  if (SITE_ORIGIN && origin && origin !== SITE_ORIGIN) return send(res, 403, { ok: false, error: 'cross-origin submissions are not accepted' });
  if (!GITHUB_TOKEN) return send(res, 503, { ok: false, error: 'submissions are temporarily unavailable' });

  const ip = clientIp(req);
  if (rateLimited(`${kind}:${ip}`)) return send(res, 429, { ok: false, error: 'too many submissions, try again later' });

  let payload;
  try {
    payload = await readJson(req);
  } catch (error) {
    return send(res, error.status ?? 400, { ok: false, error: error.message });
  }

  // Honeypot: the real form never fills `website`; bots do. Pretend success.
  if (typeof payload.website === 'string' && payload.website.trim()) {
    console.log(`Dropped honeypot submission (${kind}) from ${ip}`);
    return send(res, 200, { ok: true });
  }
  // The form sends the widget token as `turnstileToken`; accept Cloudflare's
  // default field name too for anyone posting the raw form encoding.
  if (!(await verifyTurnstile(payload.turnstileToken ?? payload['cf-turnstile-response'], ip, kind))) {
    return send(res, 400, { ok: false, error: 'verification failed, please retry' });
  }

  const { ok, errors, data } = validate(kind, payload);
  if (!ok) return send(res, 400, { ok: false, errors });

  try {
    const pr = await openPullRequest(kind, data);
    const notified = await notifyDiscord({ kind, title: pr.title, email: data.submitterEmail, prUrl: pr.url }).catch((error) => {
      console.error(`Discord notification failed: ${error.message}`);
      return false;
    });
    if (!notified) console.log(`Submission PR #${pr.number} (${kind}) from ${data.submitterEmail}`);
    return send(res, 200, { ok: true, pullRequest: pr.url });
  } catch (error) {
    console.error(`Submission failed (${kind}): ${error.message}`);
    return send(res, 502, { ok: false, error: 'could not record the submission, please try again later' });
  }
}

// ---------------------------------------------------------------------------
// GitHub OAuth for the CMS (Decap/Sveltia protocol). The CMS opens
// /api/auth in a popup; the callback page posts the token back to the opener.
// The callback's script is served as a separate file so it satisfies the
// site-wide CSP of script-src 'self' (nginx adds the headers to proxied
// responses too).

const CALLBACK_JS = `(function () {
  var el = document.currentScript;
  var origin = el.dataset.origin, provider = el.dataset.provider;
  var message = 'authorization:' + provider + ':' + el.dataset.status + ':' + el.dataset.payload;
  function receive(event) {
    if (event.origin !== origin || event.data !== 'authorizing:' + provider) return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(message, event.origin);
  }
  if (!window.opener) { document.body.textContent = 'Open this page from the CMS.'; return; }
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:' + provider, origin);
})();`;

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

function oauthReady() {
  return Boolean(SITE_ORIGIN && OAUTH_CLIENT_ID && OAUTH_CLIENT_SECRET);
}

function handleAuthStart(req, res, url) {
  if (!oauthReady()) return send(res, 503, { ok: false, error: 'CMS sign-in is not configured' });
  const provider = url.searchParams.get('provider') ?? 'github';
  if (provider !== 'github') return send(res, 400, { ok: false, error: 'unsupported provider' });
  // Sveltia sends the page's hostname (no port) as site_id. On localhost it
  // sends "cms.netlify.com" unless the admin page overrides site_domain, so
  // accept that placeholder for a local origin too.
  const siteId = url.searchParams.get('site_id');
  const expectedHost = new URL(SITE_ORIGIN).hostname;
  const allowedSiteIds = expectedHost === 'localhost' ? [expectedHost, 'cms.netlify.com'] : [expectedHost];
  if (siteId && !allowedSiteIds.includes(siteId)) {
    return send(res, 403, { ok: false, error: `unknown site ${siteId}; open the CMS at ${SITE_ORIGIN}` });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', OAUTH_CLIENT_ID);
  authorize.searchParams.set('scope', url.searchParams.get('scope') || OAUTH_SCOPE);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('redirect_uri', `${SITE_ORIGIN}/api/auth/callback`);

  res.writeHead(302, {
    location: authorize.toString(),
    'cache-control': 'no-store',
    'set-cookie': `chsmesh_oauth_state=${state}; Path=/api/auth; Max-Age=600; HttpOnly${COOKIE_SECURE}; SameSite=Lax`,
  });
  res.end();
}

async function handleAuthCallback(req, res, url) {
  if (!oauthReady()) return send(res, 503, { ok: false, error: 'CMS sign-in is not configured' });
  const provider = 'github';
  const clearCookie = `chsmesh_oauth_state=; Path=/api/auth; Max-Age=0; HttpOnly${COOKIE_SECURE}; SameSite=Lax`;
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const { chsmesh_oauth_state: expected } = parseCookies(req.headers.cookie);

  let status = 'error';
  let payload = { error: 'sign-in failed' };
  if (!code || !state || !expected || state !== expected) {
    payload = { error: 'invalid or expired sign-in state; close this window and try again' };
  } else {
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: OAUTH_CLIENT_ID,
          client_secret: OAUTH_CLIENT_SECRET,
          code,
          redirect_uri: `${SITE_ORIGIN}/api/auth/callback`,
        }),
      });
      const token = await tokenRes.json();
      if (token.access_token) {
        status = 'success';
        payload = { provider, token: token.access_token };
      } else {
        payload = { error: token.error_description || token.error || 'GitHub did not return a token' };
      }
    } catch (error) {
      payload = { error: `token exchange failed: ${error.message}` };
    }
  }

  const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in to CHS Mesh CMS</title></head>
<body><p>${status === 'success' ? 'Signed in. This window will close.' : `Sign-in failed: ${attr(payload.error)}`}</p>
<script src="/api/auth/callback.js" data-origin="${attr(SITE_ORIGIN)}" data-provider="${provider}" data-status="${status}" data-payload="${attr(JSON.stringify(payload))}"></script>
</body></html>`;
  send(res, 200, html, { 'set-cookie': clearCookie, 'referrer-policy': 'no-referrer' });
}

// ---------------------------------------------------------------------------
// Router

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (path === '/healthz') return send(res, 200, { ok: true });
    if (path === '/api/auth') return handleAuthStart(req, res, url);
    if (path === '/api/auth/callback') return await handleAuthCallback(req, res, url);
    if (path === '/api/auth/callback.js') {
      return send(res, 200, CALLBACK_JS, { 'content-type': 'text/javascript; charset=utf-8' });
    }
    const submit = path.match(/^\/api\/submit\/([a-z]+)$/);
    if (submit) return await handleSubmit(req, res, submit[1]);
    return send(res, 404, { ok: false, error: 'not found' });
  } catch (error) {
    console.error(`Unhandled error for ${req.method} ${path}: ${error.stack || error.message}`);
    if (!res.headersSent) send(res, 500, { ok: false, error: 'internal error' });
  }
});

server.listen(PORT, () => console.log(`submissions service listening on :${PORT} for ${SITE_ORIGIN || '(any origin)'}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
