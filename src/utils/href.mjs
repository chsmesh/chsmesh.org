/**
 * Internal-link canonicalization, kept in plain JS (not .ts) so `npm test` can
 * import it directly: CI runs the tests on Node 20, which cannot strip types,
 * and it runs them before `npm run build`, so asserting on `dist/` is not an
 * option either. `allowJs` in the Astro tsconfig lets the .ts callers import
 * this with the JSDoc types below.
 */

/**
 * True for any href that points off-site or within the current page, and so
 * must never be rewritten: absolute URLs, protocol-relative URLs, non-HTTP
 * schemes such as `mailto:` and `tel:`, and bare fragments.
 *
 * @param {string} href
 * @returns {boolean}
 */
const isExternalHref = (href) =>
  href.startsWith('#') || href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href);

/**
 * Give an internal path the trailing slash that Astro's directory-format build
 * actually publishes: the page for `/about` is emitted as `about/index.html`,
 * whose canonical URL is `/about/` - the form already used by the sitemap and
 * by every `<link rel="canonical">` on the site.
 *
 * Linking to the slashless form still *works* - nginx redirects it - but every
 * such link costs a needless round trip, and that redirect is only correct
 * because `absolute_redirect off` in nginx.conf makes it so. Emitting the
 * canonical form directly means the redirect is a safety net for inbound links
 * from elsewhere rather than something this site's own navigation depends on.
 *
 * A query string or fragment is preserved after the slash (`/guides#hardware`
 * becomes `/guides/#hardware`), and a path whose last segment looks like a file
 * (`/favicon.svg`, `/admin/config.yml`) is left alone - those are real files,
 * not directory-format pages.
 *
 * @param {string} href
 * @returns {string}
 */
export const normalizeHref = (href) => {
  if (!href || isExternalHref(href) || !href.startsWith('/')) return href;

  // Split the path off from ?query / #fragment so the slash lands before them.
  const suffixStart = href.search(/[?#]/);
  const path = suffixStart === -1 ? href : href.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : href.slice(suffixStart);

  if (path.endsWith('/')) return href;

  // A dot in the final segment means a file (`/og-image.png`), not a page.
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return href;

  return `${path}/${suffix}`;
};
