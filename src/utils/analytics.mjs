// Self-hosted, cookieless Umami analytics. The origin is allowed in the CSP
// script-src and connect-src (security-headers.conf).
export const ANALYTICS_SRC = 'https://stats.sendtrl.com/s.js';
export const ANALYTICS_WEBSITE_ID = 'cb56023c-10d8-4a6f-9975-d45737f9e58c';

/**
 * True when the visitor has asked not to be tracked, through Do Not Track or
 * Global Privacy Control.
 *
 * @param {{ doNotTrack?: unknown, msDoNotTrack?: unknown, globalPrivacyControl?: unknown }} nav
 * @param {{ doNotTrack?: unknown }} [win]
 * @returns {boolean}
 */
export function trackingOptedOut(nav, win = {}) {
  if (nav.globalPrivacyControl === true) return true;
  return [nav.doNotTrack, nav.msDoNotTrack, win.doNotTrack].some((v) => v === '1' || v === 1 || v === 'yes');
}

// Only the live site reports. Local dev, previews and other hosts stay out of
// the production stats.
export const ANALYTICS_HOSTS = ['chsmesh.org', 'www.chsmesh.org'];

/**
 * @param {string} hostname
 * @param {Parameters<typeof trackingOptedOut>[0]} nav
 * @param {Parameters<typeof trackingOptedOut>[1]} [win]
 * @returns {boolean}
 */
export function shouldLoadAnalytics(hostname, nav, win) {
  return ANALYTICS_HOSTS.includes(hostname) && !trackingOptedOut(nav, win);
}

// Events recorded while the tracker is still downloading, sent once it loads.
const MAX_PENDING = 20;
/** @type {[string, Record<string, string> | undefined][]} */
let pending = [];
let loading = false;

/**
 * Load the tracker on the live site unless the visitor opted out. An
 * opted-out browser never contacts the analytics origin at all.
 */
export function loadAnalytics() {
  if (!shouldLoadAnalytics(location.hostname, navigator, window)) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = ANALYTICS_SRC;
  script.dataset.websiteId = ANALYTICS_WEBSITE_ID;
  loading = true;
  script.addEventListener('load', () => {
    loading = false;
    const queued = pending;
    pending = [];
    queued.forEach(([name, data]) => track(name, data));
  });
  script.addEventListener('error', () => {
    loading = false;
    pending = [];
  });
  document.head.append(script);
}

/**
 * Record a custom event. Events sent while the tracker is still loading are
 * held and sent when it arrives. Does nothing when the tracker is not in use
 * (opted out, blocked, or not the live site), and never throws into the caller.
 *
 * @param {string} name
 * @param {Record<string, string>} [data]
 */
export function track(name, data) {
  try {
    const umami = /** @type {any} */ (window).umami;
    if (umami) umami.track(name, data);
    else if (loading && pending.length < MAX_PENDING) pending.push([name, data]);
  } catch {
    // Analytics must never break the page.
  }
}
