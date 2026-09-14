// The site's own nav links were slashless ("/about") while every page it
// publishes is directory-format ("about/index.html", canonical "/about/").
// nginx redirected the difference, and because it builds absolute redirects
// from its own scheme and listen port, behind Traefik that redirect pointed at
// http://chsmesh.org:8080/ - unreachable, so every page but the home page
// appeared broken. nginx.conf now sets `absolute_redirect off`, and these
// assertions keep the links themselves canonical so that redirect stays a
// safety net for inbound links rather than load-bearing for our own nav.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHref } from '../../src/utils/href.mjs';

test('should add the trailing slash that directory-format pages publish', () => {
  for (const [input, expected] of [
    ['/about', '/about/'],
    ['/guides', '/guides/'],
    ['/meetups', '/meetups/'],
    ['/map', '/map/'],
    ['/resources', '/resources/'],
    ['/guides/initial-setup', '/guides/initial-setup/'],
  ]) {
    assert.equal(normalizeHref(input), expected);
  }
});

test('should leave an already-canonical path untouched', () => {
  for (const href of ['/', '/about/', '/guides/initial-setup/', '/admin/']) {
    assert.equal(normalizeHref(href), href, `${href} is already canonical`);
  }
});

test('should never rewrite an off-site or in-page href', () => {
  // Appending a slash to any of these would corrupt the target: a mailto: gains
  // a bogus path, and an anchor stops matching its element.
  for (const href of [
    'https://meshmap.net',
    'http://example.com/path',
    'https://github.com/chsmesh/chsmesh.org/issues/new?template=add_content.md',
    'mailto:info@chsmesh.org',
    'tel:+18435550123',
    '//cdn.example.com/asset',
    '#hardware',
  ]) {
    assert.equal(normalizeHref(href), href, `${href} must be passed through`);
  }
});

test('should leave real files alone rather than turning them into directories', () => {
  // These are served as files; "/favicon.svg/" would 404.
  for (const href of ['/favicon.svg', '/og-image.png', '/admin/config.yml', '/robots.txt']) {
    assert.equal(normalizeHref(href), href, `${href} is a file, not a page`);
  }
});

test('should put the slash before a query string or fragment', () => {
  assert.equal(normalizeHref('/guides#hardware'), '/guides/#hardware');
  assert.equal(normalizeHref('/guides?tag=rf'), '/guides/?tag=rf');
  assert.equal(normalizeHref('/guides?tag=rf#top'), '/guides/?tag=rf#top');
  // Already canonical, suffix preserved as-is.
  assert.equal(normalizeHref('/guides/#hardware'), '/guides/#hardware');
});

test('should pass through empty and relative hrefs unchanged', () => {
  assert.equal(normalizeHref(''), '');
  // Relative hrefs are not used by the content schemas; if one appears, leaving
  // it alone is safer than guessing what it is relative to.
  assert.equal(normalizeHref('about'), 'about');
});
