import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeImage } from '../../services/submissions/images.mjs';
import { SECRETS, jpeg, png, webp } from './fixtures.mjs';

const leaks = (bytes) => SECRETS.filter((secret) => bytes.includes(secret));

test('fixtures really carry the metadata the sanitiser is meant to remove', () => {
  assert.equal(leaks(jpeg()).length, SECRETS.length);
  assert.deepEqual(leaks(png()), SECRETS);
  assert.equal(leaks(webp()).length, 4);
});

test('JPEG: EXIF, XMP, IPTC, comments, thumbnails and trailing bytes are removed', () => {
  const result = sanitizeImage(jpeg());
  assert.deepEqual({ type: result.type, ext: result.ext, width: result.width, height: result.height }, { type: 'jpeg', ext: 'jpg', width: 1600, height: 1200 });
  assert.deepEqual(leaks(result.bytes), []);
  assert.ok(!result.bytes.includes('Exif'), 'an upright photo keeps no Exif block at all');
  // What a decoder needs is kept, in order, byte for byte.
  assert.deepEqual(result.bytes, jpeg({ metadata: false }));
  assert.ok(result.bytes.includes('ICC_PROFILE'));
  assert.deepEqual([...result.bytes.subarray(-2)], [0xff, 0xd9]);
});

test('JPEG: the orientation survives as the only Exif tag', () => {
  const result = sanitizeImage(jpeg({ width: 4000, height: 3000, orientation: 6 }));
  assert.deepEqual(leaks(result.bytes), []);
  // Displayed dimensions: orientation 6 is a quarter turn.
  assert.deepEqual([result.width, result.height], [3000, 4000]);
  // Segment order: SOI, JFIF, then a 34-byte Exif APP1.
  assert.deepEqual([...result.bytes.subarray(20, 24)], [0xff, 0xe1, 0x00, 0x22]);
  // Sanitising the result finds the same orientation and changes nothing.
  const again = sanitizeImage(result.bytes);
  assert.deepEqual(again.bytes, result.bytes);
  assert.deepEqual([again.width, again.height], [3000, 4000]);
});

test('PNG: text, EXIF, time and private chunks and trailing bytes are removed', () => {
  const result = sanitizeImage(png());
  assert.deepEqual({ type: result.type, ext: result.ext, width: result.width, height: result.height }, { type: 'png', ext: 'png', width: 800, height: 600 });
  assert.deepEqual(leaks(result.bytes), []);
  for (const kept of ['IHDR', 'pHYs', 'IDAT', 'IEND']) assert.ok(result.bytes.includes(kept), `${kept} is kept`);
  for (const dropped of ['tEXt', 'iTXt', 'eXIf', 'tIME', 'prVt']) assert.ok(!result.bytes.includes(dropped), `${dropped} is dropped`);
  assert.deepEqual(sanitizeImage(result.bytes).bytes, result.bytes);
});

test('WebP: EXIF and XMP chunks are removed and their header flags cleared', () => {
  const result = sanitizeImage(webp());
  assert.deepEqual({ type: result.type, ext: result.ext, width: result.width, height: result.height }, { type: 'webp', ext: 'webp', width: 1024, height: 768 });
  assert.deepEqual(leaks(result.bytes), []);
  assert.equal(result.bytes.readUInt32LE(4), result.bytes.length - 8, 'RIFF size matches the rebuilt file');
  assert.equal(result.bytes.toString('latin1', 12, 16), 'VP8X');
  assert.equal(result.bytes[20] & 0x0c, 0, 'EXIF and XMP flags are cleared');
  assert.deepEqual(sanitizeImage(result.bytes).bytes, result.bytes);
});

test('anything that is not a whole still JPEG, PNG or WebP is refused', () => {
  const refused = (bytes, pattern) => assert.throws(() => sanitizeImage(bytes), pattern);
  refused(Buffer.from('GIF89a' + 'x'.repeat(40), 'latin1'), /must be a JPEG, PNG or WebP/);
  refused(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'), /must be a JPEG, PNG or WebP/);
  refused(Buffer.alloc(0), /must be a JPEG, PNG or WebP/);
  // Truncated at every length: never a crash, never an accepted file.
  for (const whole of [jpeg({ metadata: false }), png().subarray(0, png().length - SECRETS[4].length - 12), webp()]) {
    for (let length = 4; length < whole.length - 1; length += 7) {
      let result;
      try {
        result = sanitizeImage(whole.subarray(0, length));
      } catch (error) {
        assert.match(error.message, /is not a complete|must be a JPEG/, `length ${length}: ${error.message}`);
        continue;
      }
      // A WebP cut inside the metadata that follows its image data is still whole.
      assert.equal(result.type, 'webp', `truncated ${result.type} of ${length} bytes was accepted`);
    }
  }
  refused(png({ animated: true }), /animated/);
  refused(webp({ animated: true }), /animated/);
  // A JPEG header with no image data behind it.
  refused(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), /not a complete JPEG/);
});
