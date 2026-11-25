#!/usr/bin/env node
// Deterministic per-slide PNG export for HTML decks (phase 02, decisions 7+13).
// Screenshots every slide element at a fixed viewport so the reference and
// round-trip sides are captured by ONE tool — apples to apples (the old
// exports were ad-hoc captures at mixed zooms; 02-RESEARCH Q4).
//
// Driver: playwright (decision 13 — same driver as PPTX2HTML's proven
// playwright+pngjs deterministic-PNG verify pattern), loaded from the
// vendored PPTX2HTML toolchain (devDeps installed by scripts/setup-roundtrip.sh).
// Bundled browser downloads are NEVER used (NixOS): chromium comes from
// nixpkgs and is passed via executablePath:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node render/export-slides.mjs deck.html -o outdir
//
// Usage: node render/export-slides.mjs <deck.html> -o <outdir>
//          [--selector <css>] [--width 1280] [--height 720]
//          [--scale <n>] [--pdf]
// --scale <n>: capture deviceScaleFactor — output pixels = ceil(slide CSS
//   rect) × n (a 1280×720 deck at --scale 2 → 2560×1440). At non-default
//   scale the viewport auto-tracks the deck's natural CSS size unless
//   --width/--height was passed, so viewport-scaled deck shapes (Marp
//   sections) capture at exactly natural × n. Default 1 — the phase-02
//   capture recipe, unchanged (witness byte-stability).
// --pdf: also write <outdir>/deck.pdf — whole-deck, one page per slide,
//   7.5in-height pages (width = 540pt × slide aspect), the PNGs embedded
//   verbatim (render/pdf-bundler.mjs). Sharpness follows the PNG resolution.
// Selector auto-detect: `.pp-slide` if the deck has one, else `section`.
//
// Determinism = fixed tool + fixed viewport + fixed flags; it does NOT
// promise byte-identical PNGs across runs (chromium antialiasing may vary) —
// never gate on byte equality.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pngsToPdf } from './pdf-bundler.mjs';

export const pad2 = (n) => String(n).padStart(2, '0');

