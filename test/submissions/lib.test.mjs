import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { slugify, validate, buildFile, yamlLines, renderMarkdown, pullRequestBody, pullRequestLabels, turnstileVerdict, workflowBranch, zonedDateTime, zoneOffsetMinutes, CMS_LABEL_PREFIX, SUBMISSION_STATUS, KINDS, CONTACT_KINDS, SPECS, contactNotice } from '../../services/submissions/lib.mjs';

test('turnstile verdict requires success, matching hostname and action', () => {
  const expected = { hostname: 'chsmesh.org', action: 'submit-meetup' };
  const good = { success: true, hostname: 'chsmesh.org', action: 'submit-meetup' };
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

test('validate accepts the payload shape a form sends, coerces coordinates and drops unknown fields', () => {
  const result = validate('meetup', {
    title: 'Hampton Park Mesh Walk',
    description: 'Range test',
    date: '2026-09-12T10:00',
    location: 'Hampton Park',
    coordinates: { lat: '32.7765', lng: -80.0298 },
    submitterEmail: 'chris@example.com',
    featured: true,
    submittedAt: '2026-09-12T00:00:00Z',
    frontmatterInjection: 'nope',
  });
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.deepEqual(Object.keys(result.data).sort(), ['coordinates', 'date', 'description', 'location', 'submitterEmail', 'title']);
  assert.deepEqual(result.data.coordinates, { lat: 32.7765, lng: -80.0298 });
});

test('node submissions are no longer a kind', () => {
  assert.equal(KINDS.includes('node'), false);
  assert.equal(validate('node', { name: 'Relay', coordinates: { lat: 1, lng: 2 }, type: 'relay', submitterEmail: 'a@b.co' }).ok, false);
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
  assert.match(meetupFile.content, /date: "2026-10-03T18:00:00-04:00"\nlocation: "Library"\ndescription: "Come say hi."\nfeatured: false\n---/);
});

test('pull request body never includes the submitter email', () => {
  for (const kind of KINDS) {
    const body = pullRequestBody(kind, { title: 'T', name: 'N', submitterEmail: 'secret@example.com', content: 'private draft' }, { path: 'x', hasContact: true });
    assert.ok(!body.includes('secret@example.com'), `${kind} body leaked the email`);
    assert.ok(!body.includes('private draft'), `${kind} body dumped the content field`);
  }
});

test('zone-less meetup times are pinned to Charleston time with a DST-aware offset', () => {
  assert.deepEqual(zonedDateTime('2026-10-03T18:00'), { value: '2026-10-03T18:00:00-04:00', note: null });
  assert.deepEqual(zonedDateTime('2026-01-15T18:30'), { value: '2026-01-15T18:30:00-05:00', note: null });
  assert.deepEqual(zonedDateTime('2026-07-04T21:15:30.250'), { value: '2026-07-04T21:15:30-04:00', note: null });
  // A bare date is midnight local, so it stays on the right day once zoned.
  assert.deepEqual(zonedDateTime('2026-10-03'), { value: '2026-10-03T00:00:00-04:00', note: null });
  // The stored value names the instant the submitter meant.
  assert.equal(Date.parse(zonedDateTime('2026-10-03T18:00').value), Date.UTC(2026, 9, 3, 22, 0));
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 6, 1), 'America/New_York'), -240);
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 0, 1), 'America/New_York'), -300);
  assert.equal(zonedDateTime('2026-02-30T10:00'), null);
  assert.equal(zonedDateTime('2026-10-03T24:00'), null);
  assert.equal(zonedDateTime('2026-10-03T18:00Z'), null);
  // Local mean time offsets include seconds; dates that old are refused.
  assert.equal(zonedDateTime('1850-06-01T10:00'), null);
  assert.deepEqual(zonedDateTime('1900-06-01T10:00'), { value: '1900-06-01T10:00:00-05:00', note: null });
});

