import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, validate, buildFile, yamlLines, renderMarkdown, pullRequestBody, turnstileVerdict, KINDS } from '../../services/submissions/lib.mjs';

test('turnstile verdict requires success, matching hostname and action', () => {
  const expected = { hostname: 'chsmesh.org', action: 'submit-node' };
  const good = { success: true, hostname: 'chsmesh.org', action: 'submit-node' };
  assert.deepEqual(turnstileVerdict(good, expected), { ok: true });

  assert.equal(turnstileVerdict({ success: false, 'error-codes': ['timeout-or-duplicate'] }, expected).ok, false);
  assert.match(turnstileVerdict({ success: false, 'error-codes': ['timeout-or-duplicate'] }, expected).reason, /timeout-or-duplicate/);
  assert.equal(turnstileVerdict(null, expected).ok, false);
  assert.equal(turnstileVerdict('nope', expected).ok, false);
  assert.equal(turnstileVerdict({ ...good, hostname: 'evil.example' }, expected).ok, false);
  assert.equal(turnstileVerdict({ ...good, action: 'submit-guide' }, expected).ok, false);
  // A token minted for another kind's form is a mismatch even though it is valid.
  assert.match(turnstileVerdict({ ...good, action: 'submit-guide' }, expected).reason, /action mismatch/);
  // Checks are skipped when the service has nothing to compare against.
  assert.deepEqual(turnstileVerdict(good, { hostname: '', action: '' }), { ok: true });
});

test('slugify produces filesystem-safe collection slugs', () => {
  assert.equal(slugify('West Ashley Relay'), 'west-ashley-relay');
  assert.equal(slugify('  Héltec V3 — "budget" ☀️ '), 'heltec-v3-budget');
  assert.equal(slugify('!!!'), 'submission');
  assert.ok(slugify('a'.repeat(200)).length <= 60);
});

test('yaml emitter writes the shapes the content schemas use', () => {
  const lines = yamlLines({
    title: 'He said "hi": ok',
    order: 999,
    featured: false,
    prerequisites: [],
    links: [
      { label: 'Docs', url: 'https://example.com/docs', type: 'docs' },
      { label: 'Buy', url: 'https://example.com/buy' },
    ],
    coordinates: { lat: 32.7765, lng: -80.0298 },
    skipped: undefined,
  });
  assert.deepEqual(lines, [
    'title: "He said \\"hi\\": ok"',
    'order: 999',
    'featured: false',
    'prerequisites: []',
    'links:',
    '  - label: "Docs"',
    '    url: "https://example.com/docs"',
    '    type: "docs"',
    '  - label: "Buy"',
    '    url: "https://example.com/buy"',
    'coordinates:',
    '  lat: 32.7765',
    '  lng: -80.0298',
  ]);
  assert.equal(renderMarkdown({ title: 'x' }, '\r\n## Body\r\n'), '---\ntitle: "x"\n---\n\n## Body\n');
});

test('validate accepts the payload shape the node form sends and drops unknown fields', () => {
  const result = validate('node', {
    name: 'West Ashley Relay',
    description: 'Rooftop relay',
    coordinates: { lat: '32.7765', lng: -80.0298 },
    type: 'relay',
    elevation: 35,
    owner: 'CharlieM',
    submitterEmail: 'chris@example.com',
    active: true,
    lastSeen: '2026-09-12',
    submittedAt: '2026-09-12T00:00:00Z',
    frontmatterInjection: 'nope',
  });
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.deepEqual(Object.keys(result.data).sort(), ['coordinates', 'description', 'elevation', 'name', 'owner', 'submitterEmail', 'type']);
  assert.deepEqual(result.data.coordinates, { lat: 32.7765, lng: -80.0298 });
});

