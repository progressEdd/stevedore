// ink.mjs — dark-pixel ("ink") fraction of a rect inside a decoded PNG.
// pngjs comes from the vendored PPTX2HTML toolchain (decision 13), loaded
// lazily so suites without scripts/setup-roundtrip.sh never import it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const VENDOR_PKG = resolve(fileURLToPath(new URL('../../../vendor/PPTX2HTML/package.json', import.meta.url)));

export function loadPng(path) {
  const { PNG } = createRequire(VENDOR_PKG)('pngjs');
  return PNG.sync.read(readFileSync(path));
}

// png: decoded {width, height, data(RGBA)}; rect: {x, y, w, h} in px;
// threshold: rec.701 luma below which a pixel counts as ink.
export function inkFraction(png, rect, threshold = 160) {
  const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(png.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(png.height, Math.ceil(rect.y + rect.h));
  let ink = 0, total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (png.width * y + x) * 4;
    const luma = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    if (luma < threshold) ink++;
    total++;
  }
  return { ink, total, fraction: total ? ink / total : 0 };
}

// CLI: node scripts/test/lib/ink.mjs <file.png> <x> <y> <w> <h> [threshold] — prints the fraction.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, x, y, w, h, t] = process.argv.slice(2);
  const { fraction } = inkFraction(loadPng(file), { x: +x, y: +y, w: +w, h: +h }, t ? +t : 160);
  process.stdout.write(fraction.toFixed(5) + '\n');
}
