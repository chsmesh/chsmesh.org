// Minimal MQTT 3.1.1 subscriber: connect (TCP or TLS), authenticate, subscribe
// to one topic filter at QoS 0, receive PUBLISH packets, keep the connection
// alive and reconnect with backoff. That is all the status service needs, so
// it carries no dependencies.

import net from 'node:net';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';

const TYPE = { CONNECT: 1, CONNACK: 2, PUBLISH: 3, PUBACK: 4, SUBSCRIBE: 8, SUBACK: 9, PINGREQ: 12, PINGRESP: 13, DISCONNECT: 14 };

const CONNACK_ERRORS = {
  1: 'unacceptable protocol version',
  2: 'client identifier rejected',
  3: 'server unavailable',
  4: 'bad user name or password',
  5: 'not authorized',
};

function encodeLength(n) {
  const out = [];
  do {
    let byte = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) byte |= 0x80;
    out.push(byte);
  } while (n > 0);
  return Buffer.from(out);
}

function encodeString(s) {
  const body = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length, 0);
  return Buffer.concat([len, body]);
}

function packet(firstByte, ...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([firstByte]), encodeLength(body.length), body]);
}

export function connectPacket({ clientId, username, password, keepalive }) {
  let flags = 0x02; // clean session
  if (username) flags |= 0x80;
  if (password) flags |= 0x40;
  const header = Buffer.concat([encodeString('MQTT'), Buffer.from([4, flags, keepalive >> 8, keepalive & 0xff])]);
  const payload = [encodeString(clientId)];
  if (username) payload.push(encodeString(username));
  if (password) payload.push(encodeString(password));
  return packet(TYPE.CONNECT << 4, header, ...payload);
}

export function subscribePacket(packetId, topic) {
  const id = Buffer.from([packetId >> 8, packetId & 0xff]);
  return packet((TYPE.SUBSCRIBE << 4) | 0x02, id, encodeString(topic), Buffer.from([0]));
}

/**
 * Pull complete MQTT packets off the front of a buffer. Returns
 * { packets: [{ type, flags, body }], rest } where rest is the unconsumed tail.
 */
export function splitPackets(buf) {
  const packets = [];
  let pos = 0;
  while (buf.length - pos >= 2) {
    let len = 0;
    let mult = 1;
    let i = pos + 1;
    let complete = false;
    for (let n = 0; n < 4 && i < buf.length; n++, i++) {
      len += (buf[i] & 0x7f) * mult;
      mult *= 128;
      if ((buf[i] & 0x80) === 0) {
        complete = true;
        i++;
        break;
      }
    }
    if (!complete) {
      if (i - pos - 1 >= 4) throw new Error('malformed remaining length');
      break;
    }
    if (buf.length < i + len) break;
    packets.push({ type: buf[pos] >> 4, flags: buf[pos] & 0x0f, body: buf.subarray(i, i + len) });
    pos = i + len;
  }
  return { packets, rest: buf.subarray(pos) };
}

export function parsePublish(flags, body) {
  const qos = (flags >> 1) & 0x03;
  const topicLen = body.readUInt16BE(0);
  const topic = body.subarray(2, 2 + topicLen).toString('utf8');
  let pos = 2 + topicLen;
  let packetId = null;
  if (qos > 0) {
    packetId = body.readUInt16BE(pos);
    pos += 2;
  }
  return { topic, qos, packetId, payload: body.subarray(pos) };
}

/**
 * Events: 'connect', 'message' (topic, payload), 'close' (reason), 'error' (err).
 * Errors are reported and followed by a reconnect; they never throw.
 */
export class MqttSubscriber extends EventEmitter {
  constructor({ url, username = '', password = '', topic, clientId, keepalive = 60, minBackoffMs = 2000, maxBackoffMs = 60000, tlsOptions = {} }) {
    super();
    this.url = new URL(url);
    this.username = username;
    this.password = password;
    this.topic = topic;
    this.clientId = clientId ?? `chsmesh-status-${Math.random().toString(16).slice(2, 10)}`;
    this.keepalive = keepalive;
    this.minBackoffMs = minBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
    this.tlsOptions = tlsOptions;
    this.backoff = minBackoffMs;
    this.connected = false;
    this.stopped = false;
    this.socket = null;
    this.timers = [];
    this.lastConnectedAt = null;
    this.messages = 0;
  }

