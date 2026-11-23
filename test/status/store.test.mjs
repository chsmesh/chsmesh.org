import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeServiceEnvelope, decryptPacket, readFields, DEFAULT_KEY, PORTNUM } from '../../services/status/mesh.mjs';
import { createStore, parseTopic } from '../../services/status/store.mjs';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const env = (name) => decodeServiceEnvelope(Buffer.from(fixtures[name], 'hex'));
const ROOT = 'msh/US/SC/LoCo';
const topic = (channel, gw = '!3d506c26') => `${ROOT}/2/e/${channel}/${gw}`;
const INFRA = [
  { id: '!e20c4c89', name: 'LoCoMT-DT1', area: 'Downtown' },
  { id: '!fb5105a5', name: 'LoCoMT-MtP1', area: 'Mount Pleasant' },
];

function clockAt(iso) {
  let t = Date.parse(iso);
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}

test('protobuf reader handles varints, negative int32 and length-delimited fields', () => {
  // field 1 varint 150, field 12 int32 -97 (sign-extended to 10 bytes), field 2 bytes "hi"
  const buf = Buffer.from([0x08, 0x96, 0x01, 0x60, 0x9f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01, 0x12, 0x02, 0x68, 0x69]);
  const f = readFields(buf);
  assert.equal(f.get(1)[0], 150n);
  assert.equal(BigInt.asIntN(32, f.get(12)[0]), -97n);
  assert.equal(f.get(2)[0].toString(), 'hi');
  assert.throws(() => readFields(Buffer.from([0x08, 0x96])), /truncated/);
});

test('envelope decoding exposes header fields and decrypts LongFast with the default key', () => {
  const e = env('text');
  assert.equal(e.channelId, 'LongFast');
  assert.equal(e.gatewayId, '!3d506c26');
  assert.equal(e.packet.from, 0xaf3709d2);
  assert.equal(e.packet.hopStart, 7);
  assert.equal(e.packet.hopLimit, 5);
  assert.equal(e.packet.rxRssi, -120);
  assert.equal(e.packet.relayNode, 0x89);
  assert.equal(e.packet.decoded, null);
  const data = decryptPacket(e.packet, DEFAULT_KEY);
  assert.equal(data.portnum, PORTNUM.TEXT_MESSAGE_APP);

  // LoCo-Chat uses a private key: the default key must not "decrypt" it.
  assert.equal(decryptPacket(env('locoChat').packet, DEFAULT_KEY), null);
});

test('topics outside the LoCo root or not packet uploads are ignored', () => {
  assert.deepEqual(parseTopic(`${ROOT}/2/e/LongFast/!abcd1234`, ROOT), { kind: 'packet', channel: 'LongFast', gateway: '!abcd1234' });
  assert.deepEqual(parseTopic(`${ROOT}/2/map/`, ROOT), { kind: 'map' });
  assert.equal(parseTopic(`${ROOT}/2/json/LongFast/!abcd1234`, ROOT), null);
  assert.equal(parseTopic('msh/US/2/e/LongFast/!abcd1234', ROOT), null);
  assert.equal(parseTopic('locomesh/feed/TailsWCU/stats', ROOT), null);
});

test('store builds node, gateway and infrastructure state without keeping message text', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  store.ingest(topic('LongFast'), env('nodeinfo'));
  store.ingest(topic('LongFast'), env('position'));
  store.ingest(topic('LongFast'), env('telemetry'));
  store.ingest(topic('LongFast'), env('text'));
  // The same packet uploaded by a second gateway counts once.
  store.ingest(topic('LongFast', '!7b91d1d4'), env('text'));
  store.ingest(topic('LoCo-Chat'), env('locoChat'));
  store.ingest(`${ROOT}/2/map/`, env('mapReport'));

  const s = store.snapshot();
  const dt1 = s.nodes.find((n) => n.id === '!e20c4c89');
  assert.equal(dt1.name, 'LoCoMT-DT1');
  assert.equal(dt1.role, 'ROUTER');
  assert.equal(dt1.hw, 'RAK4631');
  assert.deepEqual(dt1.pos, { lat: 32.78, lon: -79.93 }, 'positions are rounded to about 1 km');
  assert.equal(dt1.infrastructure, true);

  const wa1 = s.nodes.find((n) => n.id === '!3d506c26');
  assert.equal(wa1.name, 'LoWattMT-WA1', 'map reports name nodes');
  assert.equal(wa1.role, 'CLIENT_BASE');
  assert.deepEqual(wa1.pos, { lat: 32.79, lon: -80.02 });

  const pocket = s.nodes.find((n) => n.id === '!af3709d2');
  assert.equal(pocket.hops, 1, 'fewest hops seen: 2 on LongFast, 1 on LoCo-Chat');
  assert.equal(pocket.gateways, 2);

  assert.equal(s.totals.packets24h, 5, 'nodeinfo, position, telemetry, one text, one LoCo-Chat');
  assert.equal(s.totals.textMessages24h, 1, 'LongFast text counted once; LoCo-Chat is not readable');
  assert.equal(s.channels, undefined, 'per-channel counts are not published');
  assert.equal(s.totals.channelUtilizationMedian, 4.3);
  assert.equal(s.totals.gatewaysOnline, 2);

  const json = JSON.stringify(s);
  // 'LoCo-Chat' stands for any private channel name: counted, never published.
  for (const secret of ['secret hello', 'private chat', '32.7765432', '-79.9312345', 'LoCo-Chat']) {
    assert.equal(json.includes(secret), false, `snapshot must not contain ${secret}`);
  }

  const infra = Object.fromEntries(s.infrastructure.map((r) => [r.id, r]));
  assert.equal(infra['!e20c4c89'].status, 'up');
  assert.equal(infra['!e20c4c89'].channelUtilization, 4.3);
  assert.equal(infra['!fb5105a5'].status, 'unseen', 'never heard is not down');
  assert.equal(infra['!fb5105a5'].lastHeard, null);
  assert.equal(infra['!e20c4c89'].activity.length, 56, '7 days of 3-hour blocks');
  assert.equal(infra['!e20c4c89'].activity.at(-1), 1);
});

