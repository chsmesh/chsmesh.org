// Photo sanitising for the submissions service. Pure, no I/O, no dependencies.
//
// A photo of a rooftop install taken on a phone carries the GPS position of
// someone's home in its EXIF block, and this repository is public. The site's
// form re-encodes photos in the browser, which already drops metadata, but the
// endpoint is callable by anyone, so the service is the trust boundary: every
// accepted image is rebuilt here from an allow-list of the segments or chunks
// a decoder needs. EXIF, XMP, IPTC, comments, embedded thumbnails and anything
// after the end-of-image marker are left behind.
//
// The pixel data is not re-encoded (that would need a native image library),
// so the type is confirmed from the file's structure, never from a file name
// or a declared content type.

const fail = (message) => {
  throw new Error(message);
};

const startsWith = (buf, offset, ascii) =>
  buf.length >= offset + ascii.length && buf.toString('latin1', offset, offset + ascii.length) === ascii;

// ---------------------------------------------------------------------------
// JPEG

// Read the Orientation tag out of an Exif APP1 payload. Dropping EXIF would
// otherwise turn every photo taken with the phone held upright on its side.
function exifOrientation(payload) {
  try {
    if (!startsWith(payload, 0, 'Exif\0\0')) return 1;
    const tiff = payload.subarray(6);
    const order = tiff.toString('latin1', 0, 2);
    if (order !== 'II' && order !== 'MM') return 1;
    const le = order === 'II';
    const u16 = (at) => (le ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
    const u32 = (at) => (le ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
    if (u16(2) !== 42) return 1;
    const ifd = u32(4);
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : 1;
      }
    }
  } catch {
    // Out-of-range offsets in a malformed block: treat as no orientation.
  }
  return 1;
}

// A minimal Exif APP1 segment holding only the Orientation tag.
function orientationSegment(orientation) {
  return Buffer.from([
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation SHORT
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
}

function keepJpegSegment(marker, payload) {
  if (marker === 0xfe) return false; // COM
  if (marker < 0xe0 || marker > 0xef) return true; // tables, frame and scan headers
  // APPn: keep only what changes how the pixels decode.
  if (marker === 0xe0) return startsWith(payload, 0, 'JFIF\0') && payload.length === 14; // no thumbnail
  if (marker === 0xe2) return startsWith(payload, 0, 'ICC_PROFILE\0');
  if (marker === 0xee) return startsWith(payload, 0, 'Adobe');
  return false;
}

function sanitizeJpeg(buf) {
  const out = [buf.subarray(0, 2)];
  let pos = 2;
  let width = 0;
  let height = 0;
  let orientation = 1;
  let scans = 0;
  for (;;) {
    if (pos + 2 > buf.length || buf[pos] !== 0xff) fail('is not a complete JPEG');
    const marker = buf[pos + 1];
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    if (marker === 0xd9) {
      out.push(buf.subarray(pos, pos + 2));
      break; // anything after EOI is dropped
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    if (pos + 4 > buf.length) fail('is not a complete JPEG');
    const length = buf.readUInt16BE(pos + 2);
    const end = pos + 2 + length;
    if (length < 2 || end > buf.length) fail('is not a complete JPEG');
    const payload = buf.subarray(pos + 4, end);
    const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (payload.length < 5) fail('is not a complete JPEG');
      height = payload.readUInt16BE(1);
      width = payload.readUInt16BE(3);
    }
    if (marker === 0xe1 && orientation === 1) orientation = exifOrientation(payload);
    if (keepJpegSegment(marker, payload)) out.push(buf.subarray(pos, end));
    pos = end;
    if (marker === 0xda) {
      // Entropy-coded data runs to the next real marker: 0xFF followed by
      // anything but a stuffed zero, a restart marker or a fill byte.
      scans += 1;
      const start = pos;
      for (;;) {
        pos = buf.indexOf(0xff, pos);
        if (pos === -1 || pos + 1 >= buf.length) fail('is not a complete JPEG');
        const next = buf[pos + 1];
        if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7)) break;
        pos += next === 0xff ? 1 : 2;
      }
      out.push(buf.subarray(start, pos));
    }
  }
  if (!scans || !width || !height) fail('is not a complete JPEG');
  if (orientation !== 1) {
    // After the JFIF header when there is one, where decoders expect it.
    const at = out.length > 1 && out[1][1] === 0xe0 ? 2 : 1;
    out.splice(at, 0, orientationSegment(orientation));
  }
  // Orientations 5-8 are rotated a quarter turn when displayed.
  const turned = orientation >= 5;
  return { type: 'jpeg', ext: 'jpg', bytes: Buffer.concat(out), width: turned ? height : width, height: turned ? width : height };
}

