// Guards the glossary: the rehype plugin that auto-links terms in guides, and
// the seed entries it reads from src/content/glossary/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glossaryLetter, loadGlossaryTerms } from '../../src/utils/glossary.mjs';
import { rehypeGlossaryLinks } from '../../src/utils/rehypeGlossaryLinks.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const glossaryDir = path.join(repoRoot, 'src/content/glossary');

const TERMS = [
  { slug: 'lora', term: 'LoRa', definition: 'Long-range radio.', aliases: [] },
  { slug: 'node', term: 'Node', definition: 'One radio.', aliases: [] },
  { slug: 'router', term: 'Router', definition: 'A relay role.', aliases: [] },
  { slug: 'router-late', term: 'Router Late', definition: 'A patient relay role.', aliases: ['ROUTER_LATE'] },
  { slug: 'psk', term: 'PSK', definition: 'Channel key.', aliases: ['pre-shared key'] },
  { slug: 'mesh-network', term: 'Mesh network', definition: 'No central tower.', aliases: ['mesh'] },
  { slug: 'line-of-sight', term: 'Line of sight', definition: 'A clear path.', aliases: ['LOS'] },
  { slug: 'region', term: 'Region', definition: 'Legal frequencies.', aliases: ['LoRa region'] },
];

const GUIDE = { path: '/repo/src/content/guides/example.md' };

const text = (value) => ({ type: 'text', value });
const el = (tagName, ...children) => ({ type: 'element', tagName, properties: {}, children });
const root = (...children) => ({ type: 'root', children });

/** Run the plugin and return the tree. */
function link(tree, file = GUIDE, terms = TERMS) {
  rehypeGlossaryLinks({ terms })(tree, file);
  return tree;
}

/** Every glossary link in the tree, as [visible text, href]. */
function links(node, found = []) {
  if (node.type === 'element' && node.tagName === 'a' && node.properties.className?.includes('glossary-term')) {
    found.push([node.children.map((c) => c.value).join(''), node.properties.href]);
  }
  for (const child of node.children ?? []) links(child, found);
  return found;
}

/** The tree flattened back to its text. */
const flatten = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(flatten).join(''));

test('should link only the first occurrence of a term', () => {
  const tree = link(root(el('p', text('A LoRa radio. More LoRa here.')), el('p', text('And LoRa again.'))));

  assert.deepEqual(links(tree), [['LoRa', '/glossary/#lora']]);
  assert.equal(flatten(tree), 'A LoRa radio. More LoRa here.And LoRa again.');
});

test('should carry the short definition for the tooltip', () => {
  const tree = link(root(el('p', text('Uses LoRa.'))));
  const anchor = tree.children[0].children[1];

  assert.equal(anchor.tagName, 'a');
  assert.equal(anchor.properties.dataDefinition, 'Long-range radio.');
  assert.deepEqual(anchor.properties.className, ['glossary-term']);
});

test('should treat a term and its aliases as one entry', () => {
  const tree = link(root(el('p', text('Share the pre-shared key. The PSK is secret.'))));

  assert.deepEqual(links(tree), [['pre-shared key', '/glossary/#psk']]);
});

test('should match case-insensitively and keep the author\'s casing', () => {
  const tree = link(root(el('p', text('Any lora radio is a NODE.'))));

  assert.deepEqual(links(tree), [
    ['lora', '/glossary/#lora'],
    ['NODE', '/glossary/#node'],
  ]);
});

test('should match a plural and include the "s" in the link', () => {
  const tree = link(root(el('p', text('Messages hop between nodes.'))));

  assert.deepEqual(links(tree), [['nodes', '/glossary/#node']]);
});

test('should only match whole words', () => {
  const tree = link(root(el('p', text('Meshtastic_XXXX uses ROUTER_LATEST and nodejs, not routers2.'))));

  assert.deepEqual(links(tree), []);
});

test('should prefer the longest term where names overlap', () => {
  const tree = link(root(el('p', text('Pick Router Late on the mesh network, or Router.'))));

  assert.deepEqual(links(tree), [
    ['Router Late', '/glossary/#router-late'],
    ['mesh network', '/glossary/#mesh-network'],
    ['Router', '/glossary/#router'],
  ]);
});

test('should match an all-capitals name only as written', () => {
  const tree = link(root(el('p', text('Packet loss near Los Angeles, psk or not. With LOS and a PSK it works.'))));

  assert.deepEqual(links(tree), [
    ['LOS', '/glossary/#line-of-sight'],
    ['PSK', '/glossary/#psk'],
  ]);
});

test('should skip names inside hostnames, file names, addresses and compounds', () => {
  const tree = link(
    root(el('p', text('Open node.meshtastic.org, save lora.bin, mail router@example.com, try a non-node. A LoRa-based node.')))
  );

  assert.deepEqual(links(tree), [
    ['LoRa', '/glossary/#lora'],
    ['node', '/glossary/#node'],
  ]);
});

test('should fall back to a shorter name when the longer one is already linked', () => {
  const tree = link(root(el('p', text('Set your region. Then check the LoRa region setting.'))));

  assert.deepEqual(links(tree), [
    ['region', '/glossary/#region'],
    ['LoRa', '/glossary/#lora'],
  ]);
});