export function parseArgs(argv) {
  const a = { width: 1280, height: 720, scale: 1, pdf: false, viewportExplicit: false, selector: null, html: null, out: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-o') a.out = argv[++i];
    else if (argv[i] === '--selector') a.selector = argv[++i];
    else if (argv[i] === '--width') { a.width = Number(argv[++i]); a.viewportExplicit = true; }
    else if (argv[i] === '--height') { a.height = Number(argv[++i]); a.viewportExplicit = true; }
    else if (argv[i] === '--scale') a.scale = Number(argv[++i]);
    else if (argv[i] === '--pdf') a.pdf = true;
    else rest.push(argv[i]);
  }
  a.html = rest[0] ?? null;
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.html || !args.out) {
    process.stderr.write('Usage: node render/export-slides.mjs <deck.html> -o <outdir> [--selector css] [--width 1280] [--height 720] [--scale 1] [--pdf]\n');
    process.exit(2);
  }
  if (!(args.scale > 0)) {
    process.stderr.write(`export-slides: --scale must be a positive number (got ${args.scale})\n`);
    process.exit(2);
  }
  if (!process.env.STEVEDORE_CHROMIUM_PATH) {
    process.stderr.write('export-slides: STEVEDORE_CHROMIUM_PATH is not set — run under nix shell nixpkgs#chromium (see header)\n');
    process.exit(2);
  }
  // playwright from the vendored PPTX2HTML toolchain (decision 13) — no
  // installs beyond scripts/setup-roundtrip.sh, no bundled browser downloads
  const here = fileURLToPath(new URL('.', import.meta.url));
  const vendorPkg = resolve(here, '../vendor/PPTX2HTML/package.json');
  let chromium;
  try { ({ chromium } = createRequire(vendorPkg)('playwright')); }
  catch {
    process.stderr.write('export-slides: playwright not found under vendor/PPTX2HTML — run scripts/setup-roundtrip.sh first\n');
    process.exit(2);
  }

  const browser = await chromium.launch({
    executablePath: process.env.STEVEDORE_CHROMIUM_PATH,   // nixpkgs chromium — never a bundled download
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: args.width, height: args.height },
      deviceScaleFactor: args.scale,   // default 1 — phase-02 recipe; opt-in scale multiplies output px
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve(args.html)).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);   // webfonts settle before capture
    // Capture-mode flatten: both deck shapes ship presentation chrome that
    // fights element capture at a fixed viewport. The Marp bespoke viewer
    // hides inactive slides (opacity:0, content-visibility:hidden, absolute
    // stacking) and paints on-screen controls; our converter's fit-scaler
    // shrinks slides to the browser window (scale(var(--pp-k)) + margins).
    // Neutralize both so every slide renders as a plain viewport-sized box —
    // each rule only matches its own deck shape (no-op on the other side).
    await page.addStyleTag({ content: `
      svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
      .bespoke-marp-osc{display:none!important}
      .pp-slide{transform:none!important;margin:0!important}
      /* (02-FX4) Converter shape+text boxes emit the fill svg as a POSITIONED
         sibling (position:absolute) and .pp-text as static — positioned boxes
         paint in CSS 2.1 App E step 8, above static content (steps 4–7), so
         opaque shape fills (code-slide line tints) covered their own text in
         every capture. position:relative moves .pp-text into the positioned
         phase in TREE ORDER: above its own shape's fill (PowerPoint paints a
         shape's text above its fill), below later shapes (spTree z-order
         preserved). Marp decks have no .pp-text — no-op on the reference side. */
      .pp-text{position:relative}
    ` });
    const selector = args.selector ?? await page.evaluate(() =>
      document.querySelector('.pp-slide') ? '.pp-slide' : 'section');
    const els = await page.locator(selector).all();
    if (els.length === 0) {
      process.stderr.write(`export-slides: no elements match ${selector} in ${args.html}\n`);
      process.exit(1);
    }
    // Resolution knob (03-02): at non-default scale, track the viewport to
    // the deck's natural CSS size (unless the caller pinned it with
    // --width/--height) so viewport-scaled shapes — Marp sections inside a
    // 100vw/100vh svg — capture at exactly natural × scale instead of
    // letterboxing/shrinking in the 1280×720 default viewport. Fixed-px
    // .pp-slide decks are viewport-independent (captureBeyondViewport), so
    // this is belt-and-braces there. Default path (scale 1): no evaluate,
    // no resize — the capture recipe is byte-identical to phase 02.
    if (args.scale !== 1 && !args.viewportExplicit) {
      const natural = await page.evaluate(() => {
        const vb = document.querySelector('svg[data-marpit-svg]')?.getAttribute('viewBox');
        if (vb) {
          const m = /^[\d.]+ [\d.]+ (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$/.exec(vb.trim());
          if (m) return { w: Math.round(+m[1]), h: Math.round(+m[2]) };
        }
        const el = document.querySelector('.pp-slide');
        if (el) return { w: el.offsetWidth, h: el.offsetHeight };
        return null;
      });
      if (natural) await page.setViewportSize({ width: natural.w, height: natural.h });
    }
    mkdirSync(args.out, { recursive: true });
    for (let i = 0; i < els.length; i++)
      await els[i].screenshot({ path: resolve(args.out, `${pad2(i + 1)}.png`) });
    if (args.pdf) {
      // Whole-deck PDF (03-02, decisions 2+4): bundle the just-written PNGs —
      // read-back so the proven screenshot-to-path loop stays byte-untouched.
      writeFileSync(resolve(args.out, 'deck.pdf'), pngsToPdf(els.map((_, i) => resolve(args.out, `${pad2(i + 1)}.png`))));
    }
    process.stdout.write(`exported ${els.length} slides (${selector}) -> ${args.out}${args.pdf ? ' (+ deck.pdf)' : ''}\n`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
