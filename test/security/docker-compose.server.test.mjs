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

test('should pin production container images to immutable digests', () => {
  const compose = readFile(composePath);
  const imageLines = compose
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('image:'));

  assert.ok(imageLines.length > 0, 'server compose should define at least one image');

  for (const line of imageLines) {
    const imageRef = line.replace(/^image:\s*/, '').trim();

    assert.match(
      imageRef,
      /@sha256:[a-f0-9]{64}$/,
      `image must be pinned by digest: ${imageRef}`
    );

    assert.equal(
      /:latest$/.test(imageRef),
      false,
      `mutable :latest tag is not allowed in production image references: ${imageRef}`
    );
  }
});

test('should reject root nginx runtime in Dockerfile', () => {
  const dockerfile = readFile(dockerfilePath);

  assert.match(dockerfile, /^USER\s+nginx$/m, 'Dockerfile runtime stage must drop to nginx user');
  assert.match(dockerfile, /^EXPOSE\s+8080$/m, 'Dockerfile runtime stage should expose unprivileged port 8080');
});
