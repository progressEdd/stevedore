---
issue: "#65"
wave: 6
depends_on: []
target: stevedore
fixes: 02-03
---

# Plan 02-FX4: Capture-safe paint order — tint fills no longer hide code runs in exported PNGs

**Objective:** Close VERIFICATION.md gap 4 (post-verify2 addendum #3, 2026-11-24): on the four code slides (08–11) the exported round-trip PNGs paint the line tints, chrome and titles but not the per-line code runs — the code areas show faint stripes and tiny text specks — while live-page probes show the runs laid out correctly (computed style, text rects, checkVisibility) and the pptx carries true sizes (sz 718/739/2827). The defect reproduces across element/clip/fullPage capture and is present in the pre-fix exports too. This plan instrumented-diagnoses the capture with a falsifiable variant matrix, applies the indicted deterministic fix to our export tool `scripts/export-slides.mjs` (02-03's surface — playwright per decision 13, `STEVEDORE_CHROMIUM_PATH`/nix chromium, 1280×720, deterministic flags), locks it with a browser-driven fixture regression test (skipped gracefully when no chromium is configured), and proves slides 08–11 ink on the real canonical deck. Artifact regeneration + breakdown update are 02-FX5's job (separate plan, progressEdd target).

**Working hypothesis (to confirm or refute in task 1 — the matrix decides, not this paragraph):** paint order, not timing. The converter emits each exporter code line as one `.pp-el` containing the tint fill as a **positioned** SVG (`<svg class="pp-geom" style="position:absolute;left:0;top:0;overflow:visible">`) and the text as a **static** sibling (`<div class="pp-text" style="display:flex;...">`) — verbatim from the committed `tests/land-e-roundtrip.html` slide 8. CSS 2.1 Appendix E paints positioned boxes with z-index auto in step 8 — above ALL static content (block backgrounds step 4, inline text step 7) — so the opaque tint fill (`fill="#fdecee"`/`#ebf7ee`, no alpha) covers its own line's text in every rendering of the converted HTML. Probes never caught it because layout/visibility probes don't ask what is ON TOP; and the faint specks in the PNGs are exactly the signature of text peeking through the rounded-corner cutouts of the tint paths (3.93px corner radius on 12px-tall line boxes) plus antialias seams. Titles/"chrome" paint because their boxes carry no fill shape. The exporter already owns a flatten-CSS block for exactly this class of capture problem, so the fix is one tree-order-preserving rule there.

**Standing facts:** same as 02-FX2/FX3 — bun not npm; nix chromium only: `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node …` (never bundled downloads, decision 13); playwright AND pngjs 7.0.0 are devDeps of the vendored PPTX2HTML toolchain, importable via `createRequire(<root>/vendor/PPTX2HTML/package.json)(…)`, installed once by `scripts/setup-roundtrip.sh`; test suite runs in glob form `node --test scripts/test/*.test.mjs` (directory form fails on this Node); commits atomic with subject prefix `(02-FX4): …`; stevedore purity — no `00-supporting-files/` content committed on this branch; determinism promise is fixed-tool/flags/viewport, NOT byte-identical PNGs — never gate on byte equality. The canonical LAND.E decks are read from the progressEdd checkout adjacent to the phase worktrees (FX2/FX3 precedent): `tests/land-e-roundtrip.html` is the committed canonical round-trip HTML (post-FX3: `font-family:"` count 0 — sanity-gate it before use). `unzip`/`file` are absent on this host (7z / node IHDR parsing, standing deviation). Plan-time facts verified by the planner: the converted markup contains ZERO `animation`/`@keyframes`/`transition:` rules (grep), so the motion variant is expected to be a no-op — it stays in the matrix because the falsifiable bar demands it; `scripts/test/lib/` exists (`deck.mjs`) and is the established home for test helpers.

## Tasks

<task>
<name>Task 1: Falsifiable capture diagnosis — run the variant matrix on the real code slide and record which variant flips the ink</name>
<files>none (scratch under ${TMPDIR:-/tmp}/stevedore-fx4; findings recorded in 02-FX4-SUMMARY.md and drive task 2)</files>
<action>
**Step 1 — preconditions** (from the stevedore agent worktree; STOP and report if either fails):

```bash
RT_HTML="$(realpath ../../00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html)"
REF_HTML="$(realpath ../../00-supporting-files/data/land-e-tests/reference/slides.html)"
test -s "$RT_HTML" && test -s "$REF_HTML" || { echo "canonical decks not found at the worktree-adjacent progressEdd checkout"; exit 1; }
test "$(grep -c 'font-family:"' "$RT_HTML")" -eq 0 || { echo "stale pre-FX1 HTML — STOP"; exit 1; }
```

**Step 2 — the diagnostic script** (write to `$T/fx4-diagnose.mjs`, `$T="${TMPDIR:-/tmp}/stevedore-fx4"`). It loads ONE deck, captures slide N through the production capture path under five variants, measures the dark-pixel fraction inside the slide's code areas, and probes what actually paints on top at code-run points:

```js
// fx4-diagnose.mjs — 02-FX4 task 1 scratch. Usage:
//   nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node fx4-diagnose.mjs <deck.html> <slideNumber 1-based> <outdir> <stevedoreRoot> [variant|all]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [html, slideArg, outdir, stevedoreRoot, only] = process.argv.slice(2);
const vendorPkg = resolve(stevedoreRoot, 'vendor/PPTX2HTML/package.json');
const { chromium } = createRequire(vendorPkg)('playwright');
const { PNG } = createRequire(vendorPkg)('pngjs');

const FLATTEN = `
  svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
  .bespoke-marp-osc{display:none!important}
  .pp-slide{transform:none!important;margin:0!important}
`;
const MOTION_CSS = '*,*::before,*::after{animation:none!important;transition:none!important}';
const STACK_CSS = '.pp-text{position:relative}';

const VARIANTS = {
  baseline:  { waitUntil: 'networkidle', extraCss: '' },
  settle:    { waitUntil: 'networkidle', extraCss: '', settleMs: 500 },
  motion:    { waitUntil: 'networkidle', extraCss: MOTION_CSS, reducedMotion: true },
  lifecycle: { waitUntil: 'load', extraCss: '', settleMs: 1500 },
  stack:     { waitUntil: 'networkidle', extraCss: STACK_CSS },
};

function inkFraction(pngPath, rect, threshold = 160) {
  const png = PNG.sync.read(readFileSync(pngPath));
  const { width, height, data } = png;
  const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(width, Math.ceil(rect.x + rect.w)), y1 = Math.min(height, Math.ceil(rect.y + rect.h));
  let ink = 0, total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (width * y + x) * 4;
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (luma < threshold) ink++;
    total++;
  }
  return { ink, total, fraction: total ? ink / total : 0 };
}

const browser = await chromium.launch({
  executablePath: process.env.STEVEDORE_CHROMIUM_PATH,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
mkdirSync(outdir, { recursive: true });
const results = {};
let probe = null;

for (const [name, v] of Object.entries(VARIANTS)) {
  if (only && only !== 'all' && only !== name) continue;
  const page = await context.newPage();
  if (v.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: v.waitUntil });
  await page.evaluate(() => document.fonts.ready);
  if (v.settleMs) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), v.settleMs);
  }
  await page.addStyleTag({ content: FLATTEN + v.extraCss });
  const selector = await page.evaluate(() => document.querySelector('.pp-slide') ? '.pp-slide' : 'section');
  const idx = Number(slideArg) - 1;

  if (!probe) {
    probe = await page.evaluate(([sel, i]) => {
      const slide = document.querySelectorAll(sel)[i];
      if (!slide) return { error: 'no slide at index' };
      const codeEls = [...slide.querySelectorAll('.pp-el')].filter(el => el.querySelector('span[style*="ui-monospace"]'));
      if (!codeEls.length) return { note: 'converter code-box selector matched nothing (Marp deck?)' };
      const points = [];
      for (const el of codeEls.slice(0, 5)) {
        const r = el.getBoundingClientRect();
        const x = r.left + 40, y = r.top + r.height / 2;
        const cls = (e) => {
          const c = e.className;
          const s = typeof c === 'string' ? c : (c && c.baseVal) || '';
          return e.tagName + (s ? '.' + s.split(' ').join('.') : '');
        };
        points.push({ x: Math.round(x), y: Math.round(y),
          stack: document.elementsFromPoint(x, y).slice(0, 4).map(cls) });
      }
      const span = slide.querySelector('span[style*="ui-monospace"]');
      const sr = span && span.getBoundingClientRect();
      return {
        fontsCheck: document.fonts.check("10px 'ui-monospace'"),
        spanFont: span ? getComputedStyle(span).fontFamily : null,
        spanRect: sr ? { w: +sr.width.toFixed(1), h: +sr.height.toFixed(1) } : null,
        points,
      };
    }, [selector, idx]);
  }

  const rect = await page.evaluate(([sel, i]) => {
    const slide = document.querySelectorAll(sel)[i];
    if (!slide) return null;
    const s = slide.getBoundingClientRect();
    const cands = [...slide.querySelectorAll('.pp-el')].filter(el => el.querySelector('span[style*="ui-monospace"]'));
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

  const els = await page.locator(selector).all();
  const png = resolve(outdir, `${name}.png`);
  await els[idx].screenshot({ path: png });
  results[name] = {
    png, rect,
    ...(rect ? inkFraction(png, rect) : { ink: null, total: null, fraction: null }),
  };
  await page.close();
}
writeFileSync(resolve(outdir, 'matrix.json'),
  JSON.stringify({ deck: html, slide: Number(slideArg), variants: results, probe }, null, 2) + '\n');
process.stdout.write(JSON.stringify({ variants: results, probe }, null, 2) + '\n');
await browser.close();
```

**Step 3 — run the matrix on the real defect** (slide 8 of the canonical round-trip HTML, plus one baseline capture of the reference deck's slide 8 as a metric sanity check — the Marp side has always painted its code):

```bash
T="${TMPDIR:-/tmp}/stevedore-fx4"; rm -rf "$T"; mkdir -p "$T"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node "$T/fx4-diagnose.mjs" "$RT_HTML" 8 "$T/variants" "$PWD" all | tee "$T/matrix-stdout.log"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node "$T/fx4-diagnose.mjs" "$REF_HTML" 8 "$T/ref" "$PWD" baseline | tee "$T/ref-sanity.log"
```

**Step 4 — verdict (decision rule, record all numbers in the SUMMARY).** Read `matrix.json`. Ink fraction inside the code-area union rect: baseline is expected ≈ 0–0.005 (specks only); a variant "flips" when its fraction jumps ≥ 0.01. The mapping to fixes:

- **`stack` flips** (expected primary): paint order confirmed → fix = `STACK_CSS` (`.pp-text{position:relative}`) in the flatten block. If `stack` does NOT flip but the probe's `points[].stack` shows the `.pp-geom` svg (or any non-text element) on top at code-run points, paint order is still indicted at the DOM level — re-run the matrix with `STACK_CSS` changed to `'.pp-text{position:relative;z-index:1}'` before concluding; if THAT flips, use the z-index form (and note in the SUMMARY that later-shape overlays could theoretically be inverted — acceptable here, no such construct exists in this deck).
- **`settle` flips**: rasterization timing confirmed → fix = the settle sequence (rAF×2 + 500 ms) before the capture loop in export-slides.mjs.
- **`motion` flips**: media state confirmed → fix = `page.emulateMedia({reducedMotion:'reduce'})` before goto + `MOTION_CSS` appended to the flatten block.
- **`lifecycle` flips**: lifecycle timing confirmed → fix = `waitUntil: 'load'` + the 1500 ms settle.
- **Nothing flips**: iterate hypotheses INSIDE this task (e.g. `MOTION_CSS` + settle combined; a `STACK_CSS`+settle combined variant — add combined entries to `VARIANTS` and re-run) and record each attempt's fraction — do not leave task 1 without a flipping variant; if genuinely nothing flips after the combined variants, STOP and report the matrix to the orchestrator (the fix would need a new hypothesis, not a guess).

Also record from the probe: `fontsCheck` (does `ui-monospace` resolve on this chromium?), `spanRect` (metric sanity — a 30-char span at 10px monospace should be ≈180px wide; a much smaller value would indict font metrics), and the reference-deck sanity fraction (expect ≥ 0.01 — proves the metric detects ink). If the probe shows the tint svg on top at code-run points in the BASELINE page state, note explicitly in the SUMMARY that the defect is a live-page paint-order fact of the converted HTML, not a capture artifact — the capture-side fix stays in scope per the gap text; a converter-side emission change is NOT this plan's surface (record as an orchestrator observation only).
</action>
<verify>T="${TMPDIR:-/tmp}/stevedore-fx4"; test -s "$T/variants/baseline.png" && test -s "$T/variants/stack.png" && test -s "$T/variants/settle.png" && test -s "$T/variants/motion.png" && test -s "$T/variants/lifecycle.png" && test -s "$T/ref/baseline.png" && node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const names=Object.keys(m.variants);for(const n of ['baseline','settle','motion','lifecycle','stack'])if(!names.includes(n))throw new Error('missing variant '+n);if(!(m.probe&&Object.keys(m.probe).length))throw new Error('probe missing');for(const n of names)console.log(n,(m.variants[n].fraction??-1).toFixed(5));" "$T/variants/matrix.json" && echo FX4-DIAGNOSIS-CAPTURED</verify>
<acceptance_criteria>
- All five variant PNGs + the reference sanity PNG exist; `matrix.json` carries per-variant `{fraction, ink, total, rect}` and the probe dump
- SUMMARY records the full fraction table (all five variants), the probe output (fontsCheck / spanFont / spanRect / points stacks), and an explicit verdict line naming the confirmed hypothesis and the fix it dictates
- The reference-side sanity fraction is ≥ 0.01 (the metric demonstrably detects ink where ink exists)
- Nothing committed to the repo by this task (scratch only); stevedore worktree `git status --porcelain` clean afterward
</acceptance_criteria>
</task>

<task>
<name>Task 2: Apply the indicted fix to export-slides.mjs and lock it with a fixture ink-fraction regression test</name>
<files>scripts/export-slides.mjs, scripts/test/lib/ink.mjs, scripts/test/export-ink.test.mjs</files>
<action>
**Step 1 — the ink helper, `scripts/test/lib/ink.mjs`** (pngjs loaded lazily so the browser-less suite run never imports it):

```js
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
```

**Step 2 — baseline the example deck with the STILL-UNFIXED tool** (needed for the unchanged-or-better gate; capture before touching the exporter; run from the stevedore worktree root):

```bash
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/export-slides.mjs scripts/examples/land-e/deck.html -o "${TMPDIR:-/tmp}/stevedore-fx4/pre-example"
```

**Step 3 — the fixture regression test, `scripts/test/export-ink.test.mjs`** (miniature converter-shaped deck: one fill-less title box + five tinted code-line boxes using the converter's EXACT markup pattern — positioned `pp-geom` svg fill + static `pp-text` sibling, `'ui-monospace'` stacks). It must FAIL against the unfixed tool — that is what proves the fixture reproduces gap 4:

```js
// Browser-driven capture regression (02-FX4, VERIFICATION gap 4): a shape's
// tint fill must never paint over its own .pp-text runs in exported PNGs.
// Skipped unless STEVEDORE_CHROMIUM_PATH is set — run under:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inkFraction, loadPng } from './lib/ink.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const codeLine = (i, top) => `
  <div class="pp-el" style="left:40px;top:${top}px;width:600px;height:12px">
    <svg class="pp-geom" viewBox="0 0 600 12" width="600" height="12" preserveAspectRatio="none" style="position:absolute;left:0;top:0;overflow:visible">
      <path d="M3.93,0 H596.07 A3.93,3.93 0 0 1 600,3.93 V8.07 A3.93,3.93 0 0 1 596.07,12 H3.93 A3.93,3.93 0 0 1 0,8.07 V3.93 A3.93,3.93 0 0 1 3.93,0 Z" fill="#fdecee" fill-rule="evenodd" stroke="none"/>
    </svg>
    <div class="pp-text" style="display:flex;flex-direction:column;justify-content:flex-start;padding:0px 1px 0px 1px">
      <p style="margin:0;line-height:11.68px;text-align:left"><span style="font-size:10px;font-family:'ui-monospace', Calibri, sans-serif;font-weight:400;font-style:normal;color:#4b5563">+ class StoryStart(BaseModel): line ${i} — the quick brown fox jumps over the lazy dog 0123456789</span></p>
    </div>
  </div>`;

const FIXTURE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
:root { --pp-w: 1280px; --pp-h: 720px; }
* { box-sizing: border-box; }
body { margin: 0; background: #1a1a1a; }
.pp-slide { position: relative; width: var(--pp-w); height: var(--pp-h); background: #fff; overflow: hidden; margin: 0; transform-origin: top center; transform: scale(var(--pp-k, 1)); }
.pp-el { position: absolute; }
</style></head><body>
<div class="pp-slide">
  <div class="pp-el" style="left:40px;top:30px;width:500px;height:60px">
    <div class="pp-text" style="display:flex;flex-direction:column;justify-content:flex-start;padding:6px 10px 6px 10px">
      <p style="margin:0;line-height:44px;text-align:left"><span style="font-size:36px;font-family:'-apple-system', Calibri, sans-serif;font-weight:700;font-style:normal;color:#111827">Fixture title</span></p>
    </div>
  </div>
  ${[0, 1, 2, 3, 4].map(i => codeLine(i, 120 + i * 24)).join('')}
</div>
</body></html>`;

test('regression: tint fills do not hide .pp-text code runs in exports — VERIFICATION gap 4 (02-FX4)',
  { skip: process.env.STEVEDORE_CHROMIUM_PATH ? false : 'requires STEVEDORE_CHROMIUM_PATH (nix shell nixpkgs#chromium)' },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'stevedore-fx4-test-'));
    const html = join(dir, 'fixture.html');
    const out = join(dir, 'out');
    writeFileSync(html, FIXTURE);
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/export-slides.mjs'), html, '-o', out],
      { encoding: 'utf8' });
    assert.equal(r.status, 0, `exporter failed: ${r.stderr}`);
    assert.deepEqual(readdirSync(out), ['01.png']);
    const png = loadPng(join(out, '01.png'));
    assert.equal(png.width, 1280); assert.equal(png.height, 720);
    // code-panel union rect: the five 600×12 tinted line boxes (40..640 × 120..228)
    const panel = inkFraction(png, { x: 42, y: 121, w: 596, h: 117 });
    assert.ok(panel.fraction >= 0.01,
      `code runs not visible in export — ink fraction ${panel.fraction.toFixed(5)} < 0.01 (gap-4 regression)`);
    // fill-less title text must stay visible (fix must not break plain text boxes)
    const title = inkFraction(png, { x: 45, y: 32, w: 495, h: 56 });
    assert.ok(title.fraction >= 0.01, `title ink missing: ${title.fraction.toFixed(5)}`);
  });
