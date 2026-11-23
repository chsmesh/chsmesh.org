#!/usr/bin/env node
/**
 * Render the offline PDFs from an already-built site: one per guide, plus the
 * field handbook. Run it after `astro build` (`npm run build:pdf`); the
 * Dockerfile does, so the PDFs ship as plain static files and are never
 * committed.
 *
 * It serves dist/ on a loopback port, opens each page in headless Chromium and
 * prints it with the site's own print stylesheet (the `@media print` block in
 * src/styles/global.css) - the same output a visitor gets from the browser's
 * "Save as PDF", plus a footer with the page's address and page numbers.
 *
 * Chromium comes from `npx playwright-core install chromium-headless-shell`.
 * Set PDF_CHROMIUM_PATH to use an existing Chromium or Chrome binary instead.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DOWNLOADS_DIR,
  HANDBOOK_PATH,
  HANDBOOK_PDF_NAME,
  guidePdfName,
} from '../src/utils/downloads.mjs';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Slugs of the built guide pages: every folder in dist/guides/ that holds an
 * index.html. Read from the build output rather than src/content so the list
 * is exactly the pages that exist, drafts and all other rules already applied.
 *
 * @param {string} distDir
 * @returns {string[]}
 */
export function listGuideSlugs(distDir) {
  const guidesDir = path.join(distDir, 'guides');
  if (!fs.existsSync(guidesDir)) return [];

  return fs
    .readdirSync(guidesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(guidesDir, entry.name, 'index.html')))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Every PDF to render: the page to open and the file to write.
 *
 * @param {string} distDir
 * @returns {{ route: string, file: string }[]}
 */
export function pdfJobs(distDir) {
  const outDir = path.join(distDir, DOWNLOADS_DIR);
  const jobs = listGuideSlugs(distDir).map((slug) => ({
    route: `/guides/${slug}/`,
    file: path.join(outDir, guidePdfName(slug)),
  }));

  // The guides index and the handbook page link to this PDF, so a build
  // without it would publish dead links. Fail here instead.
  const handbookPage = path.join(distDir, HANDBOOK_PATH, 'index.html');
  if (!fs.existsSync(handbookPage)) {
    throw new Error(`${handbookPage} is missing. Run \`npm run build\` before \`npm run build:pdf\`.`);
  }
  jobs.push({ route: HANDBOOK_PATH, file: path.join(outDir, HANDBOOK_PDF_NAME) });

  return jobs;
}

/**
 * Map a request path onto a file inside dist/, the way nginx serves the
 * directory-format build. Returns null for anything missing or outside dist/.
 *
 * @param {string} distDir
 * @param {string} urlPath  Path part of the request URL, still percent-encoded.
 * @returns {string | null}
 */
export function resolveRequestPath(distDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }

  const root = path.resolve(distDir);
  let file = path.resolve(root, `.${path.posix.normalize(`/${decoded}`)}`);
  if (file !== root && !file.startsWith(root + path.sep)) return null;

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

/**
 * Serve dist/ on a loopback port chosen by the OS.
 *
 * @param {string} distDir
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
export function serveDist(distDir) {
  const server = http.createServer((req, res) => {
    const file = resolveRequestPath(distDir, req.url ?? '/');
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/**
 * Runs in the page. Chromium writes every link into the PDF as an absolute
 * URL, resolved against the address the page was loaded from - which here is
 * the throwaway loopback server. Point site-relative links at the public site
 * instead (its origin comes from the og:url tag Layout.astro emits). In-page
 * `#fragment` links are left alone, so they stay links inside the PDF.
 *
 * Returns the public address of the page, for the footer.
 */
function prepareForPrint() {
  const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
  if (!ogUrl) throw new Error('page has no og:url meta tag to take the public site address from');
  const publicUrl = new URL(ogUrl);

  for (const link of document.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') ?? '';
    if (href.startsWith('/') && !href.startsWith('//')) {
      link.setAttribute('href', publicUrl.origin + href);
    }
  }

  return publicUrl.host + publicUrl.pathname;
}

const escapeHtml = (/** @type {string} */ text) =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char);

/**
 * Chromium's print footer. It is rendered outside the page, so none of the
 * site's CSS applies and the font size must be set inline (the default is
 * unreadably small). The `pageNumber` and `totalPages` classes are filled in
 * by Chromium.
 *
 * @param {string} address
 */
const footerTemplate = (address) => `
  <div style="width: 100%; margin: 0 0.6in; display: flex; justify-content: space-between;
              font-family: Arial, 'Liberation Sans', sans-serif; font-size: 8px; color: #57534e;">
    <span>CHS Mesh &middot; ${escapeHtml(address)}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;

async function loadChromium() {
  try {
    return (await import('playwright-core')).chromium;
  } catch (error) {
    throw new Error(
      'playwright-core is not installed. Run `npm install`, then ' +
        '`npx playwright-core install chromium-headless-shell`.',
      { cause: error }
    );
  }
}

/**
 * @param {string} distDir
 */
export async function buildPdfs(distDir) {
  const jobs = pdfJobs(distDir);
  const chromium = await loadChromium();
  const site = await serveDist(distDir);
  const browser = await chromium.launch({
    executablePath: process.env.PDF_CHROMIUM_PATH || undefined,
  });

  try {
    // One page, reused: the image builder is short on memory.
    const page = await browser.newPage();

    // Print from dist/ alone. The pages also ask for third-party scripts
    // (Turnstile, analytics); none affects the printed page, and waiting on
    // one would let a slow outside server fail the image build.
    await page.route('**/*', (route) =>
      route.request().url().startsWith(`${site.origin}/`) ? route.continue() : route.abort()
    );

    for (const job of jobs) {
      const response = await page.goto(site.origin + job.route, { waitUntil: 'load' });
      if (!response || response.status() !== 200) {
        throw new Error(`${job.route} answered ${response?.status() ?? 'nothing'}, expected 200`);
      }
      await page.evaluate(() => document.fonts.ready);
      const address = await page.evaluate(prepareForPrint);

      fs.mkdirSync(path.dirname(job.file), { recursive: true });
      await page.pdf({
        path: job.file,
        format: 'Letter',
        // Badge tints, table headers and the prerequisites strip.
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footerTemplate(address),
        // Keep in step with the @page rule in src/styles/global.css.
        margin: { top: '0.65in', right: '0.6in', bottom: '0.8in', left: '0.6in' },
        // Bookmarks from the headings, and a tagged (screen-reader friendly) PDF.
        outline: true,
        tagged: true,
      });

      const header = Buffer.alloc(5);
      const fd = fs.openSync(job.file, 'r');
      fs.readSync(fd, header, 0, 5, 0);
      fs.closeSync(fd);
      if (header.toString('latin1') !== '%PDF-') {
        throw new Error(`${job.file} was written but is not a PDF`);
      }

      const kb = Math.round(fs.statSync(job.file).size / 1024);
      console.log(`  ${job.route} -> ${path.relative(process.cwd(), job.file)} (${kb} kB)`);
    }
  } finally {
    await browser.close();
    await site.close();
  }

  return jobs;
}

// Only when run directly, so the tests can import the helpers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
  console.log(`Rendering PDFs from ${path.relative(process.cwd(), distDir) || '.'}/`);
  buildPdfs(distDir)
    .then((jobs) => console.log(`Wrote ${jobs.length} PDFs.`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
