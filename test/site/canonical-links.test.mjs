// Guards the three places an internal link can enter the site - component and
// page markup, content-authored hrefs, and markdown prose - so none of them can
// go back to emitting the slashless form that production has to redirect.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeHref } from '../../src/utils/href.mjs';
import { rehypeCanonicalLinks } from '../../src/utils/rehypeCanonicalLinks.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/** Every file under `dir` whose name ends in one of `extensions`. */
function walkFiles(dir, extensions) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

test('should canonicalize markdown prose links through the rehype plugin', () => {
  // A minimal hast tree shaped like the one Astro hands to a rehype plugin.
  const tree = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [
          { type: 'element', tagName: 'a', properties: { href: '/guides/initial-setup' }, children: [] },
          { type: 'element', tagName: 'a', properties: { href: 'https://meshmap.net' }, children: [] },
          { type: 'element', tagName: 'a', properties: { href: '#section' }, children: [] },
          { type: 'element', tagName: 'a', properties: { href: '/favicon.svg' }, children: [] },
          { type: 'text', value: 'not a link' },
        ],
      },
    ],
  };

  rehypeCanonicalLinks()(tree);

  const hrefs = tree.children[0].children
    .filter((node) => node.tagName === 'a')
    .map((node) => node.properties.href);

  assert.deepEqual(hrefs, [
    '/guides/initial-setup/',
    'https://meshmap.net',
    '#section',
    '/favicon.svg',
  ]);
});

test('should leave a link-free markdown tree untouched', () => {
  const tree = { type: 'root', children: [{ type: 'text', value: 'plain' }] };
  assert.doesNotThrow(() => rehypeCanonicalLinks()(tree));
});

test('should register the canonical-link plugin and the trailing-slash rule', () => {
  const config = readFile(path.join(repoRoot, 'astro.config.mjs'));

  assert.match(
    config,
    /rehypePlugins:\s*\[\s*rehypeCanonicalLinks\s*\]/,
    'markdown prose links must be canonicalized at build time'
  );
  assert.match(
    config,
    /trailingSlash:\s*'always'/,
    "dev and preview must enforce the same trailing-slash rule production does"
  );
});

test('should not hardcode a slashless internal href in any component or page', () => {
  // The literal hrefs in .astro markup never pass through resolveLink, so they
  // are checked against the same rule here instead.
  const sources = walkFiles(path.join(repoRoot, 'src'), ['.astro']);
  assert.ok(sources.length > 0, 'expected to find .astro sources to check');

  const offenders = [];
  for (const file of sources) {
    const contents = readFile(file);
    for (const match of contents.matchAll(/href="(\/[^"{}]*)"/g)) {
      const href = match[1];
      if (normalizeHref(href) !== href) {
        offenders.push(`${path.relative(repoRoot, file)}: href="${href}"`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `internal hrefs must be canonical (add the trailing slash):\n  ${offenders.join('\n  ')}`
  );
});

test('should not author a slashless internal link in global content', () => {
  // These flow through resolveLink at render time, so a slashless value here is
  // corrected rather than shipped - but keeping the source canonical means the
  // CMS shows editors the same form the site actually serves.
  const contentDir = path.join(repoRoot, 'src/content/global');
  const offenders = [];

  for (const file of walkFiles(contentDir, ['.md'])) {
    const contents = readFile(file);
    for (const match of contents.matchAll(/^\s*(?:href|ctaHref):\s*'?"?(\/[^\s'"]*)'?"?\s*$/gm)) {
      const href = match[1];
      if (normalizeHref(href) !== href) {
        offenders.push(`${path.relative(repoRoot, file)}: ${href}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `content hrefs must be canonical:\n  ${offenders.join('\n  ')}`
  );
});
