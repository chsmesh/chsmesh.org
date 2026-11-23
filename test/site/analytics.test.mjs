import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ANALYTICS_SRC, shouldLoadAnalytics, trackingOptedOut } from '../../src/utils/analytics.mjs';

const read = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

test('should track when the browser sends no opt-out signal', () => {
  assert.equal(trackingOptedOut({}), false);
  assert.equal(trackingOptedOut({ doNotTrack: null, globalPrivacyControl: false }, { doNotTrack: undefined }), false);
  assert.equal(trackingOptedOut({ doNotTrack: '0' }), false);
  assert.equal(trackingOptedOut({ doNotTrack: 'unspecified' }), false);
});

test('should respect Do Not Track in every form browsers report it', () => {
  assert.equal(trackingOptedOut({ doNotTrack: '1' }), true);
  assert.equal(trackingOptedOut({ doNotTrack: 'yes' }), true);
  assert.equal(trackingOptedOut({ msDoNotTrack: '1' }), true);
  assert.equal(trackingOptedOut({}, { doNotTrack: '1' }), true);
});

test('should respect Global Privacy Control', () => {
  assert.equal(trackingOptedOut({ globalPrivacyControl: true }), true);
  assert.equal(trackingOptedOut({ globalPrivacyControl: true, doNotTrack: '0' }), true);
});

test('should load the tracker only through the opt-out check', () => {
  const layout = read('src/layouts/Layout.astro');
  assert.doesNotMatch(layout, /<script[^>]+stats\.sendtrl\.com/, 'a static tracker tag would bypass the DNT / GPC check');
  assert.match(layout, /loadAnalytics\(\)/);
});

test('should load the tracker from the origin the CSP allows', () => {
  const headers = read('security-headers.conf');
  const { origin } = new URL(ANALYTICS_SRC);
  assert.match(headers, new RegExp(`script-src[^;]*\\s${origin.replaceAll('.', '\\.')}[\\s;]`));
  assert.match(headers, new RegExp(`connect-src[^;]*\\s${origin.replaceAll('.', '\\.')}[\\s;]`));
});

test('should load the tracker only on the live site', () => {
  assert.equal(shouldLoadAnalytics('chsmesh.org', {}), true);
  assert.equal(shouldLoadAnalytics('www.chsmesh.org', {}), true);
  assert.equal(shouldLoadAnalytics('localhost', {}), false);
  assert.equal(shouldLoadAnalytics('preview.chsmesh.org', {}), false);
  assert.equal(shouldLoadAnalytics('chsmesh.org', { globalPrivacyControl: true }), false);
});

test('should report opens and submissions under the same form id', () => {
  assert.match(read('src/components/Modal.astro'), /track\('form-open', \{ form: form\.id \}\)/);
  assert.match(read('src/components/SubmissionForm.astro'), /track\('form-submit', \{ form: config\.id \}\)/);
});