test('DST edges resolve like Temporal "compatible" and leave a note', () => {
  // Either side of spring forward (2026-03-08, 02:00 EST -> 03:00 EDT).
  assert.deepEqual(zonedDateTime('2026-03-08T01:59:59'), { value: '2026-03-08T01:59:59-05:00', note: null });
  assert.deepEqual(zonedDateTime('2026-03-08T03:00'), { value: '2026-03-08T03:00:00-04:00', note: null });
  // 02:30 never happens that night: move forward by the gap.
  const gap = zonedDateTime('2026-03-08T02:30');
  assert.equal(gap.value, '2026-03-08T03:30:00-04:00');
  assert.match(gap.note, /does not exist/);

  // 01:30 happens twice on 2026-11-01 (EDT, then EST): take the first.
  const repeat = zonedDateTime('2026-11-01T01:30');
  assert.equal(repeat.value, '2026-11-01T01:30:00-04:00');
  assert.match(repeat.note, /happens twice/);
  assert.deepEqual(zonedDateTime('2026-11-01T02:00'), { value: '2026-11-01T02:00:00-05:00', note: null });
  assert.deepEqual(zonedDateTime('2026-11-01T00:59'), { value: '2026-11-01T00:59:00-04:00', note: null });
});

test('validate zones meetup dates, rewrites other offsets, and surfaces DST notes in the PR', () => {
  const base = { title: 'T', description: 'D', location: 'L', submitterEmail: 'a@b.co' };
  const plain = validate('meetup', { ...base, date: '2026-12-05T10:00', endDate: '2026-12-05T12:00' });
  assert.equal(plain.ok, true, plain.errors.join('; '));
  assert.equal(plain.data.date, '2026-12-05T10:00:00-05:00');
  assert.equal(plain.data.endDate, '2026-12-05T12:00:00-05:00');
  assert.deepEqual(plain.notes, []);

  // A Charleston offset is kept; any other offset is rewritten as the same
  // moment in Charleston time and flagged for the reviewer.
  const same = validate('meetup', { ...base, date: '2026-12-05T10:00:00-05:00' });
  assert.equal(same.data.date, '2026-12-05T10:00:00-05:00');
  assert.deepEqual(same.notes, []);
  for (const explicit of ['2026-12-05T15:00:00Z', '2026-12-05T15:00:00.123Z', '2026-12-05T16:00+01:00']) {
    const result = validate('meetup', { ...base, date: explicit });
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.equal(result.data.date, '2026-12-05T10:00:00-05:00');
    assert.equal(result.notes.length, 1);
    assert.match(result.notes[0], /^date: .* different UTC offset/);
  }
  assert.equal(validate('meetup', { ...base, date: '2026-12-05T10:00:00-04:00' }).notes.length, 1);
  for (const bad of ['2026-02-30T10:00Z', '2026-12-05T10:00+19:00', '2026-12-05T25:00Z', '1850-06-01T10:00', 'tomorrow']) {
    assert.equal(validate('meetup', { ...base, date: bad }).ok, false, bad);
  }

  const impossible = validate('meetup', { ...base, date: '2026-02-30T10:00' });
  assert.equal(impossible.ok, false);

  const edge = validate('meetup', { ...base, date: '2026-03-08T02:30' });
  assert.equal(edge.ok, true, edge.errors.join('; '));
  assert.equal(edge.data.date, '2026-03-08T03:30:00-04:00');
  assert.equal(edge.notes.length, 1);
  assert.match(edge.notes[0], /^date: /);

  const body = pullRequestBody('meetup', edge.data, { path: 'x', hasContact: true, notes: edge.notes });
  assert.match(body, /### Needs a look\n\n- date: 2026-03-08T02:30 does not exist/);
  assert.match(body, /Charleston time.*America\/New_York time/);
  assert.ok(!pullRequestBody('meetup', plain.data, { path: 'x', hasContact: true }).includes('Needs a look'));
});

test('submission branches and labels are ones the CMS workflow recognises', () => {
  const config = fs.readFileSync(new URL('../../public/admin/config.yml', import.meta.url), 'utf8');
  const prefix = config.match(/^\s*cms_label_prefix:\s*"([^"]+)"/m)?.[1];
  assert.equal(prefix, CMS_LABEL_PREFIX, 'CMS_LABEL_PREFIX must match cms_label_prefix in config.yml');

  // Top-level collections are `  - name:` at two spaces; their own `folder:`
  // sits at four spaces before the next collection starts.
  const collectionFolders = new Map(
    config
      .split(/^ {2}- name: /m)
      .slice(1)
      .map((block) => [block.match(/^\S+/)[0], block.match(/^ {4}folder: (\S+)$/m)?.[1]])
  );

  for (const kind of KINDS) {
    const { path } = buildFile(kind, { title: 'T', name: 'N' }, { slug: 'my-entry', today: '2026-01-01' });
    const [, folder, file] = path.match(/^(.*)\/([^/]+)\.\w+$/);
    const [, collection, slug] = workflowBranch(kind, 'my-entry').match(/^cms\/([^/]+)\/(.+)$/);
    assert.equal(slug, file, `${kind} branch slug must equal the file name`);
    assert.equal(collectionFolders.get(collection), folder, `${kind} collection ${collection} must own ${folder}`);
    assert.ok(pullRequestLabels(kind).includes(`${prefix}${SUBMISSION_STATUS}`), `${kind} PR needs a workflow status label`);
  }
});

