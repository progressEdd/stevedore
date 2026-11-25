#!/usr/bin/env node
// audit-code-ink.mjs — per-slide code-ink auditor (02-FX4, VERIFICATION gap 4).
// Captures ONE slide through the production capture path — same flatten CSS,
// flags and viewport as export-slides.mjs (KEEP IN SYNC with its flatten
// block / capture hardening) — and reports the dark-pixel (luma<160) fraction
// inside the slide's code areas: the union rect of the slide's code-line
// boxes (converter decks: .pp-el boxes carrying ui-monospace spans; Marp
// decks: <pre> blocks).
// Usage:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node scripts/audit-code-ink.mjs <deck.html> <slideNumber 1-based> [outdir]
// Prints one JSON line: {slide, fraction, ink, total, rect, png?} and writes
// <outdir>/<NN>.png when outdir is given. Exit 0 unless the slide/rect is
// missing — the CALLER judges the fraction against its bar.

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inkFraction, loadPng } from './test/lib/ink.mjs';

const [html, slideArg, outdir] = process.argv.slice(2);
if (!html || !slideArg) {
  process.stderr.write('usage: node scripts/audit-code-ink.mjs <deck.html> <slideNumber> [outdir]\n');
  process.exit(2);
}
if (!process.env.STEVEDORE_CHROMIUM_PATH) {
  process.stderr.write('audit-code-ink: STEVEDORE_CHROMIUM_PATH is not set — run under nix shell nixpkgs#chromium\n');
  process.exit(2);
}
const { chromium } = createRequire(fileURLToPath(new URL('../vendor/PPTX2HTML/package.json', import.meta.url)))('playwright');

// (02-FX4) mirror of export-slides.mjs's post-fix capture state — keep in sync.
const FLATTEN = `
  svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
  .bespoke-marp-osc{display:none!important}
  .pp-slide{transform:none!important;margin:0!important}
  /* (02-FX4) see export-slides.mjs */
  .pp-text{position:relative}
`;

const browser = await chromium.launch({
  executablePath: process.env.STEVEDORE_CHROMIUM_PATH,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: FLATTEN });
const selector = await page.evaluate(() => document.querySelector('.pp-slide') ? '.pp-slide' : 'section');
const idx = Number(slideArg) - 1;

const rect = await page.evaluate(([sel, i]) => {
  const slide = document.querySelectorAll(sel)[i];
  if (!slide) return null;
  const s = slide.getBoundingClientRect();
  // (02-FX9) mono spans now carry Consolas stacks (or the keyword stack) —
  // match any mono-family span, not just the old ui-monospace signature.
  const cands = [...slide.querySelectorAll('.pp-el')].filter(el => el.querySelector('span[style*="monospace" i], span[style*="Consolas" i]'));
  const codeEls = cands.length ? cands : [...slide.querySelectorAll('pre')];
  if (!codeEls.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const el of codeEls) {
    const r = el.getBoundingClientRect();
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  return { x: x0 - s.left, y: y0 - s.top, w: x1 - x0, h: y1 - y0 };
}, [selector, idx]);
if (!rect) {
  process.stderr.write(`audit-code-ink: no code areas found on slide ${slideArg} (selector ${selector})\n`);
  process.exit(1);
}

let pngPath = null;
if (outdir) {
  mkdirSync(outdir, { recursive: true });
  pngPath = resolve(outdir, String(Number(slideArg)).padStart(2, '0') + '.png');
  const els = await page.locator(selector).all();
  await els[idx].screenshot({ path: pngPath });
}
const measured = pngPath ? inkFraction(loadPng(pngPath), rect) : { ink: null, total: null, fraction: null };
process.stdout.write(JSON.stringify({ slide: Number(slideArg), ...measured, rect, png: pngPath }) + '\n');
await browser.close();