test('validate rejects missing, malformed and out-of-range values', () => {
  const result = validate('meetup', {
    title: '',
    description: 'x',
    date: 'next tuesday',
    location: 'Park',
    coordinates: { lat: 95, lng: 0 },
    rsvpLink: 'javascript:alert(1)',
    maxAttendees: 2.5,
    submitterEmail: 'not-an-email',
  });
  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  for (const fragment of ['title is required', 'date must be', 'coordinates.lat', 'rsvpLink must be', 'maxAttendees must be a whole number', 'submitterEmail must be']) {
    assert.ok(result.errors.some((e) => e.includes(fragment)), `expected an error mentioning "${fragment}", got: ${result.errors.join('; ')}`);
  }
  assert.equal(validate('unknown', {}).ok, false);
  assert.equal(validate('guide', 'string').ok, false);
});

test('guide files carry front matter the guides collection schema accepts', () => {
  const { data } = validate('guide', {
    title: 'Antenna Basics',
    description: 'Pick an antenna.',
    content: '## Overview\n\nText.',
    category: 'hardware',
    difficulty: 'beginner',
    prerequisites: ['A device', 'Patience'],
    submitterEmail: 'a@b.co',
  });
  const file = buildFile('guide', data, { slug: 'antenna-basics', today: '2026-09-12' });
  assert.equal(file.path, 'src/content/guides/antenna-basics.md');
  assert.equal(
    file.content,
    [
      '---',
      'title: "Antenna Basics"',
      'description: "Pick an antenna."',
      'difficulty: "beginner"',
      'category: "hardware"',
      'order: 999',
      'prerequisites:',
      '  - "A device"',
      '  - "Patience"',
      'lastUpdated: "2026-09-12"',
      '---',
      '',
      '## Overview',
      '',
      'Text.',
      '',
    ].join('\n')
  );
});

test('node files are JSON data entries with active and lastSeen filled in', () => {
  const { data } = validate('node', {
    name: 'Relay',
    coordinates: { lat: 1, lng: 2 },
    type: 'solar',
    submitterEmail: 'a@b.co',
  });
  const file = buildFile('node', data, { slug: 'relay', today: '2026-09-12' });
  assert.equal(file.path, 'src/content/nodes/relay.json');
  assert.deepEqual(JSON.parse(file.content), {
    name: 'Relay',
    coordinates: { lat: 1, lng: 2 },
    type: 'solar',
    active: true,
    lastSeen: '2026-09-12',
  });
});

test('resource and meetup bodies fall back to the description', () => {
  const resource = validate('resource', {
    title: 'Heltec V3',
    description: 'Cheap board.',
    category: 'devices',
    links: [{ label: 'Buy', url: 'https://example.com', type: '' }],
    pros: 'Cheap\nSmall',
    submitterEmail: 'a@b.co',
  });
  assert.equal(resource.ok, true, resource.errors.join('; '));
  const file = buildFile('resource', resource.data, { slug: 'heltec-v3', today: '2026-09-12' });
  assert.match(file.content, /links:\n  - label: "Buy"\n    url: "https:\/\/example.com"\n/);
  assert.match(file.content, /pros:\n  - "Cheap"\n  - "Small"\ncons: \[\]/);
  assert.match(file.content, /---\n\nCheap board\.\n$/);

  const meetup = validate('meetup', {
    title: 'Monthly meetup',
    description: 'Come say hi.',
    date: '2026-10-03T18:00',
    location: 'Library',
    submitterEmail: 'a@b.co',
  });
  assert.equal(meetup.ok, true, meetup.errors.join('; '));
  const meetupFile = buildFile('meetup', meetup.data, { slug: 'monthly-meetup', today: '2026-09-12' });
  assert.match(meetupFile.content, /date: "2026-10-03T18:00"\nlocation: "Library"\ndescription: "Come say hi."\nfeatured: false\n---/);
});

test('pull request body never includes the submitter email', () => {
  for (const kind of KINDS) {
    const body = pullRequestBody(kind, { title: 'T', name: 'N', submitterEmail: 'secret@example.com', content: 'private draft' }, { path: 'x', hasContact: true });
    assert.ok(!body.includes('secret@example.com'), `${kind} body leaked the email`);
    assert.ok(!body.includes('private draft'), `${kind} body dumped the content field`);
  }
});
