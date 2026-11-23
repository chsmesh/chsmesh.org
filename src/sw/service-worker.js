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
//                     5xx, or takes longer than NETWORK_TIMEOUT_MS
//   /_astro/ files    cache first; their names are content hashes
//   other site files  network first, saved copy as the fallback
//   /api/, /admin/    never touched: live data and the CMS
//
// A classic script with no imports, so every browser that has service workers
// can run it. test/site/service-worker.test.mjs runs it against fakes.

const CACHE_PREFIX = 'chsmesh-offline-';
const CACHE = CACHE_PREFIX + VERSION;
const BYPASS = ['/api/', '/admin/'];
// A phone with bars but no working connection never fails a request, it just
// waits. Past this, a saved page is shown while the request carries on and
// refreshes the saved copy if it ever completes.
const NETWORK_TIMEOUT_MS = 3000;

/** Pages are directories ("/guides/x/"); anything with an extension is a file. */
const isPagePath = (pathname) => !/\.[a-z0-9]+$/i.test(pathname);

/** Cache key of a page: no query string, and the slash nginx would redirect to. */
const pageKey = (pathname) => (pathname.endsWith('/') ? pathname : pathname + '/');

const cacheable = (response) => response.ok && response.type === 'basic' && !response.redirected;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
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
        names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE).map((name) => caches.delete(name))
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

  if (request.mode === 'navigate' && isPagePath(url.pathname)) {
    event.respondWith(page(event, url));
  } else if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

async function page(event, url) {
  const cache = await caches.open(CACHE);
  const key = pageKey(url.pathname);
  const cached = await cache.match(key);

  const network = fetch(event.request).then(async (response) => {
    if (cacheable(response)) await cache.put(key, response.clone());
    return response;
  });
  // Keep the worker alive until the saved copy is refreshed, even when the
  // timeout below has already answered the page.
  event.waitUntil(network.catch(() => {}));

  try {
    if (!cached) return await network;
    const response = await Promise.race([
      network,
      new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS)),
    ]);
    // A server error is no better than no answer when a good copy is saved.
    return response.status >= 500 ? cached : response;
  } catch {
    return cached || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}