test('should match a multi-word term across a line break', () => {
  const tree = link(root(el('p', text('Choose Router\nLate here.'))));

  assert.deepEqual(links(tree), [['Router\nLate', '/glossary/#router-late']]);
});

test('should skip headings, code and existing links', () => {
  const existing = { type: 'element', tagName: 'a', properties: { href: '/guides/x/' }, children: [text('about LoRa')] };
  const tree = link(
    root(
      el('h2', text('LoRa basics')),
      el('h3', el('strong', text('Node roles'))),
      el('table', el('tr', el('th', text('Node')), el('th', text('LoRa')))),
      el('p', el('code', text('lora.region')), text(' and '), existing),
      el('pre', el('code', text('set router'))),
      el('p', text('Finally a LoRa mention, in '), el('strong', text('a node')), text('.'))
    )
  );

  assert.deepEqual(links(tree), [
    ['LoRa', '/glossary/#lora'],
    ['node', '/glossary/#node'],
  ]);
  // The first eligible mention is the one in the last paragraph.
  assert.equal(tree.children[5].children[1].tagName, 'a');
});

test('should leave content outside the guides collection alone', () => {
  for (const file of [{ path: '/repo/src/content/meetups/june.md' }, { path: '/repo/src/content/resources/heltec-v3.md' }, {}, undefined]) {
    // Called directly: `link` would swap an undefined file for its default.
    const tree = root(el('p', text('A LoRa node.')));
    rehypeGlossaryLinks({ terms: TERMS })(tree, file);
    assert.deepEqual(links(tree), [], `linked terms in ${JSON.stringify(file)}`);
  }
});

test('should do nothing with an empty glossary', () => {
  const tree = root(el('p', text('A LoRa node.')));
  assert.doesNotThrow(() => link(tree, GUIDE, []));
  assert.deepEqual(links(tree), []);
});

test('should not treat regex characters in a term as a pattern', () => {
  const terms = [{ slug: 'cpp', term: 'C++ (beta)', definition: 'x', aliases: ['a.b'] }];
  const tree = link(root(el('p', text('Not axb, but C++ (beta) is.'))), GUIDE, terms);

  assert.deepEqual(links(tree), [['C++ (beta)', '/glossary/#cpp']]);
});

test('should name the file when a glossary entry is not valid JSON', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glossary-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  fs.writeFileSync(path.join(dir, 'ok.json'), '{"term":"OK","definition":"Fine."}');
  fs.writeFileSync(path.join(dir, '_draft.json'), '{"term":"Draft","definition":"Not yet."}');
  assert.deepEqual(loadGlossaryTerms(dir).map((entry) => entry.slug), ['ok']);

  fs.writeFileSync(path.join(dir, 'hop.json'), '{"term":');
  assert.throws(() => loadGlossaryTerms(dir), /hop\.json is not valid JSON/);

  fs.writeFileSync(path.join(dir, 'hop.json'), 'null');
  assert.throws(() => loadGlossaryTerms(dir), /hop\.json must be a JSON object/);
});

test('should file terms under their first letter', () => {
  assert.equal(glossaryLetter('nRF52'), 'N');
  assert.equal(glossaryLetter(' dBm'), 'D');
  assert.equal(glossaryLetter('915 MHz'), '#');
});

test('should register the glossary plugin ahead of the canonical-link plugin', () => {
  // Comments are stripped so that prose mentioning a plugin cannot satisfy this.
  const config = fs.readFileSync(path.join(repoRoot, 'astro.config.mjs'), 'utf8').replace(/^\s*\/\/.*$/gm, '');

  assert.match(
    config,
    /rehypePlugins:\s*\[\s*\[rehypeGlossaryLinks,\s*\{\s*terms:\s*glossaryTerms\s*\}\],\s*rehypeCanonicalLinks,?\s*\]/,
    'guides must be auto-linked, and the generated links canonicalized afterwards'
  );
});

test('should ship a seed glossary whose entries are consistent', () => {
  const entries = fs
    .readdirSync(glossaryDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ slug: name.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(glossaryDir, name), 'utf8')) }));
  const slugs = new Set(entries.map((entry) => entry.slug));

  assert.ok(entries.length >= 30, `expected about 30 seed terms, found ${entries.length}`);
  assert.equal(loadGlossaryTerms(glossaryDir).length, entries.length);

  const problems = [];
  const names = new Map();
  for (const entry of entries) {
    // The slug is the anchor on /glossary/, so it has to be URL-safe.
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.slug)) problems.push(`${entry.slug}: file name is not a lower-case slug`);
    if (!entry.term) problems.push(`${entry.slug}: missing term`);
    if (!entry.definition || entry.definition.length > 200) problems.push(`${entry.slug}: definition must be 1-200 characters`);

    for (const related of entry.related ?? []) {
      if (!slugs.has(related)) problems.push(`${entry.slug}: related term "${related}" does not exist`);
      if (related === entry.slug) problems.push(`${entry.slug}: lists itself as related`);
    }

    // Two entries claiming one name would make the auto-link target arbitrary.
    for (const name of [entry.term, ...(entry.aliases ?? [])]) {
      const key = String(name).trim().toLowerCase();
      if (names.has(key)) problems.push(`"${name}" is claimed by both ${names.get(key)} and ${entry.slug}`);
      names.set(key, entry.slug);
    }
  }

  assert.deepEqual(problems, []);
});
