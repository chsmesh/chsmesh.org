// Service worker for offline reading. This file is a template, not served as
// is: the build (src/integrations/offline.mjs) writes dist/sw.js as three
// injected constants followed by this text:
//
//   VERSION      fingerprint of everything in PRECACHE; a deploy that changes
//                any of it produces a different sw.js, which is what makes
//                browsers install the new worker
//   PRECACHE     URLs saved at install: the guides and core pages, plus the
//                CSS, scripts and images they use
//   OFFLINE_URL  the page shown for a page that was never saved
//
// Strategy:
//   pages             network first, so an update shows as soon as it is
//                     published; the saved copy when the network fails, answers
//                     5xx, or takes longer than SAVED_TIMEOUT_MS
//   /_astro/ files    cache first; their names are content hashes
//   other site files  network first, saved copy as the fallback
//   /api/, /admin/    never touched: live data and the CMS
//
// Two caches:
//   chsmesh-offline-<VERSION>  exactly PRECACHE, replaced as a whole by the
//                              next version
//   chsmesh-offline-runtime    everything else a visitor has opened: other
//                              pages, downloaded PDFs. Kept across versions,
//                              or every deploy would take them off the device.
//
// Saving is always best effort. A full disk or blocked storage must never
// turn an answer the network gave into an error.
//
// A classic script with no imports, so every browser that has service workers
// can run it. test/site/service-worker.test.mjs runs it against fakes.

const CACHE_PREFIX = 'chsmesh-offline-';
const CACHE = CACHE_PREFIX + VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + 'runtime';
const PRECACHED = new Set(PRECACHE);
const BYPASS = ['/api/', '/admin/'];
// A phone with bars but no working connection never fails a request, it just
// waits. Past this, a saved page is shown while the request carries on and
// refreshes the saved copy if it ever completes.
const SAVED_TIMEOUT_MS = 3000;
// With nothing saved the only alternative is the offline page, which is the
// wrong answer on a connection that is merely slow. Wait much longer for it.
const UNSAVED_TIMEOUT_MS = 10000;

/** Pages are directories ("/guides/x/"); anything with an extension is a file. */
const looksLikeFile = (pathname) => /\.[a-z0-9]+$/i.test(pathname);

/** Cache key of a page: no query string, and the slash nginx would redirect to. */
const pageKey = (pathname) => (pathname.endsWith('/') ? pathname : pathname + '/');

/** Cache key of anything else: the path, with its query string. */
const fileKey = (url) => url.pathname + url.search;

const cacheable = (response) => response.ok && response.type === 'basic' && !response.redirected;

const after = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** The saved copy under `key`, or undefined - also when storage is unusable. */
async function saved(key) {
  try {
    return (await caches.match(key, { cacheName: CACHE })) || (await caches.match(key, { cacheName: RUNTIME_CACHE }));
  } catch {
    return undefined;
  }
}

/**
 * Save a copy of `response` under `key` without holding the response back:
 * the write finishes in the background, and a failure is dropped.
 */
function save(event, key, response) {
  if (!cacheable(response)) return;
  const copy = response.clone();
  event.waitUntil(
    caches
      .open(PRECACHED.has(key) ? CACHE : RUNTIME_CACHE)
      .then((cache) => cache.put(key, copy))
      .catch(() => {})
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await Promise.all(
          PRECACHE.map(async (url) => {
            // Pages are served with a one-hour HTTP cache; skip it so the copy
            // saved here is the one this worker's VERSION describes.
            const request = new Request(url, { cache: url.startsWith('/_astro/') ? 'default' : 'reload' });
            const response = await fetch(request);
            if (!cacheable(response)) throw new Error(`precache: ${url} answered ${response.status}`);
            await cache.put(url, response);
          })
        );
      } catch (error) {
        // Leave no half-filled cache behind for a worker that never activates.
        await caches.delete(CACHE).catch(() => {});
        throw error;
      }
      // Pages are network first, so a new worker can take over open tabs
      // without them seeing a mix of old and new files.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
      // Lets open pages show their "available offline" indicator
      // (src/utils/offlineClient.mjs) without a reload.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: 'offline-ready' });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((prefix) => url.pathname.startsWith(prefix))) return;
  // Partial responses cannot be stored, and a saved full response is the
  // wrong answer to a range request.
  if (request.headers.has('range')) return;

  let answer;
  if (request.mode === 'navigate') answer = navigation(event, url);
  else if (url.pathname.startsWith('/_astro/')) answer = cacheFirst(event, fileKey(url));
  else answer = networkFirst(event, fileKey(url));
  event.respondWith(answer);
});

async function navigation(event, url) {
  const key = pageKey(url.pathname);
  const cached = await saved(key);
  // A link to a file, such as a PDF download. Offline it must fail rather
  // than hand over the offline page under the file's name. A saved page wins
  // over the look of the URL: "/guides/setup.md" and "/guides/firmware-2.5"
  // are pages.
  if (!cached && looksLikeFile(url.pathname)) return networkFirst(event, fileKey(url));

  // `no-cache` revalidates with the server instead of trusting the one-hour
  // HTTP cache, which could hand back a page older than the saved copy and
  // then overwrite it.
  const network = fetch(event.request, { cache: 'no-cache' }).then((response) => {
    save(event, key, response);
    return response;
  });
  // The request carries on after a timeout has answered, to refresh the copy.
  event.waitUntil(network.catch(() => {}));

  const fallback = async () => cached || (await saved(OFFLINE_URL)) || Response.error();
  try {
    const response = await Promise.race([network, after(cached ? SAVED_TIMEOUT_MS : UNSAVED_TIMEOUT_MS)]);
    if (!response) return await fallback();
    // A server error is no better than no answer when a good copy is saved.
    return response.status >= 500 && cached ? cached : response;
  } catch {
    return fallback();
  }
}

async function cacheFirst(event, key) {
  const cached = await saved(key);
  if (cached) return cached;
  const response = await fetch(event.request);
  save(event, key, response);
  return response;
}

async function networkFirst(event, key) {
  try {
    const response = await fetch(event.request);
    save(event, key, response);
    return response;
  } catch (error) {
    const cached = await saved(key);
    if (cached) return cached;
    throw error;
  }
}