```

Run it NOW, against the unfixed tool: `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/export-ink.test.mjs` — **it must FAIL on the panel assertion.** Record the pre-fix fraction in the SUMMARY (expected < 0.001: opaque tint over text). If it PASSES pre-fix, the fixture does not reproduce the defect — do not fake the threshold: scale the fixture toward the real slide-8 load (repeat `codeLine` to ~100 lines via `[...Array(100).keys()]` at `top: 120 + (i % 25) * 24`, `left: 40 + Math.floor(i / 25) * 620` — capped to the 1280px viewport; recompute the panel rects to cover the grown grid) until the pre-fix run fails; or, if task 1 indicted something the miniature cannot reproduce, extend the fixture with exactly that ingredient. Record what it took.

**Step 4 — the fix in `scripts/export-slides.mjs`** (stack-branch shown; apply the variant task 1 confirmed — see the branch table; EVERY branch carries a `/* (02-FX4) … */` comment so the plan's verifies can grep it). In the `addStyleTag` flatten block, append one rule after the `.pp-slide` line:

```js
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
```

Branch table (apply ONLY what task 1 indicted; record the mapping in the SUMMARY):

| Confirmed variant | Fix in export-slides.mjs (all with a `/* (02-FX4) … */` comment) |
|---|---|
| `stack` | the `.pp-text{position:relative}` rule above (verbatim, with its comment) |
| `stack` needed z-index form per task 1 | `.pp-text{position:relative;z-index:1}` with the same comment, noting the inversion caveat |
| `settle` | keep flatten unchanged; after the existing `document.fonts.ready` await add `await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));` and `await page.evaluate(() => new Promise(r => setTimeout(r, 500)));` |
| `motion` | before `page.goto`: `await page.emulateMedia({ reducedMotion: 'reduce' });` + append `*{animation:none!important;transition:none!important}` to the flatten content |
| `lifecycle` | change `waitUntil: 'networkidle'` → `'load'` and add the 500 ms settle above it |
| combined (task 1 recorded a combination) | apply exactly the recorded combination |

**Step 5 — re-prove.** Regression test now passes: `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/export-ink.test.mjs`. Browser-less suite stays green (skip semantics): `node --test scripts/test/*.test.mjs`. Example deck unchanged-or-better: re-export post-fix and compare per-slide whole-image ink fractions (fraction of luma<160 pixels over the full 1280×720 frame) — no slide may DROP by more than 0.001 (noise); slides may gain ink (that is "better"). Run the comparison from the stevedore worktree root (paths passed as argv — no shell interpolation inside the JS):

```bash
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/export-slides.mjs scripts/examples/land-e/deck.html -o "${TMPDIR:-/tmp}/stevedore-fx4/post-example"
node --input-type=module -e '
import { loadPng, inkFraction } from "./scripts/test/lib/ink.mjs";
import { readdirSync } from "node:fs";
const [pre, post] = process.argv.slice(1);
const names = readdirSync(post);
if (JSON.stringify(names) !== JSON.stringify(readdirSync(pre))) throw new Error("slide count changed");
let bad = 0;
for (const n of names) {
  const rect = { x: 0, y: 0, w: 1280, h: 720 };
  const a = inkFraction(loadPng(pre + "/" + n), rect).fraction;
  const b = inkFraction(loadPng(post + "/" + n), rect).fraction;
  console.log(n, a.toFixed(5), "->", b.toFixed(5));
  if (b < a - 0.001) { bad++; console.log("REGRESSION on", n); }
}
process.exit(bad ? 1 : 0);
' "${TMPDIR:-/tmp}/stevedore-fx4/pre-example" "${TMPDIR:-/tmp}/stevedore-fx4/post-example" \
  && echo FX4-EXAMPLE-OK
```

Commit: `fix(02-FX4): capture-safe paint order — tint fills no longer hide code runs in exported PNGs`.
</action>
<verify>node --test scripts/test/*.test.mjs && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/export-ink.test.mjs && grep -q '(02-FX4)' scripts/export-slides.mjs && echo FX4-FIX-OK</verify>
<acceptance_criteria>
- `scripts/test/export-ink.test.mjs` FAILS on the pre-fix tool (pre-fix panel fraction recorded in SUMMARY) and PASSES post-fix — the regression is captured
- `scripts/export-slides.mjs` contains the `(02-FX4)` marker comment and the indicted fix exactly as the branch table prescribes; no other behavior flags changed (launch args, viewport 1280×720, `STEVEDORE_CHROMIUM_PATH` guard untouched)
- `node --test scripts/test/*.test.mjs` green WITHOUT nix chromium (new test skips cleanly); green WITH it under the nix wrapper
- Example deck re-export: same slide count, no per-slide ink drop > 0.001 (FX4-EXAMPLE-OK)
- `scripts/test/lib/ink.mjs` CLI prints a fraction for a PNG + rect (spot-checkable: `node scripts/test/lib/ink.mjs <png> 0 0 100 100` prints a number)
</acceptance_criteria>
</task>

<task>
<name>Task 3: Commit the code-ink auditor and prove slides 08–11 ink on the canonical deck</name>
<files>scripts/audit-code-ink.mjs</files>
<action>
**Step 1 — promote the single-variant capture into a committed auditor, `scripts/audit-code-ink.mjs`** (the reusable, production-path-accurate version of task 1's script — used again by 02-FX5's canonical proof):

```js
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
  const cands = [...slide.querySelectorAll('.pp-el')].filter(el => el.querySelector('span[style*="ui-monospace"]'));
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
```

(If task 1's confirmed fix was NOT the stack branch, mirror exactly the fix export-slides.mjs received — settle/emulateMedia/waitUntil — so the auditor captures through the SAME path as the exporter; keep the `(02-FX4)` marker.)

**Step 2 — the real-deck proof.** Fresh exports of slides 08–11 from the canonical committed round-trip HTML (and slide 8 of the reference deck as the already-inked sanity side), each through the auditor with the fixed tool (from the stevedore worktree root):

```bash
T="${TMPDIR:-/tmp}/stevedore-fx4"
RT_HTML="$(realpath ../../00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html)"
REF_HTML="$(realpath ../../00-supporting-files/data/land-e-tests/reference/slides.html)"
for n in 8 9 10 11; do
  nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
    node scripts/audit-code-ink.mjs "$RT_HTML" $n "$T/post/roundtrip" | tee "$T/post-rt$n.json"
done
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-code-ink.mjs "$REF_HTML" 8 "$T/post/reference" | tee "$T/post-ref8.json"
```

Open the four pairs (`$T/post/roundtrip/08..11.png` next to `../../00-supporting-files/data/land-e-tests/tests/exports/reference/08..11.png`) and record a one-line eyeball note per slide in the SUMMARY (the formal visual gate is 02-FX5's; this is the fix's spot check). Record every fraction in the SUMMARY.

Commit: `fix(02-FX4): code-ink auditor — per-slide capture-path ink measurement in scripts/`.
</action>
<verify>test -f scripts/audit-code-ink.mjs && grep -q '(02-FX4)' scripts/audit-code-ink.mjs && for n in 8 9 10 11; do node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!(j.fraction>=0.01))process.exit(1)" "${TMPDIR:-/tmp}/stevedore-fx4/post-rt$n.json" || exit 1; done && node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!(j.fraction>=0.01))process.exit(1)" "${TMPDIR:-/tmp}/stevedore-fx4/post-ref8.json" && echo FX4-INK-OK</verify>
<acceptance_criteria>
- `scripts/audit-code-ink.mjs` committed; it carries the `(02-FX4)` marker and mirrors `scripts/export-slides.mjs`'s post-fix capture state (flatten + hardening)
- Fresh round-trip slides 08, 09, 10, 11: code-area ink fraction ≥ 0.01 each (non-trivial dark-pixel fraction inside the code areas — the gap-4 acceptance bar)
- Reference slide 8 sanity fraction ≥ 0.01; the four round-trip PNGs visually show code ink next to their reference pairs (eyeball notes in SUMMARY)
- Suite still green after the auditor lands: `node --test scripts/test/*.test.mjs`
- Stevedore diff confined to `scripts/export-slides.mjs`, `scripts/test/lib/ink.mjs`, `scripts/test/export-ink.test.mjs`, `scripts/audit-code-ink.mjs` — no `00-supporting-files/` content (purity)
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Diagnosis matrix recorded (five variant fractions + probe dump + reference sanity) with an explicit confirmed-hypothesis verdict in the SUMMARY
- [ ] `scripts/export-slides.mjs` carries the indicted deterministic fix with the `(02-FX4)` marker; example-deck re-export unchanged-or-better (FX4-EXAMPLE-OK)
- [ ] Fixture regression test reproduces the defect pre-fix and passes post-fix; full suite green both with and without nix chromium
- [ ] Slides 08–11 of the canonical round-trip deck measure ≥ 0.01 code-area ink through the committed auditor (FX4-INK-OK); reference side sanity ≥ 0.01
- [ ] No `00-supporting-files/` content touched on stevedore (purity); commits atomic with `(02-FX4): …` prefixes
