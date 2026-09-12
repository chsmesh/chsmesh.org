// nginx is not installed in this environment, so these are config-text checks
// rather than live request assertions. They guard the header-inheritance trap
// that silently stripped every security header from HTML responses: nginx drops
// all inherited add_header directives inside any location that declares one of
// its own, so every such location must re-include security-headers.conf.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const nginxConfigPath = path.join(repoRoot, 'nginx.conf');
const securityHeadersPath = path.join(repoRoot, 'security-headers.conf');
const dockerfilePath = path.join(repoRoot, 'Dockerfile');
const composePath = path.join(repoRoot, 'docker-compose.yml');

const INCLUDE_DIRECTIVE = 'include /etc/nginx/security-headers.conf;';

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Split an nginx config into its top-level `server { ... }` bodies and, within
 * each, the body of every `location ... { ... }` block. Brace counting is
 * sufficient here: the config has no braces inside quoted strings.
 */
function parseBlocks(config) {
  const servers = [];

  const blockAt = (openIndex) => {
    let depth = 0;
    for (let i = openIndex; i < config.length; i += 1) {
      if (config[i] === '{') depth += 1;
      else if (config[i] === '}') {
        depth -= 1;
        if (depth === 0) return { body: config.slice(openIndex + 1, i), end: i };
      }
    }
    throw new Error('unbalanced braces in nginx config');
  };

  const serverRe = /\bserver\s*\{/g;
  let match;
  while ((match = serverRe.exec(config)) !== null) {
    const openIndex = config.indexOf('{', match.index);
    const { body, end } = blockAt(openIndex);
    servers.push(body);
    serverRe.lastIndex = end;
  }

  return servers;
}

function parseLocations(serverBody) {
  const locations = [];
  const locationRe = /\blocation\s+([^\n{]*?)\s*\{/g;
  let match;
  while ((match = locationRe.exec(serverBody)) !== null) {
    const openIndex = serverBody.indexOf('{', match.index);
    let depth = 0;
    for (let i = openIndex; i < serverBody.length; i += 1) {
      if (serverBody[i] === '{') depth += 1;
      else if (serverBody[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          locations.push({ matcher: match[1].trim(), body: serverBody.slice(openIndex + 1, i) });
          locationRe.lastIndex = i;
          break;
        }
      }
    }
  }
  return locations;
}

test('should keep every security header in the shared include file', () => {
  const headers = readFile(securityHeadersPath);

  for (const header of [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
    'Permissions-Policy',
    'Strict-Transport-Security',
    'Content-Security-Policy',
  ]) {
    assert.match(
      headers,
      new RegExp(`add_header\\s+${header}\\b[^\n]*always;`),
      `security-headers.conf must set ${header} with the always flag`
    );
  }

  const nginxConfig = readFile(nginxConfigPath);
  for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options']) {
    assert.equal(
      new RegExp(`add_header\\s+${header}\\b`).test(nginxConfig),
      false,
      `${header} must be declared only in security-headers.conf, not duplicated in nginx.conf`
    );
  }
});

test('should include security headers in the server block and in every add_header location', () => {
  const nginxConfig = readFile(nginxConfigPath);
  const servers = parseBlocks(nginxConfig);

  assert.ok(servers.length > 0, 'nginx.conf must define at least one server block');

  for (const serverBody of servers) {
    const locations = parseLocations(serverBody);
    const serverLevel = locations.reduce((body, loc) => body.replace(loc.body, ''), serverBody);

    assert.ok(
      serverLevel.includes(INCLUDE_DIRECTIVE),
      'server block must include security-headers.conf'
    );

    for (const location of locations) {
      if (!/\badd_header\b/.test(location.body)) continue;
      assert.ok(
        location.body.includes(INCLUDE_DIRECTIVE),
        `location ${location.matcher} declares add_header, so it must re-include security-headers.conf ` +
          '(nginx does not inherit add_header into such a location)'
      );
    }
  }
});

test('should serve a real 404 instead of an SPA index.html fallback', () => {
  const nginxConfig = readFile(nginxConfigPath);

  assert.equal(
    /try_files[^;]*\/index\.html\s*;/.test(nginxConfig),
    false,
    'try_files must not fall back to /index.html on a static site'
  );
  assert.match(
    nginxConfig,
    /try_files\s+\$uri\s+\$uri\/\s+=404\s*;/,
    'try_files must end with =404'
  );
  assert.match(nginxConfig, /error_page\s+404\s+\/404\.html\s*;/, 'nginx must map 404 to /404.html');
});

test('should hide the nginx version banner', () => {
  assert.match(readFile(nginxConfigPath), /^\s*server_tokens\s+off\s*;/m, 'server_tokens must be off');
});

test('should redirect the legacy .md content URLs permanently', () => {
  const nginxConfig = readFile(nginxConfigPath);

  for (const section of ['guides', 'meetups']) {
    assert.match(
      nginxConfig,
      new RegExp(`rewrite\\s+"?\\^/${section}/\\(\\.\\+\\)\\\\\\.md/\\?\\$"?\\s+/${section}/\\$1/\\s+permanent\\s*;`),
      `nginx must permanently redirect legacy /${section}/<name>.md/ URLs to the clean URL`
    );
  }
});

test('should scope the immutable one-year cache to hashed /_astro/ output', () => {
  const nginxConfig = readFile(nginxConfigPath);
  const locations = parseBlocks(nginxConfig).flatMap(parseLocations);

  const immutable = locations.filter((loc) => /immutable/.test(loc.body));
  assert.equal(immutable.length, 1, 'exactly one location may serve immutable cache headers');
  assert.equal(
    immutable[0].matcher,
    '^~ /_astro/',
    'the immutable one-year cache must be scoped to /_astro/ so unhashed files like favicon.svg are not pinned'
  );
  assert.match(immutable[0].body, /expires\s+1y\s*;/, '/_astro/ must use a one-year expiry');
});

test('should deny dotfiles before the static asset regex location', () => {
  const [serverBody] = parseBlocks(readFile(nginxConfigPath));
  const locations = parseLocations(serverBody);

  const dotfileIndex = locations.findIndex((loc) => loc.matcher === '~ /\\.');
  const assetIndex = locations.findIndex((loc) => /\\\.\(js\|css/.test(loc.matcher));

  assert.notEqual(dotfileIndex, -1, 'nginx must deny hidden files');
  assert.notEqual(assetIndex, -1, 'nginx must define the static asset regex location');
  assert.ok(
    dotfileIndex < assetIndex,
    'the dotfile deny block must precede the asset regex so nginx first-match-wins ordering favours it'
  );
  assert.match(locations[dotfileIndex].body, /deny\s+all\s*;/);
});

test('should build the CSP connect-src from the n8n webhook origin at image build time', () => {
  const headers = readFile(securityHeadersPath);
  const dockerfile = readFile(dockerfilePath);

  assert.match(
    headers,
    /connect-src\s+'self'\s+__N8N_ORIGIN__/,
    "connect-src must be 'self' plus the build-time n8n origin placeholder"
  );
  assert.match(
    dockerfile,
    /sed\s+-i\s+"s#__N8N_ORIGIN__#\$\{origins?\}#g"/,
    'the builder stage must substitute the derived origin list into the placeholder'
  );
  for (const arg of [
    'PUBLIC_N8N_WEBHOOK_URL',
    'PUBLIC_N8N_GUIDES_WEBHOOK_URL',
    'PUBLIC_N8N_MEETUPS_WEBHOOK_URL',
    'PUBLIC_N8N_RESOURCES_WEBHOOK_URL',
  ]) {
    assert.match(
      dockerfile,
      new RegExp(`for url in[^;]*\\$\\{${arg}:-\\}`),
      `the origin list must be derived from ${arg}`
    );
  }
  assert.match(dockerfile, /WARNING: PUBLIC_N8N_WEBHOOK_URL is unset/, 'an empty ARG must emit a build warning');
  assert.match(dockerfile, /ERROR: webhook URL is not a plain http\(s\)/, 'a malformed webhook URL must fail the build');
  assert.match(dockerfile, /^RUN nginx -t\b/m, 'the runtime stage must validate the nginx config at build time');
  // `nginx -t` runs as root and creates the pid file and temp dirs named in
  // nginx.conf; left behind, the unprivileged runtime user cannot open the
  // pid file and nginx exits at startup (only visible without a tmpfs on
  // /tmp, i.e. in a plain `docker run`).
  assert.match(
    dockerfile,
    /^RUN nginx -t && rm -rf \/tmp\/nginx\.pid \/tmp\/nginx-\*$/m,
    'the config test must remove the root-owned pid file and temp dirs it creates'
  );
});

test('should ship the security header include into the runtime image', () => {
  const dockerfile = readFile(dockerfilePath);

  assert.match(
    dockerfile,
    /^COPY\s+--from=builder\s+\/app\/security-headers\.conf\s+\/etc\/nginx\/security-headers\.conf$/m,
    'the runtime stage must COPY security-headers.conf to /etc/nginx/'
  );
  assert.match(
    dockerfile,
    /^COPY\s+nginx\.conf\s+\/etc\/nginx\/nginx\.conf$/m,
    'the runtime stage must COPY nginx.conf'
  );
});

test('should pin both Dockerfile base images by digest', () => {
  const dockerfile = readFile(dockerfilePath);
  const fromLines = dockerfile.split('\n').filter((line) => /^FROM\s/.test(line));

  assert.equal(fromLines.length, 2, 'Dockerfile should have exactly two build stages');
  for (const line of fromLines) {
    assert.match(line, /@sha256:[a-f0-9]{64}/, `base image must be digest pinned: ${line}`);
  }
});

test('should forward every PUBLIC_N8N build arg from the local compose build', () => {
  const compose = readFile(composePath);

  assert.match(compose, /build:\s*[\s\S]*?\bargs:/, 'docker-compose.yml build must declare args');

  for (const key of [
    'PUBLIC_N8N_WEBHOOK_URL',
    'PUBLIC_N8N_GUIDES_WEBHOOK_URL',
    'PUBLIC_N8N_MEETUPS_WEBHOOK_URL',
    'PUBLIC_N8N_RESOURCES_WEBHOOK_URL',
  ]) {
    assert.match(
      compose,
      new RegExp(`^\\s*${key}:\\s*\\$\\{${key}(:-)?[^}]*\\}`, 'm'),
      `docker-compose.yml must forward ${key} as a build arg`
    );
  }
});

test('should not ship an inline define:vars script in the submission form', () => {
  const form = readFile(path.join(repoRoot, 'src/components/SubmissionForm.astro'));

  assert.equal(
    /<script[^>]*\bdefine:vars\b/.test(form),
    false,
    "a define:vars script is forced inline, which script-src 'self' blocks"
  );
  assert.match(
    form,
    /<script\s+type="application\/json"[\s\S]*?data-form-config/,
    'the form config must reach the client through an inert JSON data block'
  );
  assert.match(
    form,
    /\.replace\(\/<\/g, '\\\\u003c'\)/,
    'the JSON data block must escape "<" so no value can close the tag early'
  );
});