test('relay host offers are contact-only and never become repository content', () => {
  assert.deepEqual(CONTACT_KINDS, ['host']);
  assert.ok(!KINDS.includes('host'), 'host must not be a pull-request kind');
  assert.equal(SPECS.host.collection, undefined);
  assert.throws(() => buildFile('host', { name: 'N' }, { slug: 'x', today: '2026-01-01' }), /Unknown submission kind/);
  // The page promises a neighborhood is all that is asked for.
  for (const field of Object.keys(SPECS.host.fields)) assert.doesNotMatch(field, /address|street|lat|lng|coord/i);
  // Every accepted field reaches the moderators.
  assert.deepEqual(Object.keys(SPECS.host.contactLabels).sort(), Object.keys(SPECS.host.fields).sort());
});

test('validate accepts the payload the host form sends and rejects bad ones', () => {
  const result = validate('host', {
    name: ' Jordan Smith ',
    siteType: 'church',
    area: 'James Island near Folly Road',
    power: 'unsure',
    submitterEmail: 'jordan@example.com',
    address: '1 Secret St',
    submittedAt: '2026-11-22T00:00:00.000Z',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    name: 'Jordan Smith',
    siteType: 'church',
    area: 'James Island near Folly Road',
    power: 'unsure',
    submitterEmail: 'jordan@example.com',
  });

  const bad = validate('host', { name: 'J', siteType: 'castle', notes: 'x'.repeat(1001) });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.startsWith('siteType must be one of')));
  assert.ok(bad.errors.includes('area is required'));
  assert.ok(bad.errors.includes('submitterEmail is required'));
  assert.ok(bad.errors.includes('notes is longer than 1000 characters'));
});

test('host notice carries the contact details, fits Discord limits and cannot ping', () => {
  const notice = contactNotice('host', {
    name: 'Jordan Smith',
    siteType: 'home',
    area: 'West Ashley',
    notes: '@everyone '.repeat(150),
    submitterEmail: 'jordan@example.com',
  });
  assert.deepEqual(notice.allowed_mentions, { parse: [] });
  const [embed] = notice.embeds;
  assert.equal(embed.title, 'Relay host offer: West Ashley');
  assert.deepEqual(embed.fields.map((f) => f.name), ['Name', 'Kind of site', 'Neighborhood', 'Notes', 'Email']);
  assert.equal(embed.fields.at(-1).value, 'jordan@example.com');
  assert.ok(embed.fields.every((f) => f.value.length <= 1024));
  assert.throws(() => contactNotice('node', {}), /not a contact-only kind/);

  // Markdown is escaped, so a masked link shows as typed instead of rendering.
  const masked = contactNotice('host', { name: 'N', area: 'A', notes: '[Verify](https://evil.example) `x`' });
  assert.equal(masked.embeds[0].fields.at(-1).value, '\\[Verify\\]\\(https://evil.example\\) \\`x\\`');
  // The longest notes the service accepts arrive whole unless escaping grows them.
  assert.equal(contactNotice('host', { name: 'N', area: 'A', notes: 'x'.repeat(1000) }).embeds[0].fields.at(-1).value, 'x'.repeat(1000));
  // A cut never ends on half an escape or half an emoji.
  for (const filler of ['(', '😀']) {
    const cut = contactNotice('host', { name: 'N', area: 'A', notes: filler.repeat(1000) }).embeds[0].fields.at(-1).value;
    assert.ok(cut.length <= 1024);
    assert.doesNotMatch(cut, /(?<!\\)(\\\\)*\\…$|[\uD800-\uDBFF]…$/);
  }
  // A honeypot hit is still delivered, flagged.
  assert.match(contactNotice('host', { name: 'N', area: 'A' }, { suspect: true }).embeds[0].title, /^Possible spam - /);
});