// ---------------------------------------------------------------------------
// PNG

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Critical chunks plus the ancillary ones that affect rendering. Text (tEXt,
// zTXt, iTXt), eXIf, tIME and any private chunk are dropped.
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'pHYs', 'cICP']);

function sanitizePng(buf) {
  const out = [PNG_SIGNATURE];
  let pos = 8;
  let width = 0;
  let height = 0;
  let hasData = false;
  for (;;) {
    if (pos + 12 > buf.length) fail('is not a complete PNG');
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const end = pos + 12 + length;
    if (end > buf.length) fail('is not a complete PNG');
    if (pos === 8) {
      if (type !== 'IHDR' || length !== 13) fail('is not a complete PNG');
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
    }
    if (type === 'acTL') fail('is animated; send a still photo');
    if (type === 'IDAT') hasData = true;
    if (PNG_KEEP.has(type)) out.push(buf.subarray(pos, end));
    if (type === 'IEND') break; // anything after IEND is dropped
    pos = end;
  }
  if (!hasData || !width || !height) fail('is not a complete PNG');
  return { type: 'png', ext: 'png', bytes: Buffer.concat(out), width, height };
}

// ---------------------------------------------------------------------------
// WebP

function sanitizeWebp(buf) {
  const declaredEnd = Math.min(buf.length, 8 + buf.readUInt32LE(4));
  const out = [];
  let pos = 12;
  let width = 0;
  let height = 0;
  let hasData = false;
  while (pos + 8 <= declaredEnd) {
    const type = buf.toString('latin1', pos, pos + 4);
    const length = buf.readUInt32LE(pos + 4);
    const end = pos + 8 + length;
    if (end > declaredEnd) fail('is not a complete WebP');
    const data = buf.subarray(pos + 8, end);
    // Chunks are padded to an even length.
    const padded = Buffer.concat([buf.subarray(pos, end), Buffer.alloc(length % 2)]);
    if (type === 'VP8X') {
      if (length < 10) fail('is not a complete WebP');
      if (data[0] & 0x02) fail('is animated; send a still photo');
      padded[8] &= ~0x0c; // clear the "has EXIF" and "has XMP" flags
      width = 1 + data.readUIntLE(4, 3);
      height = 1 + data.readUIntLE(7, 3);
      out.push(padded);
    } else if (type === 'VP8 ') {
      if (length < 10 || data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) fail('is not a complete WebP');
      width ||= data.readUInt16LE(6) & 0x3fff;
      height ||= data.readUInt16LE(8) & 0x3fff;
      hasData = true;
      out.push(padded);
    } else if (type === 'VP8L') {
      if (length < 5 || data[0] !== 0x2f) fail('is not a complete WebP');
      const bits = data.readUInt32LE(1);
      width ||= (bits & 0x3fff) + 1;
      height ||= ((bits >>> 14) & 0x3fff) + 1;
      hasData = true;
      out.push(padded);
    } else if (type === 'ALPH' || type === 'ICCP') {
      out.push(padded);
    }
    // EXIF, XMP and unknown chunks are dropped.
    pos = end + (length % 2);
  }
  if (!hasData || !width || !height) fail('is not a complete WebP');
  const body = Buffer.concat(out);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return { type: 'webp', ext: 'webp', bytes: Buffer.concat([header, body]), width, height };
}

// ---------------------------------------------------------------------------

/**
 * Rebuild `buf` (a JPEG, PNG or WebP file) without its metadata.
 * Returns `{ type, ext, bytes, width, height }`, with the dimensions as
 * displayed. Throws an Error whose message completes "photo N ..." when the
 * bytes are not a whole, still image of one of those types.
 */
export function sanitizeImage(buf) {
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return sanitizeJpeg(buf);
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return sanitizePng(buf);
  if (startsWith(buf, 0, 'RIFF') && startsWith(buf, 8, 'WEBP')) return sanitizeWebp(buf);
  return fail('must be a JPEG, PNG or WebP image');
}
