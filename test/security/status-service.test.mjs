import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const composeFiles = ['docker-compose.yml', 'docker-compose.server.yml', 'docker-compose.komodo.yml'];

// The status service block runs from `  status:` to the next top-level key.
const statusBlock = (compose) => {
  const start = compose.indexOf('\n  status:');
  assert.notEqual(start, -1, 'compose file must define the status service');
  const rest = compose.slice(start + 1);
  const end = rest.search(/\n(?:\S|  \S[^\n]*:\n)/);
  return end === -1 ? rest : rest.slice(0, end);
};

test('status service runs hardened in every compose file', () => {
  for (const file of composeFiles) {
    const service = statusBlock(read(file));
    assert.match(service, /user:\s*"1000:1000"/, `${file}: non-root user`);
    assert.match(service, /read_only:\s*true/, `${file}: read-only root filesystem`);
    assert.match(service, /cap_drop:\s*\n\s*-\s*ALL/, `${file}: drop all capabilities`);
    assert.match(service, /no-new-privileges:true/, `${file}: no-new-privileges`);
    assert.match(service, /status-data:\/data/, `${file}: state on a named volume`);
    assert.doesNotMatch(service, /^\s*ports:/m, `${file}: only reachable through nginx`);
    // Least privilege: the collector gets its own variables, never the whole
    // .env with the submissions service's GitHub and Discord secrets.
    assert.doesNotMatch(service, /env_file:/, `${file}: must not receive the full .env`);
    assert.match(service, /STATUS_MQTT_PASSWORD: \$\{STATUS_MQTT_PASSWORD:-\}/, `${file}: password from the environment`);
  }
});

test('status service stays off the shared proxy network in production', () => {
  const service = statusBlock(read('docker-compose.komodo.yml'));
  assert.match(service, /networks:\s*\n\s*-\s*internal\s*$/m);
  assert.doesNotMatch(service, /-\s*proxy/);
  assert.doesNotMatch(service, /traefik/);
});

test('status image is digest pinned and copies every module it imports', () => {
  const dockerfile = read('services/status/Dockerfile');
  for (const line of dockerfile.split('\n').filter((l) => /^FROM\s/.test(l))) {
    assert.match(line, /@sha256:[a-f0-9]{64}/, `base image must be digest pinned: ${line}`);
  }
  assert.match(dockerfile, /^USER node$/m);
  const copied = dockerfile.match(/^COPY (.+) \.\/$/m)[1].split(/\s+/);
  for (const file of fs.readdirSync(path.join(root, 'services/status'))) {
    if (/\.(mjs|json)$/.test(file)) assert.ok(copied.includes(file), `Dockerfile must COPY ${file}`);
  }
});

test('nginx routes /api/status/ to the status service, read-only, ahead of /api/', () => {
  const nginx = read('nginx.conf');
  const statusAt = nginx.indexOf('location ^~ /api/status/ {');
  const apiAt = nginx.indexOf('location ^~ /api/ {');
  assert.ok(statusAt !== -1 && apiAt !== -1);
  const block = nginx.slice(statusAt, nginx.indexOf('\n        }\n', statusAt));
  assert.match(block, /set \$status_upstream http:\/\/status:3001;/);
  assert.match(block, /proxy_pass \$status_upstream;/);
  assert.match(block, /limit_except GET/);
  assert.doesNotMatch(block, /add_header/, 'must inherit the server-level security headers');
});

test('the status service has no dependencies', () => {
  const pkg = JSON.parse(read('services/status/package.json'));
  assert.equal(pkg.dependencies, undefined);
  for (const file of fs.readdirSync(path.join(root, 'services/status')).filter((f) => f.endsWith('.mjs'))) {
    for (const [, spec] of read(`services/status/${file}`).matchAll(/from '([^']+)'/g)) {
      assert.ok(spec.startsWith('node:') || spec.startsWith('./'), `${file} imports ${spec}`);
    }
  }
});

test('infrastructure list never carries coordinates', () => {
  const infra = JSON.parse(read('services/status/infrastructure.json'));
  for (const site of infra.sites) {
    assert.match(site.id, /^![0-9a-f]{8}$/);
    for (const key of ['lat', 'lon', 'lng', 'latitude', 'longitude', 'coordinates', 'address']) {
      assert.equal(site[key], undefined, `${site.name} must not list ${key}`);
    }
  }
});
