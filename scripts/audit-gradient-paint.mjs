#!/usr/bin/env node
// audit-gradient-paint.mjs — per-element gradient-visibility auditor
// (02-FX7, VERIFICATION addendum #4 gap 7). Census every <img class="pp-img">
// on ONE slide of a round-trip deck (kind, gradient-ness from the decoded
// SVG payload, rect, decode state), then measures a TOGGLE-DIFF per gradient
// image: mean absolute per-channel pixel delta inside the image's own rect
// between a capture with the element painted and one with visibility:hidden.
// The gradient VISIBLY paints iff meanDelta >= THRESHOLD (0.5, calibrated:
// the deterministic capture's noise floor measures 0.000 — a fully covered
// gradient toggles at exactly 0 — while the weakest half-panel overlay,
// painting above the content it covers, toggles at 0.883; the plan's
// original 2.0 bar was calibrated on the reference's full dual-gradient
// +screen effect, which the exported single-gradient non-blended artifact
// class cannot reach — the reference itself in export-equivalent form
// measures 1.659/2.363) — the luma<160 "ink" metric cannot detect these
// overlays (light translucent gradients over dark panels lighten; they do
// not darken). elementsFromPoint at each
// gradient's sample point records what actually paints ON TOP of it.
// Optional reference.html argument: sanity-checks the reference's own
// ::after gradient overlays via injected CSS (background:none) — they must
// visibly paint on the reference side (meanDelta >= THRESHOLD there too).
// Prints one JSON line; exit 0 iff every gradient image painted.
// Usage:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node scripts/audit-gradient-paint.mjs <roundtrip.html> <slide#> [reference.html] [stevedoreRoot]
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [rtHtml, slideArg, refHtml, rootArg] = process.argv.slice(2);
if (!rtHtml || !slideArg) {
  process.stderr.write('usage: node scripts/audit-gradient-paint.mjs <roundtrip.html> <slide#> [reference.html] [stevedoreRoot]\n');
  process.exit(2);
}
if (!process.env.STEVEDORE_CHROMIUM_PATH) {
  process.stderr.write('audit-gradient-paint: STEVEDORE_CHROMIUM_PATH is not set — run under nix shell nixpkgs#chromium\n');
  process.exit(2);
}
const root = resolve(rootArg ?? fileURLToPath(new URL('..', import.meta.url)));
const req = createRequire(resolve(root, 'vendor/PPTX2HTML/package.json'));
const { chromium } = req('playwright');
const { PNG } = req('pngjs');

// (02-FX7) mirror of export-slides.mjs's capture state — keep in sync.
const FLATTEN = `
  svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
  .bespoke-marp-osc{display:none!important}
  .pp-slide{transform:none!important;margin:0!important}
  .pp-text{position:relative}
`;

const THRESHOLD = 0.5; // (02-FX7) calibrated — see header comment; noise floor 0.000, weakest painted overlay 0.883

function meanDelta(a, b, rect) {
  const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(a.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(a.height, Math.ceil(rect.y + rect.h));
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (a.width * y + x) * 4;
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    n++;
  }
  return n ? +(sum / (3 * n)).toFixed(3) : null;
}

