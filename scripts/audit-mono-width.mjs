#!/usr/bin/env node
// audit-mono-width.mjs — code-font width-probe auditor (02-FX9).
// VERIFICATION addendum #5 gap 10. Extracts the ACTUAL computed
// font-family of a deck's code spans on one slide and measures the
// rendered width of the metric-sensitive glyph run "iiiwww" (narrow i's +
// wide w's — maximally font-class-sensitive) under that stack at a fixed
// 16px, calibrated in the same page against 'sans-serif' and 'monospace'.
// The stack RESOLVES monospace iff its measured width is closer to the
// monospace width than to the sans-serif width. This is the probe that
// convicted the gap: on nix chromium ui-monospace resolves to nothing and
// the old emission `'ui-monospace', <theme>, sans-serif` fell through to
// proportional sans ("iiiwww" 45.3px = the sans class; monospace 47.0,
// Consolas 57.8 — absolute values are probe-size-dependent; the comparison
// is same-page and host-independent). Deck shapes: converter decks
// (.pp-slide) pick the first span whose inline style carries a mono stack;
// Marp decks (section) use pre>code.
// Usage:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node scripts/audit-mono-width.mjs <deck.html> <slide#> [stevedoreRoot]
// Prints one JSON line {slide, family, familyWidth, sansWidth, monoWidth,
// monoClass}; exit 0 iff monoClass; exit 1 if no code span is found.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [html, slideArg, rootArg] = process.argv.slice(2);
if (!html || !slideArg) {
  process.stderr.write('usage: node scripts/audit-mono-width.mjs <deck.html> <slide#> [stevedoreRoot]\n');
  process.exit(2);
}
if (!process.env.STEVEDORE_CHROMIUM_PATH) {
  process.stderr.write('audit-mono-width: STEVEDORE_CHROMIUM_PATH is not set — run under nix shell nixpkgs#chromium\n');
  process.exit(2);
}
const root = resolve(rootArg ?? fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = createRequire(resolve(root, 'vendor/PPTX2HTML/package.json'))('playwright');

const browser = await chromium.launch({
  executablePath: process.env.STEVEDORE_CHROMIUM_PATH,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const family = await page.evaluate(([i]) => {
    const slides = document.querySelector('.pp-slide')
      ? document.querySelectorAll('.pp-slide') : document.querySelectorAll('section');
    const slide = slides[i];
    if (!slide) return null;
    // converter decks: inline-styled code spans (self-contained HTML);
    // Marp decks: pre>code carries the code stack (FX6's selector chain)
    const span = slide.querySelector('span[style*="monospace" i], span[style*="Consolas" i]');
    const el = span ?? slide.querySelector('pre code') ?? slide.querySelector('pre');
    return el ? getComputedStyle(el).fontFamily : null;
  }, [Number(slideArg) - 1]);
  if (!family) {
    process.stderr.write(`audit-mono-width: no code spans found on slide ${slideArg}\n`);
    process.exit(1);
  }
  const m = await page.evaluate((fam) => {
    const measure = (ff) => {
      const s = document.createElement('span');
      s.style.cssText = `position:absolute;left:-9999px;top:0;font-size:16px;font-family:${ff};white-space:pre`;
      s.textContent = 'iiiwww';
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return +w.toFixed(3);
    };
    return { familyWidth: measure(fam), sansWidth: measure('sans-serif'), monoWidth: measure('monospace') };
  }, family);
  const monoClass = Math.abs(m.familyWidth - m.monoWidth) < Math.abs(m.familyWidth - m.sansWidth);
  process.stdout.write(JSON.stringify({ slide: Number(slideArg), family, ...m, monoClass }) + '\n');
  process.exit(monoClass ? 0 : 1);
} finally {
  await browser.close();
}
