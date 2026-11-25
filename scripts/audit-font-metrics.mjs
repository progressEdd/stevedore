#!/usr/bin/env node
// audit-font-metrics.mjs — reference-vs-round-trip text-metrics A/B probe
// (02-FX6, VERIFICATION addendum #4 gap 6). Probes ONE slide's code areas on
// BOTH decks through the production capture state (same flatten CSS, launch
// flags and 1280×720 viewport as render/export-slides.mjs — KEEP IN SYNC),
// diffs the computed styles + line-box geometry, and pairs tracked
// (letter-spacing) leaf elements by text. Exit 0 iff the fixable metric
// classes match within tolerance.
//   reference (Marp) side: pre>code block spans (.del/.add/.ctx are
//     display:block — each span IS one line box)
//   round-trip side: .pp-el boxes carrying ui-monospace spans
// Tolerances (fixable classes): fontSize 0.2px, style letterSpacing 0.05px,
// lineHeight 0.2px, fontWeight exact, tracked pairs 0.05px. Line pitch /
// first-line geometry are RECORDED but never gate — that drift class is the
// standing per-line-layout defer (decision 8).
// Usage:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node scripts/audit-font-metrics.mjs <reference.html> <roundtrip.html> <slide#> [stevedoreRoot]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [refHtml, rtHtml, slideArg, rootArg] = process.argv.slice(2);
if (!refHtml || !rtHtml || !slideArg) {
  process.stderr.write('usage: node scripts/audit-font-metrics.mjs <reference.html> <roundtrip.html> <slide#> [stevedoreRoot]\n');
  process.exit(2);
}
if (!process.env.STEVEDORE_CHROMIUM_PATH) {
  process.stderr.write('audit-font-metrics: STEVEDORE_CHROMIUM_PATH is not set — run under nix shell nixpkgs#chromium\n');
  process.exit(2);
}
const root = resolve(rootArg ?? fileURLToPath(new URL('..', import.meta.url)));
const { chromium } = createRequire(resolve(root, 'vendor/PPTX2HTML/package.json'))('playwright');

// (02-FX6) mirror of export-slides.mjs's capture state — keep in sync.
const FLATTEN = `
  svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
  .bespoke-marp-osc{display:none!important}
  .pp-slide{transform:none!important;margin:0!important}
  .pp-text{position:relative}
`;

const px = (s) => parseFloat(s); // 'normal' -> NaN, callers handle

async function probe(browser, html, slideNo) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: FLATTEN });
  const selector = await page.evaluate(() => document.querySelector('.pp-slide') ? '.pp-slide' : 'section');
  const data = await page.evaluate(([sel, i]) => {
    const slide = document.querySelectorAll(sel)[i];
    if (!slide) return { error: 'no slide at index ' + i };
    const isRt = !!slide.querySelector('.pp-el');
    let lines = [];
    let styleEl = null;
    let overflow = 0; // vertical: re-wrapped text taller than its fixed-height box
    if (isRt) {
      const boxes = [...slide.querySelectorAll('.pp-el')].filter(el => el.querySelector('span[style*="ui-monospace"]'));
      lines = boxes.map(el => {
        const r = el.getBoundingClientRect();
        const span = el.querySelector('span[style*="ui-monospace"]');
        const sr = span.getBoundingClientRect();
        return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
          textW: +sr.width.toFixed(2), text: span.textContent.slice(0, 40) };
      });
      overflow = boxes.filter(el => {
        const t = el.querySelector('.pp-text');
        return t && t.scrollHeight > el.getBoundingClientRect().height + 1;
      }).length;
      styleEl = boxes[0]?.querySelector('span[style*="ui-monospace"]') ?? null;
    } else {
      lines = [...slide.querySelectorAll('pre code > span')].map(sp => {
        const r = sp.getBoundingClientRect();
        return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
          textW: +r.width.toFixed(2), text: sp.textContent.slice(0, 40) };
      });
      styleEl = slide.querySelector('pre code > span') ?? slide.querySelector('pre code') ?? slide.querySelector('pre');
    }
    const cs = styleEl ? getComputedStyle(styleEl) : null;
    const tracked = [...slide.querySelectorAll('*')].filter(el => {
      if (el.children.length) return false;
      const t = el.textContent.trim();
      if (!t || t.length > 40) return false;
      const ls = getComputedStyle(el).letterSpacing;
      return ls && ls !== 'normal' && ls !== '0px';
    }).slice(0, 16).map(el => ({
      text: el.textContent.trim().toUpperCase().slice(0, 30),
      letterSpacing: getComputedStyle(el).letterSpacing,
    }));
    const pitches = [];
    for (let k = 1; k < lines.length; k++) pitches.push(+(lines[k].y - lines[k - 1].y).toFixed(2));
    pitches.sort((a, b) => a - b);
    // (02-FX6) slides without code areas (e.g. the tracked-evidence slide 17)
    // probe no style element — emit a truthy, field-less {} so the JSON keeps
    // the per-side style slot; the delta block below skips it field-wise.
    return {
      mode: isRt ? 'roundtrip' : 'marp', lineCount: lines.length,
      style: cs ? { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontSize: cs.fontSize,
        letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight } : {},
      firstLine: lines[0] ?? null,
      pitchMedian: pitches.length ? pitches[(pitches.length - 1) >> 1] : null,
      overflow,
      tracked,
    };
  }, [selector, Number(slideNo) - 1]);
  await page.close();
  return data;
}

