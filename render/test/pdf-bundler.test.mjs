// pdf-bundler tests (03-02): pure-function coverage — chunk parsing, IHDR
// validation diagnostics, exact object set, xref offsets, verbatim IDAT
// passthrough, byte determinism, page geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePng, pngsToPdf } from '../pdf-bundler.mjs';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
  return out;
}
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// minimal PNG: w×h, filter-0 scanlines, solid fill; returns { buf, rows } so
// tests can prove the IDAT inflates back to exactly these scanlines.
function buildPng({ w, h, colorType = 2, bitDepth = 8, interlace = 0, fill = [255, 0, 0] }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = bitDepth; ihdr[9] = colorType; ihdr[12] = interlace;
  const bpp = colorType === 6 ? 4 : 3;
  const rows = Buffer.alloc((1 + w * bpp) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w * bpp; x++) rows[y * (1 + w * bpp) + 1 + x] = fill[x % bpp];
  return { buf: Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]), rows };
}

const tmp = mkdtempSync(join(tmpdir(), 'pdf-bundler-'));
let seq = 0;
function writeTmp(buf) {
  const p = join(tmp, `f${++seq}.png`);
  writeFileSync(p, buf);
  return p;
}

const png16x9 = buildPng({ w: 64, h: 36 });   // 540×64/36  = 960pt page
const png4x3 = buildPng({ w: 64, h: 48 });    // 540×64/48  = 720pt page

test('parsePng reads IHDR fields and concatenates IDAT', () => {
  const png = parsePng(png16x9.buf);
  assert.equal(png.width, 64);
  assert.equal(png.height, 36);
  assert.equal(png.colorType, 2);
  assert.equal(png.bitDepth, 8);
  assert.equal(png.interlace, 0);
  assert.ok(png.idat.length > 0);
  assert.ok(inflateSync(png.idat).equals(png16x9.rows), 'IDAT inflates to the exact scanlines');
});

test('rejects non-passthrough profiles with diagnostics', () => {
  assert.throws(() => parsePng(Buffer.from('definitely not a png')), /signature/);
  assert.throws(() => pngsToPdf([writeTmp(buildPng({ w: 2, h: 2, colorType: 6 }).buf)]), /color type 6 .*truecolor RGB/);
  assert.throws(() => pngsToPdf([writeTmp(buildPng({ w: 2, h: 2, bitDepth: 16 }).buf)]), /bit depth 16/);
  assert.throws(() => pngsToPdf([writeTmp(buildPng({ w: 2, h: 2, interlace: 1 }).buf)]), /interlaced/);
  assert.throws(() => pngsToPdf([]), /no PNGs/);
});

test('PDF scaffolding: header, trailer, object set, no metadata', () => {
  const s = pngsToPdf([writeTmp(png16x9.buf), writeTmp(png4x3.buf)]).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4\n%'), 'header + binary comment');
  assert.ok(s.endsWith('%%EOF\n'));
  assert.ok(s.includes('<< /Type /Catalog /Pages 2 0 R >>'));
  assert.ok(s.includes('/Kids [5 0 R 8 0 R]'));
  assert.ok(s.includes('/Count 2'));
  assert.ok(s.includes('/Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns 64'), 'PNG predictors declared');
  assert.ok(!s.includes('/Info'), 'no Info dict — determinism');
  assert.ok(!s.includes('/CreationDate'));
});

test('page geometry: 7.5in (540pt) height fixed, width follows each PNG aspect, image fills the page', () => {
  const s = pngsToPdf([writeTmp(png16x9.buf), writeTmp(png4x3.buf)]).toString('latin1');
  assert.ok(s.includes('/MediaBox [0 0 960 540]'), '16:9 page (13.33×7.5in)');
  assert.ok(s.includes('/MediaBox [0 0 720 540]'), '4:3 page (10×7.5in)');
  assert.ok(s.includes('q 960 0 0 540 0 0 cm /Im0 Do Q'), '16:9 content fills the page');
  assert.ok(s.includes('q 720 0 0 540 0 0 cm /Im0 Do Q'), '4:3 content fills the page');
});

test('xref table: every offset points at its own `N 0 obj`', () => {
  const pdf = pngsToPdf([writeTmp(png16x9.buf), writeTmp(png4x3.buf)]);
  const s = pdf.toString('latin1');
  const m = /xref\n0 (\d+)\n/.exec(s);
  assert.ok(m, 'xref header found');
  const count = Number(m[1]) - 1;
  assert.equal(count, 8, '2 slides → 8 objects (catalog, pages, 3 per slide)');
  const lines = s.slice(m.index).split('\n');
  // lines[0]='xref', lines[1]='0 N+1', lines[2]=free entry, lines[2+n]=object n
  for (let n = 1; n <= count; n++) {
    const entry = lines[2 + n];
    assert.match(entry, /^\d{10} 00000 n $/, `xref entry ${n} well-formed (20 bytes)`);
    const off = Number(entry.slice(0, 10));
    assert.ok(pdf.toString('latin1', off, off + 12).startsWith(`${n} 0 obj`),
      `offset for object ${n} points at \`${n} 0 obj\``);
  }
});

test('IDAT passthrough: the image stream bytes ARE the source PNG IDAT, verbatim', () => {
  const idat = parsePng(png16x9.buf).idat;
  const pdf = pngsToPdf([writeTmp(png16x9.buf)]);
  assert.ok(pdf.indexOf(idat) !== -1, 'embedded stream == source IDAT bytes, no re-encode');
});

test('byte-deterministic: same inputs → identical output', () => {
  const paths = [writeTmp(png16x9.buf), writeTmp(png4x3.buf)];
  assert.ok(pngsToPdf(paths).equals(pngsToPdf(paths)));
});

test('CLI: no args -> exit 2 with usage', () => {
  const r = spawnSync(process.execPath, ['render/pdf-bundler.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage: node render\/pdf-bundler\.mjs/);
});