  start() {
    this.stopped = false;
    this.#open();
    return this;
  }

  stop() {
    this.stopped = true;
    this.#teardown('stopped');
  }

  #open() {
    const secure = this.url.protocol === 'mqtts:';
    const host = this.url.hostname;
    const port = Number(this.url.port) || (secure ? 8883 : 1883);
    const socket = secure
      ? tls.connect({ host, port, servername: host, ...this.tlsOptions })
      : net.connect({ host, port });
    this.socket = socket;
    let buffer = Buffer.alloc(0);
    let lastRx = Date.now();

    socket.once(secure ? 'secureConnect' : 'connect', () => {
      socket.write(connectPacket({ clientId: this.clientId, username: this.username, password: this.password, keepalive: this.keepalive }));
    });

    socket.on('data', (chunk) => {
      lastRx = Date.now();
      buffer = Buffer.concat([buffer, chunk]);
      let split;
      try {
        split = splitPackets(buffer);
      } catch (err) {
        this.emit('error', err);
        socket.destroy();
        return;
      }
      buffer = Buffer.from(split.rest);
      for (const p of split.packets) this.#handle(p, socket);
    });

    socket.on('error', (err) => this.emit('error', err));
    socket.on('close', () => {
      if (this.socket === socket) this.#teardown('connection closed');
    });

    // PINGREQ at half the keepalive; give up if the broker goes silent.
    const ping = setInterval(() => {
      if (!this.connected) return;
      if (Date.now() - lastRx > this.keepalive * 1500) {
        this.emit('error', new Error('broker stopped responding'));
        socket.destroy();
        return;
      }
      socket.write(Buffer.from([TYPE.PINGREQ << 4, 0]));
    }, (this.keepalive * 1000) / 2);
    ping.unref?.();
    // A connection that never gets its CONNACK is abandoned too.
    const connectTimeout = setTimeout(() => {
      if (!this.connected) {
        this.emit('error', new Error('timed out waiting for CONNACK'));
        socket.destroy();
      }
    }, 20000);
    connectTimeout.unref?.();
    this.timers = [ping, connectTimeout];
  }

  #handle({ type, flags, body }, socket) {
    if (type === TYPE.CONNACK) {
      const rc = body[1];
      if (rc !== 0) {
        this.emit('error', new Error(`broker refused connection: ${CONNACK_ERRORS[rc] ?? `code ${rc}`}`));
        socket.destroy();
        return;
      }
      this.connected = true;
      this.backoff = this.minBackoffMs;
      this.lastConnectedAt = new Date().toISOString();
      socket.write(subscribePacket(1, this.topic));
      this.emit('connect');
    } else if (type === TYPE.SUBACK) {
      if (body[body.length - 1] === 0x80) this.emit('error', new Error(`subscription to ${this.topic} was refused`));
    } else if (type === TYPE.PUBLISH) {
      const msg = parsePublish(flags, body);
      if (msg.qos === 1) socket.write(Buffer.from([TYPE.PUBACK << 4, 2, msg.packetId >> 8, msg.packetId & 0xff]));
      this.messages++;
      this.emit('message', msg.topic, msg.payload);
    }
  }

  #teardown(reason) {
    for (const t of this.timers) {
      clearInterval(t);
      clearTimeout(t);
    }
    this.timers = [];
    const wasConnected = this.connected;
    this.connected = false;
    const socket = this.socket;
    this.socket = null;
    if (socket && !socket.destroyed) {
      try {
        if (wasConnected) socket.write(Buffer.from([TYPE.DISCONNECT << 4, 0]));
      } catch {}
      socket.destroy();
    }
    this.emit('close', reason);
    if (this.stopped) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, this.maxBackoffMs);
    const retry = setTimeout(() => this.#open(), delay);
    retry.unref?.();
    this.timers.push(retry);
  }
}
