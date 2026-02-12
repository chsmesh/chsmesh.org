import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const composePath = path.resolve(__dirname, '../../docker-compose.server.yml');

function getCompose() {
  return fs.readFileSync(composePath, 'utf8');
}

test('should reject docker.sock exposure in server compose services', () => {
  const compose = getCompose();

  // Regression guard against host socket mount reintroduction.
  assert.equal(
    /\/var\/run\/docker\.sock\s*:\s*\/var\/run\/docker\.sock/.test(compose),
    false,
    'docker.sock must never be mounted by application-side containers'
  );
});
