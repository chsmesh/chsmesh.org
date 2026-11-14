import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { MqttSubscriber, splitPackets, parsePublish, connectPacket } from '../../services/status/mqtt.mjs';

function publishPacket(topic, payload, qos = 0, packetId = 7) {
  const t = Buffer.from(topic);
  const parts = [Buffer.from([t.length >> 8, t.length & 0xff]), t];
  if (qos) parts.push(Buffer.from([packetId >> 8, packetId & 0xff]));
  parts.push(payload);
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30 | (qos << 1), body.length]), body]);
}

test('packet framing handles partial reads and multi-byte lengths', () => {
  const big = Buffer.alloc(300, 1);
  const p = Buffer.concat([Buffer.from([0x30, 0xac, 0x02]), big]); // remaining length 300
  const half = splitPackets(p.subarray(0, 100));
  assert.equal(half.packets.length, 0);
  assert.equal(half.rest.length, 100);
  const whole = splitPackets(Buffer.concat([p, Buffer.from([0xd0, 0x00])]));
  assert.equal(whole.packets.length, 2);
  assert.equal(whole.packets[0].body.length, 300);
  assert.equal(whole.packets[1].type, 13);
});

test('publish parsing reads topic, QoS and payload', () => {
  const pkt = publishPacket('a/b', Buffer.from('xyz'), 1, 0x0102);
  const { packets } = splitPackets(pkt);
  const msg = parsePublish(packets[0].flags, packets[0].body);
  assert.equal(msg.topic, 'a/b');
  assert.equal(msg.qos, 1);
  assert.equal(msg.packetId, 0x0102);
  assert.equal(msg.payload.toString(), 'xyz');
});

test('connect packet carries credentials and a clean session', () => {
  const p = connectPacket({ clientId: 'c', username: 'u', password: 'p', keepalive: 60 });
  assert.equal(p[0], 0x10);
  const flags = p[2 + 6 + 1];
  assert.equal(flags & 0xc2, 0xc2);
});

test('subscriber connects, subscribes and delivers messages from a broker', async () => {
  let seenConnect = null;
  let seenSubscribe = null;
  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { packets, rest } = splitPackets(buf);
      buf = Buffer.from(rest);
      for (const p of packets) {
        if (p.type === 1) {
          seenConnect = p.body;
          sock.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
        } else if (p.type === 8) {
          seenSubscribe = p.body;
          sock.write(Buffer.from([0x90, 0x03, p.body[0], p.body[1], 0x00]));
          sock.write(publishPacket('msh/US/SC/LoCo/2/e/LongFast/!12345678', Buffer.from([1, 2, 3])));
        }
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const sub = new MqttSubscriber({ url: `mqtt://127.0.0.1:${port}`, username: 'chsmesh-status', password: 'pw', topic: 'msh/US/SC/LoCo/#' });
  const got = new Promise((resolve) => sub.on('message', (topic, payload) => resolve({ topic, payload })));
  sub.start();
  const { topic, payload } = await got;
  sub.stop();
  server.close();

  assert.equal(topic, 'msh/US/SC/LoCo/2/e/LongFast/!12345678');
  assert.deepEqual([...payload], [1, 2, 3]);
  assert.ok(seenConnect.includes(Buffer.from('chsmesh-status')));
  assert.ok(seenSubscribe.includes(Buffer.from('msh/US/SC/LoCo/#')));
  assert.equal(sub.messages, 1);
});

test('a malformed PUBLISH is reported and the connection retried rather than thrown', async () => {
  let connects = 0;
  const server = net.createServer((sock) => {
    sock.on('error', () => {});
    sock.on('data', (chunk) => {
      const type = chunk[0] >> 4;
      if (type === 1) {
        connects++;
        sock.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
      } else if (type === 8) {
        sock.write(Buffer.from([0x90, 0x03, chunk[2], chunk[3], 0x00]));
        sock.write(Buffer.from([0x30, 0x01, 0x00])); // PUBLISH too short for its topic length
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const sub = new MqttSubscriber({ url: `mqtt://127.0.0.1:${port}`, topic: 't/#', minBackoffMs: 20, maxBackoffMs: 40 });
  const errors = [];
  let messages = 0;
  sub.on('error', (e) => errors.push(e.message));
  sub.on('message', () => messages++);
  sub.start();
  await new Promise((r) => setTimeout(r, 300));
  sub.stop();
  server.close();
  assert.ok(errors.some((m) => /malformed PUBLISH/.test(m)));
  assert.equal(messages, 0);
  assert.ok(connects >= 2, 'it reconnects after dropping the connection');
});

test('a refused login is reported and retried rather than thrown', async () => {
  let attempts = 0;
  const server = net.createServer((sock) => {
    sock.on('data', () => {
      attempts++;
      sock.write(Buffer.from([0x20, 0x02, 0x00, 0x05])); // not authorized
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const sub = new MqttSubscriber({ url: `mqtt://127.0.0.1:${port}`, topic: 't/#', minBackoffMs: 20, maxBackoffMs: 40 });
  const errors = [];
  sub.on('error', (e) => errors.push(e.message));
  sub.start();
  await new Promise((r) => setTimeout(r, 300));
  sub.stop();
  server.close();
  assert.ok(errors.some((m) => /not authorized/.test(m)));
  assert.ok(attempts >= 2, 'it reconnects after a refusal');
  assert.equal(sub.connected, false);
});