test('relay bytes credit infrastructure only when unambiguous', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  // The text fixture was relayed by byte 0x89, which only !e20c4c89 ends in.
  store.ingest(topic('LongFast'), env('text'));
  const s = store.snapshot();
  assert.equal(s.infrastructure.find((r) => r.id === '!e20c4c89').status, 'up');

  // Once another known node ends in 0x89 the byte is ambiguous and credits nobody.
  const now2 = clockAt('2026-11-14T15:00:00Z');
  const store2 = createStore({ infrastructure: [...INFRA, { id: '!00000089', name: 'Other' }], root: ROOT, now: now2 });
  store2.ingest(topic('LongFast'), env('text'));
  assert.equal(store2.snapshot().infrastructure.find((r) => r.id === '!e20c4c89').status, 'unseen');
});

test('a never-heard site is unseen for the grace period, then down, and stays out of the headline count', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  store.ingest(topic('LongFast'), env('nodeinfo'));
  const mtp = (s) => s.infrastructure.find((r) => r.id === '!fb5105a5');
  let s = store.snapshot();
  assert.equal(mtp(s).status, 'unseen');
  assert.deepEqual([s.totals.infrastructureUp, s.totals.infrastructureTotal, s.totals.infrastructureUnseen], [1, 2, 1]);

  now.advance(6 * 86400_000);
  assert.equal(mtp(store.snapshot()).status, 'unseen');
  // The grace period is per site and survives a restart.
  const restarted = createStore({ infrastructure: [...INFRA, { id: '!0000aaaa', name: 'New site' }], root: ROOT, now });
  assert.equal(restarted.load(JSON.parse(JSON.stringify(store.serialize()))), true);
  now.advance(2 * 86400_000);
  s = restarted.snapshot();
  assert.equal(mtp(s).status, 'down');
  assert.equal(mtp(s).lastHeard, null);
  assert.equal(s.infrastructure.find((r) => r.id === '!0000aaaa').status, 'unseen', 'a site added later gets its own grace period');
  assert.equal(s.totals.infrastructureUnseen, 1);

  // State saved before infraSince existed ages from the collector start.
  const old = store.serialize();
  delete old.infraSince;
  const upgraded = createStore({ infrastructure: INFRA, root: ROOT, now });
  upgraded.load(JSON.parse(JSON.stringify(old)));
  assert.equal(mtp(upgraded.snapshot()).status, 'down');
});

test('a node heard before it was listed as infrastructure keeps that evidence', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const before = createStore({ infrastructure: [], root: ROOT, now });
  before.ingest(topic('LongFast'), env('nodeinfo'));
  const heardAt = new Date(now()).toISOString();
  now.advance(2 * 3600_000);
  const after = createStore({ infrastructure: INFRA, root: ROOT, now });
  after.load(JSON.parse(JSON.stringify(before.serialize())));
  const dt = () => after.snapshot().infrastructure.find((r) => r.id === '!e20c4c89');
  assert.equal(dt().status, 'up');
  assert.equal(dt().lastHeard, heardAt);
  now.advance(30 * 3600_000);
  assert.equal(dt().status, 'down', 'and it ages like any other site');

  // The same holds for a site first seen only as an uploading gateway.
  const gwOnly = createStore({ infrastructure: [], root: ROOT, now });
  gwOnly.ingest(topic('LongFast', '!fb5105a5'), env('text'));
  const listed = createStore({ infrastructure: INFRA, root: ROOT, now });
  listed.load(JSON.parse(JSON.stringify(gwOnly.serialize())));
  assert.equal(listed.snapshot().infrastructure.find((r) => r.id === '!fb5105a5').status, 'up');
});

test('status ages from up to stale to down and old data is pruned', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  store.ingest(topic('LongFast'), env('nodeinfo'));
  now.advance(7 * 3600_000);
  assert.equal(store.snapshot().infrastructure[0].status, 'stale');
  now.advance(20 * 3600_000);
  const s = store.snapshot();
  assert.equal(s.infrastructure[0].status, 'down');
  assert.equal(s.totals.activeNodes, 0);
  assert.equal(s.gateways.length, 0, 'gateways silent for a day are not listed');

  now.advance(8 * 86400_000);
  store.prune();
  assert.equal(store.size.hours, 0);
  assert.equal(store.size.gateways, 0);
});

