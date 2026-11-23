// Guards the local mesh settings card: the channel link (and so the QR code)
// in src/content/global/mesh.md has to carry the same channels the card lists
// in words, because the CMS edits the two separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qrPath } from '../../src/utils/qr.mjs';

const source = readFileSync(new URL('../../src/content/global/mesh.md', import.meta.url), 'utf8');
const frontmatter = source.split(/^---$/m)[1];

/** Strip the quotes YAML allows around a scalar. */
const scalar = (value) => value.trim().replace(/^(['"])(.*)\1$/, '$2');

/** The `channels:` list as [{ name, key }], read without a YAML parser. */
function listedChannels() {
  const block = frontmatter.match(/^channels:\n((?: .*\n)+)/m)?.[1] ?? '';
  return block
    .split(/^  - /m)
    .slice(1)
    .map((item) => ({
      name: scalar(item.match(/^\s*name:(.*)$/m)[1]),
      key: scalar(item.match(/^\s*key:(.*)$/m)[1]),
    }));
}

const shareUrl = () => scalar(frontmatter.match(/^  url:(.*)$/m)[1]);

/** Fields of one protobuf message as [number, wireType, value]. */
function fields(bytes) {
  const out = [];
  let at = 0;
  const varint = () => {
    let value = 0;
    let shift = 0;
    for (;;) {
      const byte = bytes[at++];
      value += (byte & 0x7f) * 2 ** shift;
      if (!(byte & 0x80)) return value;
      shift += 7;
    }
  };
  while (at < bytes.length) {
    const tag = varint();
    const wireType = tag & 7;
    if (wireType === 0) out.push([tag >> 3, wireType, varint()]);
    else if (wireType === 2) {
      const length = varint();
      out.push([tag >> 3, wireType, bytes.subarray(at, at + length)]);
      at += length;
    } else if (wireType === 5) {
      out.push([tag >> 3, wireType, bytes.subarray(at, at + 4)]);
      at += 4;
    } else throw new Error(`unexpected wire type ${wireType}`);
  }
  return out;
}

/** Decode a meshtastic.org/e/ link: a base64url ChannelSet after the #. */
function decodeChannelUrl(url) {
  const set = fields(Buffer.from(new URL(url).hash.slice(1), 'base64url'));
  const channels = set
    .filter(([number]) => number === 1) // ChannelSet.settings
    .map(([, , bytes]) => {
      const settings = fields(bytes);
      const psk = settings.find(([number]) => number === 2)?.[2] ?? Buffer.alloc(0);
      const name = settings.find(([number]) => number === 3)?.[2] ?? Buffer.alloc(0);
      return { name: Buffer.from(name).toString('utf8'), key: Buffer.from(psk).toString('base64') };
    });
  const lora = fields(set.find(([number]) => number === 2)?.[2] ?? Buffer.alloc(0)); // ChannelSet.lora_config
  const value = (number) => lora.find(([n]) => n === number)?.[2] ?? 0;
  return { channels, usePreset: value(1), modemPreset: value(2), region: value(7), hopLimit: value(8) };
}

test('the channel link carries the channels the card lists, in order', () => {
  const listed = listedChannels();
  assert.ok(listed.length > 0, 'expected at least one channel in mesh.md');
  const { channels } = decodeChannelUrl(shareUrl());
  // A channel with the default key and no name is shown as the preset's name.
  const named = channels.map((channel) => ({
    name: channel.name || (channel.key === 'AQ==' ? 'LongFast' : ''),
    key: channel.key,
  }));
  assert.deepEqual(named, listed);
});

test('the channel link sets the US region, the LongFast preset and 3 hops', () => {
  const link = decodeChannelUrl(shareUrl());
  assert.equal(link.region, 1, 'region US');
  assert.equal(link.usePreset, 1, 'use a modem preset');
  assert.equal(link.modemPreset, 0, 'LONG_FAST');
  assert.equal(link.hopLimit, 3);
});

test('the QR code keeps its quiet zone and encodes dark modules', () => {
  const { size, d } = qrPath(shareUrl());
  assert.ok(size >= 21 + 8);
  assert.match(d, /^(M\d+ \d+h1v1h-1z)+$/);
  assert.doesNotMatch(d, /M[0-3] /, 'no module inside the left quiet zone');
});
