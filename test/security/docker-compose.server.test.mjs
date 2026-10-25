import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const composePath = path.resolve(__dirname, '../../docker-compose.server.yml');
const localComposePath = path.resolve(__dirname, '../../docker-compose.yml');
const dockerfilePath = path.resolve(__dirname, '../../Dockerfile');
const submissionsDockerfilePath = path.resolve(__dirname, '../../services/submissions/Dockerfile');
const nginxConfigPath = path.resolve(__dirname, '../../nginx.conf');
const securityHeadersPath = path.resolve(__dirname, '../../security-headers.conf');
const serverUpdateScriptPath = path.resolve(__dirname, '../../scripts/server-update.sh');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('should reject docker.sock exposure in server compose services', () => {
  const compose = readFile(composePath);

  // Regression guard against host socket mount reintroduction.
  assert.equal(
    /\/var\/run\/docker\.sock\s*:\s*\/var\/run\/docker\.sock/.test(compose),
    false,
    'docker.sock must never be mounted by application-side containers'
  );
});

test('should enforce non-root and hardened runtime controls in compose files', () => {
  for (const filePath of [composePath, localComposePath]) {
    const compose = readFile(filePath);

    assert.match(compose, /user:\s*"101:101"/, `${filePath} must run as non-root UID/GID`);
    assert.match(compose, /read_only:\s*true/, `${filePath} must use a read-only root filesystem`);
    assert.match(compose, /cap_drop:\s*[\s\S]*-\s*ALL/, `${filePath} must drop all Linux capabilities`);
    assert.match(
      compose,
      /security_opt:\s*[\s\S]*-\s*no-new-privileges:true/,
      `${filePath} must set no-new-privileges`
    );

    for (const writablePath of ['/var/cache/nginx', '/var/run', '/tmp']) {
      assert.match(compose, new RegExp(`-\\s*${writablePath.replaceAll('/', '\\/')}`), `${filePath} must include tmpfs ${writablePath}`);
    }
  }
});

test('should build production images from the checkout on digest-pinned bases', () => {
  const compose = readFile(composePath);

  // Images come from this repository, not a registry, so a fork can host the
  // site; reproducibility comes from pinning every FROM by digest instead.
  assert.doesNotMatch(compose, /^\s*image:/m, 'server compose must build its images, not pull them');
  assert.match(compose, /^  submissions:\n\s+build:\n\s+context: \.\/services\/submissions$/m, 'server compose must build the submissions service');
  assert.match(compose, /^  chsmesh:[\s\S]*?build:\n\s+context: \.$/m, 'server compose must build the site image');

  for (const filePath of [dockerfilePath, submissionsDockerfilePath]) {
    for (const line of readFile(filePath).split('\n').filter((l) => /^FROM\s/.test(l))) {
      assert.match(line, /@sha256:[a-f0-9]{64}/, `base image must be digest pinned: ${line}`);
    }
  }
});

test('should run the hardened submissions service in production', () => {
  const compose = readFile(composePath);
  const service = compose.slice(compose.indexOf('\n  submissions:'), compose.indexOf('\n  chsmesh:'));

  assert.match(service, /path: \.env\n\s+required: true/, 'production must require .env for the service secrets');
  assert.match(service, /user:\s*"1000:1000"/);
  assert.match(service, /read_only:\s*true/);
  assert.match(service, /cap_drop:\s*\n\s*-\s*ALL/);
  assert.match(service, /no-new-privileges:true/);
  assert.doesNotMatch(service, /^\s*ports:/m, 'the service must only be reachable through nginx');
});

test('should configure a production healthcheck for the server compose service', () => {
  const compose = readFile(composePath);

  assert.match(
    compose,
    /healthcheck:\s*[\s\S]*test:\s*\["CMD-SHELL",\s*"wget -qO- http:\/\/127\.0\.0\.1:8080\/ \|\| exit 1"\]/,
    'server compose must define the production healthcheck command'
  );
  // nginx listens on IPv4 only; `localhost` resolves to ::1 first in the
  // container and busybox wget does not fall back, so the check never passes.
  assert.doesNotMatch(compose, /localhost:8080/, 'the healthcheck must target 127.0.0.1, not localhost');
  assert.match(compose, /start_period:\s*10s/, 'server compose must allow the healthcheck a startup period');
});

test('should reject root nginx runtime in Dockerfile', () => {
  const dockerfile = readFile(dockerfilePath);

  assert.match(dockerfile, /^USER\s+nginx$/m, 'Dockerfile runtime stage must drop to nginx user');
  assert.match(dockerfile, /^EXPOSE\s+8080$/m, 'Dockerfile runtime stage should expose unprivileged port 8080');
});

test('should rebuild from the checkout and stop on failure before restarting', () => {
  const serverUpdateScript = readFile(serverUpdateScriptPath);

  assert.match(serverUpdateScript, /\[\[ ! -f \.env \]\]/, 'server update script must refuse to run without .env');
  assert.match(serverUpdateScript, /git pull --ff-only/, 'server update script must only fast-forward the checkout');
  assert.match(
    serverUpdateScript,
    /if ! docker compose -f "\$COMPOSE_FILE" build; then/,
    'server update script must stop when the build fails'
  );
  assert.match(serverUpdateScript, /up -d --remove-orphans/);
});

test('should reject unsafe-inline scripts, allow current inline styles, and require HSTS preload policy in nginx', () => {
  // The security headers now live in the shared include that nginx.conf pulls
  // into the server block and every add_header location, so assert across both.
  const nginxConfig = `${readFile(nginxConfigPath)}\n${readFile(securityHeadersPath)}`;

  assert.equal(
    /script-src[^;]*'unsafe-inline'/.test(nginxConfig),
    false,
    'CSP must not allow unsafe-inline scripts'
  );
  assert.match(
    nginxConfig,
    /style-src[^;]*'unsafe-inline'/,
    'CSP must allow unsafe-inline styles while inline style attributes remain in the site'
  );

  assert.match(
    nginxConfig,
    /add_header\s+Strict-Transport-Security\s+\$hsts_header\s+always;/,
    'nginx must emit Strict-Transport-Security header'
  );
  assert.match(
    nginxConfig,
    /https\s+"max-age=63072000; includeSubDomains; preload";/,
    'HSTS policy must be at least 2 years with includeSubDomains and preload'
  );
});
