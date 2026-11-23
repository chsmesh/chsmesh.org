// Checks the built /troubleshooting/ page in dist/. The page has to work with
// JavaScript off, which means every answer is a link to an anchor that exists,
// and under the site's CSP, which means no inline script. Run after
// `npm run build` (`npm run test:build`, as CI does).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = join(root, 'dist');
const skip = process.env.REQUIRE_DIST ? false : 'checks dist/ - run `npm run build && npm run test:build`';

const page = () => readFileSync(join(dist, 'troubleshooting/index.html'), 'utf8');
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
const hrefs = (html) => [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1].replaceAll('&#38;', '&'));

test('should give every answer an anchor to land on', { skip }, () => {
  const html = page();
  const known = ids(html);
  const fragments = hrefs(html).filter((href) => href.startsWith('#'));
  assert.ok(fragments.length > 40, 'expected the answers to be fragment links');
  for (const href of fragments) assert.ok(known.has(href.slice(1)), `${href} has no matching id`);
});

test('should list every step in the HTML, visible without JavaScript', { skip }, () => {
  const html = page();
  assert.ok([...html.matchAll(/data-ts-step=/g)].length >= 40);
  // The script hides steps at run time; nothing may ship already hidden
  // except the list of answers, which only the script can fill.
  const hidden = [...html.matchAll(/<[^>]*\shidden[\s>][^>]*>/g)].map((match) => match[0]);
  for (const tag of hidden.filter((tag) => tag.includes('ts-') && !tag.includes('data-ts-trail'))) {
    assert.fail(`shipped hidden: ${tag}`);
  }
});

test('should load its script from a file, as the CSP requires', { skip }, () => {
  const scripts = [...page().matchAll(/<script\b([^>]*)>/g)].map((match) => match[1]);
  for (const attributes of scripts) {
    assert.ok(/\ssrc=/.test(attributes) || /type="application\/json"/.test(attributes), `inline script: <script${attributes}>`);
  }
  assert.ok(scripts.some((attributes) => /src="\/_astro\/troubleshooting\./.test(attributes)));
});

test('should link to guide sections that exist', { skip }, () => {
  const links = hrefs(page()).filter((href) => /^\/(guides|status)\//.test(href));
  assert.ok(links.length > 0);
  for (const href of links) {
    const [path, fragment] = href.split('#');
    const file = join(dist, path, 'index.html');
    assert.ok(existsSync(file), `${href}: no such page`);
    if (fragment) assert.ok(ids(readFileSync(file, 'utf8')).has(fragment), `${href}: no such section`);
  }
});

test('should be reachable from the guides that send people to it', { skip }, () => {
  for (const guide of ['initial-setup', 'flashing-firmware']) {
    const html = readFileSync(join(dist, 'guides', guide, 'index.html'), 'utf8');
    assert.ok(hrefs(html).some((href) => href.startsWith('/troubleshooting/')), `${guide} does not link to the troubleshooter`);
  }
  const known = ids(page());
  const targets = hrefs(readFileSync(join(dist, 'guides/initial-setup/index.html'), 'utf8')).filter((href) => href.startsWith('/troubleshooting/#'));
  for (const href of targets) assert.ok(known.has(href.split('#')[1]), `${href}: no such problem`);
});
