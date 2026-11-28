import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../services/status/store.mjs';
import { subscribePacket, topicMatches, splitPackets } from '../../services/status/mqtt.mjs';

const ROOT = 'msh/US/SC/LoCo';
const INFRA = [
  { id: '!e20c4c89', name: 'LoCoMT-DT1', area: 'Downtown' },
  { id: '!f196051c', name: 'LoWatt 5900', area: 'West Ashley' },
];
const FEED = (member, kind) => `locomesh/feed/${member}/${kind}`;

function clockAt(iso) {
  let t = Date.parse(iso);
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}

const site = (s, id) => s.infrastructure.find((r) => r.id === id);

test('a feeder hearing a router over the air marks it up, labelled as feeder evidence', () => {
  const now = clockAt('2026-11-28T12:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  // 5900 has OK to MQTT off: gateways never upload its packets, so without
  // feeder reports it never shows as heard.
  assert.equal(site(store.snapshot(), '!f196051c').status, 'unseen');

  const r = store.ingestFeed(FEED('starleaf', 'rx'), { from: 0xf196051c, id: 77, rssi: -112, snr: -6.5, hops: 0, via_mqtt: false, text: 'never kept' });
  assert.deepEqual(r, { from: '!f196051c', credited: true });

  const s = store.snapshot();
  const w = site(s, '!f196051c');
  assert.equal(w.status, 'up');
  assert.equal(w.lastHeard, '2026-11-28T12:00:00.000Z');
  assert.equal(w.lastHeardSource, 'feeder');
  assert.equal(w.activity.at(-1), 1);
  assert.match(s.scope, /feeders/);
  // Feeder reports don't add nodes, packets or gateways.
  assert.equal(s.nodes.length, 0);
  assert.equal(s.totals.packets24h, 0);
  assert.equal(s.gateways.length, 0);
  assert.doesNotMatch(JSON.stringify(store.serialize()), /starleaf|never kept/);
});

test('via_mqtt copies, downlinks without a signal report and non-infrastructure senders are not credited', () => {
  const now = clockAt('2026-11-28T12:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  assert.equal(store.ingestFeed(FEED('a', 'rx'), { from: '!f196051c', id: 1, rssi: -90, snr: 5, via_mqtt: true }).reason, 'via_mqtt');
  assert.equal(store.ingestFeed(FEED('a', 'rx'), { from: '!f196051c', id: 2, hops: 0 }).reason, 'no signal report');
  assert.equal(store.ingestFeed(FEED('a', 'rx'), { from: '!f196051c', id: 3, rssi: 0, snr: 0 }).reason, 'no signal report');
  assert.equal(store.ingestFeed(FEED('a', 'rx'), { from: 'bogus', id: 4, rssi: -90 }).reason, 'no sender');
  assert.equal(store.ingestFeed(FEED('a', 'rx'), { from: '!12345678', id: 5, rssi: -90, snr: 2 }).credited, false);
  assert.equal(store.ingestFeed(FEED('a', 'status'), { state: 'online' }).ignored, true);
  const s = store.snapshot();
  assert.equal(site(s, '!f196051c').status, 'unseen');
  assert.equal(s.nodes.length, 0);
});

test('feeder nodedb last_heard credits infrastructure, skipping via_mqtt, future and expired entries', () => {
  const now = clockAt('2026-11-28T12:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  const sec = (iso) => Date.parse(iso) / 1000;
  const r = store.ingestFeed(FEED('b', 'nodedb'), {
    nodes: [
      { id: '!f196051c', hops_away: 1, snr: -3, last_heard: sec('2026-11-28T10:00:00Z') },
      { id: '!e20c4c89', hops_away: 0, last_heard: sec('2026-11-28T11:00:00Z'), via_mqtt: true },
      { id: '!e20c4c89', last_heard: sec('2026-11-28T13:00:00Z') },
      { id: '!e20c4c89', last_heard: sec('2026-11-10T13:00:00Z') },
      { id: '!aaaaaaaa', last_heard: sec('2026-11-28T11:59:00Z') },
    ],
  });
  assert.deepEqual(r.credited, ['!f196051c']);
  const s = store.snapshot();
  assert.equal(site(s, '!f196051c').lastHeard, '2026-11-28T10:00:00.000Z');
  assert.equal(site(s, '!f196051c').status, 'up');
  assert.equal(site(s, '!e20c4c89').status, 'unseen');
});

test('gateway evidence newer than the feeder wins the label; feeder state survives a restart', () => {
  const now = clockAt('2026-11-28T12:00:00Z');
  const store = createStore({ infrastructure: INFRA, root: ROOT, now });
  store.ingestFeed(FEED('a', 'rx'), { from: '!e20c4c89', id: 9, snr: -2 });
  now.advance(60_000);
  store.ingest(`${ROOT}/2/e/LoCo-Chat/!3d506c26`, { packet: { from: 0xe20c4c89, id: 10, hopStart: 3, hopLimit: 3 } });
  assert.equal(site(store.snapshot(), '!e20c4c89').lastHeardSource, 'gateway');

  store.ingestFeed(FEED('a', 'rx'), { from: '!f196051c', id: 11, rssi: -120 });
  const copy = createStore({ infrastructure: INFRA, root: ROOT, now });
  assert.equal(copy.load(JSON.parse(JSON.stringify(store.serialize()))), true);
  const w = site(copy.snapshot(), '!f196051c');
  assert.equal(w.status, 'up');
  assert.equal(w.lastHeardSource, 'feeder');
});

test('subscriber subscribes to several filters in one packet; topic filters match like the broker', () => {
  const { packets } = splitPackets(subscribePacket(1, ['msh/US/SC/LoCo/#', 'locomesh/feed/+/rx']));
  assert.equal(packets.length, 1);
  assert.equal(packets[0].type, 8);
  const body = packets[0].body.toString('latin1');
  assert.match(body, /msh\/US\/SC\/LoCo\/#\x00/);
  assert.match(body, /locomesh\/feed\/\+\/rx\x00$/);
  // A single string still works.
  assert.equal(splitPackets(subscribePacket(1, 'a/#')).packets.length, 1);

  assert.equal(topicMatches('locomesh/feed/+/rx', 'locomesh/feed/starleaf/rx'), true);
  assert.equal(topicMatches('locomesh/feed/+/rx', 'locomesh/feed/starleaf/nodedb'), false);
  assert.equal(topicMatches('locomesh/feed/+/rx', 'locomesh/feed/a/b/rx'), false);
  assert.equal(topicMatches('locomesh/feed/#', 'locomesh/feed/a/b/rx'), true);
  assert.equal(topicMatches('locomesh/feed/+', 'locomesh/feed'), false);
});
