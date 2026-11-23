// What the build puts in the service worker's install list
// (src/integrations/offline.mjs), checked against small fake dist/ folders.
// test/build/offline.test.mjs checks the real build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { precacheList, precachePages, referencedFiles, serviceWorkerSource } from '../../src/integrations/offline.mjs';
import { APP_ICONS, MARK, renderAppIcon } from '../../src/utils/appIcons.mjs';
import { pngSize } from '../png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

function makeDist(t, files) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'chsmesh-dist-'));
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(dist, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dist;
}

const page = (extra = '') =>
  `<link rel="stylesheet" href="/_astro/site.aaa.css"><link rel="icon" href="/favicon.svg">` +
  `<link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/_astro/Layout.bbb.js"></script>` +
  `<a href="/guides/">Guides</a><a href="/downloads/chsmesh-field-handbook.pdf">PDF</a>${extra}`;

const SITE = {
  'index.html': page(),
  'offline/index.html': page(),
  'guides/index.html': page(),
  'guides/initial-setup/index.html': page('<img src="/images/radio.png?v=2">'),
  'status/index.html': page('<script type="module" src="/_astro/status.ccc.js"></script>'),
  'admin/index.html': '<script type="module" src="/_astro/cms.ddd.js"></script>',
  '404.html': page(),
  '_astro/site.aaa.css': 'body{background:url(/_astro/pattern.eee.png)}',
  '_astro/Layout.bbb.js': 'import{t}from"./analytics.fff.js";',
  '_astro/analytics.fff.js': 'export const t=1;',
  '_astro/pattern.eee.png': 'png',
  '_astro/status.ccc.js': 'leaflet',
  '_astro/cms.ddd.js': 'cms',
  'favicon.svg': '<svg/>',
  'images/radio.png': 'png',
  'manifest.webmanifest': JSON.stringify({ icons: [{ src: '/icons/icon-192.png' }] }),
  'icons/icon-192.png': 'png',
  'downloads/chsmesh-field-handbook.pdf': 'pdf',
};

test('should list every page except the CMS, the live status page and 404.html', () => {
  assert.deepEqual(precachePages(Object.keys(SITE)), ['/', '/guides/', '/guides/initial-setup/', '/offline/']);
});

test('should find the files a page loads, not the pages and PDFs it links to', () => {
  assert.deepEqual(referencedFiles(page('<img src="/images/radio.png?v=2"><img src="https://example.com/a.png">')).sort(), [
    '/_astro/Layout.bbb.js',
    '/_astro/site.aaa.css',
    '/favicon.svg',
    '/images/radio.png',
    '/manifest.webmanifest',
  ]);
});

test('should save the pages with everything they need, and nothing from the skipped pages', (t) => {
  const { urls } = precacheList(makeDist(t, SITE));

  assert.deepEqual(urls, [
    '/',
    '/guides/',
    '/guides/initial-setup/',
    '/offline/',
    '/_astro/Layout.bbb.js',
    // Imported by Layout.bbb.js and named nowhere in the HTML.
    '/_astro/analytics.fff.js',
    // Used by the stylesheet.
    '/_astro/pattern.eee.png',
    '/_astro/site.aaa.css',
    '/favicon.svg',
    // Named only inside the manifest.
    '/icons/icon-192.png',
    '/images/radio.png',
    '/manifest.webmanifest',
  ]);
});

test('should change the version when a saved file changes, and only then', (t) => {
  const version = (files) => precacheList(makeDist(t, files)).version;
  const before = version(SITE);

  assert.match(before, /^[0-9a-f]{12}$/);
  assert.equal(version({ ...SITE }), before, 'the same build must give the same sw.js');
  assert.equal(version({ ...SITE, 'status/index.html': 'changed' }), before, 'a page that is not saved');
  assert.notEqual(version({ ...SITE, 'guides/initial-setup/index.html': page('edited') }), before, 'an edited guide');
  assert.notEqual(version({ ...SITE, '_astro/analytics.fff.js': 'export const t=2;' }), before, 'a changed script');
});

test('should refuse to build a worker with no offline page or a missing file', (t) => {
  const { 'offline/index.html': _offline, ...noOffline } = SITE;
  assert.throws(() => precacheList(makeDist(t, noOffline)), /no \/offline\/ page/);

  const { 'images/radio.png': _image, ...noImage } = SITE;
  assert.throws(() => precacheList(makeDist(t, noImage)), /\/guides\/initial-setup\/ uses \/images\/radio\.png/);
});

test('should write the list and version ahead of the worker code', () => {
  const source = serviceWorkerSource({ urls: ['/', '/offline/'], version: 'abc' }, '// worker');
  assert.equal(
    source,
    'const VERSION = "abc";\nconst PRECACHE = ["/","/offline/"];\nconst OFFLINE_URL = "/offline/";\n\n// worker'
  );
});

test('should draw every app icon at its declared size, from the favicon mark', async () => {
  for (const [name, { size }] of Object.entries(APP_ICONS)) {
    assert.deepEqual(pngSize(await renderAppIcon(name)), { width: size, height: size }, name);
  }

  const favicon = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
  for (const [, d] of MARK.matchAll(/ d="([^"]+)"/g)) {
    assert.ok(favicon.includes(d), `public/favicon.svg no longer has the path ${d}; update MARK in appIcons.mjs`);
  }
});

test('should name only icons the build draws in the manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));

  for (const icon of manifest.icons) {
    const name = /^\/icons\/(.+)\.png$/.exec(icon.src)?.[1];
    assert.ok(name && APP_ICONS[name], `${icon.src} is not one of the generated icons`);
    assert.equal(icon.sizes, `${APP_ICONS[name].size}x${APP_ICONS[name].size}`, icon.src);
  }
  // What Chrome needs before it offers to install the site.
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
});
