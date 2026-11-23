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

/**
 * Load the tracker unless the visitor opted out. An opted-out browser never
 * contacts the analytics origin at all.
 */
export function loadAnalytics() {
  if (trackingOptedOut(navigator, window)) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = ANALYTICS_SRC;
  script.dataset.websiteId = ANALYTICS_WEBSITE_ID;
  document.head.append(script);
}

/**
 * Record a custom event. Does nothing when the tracker is not loaded (opted
 * out, blocked, or still loading), and never throws into the caller.
 *
 * @param {string} name
 * @param {Record<string, string>} [data]
 */
export function track(name, data) {
  try {
    /** @type {any} */ (window).umami?.track(name, data);
  } catch {
    // Analytics must never break the page.
  }
}
