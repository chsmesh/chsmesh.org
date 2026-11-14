// Just enough Meshtastic protobuf decoding for the status service: the MQTT
// ServiceEnvelope, MeshPacket, Data, User, Position, Telemetry and MapReport
// messages, plus AES-CTR decryption with the public LongFast key. No
// dependencies; field numbers follow meshtastic/protobufs (mesh.proto,
// mqtt.proto, telemetry.proto).

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Protobuf wire format

/**
 * Split a protobuf message into its fields. Returns a Map of field number to
 * an array of raw values: varints as BigInt, fixed64/fixed32 and
 * length-delimited fields as Buffers. Throws on malformed input.
 */
export function readFields(buf) {
  const fields = new Map();
  let pos = 0;

  const varint = () => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (pos >= buf.length) throw new Error('truncated varint');
      const byte = buf[pos++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
      if (shift > 63n) throw new Error('varint too long');
    }
  };

  const take = (n) => {
    if (n < 0 || pos + n > buf.length) throw new Error('truncated field');
    const out = buf.subarray(pos, pos + n);
    pos += n;
    return out;
  };

  while (pos < buf.length) {
    const key = varint();
    const field = Number(key >> 3n);
    const wire = Number(key & 7n);
    if (field === 0) throw new Error('field number 0');
    let value;
    if (wire === 0) value = varint();
    else if (wire === 1) value = take(8);
    else if (wire === 2) value = take(Number(varint()));
    else if (wire === 5) value = take(4);
    else throw new Error(`unsupported wire type ${wire}`);
    if (!fields.has(field)) fields.set(field, []);
    fields.get(field).push(value);
  }
  return fields;
}

const last = (fields, n) => {
  const values = fields.get(n);
  return values ? values[values.length - 1] : undefined;
};

const asUint = (v) => (typeof v === 'bigint' ? Number(BigInt.asUintN(32, v)) : undefined);
// int32 fields are sign-extended to 64 bits on the wire.
const asInt = (v) => (typeof v === 'bigint' ? Number(BigInt.asIntN(32, v)) : undefined);
const asBool = (v) => (typeof v === 'bigint' ? v !== 0n : false);
const asFixed32 = (v) => (Buffer.isBuffer(v) && v.length === 4 ? v.readUInt32LE(0) : undefined);
const asSfixed32 = (v) => (Buffer.isBuffer(v) && v.length === 4 ? v.readInt32LE(0) : undefined);
const asFloat = (v) => (Buffer.isBuffer(v) && v.length === 4 ? v.readFloatLE(0) : undefined);
const asString = (v) => (Buffer.isBuffer(v) ? v.toString('utf8') : undefined);
const asBytes = (v) => (Buffer.isBuffer(v) ? v : undefined);

// ---------------------------------------------------------------------------
// Constants

export const PORTNUM = Object.freeze({
  TEXT_MESSAGE_APP: 1,
  POSITION_APP: 3,
  NODEINFO_APP: 4,
  ROUTING_APP: 5,
  TELEMETRY_APP: 67,
  TRACEROUTE_APP: 70,
  NEIGHBORINFO_APP: 71,
  MAP_REPORT_APP: 73,
});

export const ROLES = Object.freeze([
  'CLIENT', 'CLIENT_MUTE', 'ROUTER', 'ROUTER_CLIENT', 'REPEATER', 'TRACKER', 'SENSOR',
  'TAK', 'CLIENT_HIDDEN', 'LOST_AND_FOUND', 'TAK_TRACKER', 'ROUTER_LATE', 'CLIENT_BASE',
]);

export const roleName = (n) => (n === undefined ? null : ROLES[n] ?? `ROLE_${n}`);

/** The public default channel key ("AQ==" expanded), used by LongFast. */
export const DEFAULT_KEY = Buffer.from('d4f1bb3a20290759f0bcffabcf4e6901', 'hex');

export const nodeId = (num) => `!${(num >>> 0).toString(16).padStart(8, '0')}`;

// ---------------------------------------------------------------------------
// Messages

export function decodeData(buf) {
  const f = readFields(buf);
  return {
    portnum: asUint(last(f, 1)) ?? 0,
    payload: asBytes(last(f, 2)) ?? Buffer.alloc(0),
    wantResponse: asBool(last(f, 3)),
    requestId: asFixed32(last(f, 6)),
  };
}