test('fewest hops is forgotten once that observation leaves the active window', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  let id = 1;
  const heard = (hopLimit) =>
    store.ingest(topic('LongFast'), { gatewayId: '', packet: { from: 0x0a0b0c0d, id: id++, hopStart: 3, hopLimit, decoded: null, encrypted: null } });
  const hops = () => store.snapshot().nodes.find((n) => n.id === '!0a0b0c0d').hops;

  heard(3); // direct, once
  now.advance(12 * 3600_000);
  heard(0); // three relays from here on
  assert.equal(hops(), 0, 'the direct path is still inside the 24 h window');
  now.advance(13 * 3600_000);
  heard(0);
  assert.equal(hops(), 3, 'the direct path was last seen 25 h ago');
  now.advance(3600_000);
  heard(2); // one relay
  assert.equal(hops(), 1, 'a better count replaces the current one straight away');
});

test('state survives a serialize/load round trip', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const a = createStore({ infrastructure: INFRA, root: ROOT, now });
  a.ingest(topic('LongFast'), env('nodeinfo'));
  a.ingest(topic('LongFast'), env('text'));
  const b = createStore({ infrastructure: INFRA, root: ROOT, now });
  assert.equal(b.load(JSON.parse(JSON.stringify(a.serialize()))), true);
  const sa = a.snapshot();
  const sb = b.snapshot();
  assert.deepEqual(sb.totals, sa.totals);
  assert.deepEqual(sb.infrastructure, sa.infrastructure);
  assert.equal(b.load({ version: 99 }), false);
});

test('channel names are never kept in saved state', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const a = createStore({ infrastructure: INFRA, root: ROOT, now });
  a.ingest(topic('LoCo-Chat'), env('locoChat'));
  assert.doesNotMatch(JSON.stringify(a.serialize()), /LoCo-Chat/);
  // State written by earlier versions carried per-channel counts; loading drops them.
  const old = JSON.parse(JSON.stringify(a.serialize()));
  for (const [, h] of old.hours) h.channels = { 'LoCo-Chat': 1 };
  const b = createStore({ infrastructure: INFRA, root: ROOT, now });
  assert.equal(b.load(old), true);
  assert.doesNotMatch(JSON.stringify(b.serialize()), /LoCo-Chat/);
  assert.equal(b.snapshot().totals.packets24h, 1);
});

test('a channel name containing a slash never leaks into the gateway slot', () => {
  assert.deepEqual(parseTopic(`${ROOT}/2/e/Ops/Zzqq/!3d506c26`, ROOT), { kind: 'packet', channel: 'Ops/Zzqq', gateway: '!3d506c26' });
  assert.equal(parseTopic(`${ROOT}/2/e/Ops/Zzqq`, ROOT).gateway, null);

  const now = clockAt('2026-11-14T15:00:00Z');
  const a = createStore({ infrastructure: INFRA, root: ROOT, now });
  a.ingest(`${ROOT}/2/e/Ops/Zzqq/!3d506c26`, env('locoChat'));
  // No gateway segment at all, and an envelope that claims a bogus one.
  a.ingest(`${ROOT}/2/e/Ops/Zzqq`, { ...env('locoChat'), gatewayId: 'Zzqq' });
  assert.doesNotMatch(JSON.stringify(a.serialize()), /zzqq/i);
  assert.equal(a.size.gateways, 1);

  // State saved by earlier versions may already hold such a fragment.
  const old = JSON.parse(JSON.stringify(a.serialize()));
  old.nodes[0].heardBy.zzqq = { at: now(), hops: 0, hopsAt: now() };
  old.gateways.push(['!zzqq', { lastUpload: now(), uploads: {} }]);
  const b = createStore({ infrastructure: INFRA, root: ROOT, now });
  assert.equal(b.load(old), true);
  assert.doesNotMatch(JSON.stringify(b.serialize()), /zzqq/i);
});

test('a damaged hour entry does not abort loading the rest of the state', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const a = createStore({ infrastructure: INFRA, root: ROOT, now });
  a.ingest(topic('LongFast'), env('nodeinfo'));
  const state = JSON.parse(JSON.stringify(a.serialize()));
  state.hours.unshift([String(now() - 3_600_000), null]);
  const b = createStore({ infrastructure: INFRA, root: ROOT, now });
  assert.equal(b.load(state), true);
  assert.deepEqual(b.snapshot().totals, a.snapshot().totals);
  assert.deepEqual(b.snapshot().infrastructure, a.snapshot().infrastructure);
});

test('malformed payloads are counted but never throw out of ingest', () => {
  const now = clockAt('2026-11-14T15:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  const e = env('nodeinfo');
  e.packet.encrypted = Buffer.from('not a real ciphertext');
  assert.doesNotThrow(() => store.ingest(topic('LongFast'), e));
  assert.equal(store.snapshot().totals.packets24h, 1);
  assert.deepEqual(store.ingest('unrelated/topic', e), { ignored: true });
});