const TOL = { fontSize: 0.2, letterSpacing: 0.05, lineHeight: 0.2, tracked: 0.05 };
const browser = await chromium.launch({
  executablePath: process.env.STEVEDORE_CHROMIUM_PATH,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
try {
  const ref = await probe(browser, refHtml, slideArg);
  const rt = await probe(browser, rtHtml, slideArg);
  const d = {};
  // (02-FX6) field-guarded: a slide with no style element emits style:{} and
  // must not produce NaN deltas that would fail the gate for no reason.
  if (ref.style?.fontSize != null && rt.style?.fontSize != null) {
    d.fontSize = +Math.abs(px(ref.style.fontSize) - px(rt.style.fontSize)).toFixed(3);
    d.lineHeight = +Math.abs(px(ref.style.lineHeight) - px(rt.style.lineHeight)).toFixed(3);
    d.fontWeightDiff = ref.style.fontWeight !== rt.style.fontWeight;
    d.letterSpacing = ref.style.letterSpacing === rt.style.letterSpacing ? 0
      : +Math.abs(px(ref.style.letterSpacing) - px(rt.style.letterSpacing)).toFixed(3);
  }
  if (ref.pitchMedian != null && rt.pitchMedian != null)
    d.pitch = +Math.abs(ref.pitchMedian - rt.pitchMedian).toFixed(3);   // defer class — never gates
  if (ref.firstLine && rt.firstLine)
    d.firstY = +Math.abs(ref.firstLine.y - rt.firstLine.y).toFixed(3);  // defer class — never gates
  d.overflowRt = rt.overflow ?? 0;
  const rtTracked = new Map((rt.tracked ?? []).map(t => [t.text, t.letterSpacing]));
  const tracked = (ref.tracked ?? []).filter(t => rtTracked.has(t.text)).map(t => ({
    text: t.text, ref: t.letterSpacing, rt: rtTracked.get(t.text),
    delta: +Math.abs(px(t.letterSpacing) - px(rtTracked.get(t.text))).toFixed(3),
  }));
  const pass = (d.fontSize ?? 0) <= TOL.fontSize && (d.lineHeight ?? 0) <= TOL.lineHeight
    && !d.fontWeightDiff && (d.letterSpacing ?? 0) <= TOL.letterSpacing
    && tracked.every(t => t.delta <= TOL.tracked);
  process.stdout.write(JSON.stringify({ slide: Number(slideArg), ref, rt, deltas: d, tracked, pass }) + '\n');
  process.exit(pass ? 0 : 1);
} finally {
  await browser.close();
}
