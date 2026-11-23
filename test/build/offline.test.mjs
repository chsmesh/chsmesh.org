// Checks the built site in dist/: the service worker the build wrote must
// list the guides and core pages, and every file it lists must exist, or the
// worker's install fails in the browser and nothing is saved. Run after
// `npm run build` (`npm run test:build`, as CI does).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import vm from 'node:vm';
import { pngSize } from '../png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'dist');
const skip = process.env.REQUIRE_DIST ? false : 'checks dist/ - run `npm run build && npm run test:build`';

/** The constants the build injected at the top of dist/sw.js. */
function workerConfig() {
  const source = readFileSync(join(dist, 'sw.js'), 'utf8');
  const header = source.split('\n').slice(0, 3).join('\n');
  return vm.runInNewContext(`${header}\n({ VERSION, PRECACHE, OFFLINE_URL })`);
}

const distFile = (url) => join(dist, url.endsWith('/') ? `${url}index.html` : url);

test('should write a service worker that parses', { skip }, () => {
  const source = readFileSync(join(dist, 'sw.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(workerConfig().VERSION, /^[0-9a-f]{12}$/);
});

test('should save every guide and the core pages for offline use', { skip }, () => {
  const { PRECACHE, OFFLINE_URL } = workerConfig();
  const guides = readdirSync(join(root, 'src/content/guides'))
    .filter((name) => /^[^_].*\.md$/.test(name))
    .map((name) => `/guides/${name.replace(/\.md$/, '')}/`);

  assert.ok(guides.length > 0);
  for (const url of ['/', '/guides/', '/handbook/', '/glossary/', OFFLINE_URL, ...guides]) {
    assert.ok(PRECACHE.includes(url), `${url} is not saved for offline use`);
  }
  for (const url of PRECACHE) {
    assert.equal(url.startsWith('/admin/') || url.startsWith('/status/'), false, `${url} should not be saved at install`);
  }
});

test('should only list files that are in dist/', { skip }, () => {
  for (const url of workerConfig().PRECACHE) {
    assert.ok(existsSync(distFile(url)), `sw.js lists ${url}, which is not in dist/`);
  }
});

test('should keep the install download small', { skip }, () => {
  // Every visitor downloads this in the background on their first visit and
  // after each deploy that changes it. The CMS bundle alone is 1.9 MB, so a
  // jump here most likely means something like it slipped into the list.
  const bytes = workerConfig().PRECACHE.reduce((sum, url) => sum + readFileSync(distFile(url)).length, 0);
  assert.ok(bytes < 1.5 * 1024 * 1024, `the service worker saves ${Math.round(bytes / 1024)} kB at install`);
});

test('should link the manifest and icons from every page, and build them', { skip }, () => {
  const html = readFileSync(join(dist, 'guides/index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.deepEqual(pngSize(readFileSync(join(dist, 'icons/apple-touch-icon.png'))), { width: 180, height: 180 });

  const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(readFileSync(join(dist, icon.src))), { width, height }, icon.src);
  }
});

test('should keep the offline page out of search and the sitemap', { skip }, () => {
  assert.match(readFileSync(join(dist, 'offline/index.html'), 'utf8'), /<meta name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(readFileSync(join(dist, 'sitemap-0.xml'), 'utf8'), /\/offline\//);
});
