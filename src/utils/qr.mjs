// Build-time QR codes, drawn as one SVG path so they stay sharp in the guide
// PDFs and need no script in the browser.
import qrcode from 'qrcode-generator';

/** Modules of quiet zone the QR specification asks for on every side. */
const QUIET_ZONE = 4;

/**
 * Encode `text` as a QR code.
 *
 * Returns the side length of the symbol in modules, quiet zone included, and
 * the path data for its dark modules on that grid.
 */
export function qrPath(text) {
  // Type 0 picks the smallest symbol that fits. Level M survives a scuffed
  // print or a dim screen without making the code much denser.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { size: count + QUIET_ZONE * 2, d };
}
