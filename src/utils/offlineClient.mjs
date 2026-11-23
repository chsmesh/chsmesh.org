// Browser side of offline reading: registers the service worker (dist/sw.js,
// written by src/integrations/offline.mjs) and drives the two bits of UI in
// Layout.astro and OfflineIndicator.astro:
//
//   [data-offline-indicator]  shown once this page is saved on the device
//   [data-offline-banner]     shown while the browser reports no connection
//
// Both start `hidden`, so a browser without service workers shows neither.

const show = (selector, visible) => {
  for (const element of document.querySelectorAll(selector)) element.hidden = !visible;
};

/** Same key the worker saves a page under: no query string, trailing slash. */
export const pageKey = (pathname) => (pathname.endsWith('/') ? pathname : `${pathname}/`);

async function updateIndicator() {
  try {
    const saved = await caches.match(pageKey(location.pathname));
    show('[data-offline-indicator]', Boolean(saved));
  } catch {
    // Storage can be blocked (private windows); the page works without it.
  }
}

/**
 * @param {{ enabled: boolean }} options `enabled` is false under `astro dev`,
 *   which has no sw.js. A worker left over from a production preview on the
 *   same localhost port is removed there, so it cannot serve stale files.
 */
export function setUpOffline({ enabled }) {
  const updateBanner = () => show('[data-offline-banner]', navigator.onLine === false);
  window.addEventListener('online', updateBanner);
  window.addEventListener('offline', updateBanner);
  updateBanner();

  if (!('serviceWorker' in navigator)) return;
  if (!enabled) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {});
    return;
  }

  // The worker posts this once a new version has saved everything.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'offline-ready') updateIndicator();
  });
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  updateIndicator();
}
