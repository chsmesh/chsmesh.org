// Checks the built site in dist/: every meetup and guide page must point its
// share image at a file the build actually emitted. Run after `npm run build`
// (`npm run test:build`, as CI does). A plain `npm test` skips them: whatever
// dist/ happens to be on disk then may predate the source being tested.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { pngSize } from '../png.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'dist');
const skip = process.env.REQUIRE_DIST ? false : 'checks dist/ - run `npm run build && npm run test:build`';

/** Detail pages of a collection as built: dist/<section>/<slug>/index.html. */
function builtPages(section) {
  const dir = join(dist, section);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'index.html')))
    .map((entry) => ({
      slug: entry.name,
      url: `/${section}/${entry.name}/`,
      html: readFileSync(join(dir, entry.name, 'index.html'), 'utf8'),
    }));
}

// Mirrors what Astro loads: markdown files, minus `_`-prefixed drafts.
const contentCount = (collection) =>
  readdirSync(join(root, 'src/content', collection)).filter((name) => /^[^_].*\.md$/.test(name)).length;

const meta = (html, attribute, name) =>
  new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`).exec(html)?.[1];

function assertShareImage(section, page) {
  const image = meta(page.html, 'property', 'og:image');
  assert.ok(image, `${page.url} has no og:image`);
  const { pathname, searchParams } = new URL(image);
  assert.match(searchParams.get('v') ?? '', /^[0-9a-f]{8}$/, `${page.url} share image should carry a content version`);
  assert.equal(pathname, `/og/${section}/${page.slug}.png`, `${page.url} should use its own share image`);

  const file = join(dist, pathname);
  assert.ok(existsSync(file), `${page.url} points at ${pathname}, which is not in dist/`);
  const size = pngSize(readFileSync(file));
  assert.equal(meta(page.html, 'property', 'og:image:width'), String(size.width), `${page.url} og:image:width`);
  assert.equal(meta(page.html, 'property', 'og:image:height'), String(size.height), `${page.url} og:image:height`);
  assert.ok(meta(page.html, 'property', 'og:image:alt'), `${page.url} has no og:image:alt`);
  assert.equal(meta(page.html, 'name', 'twitter:image'), image, `${page.url} twitter:image`);
}

test('dist/ exists', { skip }, () => {
  assert.ok(existsSync(dist), 'no dist/ - run `npm run build` first');
});

for (const section of ['guides', 'meetups']) {
  test(`should give every page in /${section}/ a share image that exists in dist/`, { skip }, () => {
    const pages = builtPages(section);
    // Guards against the loop below passing because it found nothing to check.
    assert.equal(pages.length, contentCount(section), `built /${section}/ pages vs. src/content/${section}`);
    for (const page of pages) assertShareImage(section, page);
  });
}

test('should mark guides as og:type article', { skip }, () => {
  for (const page of builtPages('guides')) {
    assert.equal(meta(page.html, 'property', 'og:type'), 'article', page.url);
  }
});

test('should keep the default share image, with its real size, on other pages', { skip }, () => {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const { pathname } = new URL(meta(html, 'property', 'og:image'));
  assert.equal(pathname, '/og-image.png');
  const size = pngSize(readFileSync(join(dist, pathname)));
  assert.equal(meta(html, 'property', 'og:image:width'), String(size.width));
  assert.equal(meta(html, 'property', 'og:image:height'), String(size.height));
  assert.ok(meta(html, 'property', 'og:image:alt'));
  assert.equal(meta(html, 'property', 'og:type'), 'website');
});
