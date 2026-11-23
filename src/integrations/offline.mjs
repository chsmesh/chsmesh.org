// Writes dist/sw.js, the service worker that keeps the guides and core pages
// readable offline. It runs when `astro build` finishes, because only then do
// the pages and their hashed /_astro/ files exist to be listed.
//
// The worker itself is src/sw/service-worker.js; this module decides what it
// saves at install and stamps that list with a fingerprint. Plain .mjs with
// no Astro imports so test/site/offline.test.mjs can run it.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVICE_WORKER_PATH = '/sw.js';
export const MANIFEST_PATH = '/manifest.webmanifest';
/** Shown for a page that was never saved. Must itself be saved. */
export const OFFLINE_PATH = '/offline/';

// Pages left out of the install-time download. They still work online, and a
// visited page is saved like any other.
//   /admin/   the CMS: a 1.9 MB bundle that is useless without GitHub
//   /status/  live data, plus the map library
const NOT_PRECACHED = ['/admin/', '/status/'];

const TEMPLATE = fileURLToPath(new URL('../sw/service-worker.js', import.meta.url));

/** Every file under `dir`, as paths relative to it with forward slashes. */
function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix + entry.name;
    return entry.isDirectory() ? walk(path.join(dir, entry.name), `${relative}/`) : [relative];
  });
}

/**
 * URLs of the built pages to save at install: every directory with an
 * index.html, minus NOT_PRECACHED. 404.html is not a directory page, so it is
 * left out; an unknown URL offline gets the offline page instead.
 *
 * @param {string[]} files dist-relative paths
 * @returns {string[]}
 */
export function precachePages(files) {
  return files
    .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
    .map((file) => `/${file.slice(0, -'index.html'.length)}`)
    .filter((url) => !NOT_PRECACHED.some((prefix) => url.startsWith(prefix)))
    .sort();
}

/**
 * The site's own files that `html` loads: hashed /_astro/ files, and images
 * and icons from public/. Links to other pages and to PDFs are not followed.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function referencedFiles(html) {
  const found = new Set();
  for (const [, url] of html.matchAll(/(?:src|href)="(\/[^"/][^"?#]*)[^"]*"/g)) {
    if (url.startsWith('/_astro/') || /\.(?:png|jpe?g|gif|svg|webp|avif|ico|webmanifest)$/i.test(url)) found.add(url);
  }
  return [...found];
}

/**
 * Everything the worker saves at install, and the fingerprint of it all.
 *
 * @param {string} distDir
 * @returns {{ urls: string[], version: string, bytes: number }}
 */
export function precacheList(distDir) {
  const files = walk(distDir);
  const inDist = new Set(files.map((file) => `/${file}`));
  const read = (url) => fs.readFileSync(path.join(distDir, url.endsWith('/') ? `${url}index.html` : url));

  const pages = precachePages(files);
  if (!pages.includes(OFFLINE_PATH)) {
    throw new Error(`The build has no ${OFFLINE_PATH} page, which the service worker falls back to.`);
  }

  const assets = new Set();
  const queue = [];
  const add = (url, from) => {
    if (assets.has(url)) return;
    if (!inDist.has(url)) throw new Error(`${from} uses ${url}, which is not in the build.`);
    assets.add(url);
    queue.push(url);
  };

  for (const page of pages) {
    for (const url of referencedFiles(read(page).toString('utf8'))) add(url, page);
  }
  // The manifest is linked from every page; its icons are only named inside it.
  if (assets.has(MANIFEST_PATH)) {
    for (const icon of JSON.parse(read(MANIFEST_PATH).toString('utf8')).icons ?? []) add(icon.src, MANIFEST_PATH);
  }
  // Scripts import other chunks and stylesheets pull in images, by file name.
  // Follow those too, or a saved page would load without them.
  const hashed = files.filter((file) => file.startsWith('_astro/')).map((file) => `/${file}`);
  while (queue.length > 0) {
    const url = queue.pop();
    if (!/\.(?:js|css)$/.test(url)) continue;
    const text = read(url).toString('utf8');
    for (const other of hashed) {
      if (text.includes(path.posix.basename(other))) add(other, url);
    }
  }

  const urls = [...pages, ...[...assets].sort()];
  const hash = createHash('sha256');
  let bytes = 0;
  for (const url of urls) {
    const body = read(url);
    bytes += body.length;
    hash.update(url).update('\0').update(body).update('\0');
  }
  return { urls, version: hash.digest('hex').slice(0, 12), bytes };
}

/**
 * The text of sw.js: the injected constants, then the worker.
 *
 * @param {{ urls: string[], version: string }} precache
 * @param {string} [template]
 */
export function serviceWorkerSource({ urls, version }, template = fs.readFileSync(TEMPLATE, 'utf8')) {
  return [
    `const VERSION = ${JSON.stringify(version)};`,
    `const PRECACHE = ${JSON.stringify(urls)};`,
    `const OFFLINE_URL = ${JSON.stringify(OFFLINE_PATH)};`,
    '',
    template,
  ].join('\n');
}

/** @returns {import('astro').AstroIntegration} */
export default function offline() {
  return {
    name: 'chsmesh-offline',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const precache = precacheList(distDir);
        fs.writeFileSync(path.join(distDir, SERVICE_WORKER_PATH), serviceWorkerSource(precache));
        logger.info(
          `sw.js saves ${precache.urls.length} files (${Math.round(precache.bytes / 1024)} kB) for offline use, version ${precache.version}`
        );
      },
    },
  };
}
