// The offline PDFs are generated after the build and never committed, so
// nothing but these names ties a page's "Download PDF" link to the file
// scripts/build-pdfs.mjs writes. Rendering itself needs Chromium and is
// exercised by `npm run build:pdf` in CI; this covers everything around it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  guidePdfHref,
  handbookAnchor,
  handbookPdfHref,
} from '../../src/utils/downloads.mjs';
import { listGuideSlugs, pdfJobs, resolveRequestPath, serveDist } from '../../scripts/build-pdfs.mjs';

function makeDist(t, files) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'chsmesh-dist-'));
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(dist, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dist;
}

test('should write each PDF where the pages link to it', (t) => {
  const dist = makeDist(t, {
    'guides/index.html': 'index',
    'guides/initial-setup/index.html': 'guide',
    'guides/what-is-meshtastic/index.html': 'guide',
    'handbook/index.html': 'handbook',
  });

  // The guides index itself is not a guide.
  assert.deepEqual(listGuideSlugs(dist), ['initial-setup', 'what-is-meshtastic']);

  const published = pdfJobs(dist).map((job) => ({
    route: job.route,
    href: `/${path.relative(dist, job.file).split(path.sep).join('/')}`,
  }));
  assert.deepEqual(published, [
    { route: '/guides/initial-setup/', href: guidePdfHref('initial-setup') },
    { route: '/guides/what-is-meshtastic/', href: guidePdfHref('what-is-meshtastic') },
    { route: '/handbook/', href: handbookPdfHref },
  ]);
});

test('should keep a guide named like the handbook from overwriting it', () => {
  assert.notEqual(guidePdfHref('field-handbook'), handbookPdfHref);
});

test('should fail when the handbook page was not built', (t) => {
  const dist = makeDist(t, { 'guides/initial-setup/index.html': 'guide' });
  assert.throws(() => pdfJobs(dist), /npm run build/);
});

test('should point handbook links at the copy inside the handbook', () => {
  for (const [href, expected] of [
    ['/glossary/#lora', 'glossary-lora'],
    ['/guides/initial-setup/', 'guide-initial-setup'],
    ['/guides/initial-setup', 'guide-initial-setup'],
    ['/guides/initial-setup/#step-1', 'guide-initial-setup'],
    // No counterpart inside the handbook.
    ['/glossary/', null],
    ['/guides/', null],
    ['/resources/', null],
    ['/downloads/chsmesh-guide-initial-setup.pdf', null],
    ['https://meshtastic.org/guides/x/', null],
    ['//example.com/guides/x/', null],
    ['#overview', null],
    [null, null],
  ]) {
    assert.equal(handbookAnchor(href), expected, String(href));
  }
});

test('should serve only files inside dist, directory-format', async (t) => {
  const dist = makeDist(t, {
    'index.html': 'home',
    'guides/initial-setup/index.html': 'guide',
    '_astro/site.css': 'body{}',
  });
  fs.writeFileSync(path.join(path.dirname(dist), 'chsmesh-outside.txt'), 'secret');
  t.after(() => fs.rmSync(path.join(path.dirname(dist), 'chsmesh-outside.txt'), { force: true }));

  assert.equal(resolveRequestPath(dist, '/'), path.join(dist, 'index.html'));
  assert.equal(
    resolveRequestPath(dist, '/guides/initial-setup/?x=1'),
    path.join(dist, 'guides/initial-setup/index.html')
  );
  for (const escape of ['/../chsmesh-outside.txt', '/%2e%2e/chsmesh-outside.txt', '/guides/../../chsmesh-outside.txt']) {
    assert.equal(resolveRequestPath(dist, escape), null, escape);
  }
  assert.equal(resolveRequestPath(dist, '/missing/'), null);
  assert.equal(resolveRequestPath(dist, '/%E0%A4%A'), null);

  const site = await serveDist(dist);
  t.after(() => site.close());
  const css = await fetch(`${site.origin}/_astro/site.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type') ?? '', /^text\/css/);
  assert.equal((await fetch(`${site.origin}/missing/`)).status, 404);
});