export function decodeMeshPacket(buf) {
  const f = readFields(buf);
  const packet = {
    from: asFixed32(last(f, 1)) ?? 0,
    to: asFixed32(last(f, 2)) ?? 0,
    channel: asUint(last(f, 3)) ?? 0,
    id: asFixed32(last(f, 6)) ?? 0,
    rxTime: asFixed32(last(f, 7)),
    rxSnr: asFloat(last(f, 8)),
    hopLimit: asUint(last(f, 9)) ?? 0,
    wantAck: asBool(last(f, 10)),
    rxRssi: asInt(last(f, 12)),
    viaMqtt: asBool(last(f, 14)),
    hopStart: asUint(last(f, 15)) ?? 0,
    relayNode: asUint(last(f, 19)),
    decoded: null,
    encrypted: asBytes(last(f, 5)) ?? null,
  };
  const decoded = asBytes(last(f, 4));
  if (decoded) packet.decoded = decodeData(decoded);
  return packet;
}

export function decodeServiceEnvelope(buf) {
  const f = readFields(buf);
  const packet = asBytes(last(f, 1));
  return {
    packet: packet ? decodeMeshPacket(packet) : null,
    channelId: asString(last(f, 2)) ?? '',
    gatewayId: asString(last(f, 3)) ?? '',
  };
}

export function decodeUser(buf) {
  const f = readFields(buf);
  return {
    id: asString(last(f, 1)) ?? '',
    longName: asString(last(f, 2)) ?? '',
    shortName: asString(last(f, 3)) ?? '',
    hwModel: asUint(last(f, 5)) ?? 0,
    role: asUint(last(f, 7)) ?? 0,
  };
}

export function decodePosition(buf) {
  const f = readFields(buf);
  const latI = asSfixed32(last(f, 1));
  const lonI = asSfixed32(last(f, 2));
  return {
    lat: latI ? latI / 1e7 : null,
    lon: lonI ? lonI / 1e7 : null,
    altitude: asInt(last(f, 3)) ?? null,
    precisionBits: asUint(last(f, 23)) ?? null,
  };
}

export function decodeTelemetry(buf) {
  const f = readFields(buf);
  const out = { time: asFixed32(last(f, 1)) ?? null, device: null, local: null };
  const device = asBytes(last(f, 2));
  if (device) {
    const d = readFields(device);
    out.device = {
      batteryLevel: asUint(last(d, 1)) ?? null,
      voltage: asFloat(last(d, 2)) ?? null,
      channelUtilization: asFloat(last(d, 3)) ?? null,
      airUtilTx: asFloat(last(d, 4)) ?? null,
      uptimeSeconds: asUint(last(d, 5)) ?? null,
    };
  }
  const local = asBytes(last(f, 6));
  if (local) {
    const l = readFields(local);
    out.local = {
      channelUtilization: asFloat(last(l, 2)) ?? null,
      airUtilTx: asFloat(last(l, 3)) ?? null,
      numOnlineNodes: asUint(last(l, 7)) ?? null,
      noiseFloor: asInt(last(l, 15)) ?? null,
    };
  }
  return out;
}

export function decodeMapReport(buf) {
  const f = readFields(buf);
  const latI = asSfixed32(last(f, 9));
  const lonI = asSfixed32(last(f, 10));
  return {
    longName: asString(last(f, 1)) ?? '',
    shortName: asString(last(f, 2)) ?? '',
    role: asUint(last(f, 3)) ?? 0,
    hwModel: asUint(last(f, 4)) ?? 0,
    firmwareVersion: asString(last(f, 5)) ?? '',
    lat: latI ? latI / 1e7 : null,
    lon: lonI ? lonI / 1e7 : null,
    positionPrecision: asUint(last(f, 12)) ?? null,
    numOnlineLocalNodes: asUint(last(f, 13)) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Decryption

/**
 * Decrypt a packet's payload with a channel key (AES-CTR; the nonce is the
 * packet id as a little-endian u64 followed by the sender's node number).
 * Returns the decoded Data, or null when the key does not fit: a wrong key
 * yields bytes that fail to parse or carry no plausible port number.
 */
export function decryptPacket(packet, key = DEFAULT_KEY) {
  if (!packet?.encrypted?.length) return null;
  if (key.length !== 16 && key.length !== 32) return null;
  const nonce = Buffer.alloc(16);
  nonce.writeUInt32LE(packet.id >>> 0, 0);
  nonce.writeUInt32LE(packet.from >>> 0, 8);
  const decipher = crypto.createDecipheriv(key.length === 16 ? 'aes-128-ctr' : 'aes-256-ctr', key, nonce);
  const plain = Buffer.concat([decipher.update(packet.encrypted), decipher.final()]);
  try {
    const data = decodeData(plain);
    if (data.portnum < 1 || data.portnum > 511) return null;
    return data;
  } catch {
    return null;
  }
}