const browser = await chromium.launch({
  executablePath: process.env.STEVEDORE_CHROMIUM_PATH,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
try {
  const scratch = mkdtempSync(join(tmpdir(), 'stevedore-fx7-'));
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve(rtHtml)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: FLATTEN });
  const sel = '.pp-slide';
  const idx = Number(slideArg) - 1;
  const els = await page.locator(sel).all();
  if (!els[idx]) { process.stderr.write(`audit-gradient-paint: no slide ${slideArg}\n`); process.exit(1); }

  const census = await page.evaluate(([s, i]) => {
    const slide = document.querySelectorAll(s)[i];
    const base = slide.getBoundingClientRect();
    return [...slide.querySelectorAll('img.pp-img')].map((img, g) => {
      const r = img.getBoundingClientRect();
      let kind = 'other', gradient = false;
      const m = /^data:image\/(svg\+xml|png);base64,(.*)$/.exec(img.src);
      if (m) {
        kind = m[1] === 'svg+xml' ? 'svg' : 'png';
        if (kind === 'svg') { try { gradient = atob(m[2]).includes('Gradient'); } catch { gradient = false; } }
      }
      return { g, kind, gradient, complete: img.complete, natural: [img.naturalWidth, img.naturalHeight],
        rect: { x: +(r.left - base.left).toFixed(1), y: +(r.top - base.top).toFixed(1),
                w: +r.width.toFixed(1), h: +r.height.toFixed(1) } };
    });
  }, [sel, idx]);

  const aPath = join(scratch, 'slide-a.png');
  await els[idx].screenshot({ path: aPath });
  const pngA = PNG.sync.read(readFileSync(aPath));

  const gradients = [];
  for (const c of census) {
    const stack = await page.evaluate(([s, i, g]) => {
      const slide = document.querySelectorAll(s)[i];
      const img = [...slide.querySelectorAll('img.pp-img')][g];
      const r = img.getBoundingClientRect();
      const x = Math.min(Math.max(r.left + r.width / 2, r.left + 1), r.right - 1);
      const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 30), r.top + 1), r.bottom - 1);
      const cls = (e) => {
        const c = typeof e.className === 'string' ? e.className : (e.className && e.className.baseVal) || '';
        return e.tagName + (c ? '.' + c.split(' ').join('.') : '');
      };
      return document.elementsFromPoint(x, y).slice(0, 4).map(cls);
    }, [sel, idx, c.g]);
    if (!c.gradient) { gradients.push({ ...c, stack, skipped: 'not a gradient image' }); continue; }
    await page.evaluate(([s, i, g]) => {
      [...document.querySelectorAll(s)[i].querySelectorAll('img.pp-img')][g].style.visibility = 'hidden';
    }, [sel, idx, c.g]);
    const bPath = join(scratch, `slide-b-${c.g}.png`);
    await els[idx].screenshot({ path: bPath });
    await page.evaluate(([s, i, g]) => {
      [...document.querySelectorAll(s)[i].querySelectorAll('img.pp-img')][g].style.visibility = '';
    }, [sel, idx, c.g]);
    const mean = meanDelta(pngA, PNG.sync.read(readFileSync(bPath)), c.rect);
    gradients.push({ ...c, stack, meanDelta: mean, painted: mean != null && mean >= THRESHOLD });
  }

  let refOverlays = null;
  if (refHtml) {
    const page2 = await context.newPage();
    await page2.goto(pathToFileURL(resolve(refHtml)).href, { waitUntil: 'networkidle' });
    await page2.evaluate(() => document.fonts.ready);
    await page2.addStyleTag({ content: FLATTEN });
    const rels = await page2.locator('section').all();
    const ra = join(scratch, 'ref-a.png');
    await rels[idx].screenshot({ path: ra });
    await page2.addStyleTag({ content: '.vs-side.left::after,.vs-side.right::after{background:none!important}' });
    const rb = join(scratch, 'ref-b.png');
    await rels[idx].screenshot({ path: rb });
    const A = PNG.sync.read(readFileSync(ra)), B = PNG.sync.read(readFileSync(rb));
    refOverlays = {
      left: meanDelta(A, B, { x: 0, y: 60, w: 640, h: 660 }),
      right: meanDelta(A, B, { x: 640, y: 60, w: 640, h: 660 }),
    };
    refOverlays.sanity = refOverlays.left >= THRESHOLD && refOverlays.right >= THRESHOLD;
    await page2.close();
  }

  const gate = gradients.filter(g => g.gradient);
  const allPainted = gate.length > 0 && gate.every(g => g.painted);
  process.stdout.write(JSON.stringify({ slide: Number(slideArg), threshold: THRESHOLD, gradients, refOverlays, allPainted }) + '\n');
  process.exit(allPainted ? 0 : 1);
} finally {
  await browser.close();
}
