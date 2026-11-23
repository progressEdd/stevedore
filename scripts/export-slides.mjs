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
//     node scripts/export-slides.mjs deck.html -o outdir
//
// Usage: node scripts/export-slides.mjs <deck.html> -o <outdir>
//          [--selector <css>] [--width 1280] [--height 720]
// Selector auto-detect: `.pp-slide` if the deck has one, else `section`.

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const pad2 = (n) => String(n).padStart(2, '0');

export function parseArgs(argv) {
  const a = { width: 1280, height: 720, selector: null, html: null, out: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-o') a.out = argv[++i];
    else if (argv[i] === '--selector') a.selector = argv[++i];
    else if (argv[i] === '--width') a.width = Number(argv[++i]);
    else if (argv[i] === '--height') a.height = Number(argv[++i]);
    else rest.push(argv[i]);
  }
  a.html = rest[0] ?? null;
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.html || !args.out) {
    process.stderr.write('Usage: node scripts/export-slides.mjs <deck.html> -o <outdir> [--selector css] [--width 1280] [--height 720]\n');
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
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve(args.html)).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);   // webfonts settle before capture
    const selector = args.selector ?? await page.evaluate(() =>
      document.querySelector('.pp-slide') ? '.pp-slide' : 'section');
    const els = await page.locator(selector).all();
    if (els.length === 0) {
      process.stderr.write(`export-slides: no elements match ${selector} in ${args.html}\n`);
      process.exit(1);
    }
    mkdirSync(args.out, { recursive: true });
    for (let i = 0; i < els.length; i++)
      await els[i].screenshot({ path: resolve(args.out, `${pad2(i + 1)}.png`) });
    process.stdout.write(`exported ${els.length} slides (${selector}) -> ${args.out}\n`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
