/**
 * Names and URLs of the offline PDF downloads, shared by the pages that link to
 * them, the script that generates them (scripts/build-pdfs.mjs) and the tests.
 * Plain JS for the same reason as href.mjs: `npm test` imports it on Node 20,
 * which cannot strip types. It is also bundled into the handbook page's client
 * script, so it must not import anything from Node.
 *
 * The PDFs are not in git and `astro build` does not produce them: the image
 * build runs `npm run build:pdf` afterwards, which renders each page listed
 * here with headless Chromium and writes the file into dist/downloads/.
 */

/** Folder under dist/ (and URL prefix) that holds every generated PDF. */
export const DOWNLOADS_DIR = 'downloads';

/** The single page that bundles the handbook guides and the glossary. */
export const HANDBOOK_PATH = '/handbook/';

export const HANDBOOK_PDF_NAME = 'chsmesh-field-handbook.pdf';

/**
 * File name of a guide's PDF. The `guide-` prefix keeps a guide whose slug is
 * `field-handbook` from overwriting the handbook, and the `chsmesh-` prefix
 * means the file still says where it came from once it is in a Downloads
 * folder among fifty others.
 *
 * @param {string} slug
 * @returns {string}
 */
export const guidePdfName = (slug) => `chsmesh-guide-${slug}.pdf`;

/** @param {string} slug */
export const guidePdfHref = (slug) => `/${DOWNLOADS_DIR}/${guidePdfName(slug)}`;

export const handbookPdfHref = `/${DOWNLOADS_DIR}/${HANDBOOK_PDF_NAME}`;

/**
 * Element ids inside the handbook. Prefixed so a glossary entry (`router`) can
 * never collide with a heading id that a guide's markdown generates.
 */
export const handbookGuideId = (/** @type {string} */ slug) => `guide-${slug}`;
export const handbookGlossaryId = (/** @type {string} */ slug) => `glossary-${slug}`;

/**
 * Map a site link to the id of the same content inside the handbook, so a link
 * between two guides, or from a guide to a glossary term, stays inside the
 * document instead of needing the internet. Returns null for every link that
 * has no counterpart; the caller must still check that the id exists, because
 * not every guide is in the handbook.
 *
 *   /glossary/#lora              -> glossary-lora
 *   /guides/initial-setup/       -> guide-initial-setup
 *   /guides/initial-setup/#step  -> guide-initial-setup (the chapter start)
 *
 * @param {string | null | undefined} href
 * @returns {string | null}
 */
export function handbookAnchor(href) {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null;

  const hashAt = href.indexOf('#');
  const pathname = (hashAt === -1 ? href : href.slice(0, hashAt)).split('?')[0];
  const hash = hashAt === -1 ? '' : href.slice(hashAt + 1);

  if (/^\/glossary\/?$/.test(pathname)) {
    return hash ? handbookGlossaryId(hash) : null;
  }

  const guide = /^\/guides\/([^/]+)\/?$/.exec(pathname);
  return guide ? handbookGuideId(guide[1]) : null;
}
