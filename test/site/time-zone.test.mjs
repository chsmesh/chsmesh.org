import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE_TIME_ZONE } from '../../services/submissions/time-zone.mjs';

// The CMS config cannot import SITE_TIME_ZONE, so it repeats the zone. If the
// two drift, CMS edits and form submissions land in different zones.
test('CMS datetime fields use the shared site time zone', () => {
  const config = readFileSync(new URL('../../public/admin/config.yml', import.meta.url), 'utf8');
  const zones = [...config.matchAll(/input_timezone:\s*['"]?([^,'"}\s]+)/g)].map((match) => match[1]);
  assert.ok(zones.length > 0, 'expected input_timezone on the meetup datetime fields');
  for (const zone of zones) assert.equal(zone, SITE_TIME_ZONE);
});
