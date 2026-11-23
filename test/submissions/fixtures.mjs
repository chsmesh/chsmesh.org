// Hand-built image files for the submissions tests: structurally valid
// containers with fake pixel data, carrying the kinds of metadata a phone
// writes. Nothing decodes the pixels, so a few placeholder bytes are enough.

const u16be = (n) => Buffer.from([n >> 8, n & 0xff]);
const u32be = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const u32le = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

export const SECRETS = ['GPS-32.7765,-80.0298', 'xmp-owner-jordan', 'comment-home-address', 'thumbnail-bytes', 'TRAILING-PAYLOAD'];

const jpegSegment = (marker, payload) => Buffer.concat([Buffer.from([0xff, marker]), u16be(payload.length + 2), payload]);

// Little-endian Exif block: Orientation, a GPS IFD pointer, then the "GPS" data.
function exif(orientation) {
  const entry = (tag, type, value) => {
    const b = Buffer.alloc(12);
    b.writeUInt16LE(tag, 0);
    b.writeUInt16LE(type, 2);
    b.writeUInt32LE(1, 4);
    b.writeUInt32LE(value, 8);
    return b;
  };
  return Buffer.concat([
    Buffer.from('Exif\0\0', 'latin1'),
    Buffer.from('II*\0', 'latin1'),
    u32le(8),
    Buffer.from([2, 0]),
    entry(0x0112, 3, orientation),
    entry(0x8825, 4, 38),
    u32le(0),
    Buffer.from(SECRETS[0], 'latin1'),
  ]);
}

/** A baseline JPEG with EXIF (GPS, orientation), XMP, a comment, a JFXX thumbnail and bytes after EOI. */
export function jpeg({ width = 1600, height = 1200, orientation = 1, metadata = true } = {}) {
  const frame = Buffer.concat([Buffer.from([8]), u16be(height), u16be(width), Buffer.from([1, 1, 0x11, 0])]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])),
    ...(metadata
      ? [
          jpegSegment(0xe0, Buffer.from(`JFXX\0\x10${SECRETS[3]}`, 'latin1')),
          jpegSegment(0xe1, exif(orientation)),
          jpegSegment(0xe1, Buffer.from(`http://ns.adobe.com/xap/1.0/\0<x>${SECRETS[1]}</x>`, 'latin1')),
          jpegSegment(0xed, Buffer.from(`Photoshop 3.0\0${SECRETS[2]}`, 'latin1')),
          jpegSegment(0xfe, Buffer.from(SECRETS[2], 'latin1')),
        ]
      : []),
    jpegSegment(0xe2, Buffer.from('ICC_PROFILE\0\x01\x01profile', 'latin1')),
    jpegSegment(0xdb, Buffer.alloc(65, 1)),
    jpegSegment(0xc0, frame),
    jpegSegment(0xc4, Buffer.alloc(20, 2)),
    jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    // Entropy data with a stuffed 0xFF, a restart marker and a fill byte.
    Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xff, 0xd9]),
    ...(metadata ? [Buffer.from(SECRETS[4], 'latin1')] : []),
  ]);
}

const pngChunk = (type, data) => Buffer.concat([u32be(data.length), Buffer.from(type, 'latin1'), data, u32be(0)]);

/** A PNG with text, EXIF and time chunks, a private chunk and bytes after IEND. */
export function png({ width = 800, height = 600, animated = false } = {}) {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([u32be(width), u32be(height), Buffer.from([8, 2, 0, 0, 0])])),
    pngChunk('tEXt', Buffer.from(`Comment\0${SECRETS[2]}`, 'latin1')),
    pngChunk('iTXt', Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${SECRETS[1]}`, 'latin1')),
    pngChunk('eXIf', Buffer.from(SECRETS[0], 'latin1')),
    pngChunk('tIME', Buffer.alloc(7)),
    pngChunk('prVt', Buffer.from(SECRETS[3], 'latin1')),
    ...(animated ? [pngChunk('acTL', Buffer.alloc(8))] : []),
    pngChunk('pHYs', Buffer.alloc(9)),
    pngChunk('IDAT', Buffer.from([0x78, 0x9c, 1, 2, 3])),
    pngChunk('IEND', Buffer.alloc(0)),
    Buffer.from(SECRETS[4], 'latin1'),
  ]);
}

const riffChunk = (type, data) => Buffer.concat([Buffer.from(type, 'latin1'), u32le(data.length), data, Buffer.alloc(data.length % 2)]);

/** An extended-format WebP with EXIF and XMP chunks and their header flags set. */
export function webp({ width = 1024, height = 768, animated = false } = {}) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x08 | 0x04 | (animated ? 0x02 : 0);
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  const frame = Buffer.from([0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, width & 0xff, width >> 8, height & 0xff, height >> 8, 0xaa]);
  const body = Buffer.concat([
    riffChunk('VP8X', vp8x),
    riffChunk('VP8 ', frame),
    riffChunk('EXIF', Buffer.from(SECRETS[0], 'latin1')),
    riffChunk('XMP ', Buffer.from(SECRETS[1], 'latin1')),
    riffChunk('JUNK', Buffer.from(SECRETS[3], 'latin1')),
  ]);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), u32le(body.length + 4), Buffer.from('WEBP', 'latin1'), body, Buffer.from(SECRETS[4], 'latin1')]);
}
