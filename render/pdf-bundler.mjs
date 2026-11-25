// render/pdf-bundler.mjs — zero-dependency whole-deck PDF over deterministic
// PNG captures (phase 03, decisions 2+4): pure IDAT passthrough (the img2pdf
// approach — 03-RESEARCH Q1, PoC-validated with qpdf 12.4.2 + poppler). A
// PNG's concatenated IDAT payloads are a zlib stream of PNG-filtered
// scanlines; PDF FlateDecode with PNG predictors (PDF 32000-1 §7.4.4.3)
// decodes that byte-compatibly, so the IDAT bytes are embedded verbatim —
// no re-encode. Page geometry (decision 4): fixed 7.5in (540pt) page height,
// width = 540pt × the PNG's aspect (16:9 → 960×540pt = 13.33×7.5in; 4:3 →
// 720×540pt = 10×7.5in — PowerPoint's standard sizes); the image exactly
// fills its page (aspect derives from the same capture, so it is an exact
// fill — no letterboxing). No /Info, no timestamps, no object streams: the
// output is a pure function of the input bytes — byte-identical across runs,
// matching the PNGs' own determinism doctrine.
// Supported input: color type 2 (truecolor RGB), bit depth 8, non-interlaced
// — exactly what playwright element captures emit (verified at
// deviceScaleFactor 1 and 2 on both deck shapes). Anything else throws with
// a diagnostic instead of guessing. CRCs are not re-verified (inputs are
// fresh captures from our own exporter; structure is walked, not validated).
//
// Library: import { pngsToPdf, parsePng } from './pdf-bundler.mjs'
// CLI: node render/pdf-bundler.mjs <01.png> [<02.png> …] > deck.pdf

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const enc = (s) => Buffer.from(s, 'latin1');

export function parsePng(buf) {
  if (buf.length < 8 + 25 || !buf.subarray(0, 8).equals(PNG_SIG))
    throw new Error('pdf-bundler: not a PNG (signature mismatch)');
  const png = { width: 0, height: 0, bitDepth: 0, colorType: 0, interlace: 0, idat: [] };
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    if (off + 12 + len > buf.length) throw new Error('pdf-bundler: truncated PNG chunk');
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      png.width = data.readUInt32BE(0);
      png.height = data.readUInt32BE(4);
      png.bitDepth = data[8];
      png.colorType = data[9];
      png.interlace = data[12];
    } else if (type === 'IDAT') png.idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  png.idat = Buffer.concat(png.idat);
  return png;
}

function assertPassthroughPng(png, file) {
  if (png.colorType !== 2)
    throw new Error(`pdf-bundler: ${file}: PNG color type ${png.colorType} is not truecolor RGB (2) — passthrough supports opaque RGB only; re-capture or re-encode first`);
  if (png.bitDepth !== 8)
    throw new Error(`pdf-bundler: ${file}: bit depth ${png.bitDepth} is not 8 — unsupported`);
  if (png.interlace !== 0)
    throw new Error(`pdf-bundler: ${file}: interlaced PNG — unsupported`);
  if (png.idat.length === 0)
    throw new Error(`pdf-bundler: ${file}: no IDAT chunks — corrupt PNG`);
}

// PDF real number: up to 2 decimals, trailing zeros stripped (960, 720.75).
function fmtNum(x) {
  const s = x.toFixed(2).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

// Whole-deck PDF from PNG paths, in order. Returns a Buffer.
export function pngsToPdf(paths) {
  const pngs = paths.map((p) => {
    const png = parsePng(readFileSync(p));
    assertPassthroughPng(png, p);
    return png;
  });
  if (pngs.length === 0) throw new Error('pdf-bundler: no PNGs to bundle');
  const N = pngs.length;
  const count = 2 + 3 * N;                       // catalog + pages + 3 per slide
  const offsets = new Array(count + 1).fill(0);  // offsets[objNum], 1-based
  const parts = [];
  let pos = 0;
  const push = (chunk) => { parts.push(chunk); pos += chunk.length; };
  const pushObj = (num, body) => {
    offsets[num] = pos;
    push(enc(`${num} 0 obj\n`));
    for (const c of body) push(c);
    push(enc('endobj\n'));
  };

  push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));   // binary comment marks the file binary
  pushObj(1, [enc('<< /Type /Catalog /Pages 2 0 R >>\n')]);
  const kids = pngs.map((_, i) => `${5 + 3 * i} 0 R`);
  pushObj(2, [enc(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${N} >>\n`)]);
  for (let i = 0; i < N; i++) {
    const png = pngs[i];
    const pageW = fmtNum((540 * png.width) / png.height);  // 7.5in height fixed
    // image XObject — the IDAT bytes verbatim as the FlateDecode stream
    pushObj(3 + 3 * i, [
      enc(`<< /Type /XObject /Subtype /Image /Width ${png.width} /Height ${png.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${png.width} >> /Length ${png.idat.length} >>\nstream\n`),
      png.idat,
      enc('\nendstream\n'),
    ]);
    // content stream — unit-square image scaled to the full page box
    const content = `q ${pageW} 0 0 540 0 0 cm /Im0 Do Q\n`;
    pushObj(4 + 3 * i, [
      enc(`<< /Length ${content.length} >>\nstream\n`),
      enc(content),
      enc('endstream\n'),
    ]);
    // page — MediaBox follows this PNG's aspect
    pushObj(5 + 3 * i, [
      enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} 540] /Resources << /XObject << /Im0 ${3 + 3 * i} 0 R >> >> /Contents ${4 + 3 * i} 0 R >>\n`),
    ]);
  }
  const xrefPos = pos;
  let xref = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= count; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(enc(xref));
  push(enc(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`));
  return Buffer.concat(parts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    process.stderr.write('Usage: node render/pdf-bundler.mjs <01.png> [<02.png> …] > deck.pdf\n');
    process.exit(2);
  }
  process.stdout.write(pngsToPdf(paths));
}
