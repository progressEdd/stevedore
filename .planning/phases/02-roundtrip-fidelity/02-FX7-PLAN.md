---
issue: "#70"
wave: 7
depends_on: []
target: stevedore
fixes: 02-05
---

# Plan 02-FX7: Slide-17 gradients — pseudo-element overlays export above the content they cover

**Objective:** Close VERIFICATION.md addendum #4 gap 7 (slide-17 gradients, 2026-11-24): the round-trip HTML embeds 6 SVG + 1 PNG gradient data-URIs on slide 17 (media survival already proves the bytes), but they do not visibly render in the exported PNG. Diagnosis-first per the gap text — census the gradient data-URIs, check they decode, measure each one's actual visibility, and locate the paint-order inversion with pptx ground truth — then fix what the diagnosis indicts. Plan-time code reading predicts the indictment (task 1 must confirm, not assume): **dom-to-pptx tracks z-index but hardcodes pseudo-element sort levels.** `src/index.js`'s `collect()` builds per-element sort keys (`parentSortKey.concat([zVal, order])` — real DOM elements get their own parsed z-index) and the final queue is sorted by `compareKeys`; but `prepareRenderItem`'s pseudo-element block passes `parentSortKey.concat([-1000000])` for `::before` and **`parentSortKey.concat([0, Infinity])` for `::after`** — the pseudo's own computed z-index is never read. The reference slide 17 paints `.vs-side::after` (the half-panel gradient overlays, `z-index: 2`, verified: `slides.html:505–524`) ABOVE `.vs-image` (`z-index: 1`); dom-to-pptx sorts the overlay picture BELOW the photo picture (compareKeys: [0,∞] < [1,order]) → the pptx spTree inverts them → our converter (faithful to spTree order — `.pp-el` boxes are `position:absolute`, so document order = z-order) emits the gradient `.pp-el` before the photo `.pp-el` (verified in the committed round-trip HTML: left gradient 640×660 @ left:0,top:60 precedes the photo 640×832 @ left:0,top:-26; right gradient 640×660 @ 640,60 precedes the terminal mockup) → the gradient paints under the photo in EVERY rendering — live page and capture alike. FX4's `.pp-text{position:relative}` rule is within-box only and is not the culprit here. The gradient pills, center divider and glow are real DOM elements whose z-index `collect()` parses correctly — expected fine, census confirms. The fix lands on a `progressEdd/dom-to-pptx` fork branch (decisions 10/12 — 02-05's `fix/*` pattern, FX2's precedent), vendor-synced into stevedore. This is the html→pptx emission surface, distinct from 02-FX6's converter text emission; the artifact half is 02-FX8.

**Standing facts:** bun not npm — `PUPPETEER_SKIP_DOWNLOAD=1 bun install && bun run build` for the fork; NixOS chromium via `nix shell nixpkgs#chromium --command`, the fork's own runs point puppeteer at it with `PUPPETEER_EXECUTABLE_PATH=$(command -v chromium)`, our tooling uses `STEVEDORE_CHROMIUM_PATH`; test suite glob form `node --test scripts/test/*.test.mjs`; playwright + pngjs via `createRequire(<root>/vendor/PPTX2HTML/package.json)(…)`; commits atomic with subject prefix `(02-FX7): …`; stevedore purity — no `00-supporting-files/` content. Fork: `https://github.com/progressEdd/dom-to-pptx`, branches `pin/puppeteer-23.11.1`, `fix/media-byte-embed`, `fix/gradient-svg-stop`, `fix/font-design-viewport`, integration `stevedore-combined`. Fix branches fork off upstream tag **v2.1.2** (upstream-PR-ready; the vendored tree's line numbers may shift a few lines vs the v2.1.2 checkout — the code sites are identical; anchor by grep, not line number). Canonical decks (worktree-adjacent progressEdd checkout, resolve absolute):

```bash
TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)"
REF_HTML="$TESTS/reference/slides.html"       # slide 17 = the vs-slide: .vs-side/.vs-image/.vs-tag/.vs-divider/.vs-glow
RT_HTML="$TESTS/tests/land-e-roundtrip.html"  # slide 17 = .pp-el boxes, gradients as <img class="pp-img"> data-URIs
PPTX="$TESTS/tests/land-e-slides.pptx"        # committed canonical (pre-fix)
```

Reference paint semantics (slides.html:485–620): `.vs-image{z-index:1}`, `.vs-side::after{position:absolute;inset:60px 0 0 0;z-index:2;mix-blend-mode:screen;background:linear-gradient…}`, `.vs-glow{z-index:3}` (radial-gradient + `blur(8px)`), `.vs-topbar{z-index:4}`, `.vs-player/.vs-name/.vs-tag{z-index:6}`, `.vs-divider{z-index:7}`. pptxgenjs writes each item's sort identity into the pptx: `item.options.objectName = '__z_<queueIndex>__dom_<domOrder>__type_<type>'` lands in each `p:cNvPr name=` — the z-order is grep-readable in slide XML. `unzip`/`file` are absent on this host (standing deviation — `7z x -so` for pptx parts). **The gradients are light translucent overlays (rgba(…,0.16) over dark panels) — a luma<160 "ink" metric CANNOT detect them; the diagnosis metric is a per-element TOGGLE-DIFF: mean absolute per-channel pixel delta inside the element's rect, captured with vs without that one element painted.** Determinism promise: fixed tool/flags/viewport, never byte-identical PNG gates.

## Tasks

<task>
<name>Task 1: Falsifiable gradient diagnosis — census, decode check, per-element visibility A/B, live stack probes, pptx z-order ground truth</name>
<files>none (scratch under ${TMPDIR:-/tmp}/stevedore-fx7; findings recorded in 02-FX7-SUMMARY.md and drive task 2)</files>
<action>
**Step 1 — preconditions** (from the stevedore agent worktree):

```bash
TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)"
test -s "$TESTS/tests/land-e-roundtrip.html" && test -s "$TESTS/tests/land-e-slides.pptx" \
  && test -s "$TESTS/reference/slides.html" \
  || { echo "canonical decks not found at the worktree-adjacent progressEdd checkout"; exit 1; }
```

**Step 2 — the probe script.** Write the FULL auditor to `$T/audit-gradient-paint.mjs` (`T="${TMPDIR:-/tmp}/stevedore-fx7"`) — this is the final form task 3 commits unchanged:

```js
#!/usr/bin/env node
// audit-gradient-paint.mjs — per-element gradient-visibility auditor
// (02-FX7, VERIFICATION addendum #4 gap 7). Census every <img class="pp-img">
// on ONE slide of a round-trip deck (kind, gradient-ness from the decoded
// SVG payload, rect, decode state), then measures a TOGGLE-DIFF per gradient
// image: mean absolute per-channel pixel delta inside the image's own rect
// between a capture with the element painted and one with visibility:hidden.
// The gradient VISIBLY paints iff meanDelta >= 2.0 — the luma<160 "ink"
// metric cannot detect these overlays (light translucent gradients over
// dark panels lighten; they do not darken). elementsFromPoint at each
// gradient's sample point records what actually paints ON TOP of it.
// Optional reference.html argument: sanity-checks the reference's own
// ::after gradient overlays via injected CSS (background:none) — they must
// visibly paint on the reference side (meanDelta >= 2.0 there too).
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

const THRESHOLD = 2.0;

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
```

**Step 3 — run it on the committed defect** (round-trip slide 17 with the reference sanity side):

```bash
T="${TMPDIR:-/tmp}/stevedore-fx7"; mkdir -p "$T"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node "$T/audit-gradient-paint.mjs" "$RT_HTML" 17 "$REF_HTML" "$PWD" | tee "$T/fx7-diagnosis.json"; echo "exit=$? (expect 1 pre-fix)"
```

**Step 4 — pptx z-order ground truth** (where does the inversion live — the exporter or the converter?):

```bash
7z x -so "$PPTX" ppt/slides/slide17.xml > "$T/slide17.xml" 2>/dev/null
7z x -so "$PPTX" ppt/slides/_rels/slide17.xml.rels > "$T/slide17.xml.rels" 2>/dev/null
node -e '
const fs = require("fs");
const xml = fs.readFileSync(process.argv[1], "utf8");
const rels = fs.readFileSync(process.argv[2], "utf8");
const rmap = {};
for (const m of rels.matchAll(/Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rmap[m[1]] = m[2].replace(/^.*\//, "");
const pics = [];
for (const m of xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
  const name = (m[1].match(/<p:cNvPr[^>]*name="([^"]*)"/) || [])[1] ?? "?";
  const rid = (m[1].match(/r:embed="([^"]+)"/) || [])[1] ?? "?";
  pics.push({ name, media: rmap[rid] ?? rid });
}
console.log(JSON.stringify(pics, null, 1));
' "$T/slide17.xml" "$T/slide17.xml.rels" | tee "$T/fx7-pic-order.json"
```

Document order in the spTree = z-order (first = bottom). Identify the gradient overlay pics (`.svg` media, rects ≈ (0,60,640,660)/(640,60,640,660)) vs the content pics (the left `copilot-agent-dropdown` PNG photo, the right `terminal.svg`-derived image).

**Step 5 — verdict (record ALL numbers in the SUMMARY; drives task 2's branch):**
- **Half-panel overlays not painted (meanDelta < 2.0), the covering image on top in the `stack` probe, the gradient pic BEFORE the content pic in `fx7-pic-order.json`, reference sanity ≥ 2.0** → **pseudo-element z-index fix confirmed** (task 2, primary — expected).
- A gradient image with `natural: [0,0]` or not `complete` → decode failure → the `generateGradientSVG` branch (fix/gradient-svg-stop class): extract that one data-URI to a file, render it standalone, record the malformed fragment.
- Live-page stack shows the gradient ON TOP yet the captured PNG hides it → capture-side → the `scripts/export-slides.mjs` branch (02-03 surface): extend the FX4 flatten rule to keep `.pp-img` positioned elements above earlier positioned fills — apply only what this evidence shows.
- Pills/divider/glow already ≥ 2.0 → record "fine", no action. (The glow may be the "1 PNG gradient" — its delta is recorded; if < 2.0 and nothing covers it, diagnose it like the malformed branch above.)
</action>
<verify>T="${TMPDIR:-/tmp}/stevedore-fx7"; test -s "$T/fx7-diagnosis.json" && test -s "$T/fx7-pic-order.json" && node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if(!j.gradients||!j.gradients.length) process.exit(1); for (const g of j.gradients) console.log('g'+g.g, g.kind, 'gradient='+g.gradient, 'meanDelta='+g.meanDelta, 'stack='+g.stack.join(',')); if (j.refOverlays) console.log('refOverlays', JSON.stringify(j.refOverlays));" "$T/fx7-diagnosis.json" && echo FX7-DIAGNOSIS-CAPTURED</verify>
<acceptance_criteria>
- Diagnosis JSON carries the full census (kind, gradient flag, rect, decode state), per-gradient `{meanDelta, painted, stack}`, and the reference-overlay sanity numbers; pic-order JSON carries slide17.xml's pic order with media names
- SUMMARY records the full table + an explicit verdict naming the confirmed hypothesis and the task-2 branch it dictates (or the STOP if evidence contradicts every branch)
- Reference-side overlay sanity ≥ 2.0 (the toggle-diff metric demonstrably detects gradient visibility where it exists)
- Nothing committed by this task (scratch only); worktree `git status --porcelain` clean afterward
</acceptance_criteria>
</task>

<task>
<name>Task 2: Fix pseudo-element z-order on a fork branch, test it, push, merge, vendor-sync</name>
<files>vendor/dom-to-pptx/src/utils.js, vendor/dom-to-pptx/src/index.js, vendor/dom-to-pptx/src/__tests__/pseudo-z-index.test.js, vendor/dom-to-pptx/VENDORED.md (all via the fork + scripts/vendor-sync.sh)</files>
<action>
**Step 1 — scratch fork checkout** (mirrors FX2's recipe):

```bash
FK="${TMPDIR:-/tmp}/stevedore-fx7-fork"
rm -rf "$FK" && git clone https://github.com/progressEdd/dom-to-pptx.git "$FK" && cd "$FK"
git checkout -b fix/pseudo-z-index v2.1.2        # off the upstream tag: upstream-PR-ready
PUPPETEER_SKIP_DOWNLOAD=1 bun install && bun run build
```

**Step 2 — the pure helper, `src/utils.js`** (next to `resolveCaptureViewport`, so the ordering decision is unit-testable in their vitest convention):

```js
/**
 * Sort key for a ::before/::after pseudo-element item (fix/pseudo-z-index).
 * The pseudo participates in its host's stacking context by its OWN
 * computed z-index — not a hardcoded below/above-everything level. The
 * previous ::after key hardcoded 0, so an overlay like
 * .panel::after{z-index:2} sorted BELOW any in-flow child with z-index >= 1
 * (e.g. .panel .img{z-index:1}) and exported under the content it
 * visually covers. 'auto'/unparsable keeps tree-order semantics:
 * ::before below all content, ::after above same-z content.
 */
export function pseudoSortKey(parentSortKey, pseudoType, pseudoZIndex) {
  const raw = String(pseudoZIndex ?? '').trim();
  const parsed = raw && raw !== 'auto' ? parseInt(raw, 10) : NaN;
  const z = Number.isNaN(parsed) ? (pseudoType === '::before' ? -1000000 : 0) : parsed;
  const tie = pseudoType === '::before' ? -1 : Infinity;
  return parentSortKey.concat([z, tie]);
}
```

**Step 3 — the call sites, `src/index.js`** (anchor by grep: the `globalOptions.includePseudoElements !== false` block in `prepareRenderItem` — the two `preparePseudoElementItem(` calls). Add `pseudoSortKey` to the existing named-import block from `'./utils.js'` (top of the file), then replace both hardcoded keys:

```js
  if (globalOptions.includePseudoElements !== false) {
    // (fix/pseudo-z-index) sort pseudos by their OWN computed z-index —
    // hardcoded levels inverted z-indexed overlays under z-indexed in-flow
    // content (slide 17's .vs-side::after z:2 under .vs-image z:1)
    const pseudoBeforeRes = preparePseudoElementItem(
      node, '::before', rect, config,
      pseudoSortKey(parentSortKey, '::before', window.getComputedStyle(node, '::before').zIndex),
      domOrder, pptx, globalOptions
    );
    if (pseudoBeforeRes?.item) items.unshift(pseudoBeforeRes.item);
    if (pseudoBeforeRes?.job) pseudoJobs.push(pseudoBeforeRes.job);

    const pseudoAfterRes = preparePseudoElementItem(
      node, '::after', rect, config,
      pseudoSortKey(parentSortKey, '::after', window.getComputedStyle(node, '::after').zIndex),
      domOrder, pptx, globalOptions
    );
    if (pseudoAfterRes?.item) items.push(pseudoAfterRes.item);
    if (pseudoAfterRes?.job) pseudoJobs.push(pseudoAfterRes.job);
  }
```

(Keep every other line of the block — the `items.unshift/push` and `pseudoJobs` handling — exactly as it is. If task 1 indicted a different branch, apply THAT branch instead — e.g. a `generateGradientSVG` fix or an `export-slides.mjs` rule — with a `(02-FX7)` comment; the rest of this task's push/merge/sync loop is unchanged.)

**Step 4 — their-convention test, `src/__tests__/pseudo-z-index.test.js`:**

```js
import { describe, it, expect } from 'vitest';
import { pseudoSortKey } from '../utils.js';

describe('pseudoSortKey (fix/pseudo-z-index)', () => {
  it("uses the pseudo's own z-index so a z:2 ::after sorts above z:1 children", () => {
    expect(pseudoSortKey([0, 5], '::after', '2')).toEqual([0, 5, 2, Infinity]);
  });
  it("'auto' ::after keeps the above-same-z tree-order semantics", () => {
    expect(pseudoSortKey([0, 5], '::after', 'auto')).toEqual([0, 5, 0, Infinity]);
  });
  it("'auto' ::before keeps the below-content semantics", () => {
    expect(pseudoSortKey([0, 5], '::before', 'auto')).toEqual([0, 5, -1000000, -1]);
  });
  it('a z-indexed ::before participates at its own level', () => {
    expect(pseudoSortKey([0, 5], '::before', '2')).toEqual([0, 5, 2, -1]);
  });
  it('unparsable values fall back like auto', () => {
    expect(pseudoSortKey([0, 5], '::after', '')).toEqual([0, 5, 0, Infinity]);
  });
});
```

Run `bunx vitest run src/__tests__/pseudo-z-index.test.js`, then the full `bunx vitest run` if the environment allows. (`window.getComputedStyle(node, '::after')` with the pseudo type is standard chromium — the vendored copy and the fork both run under puppeteer 23.11.1 / nix chromium.)

**Step 5 — push, integrate, vendor-sync** (FX2's proven loop):

```bash
git add -A && git commit -m "fix: pseudo-element overlays sort by their own z-index (z-indexed ::after no longer exports under z-indexed content)"
git push -u origin fix/pseudo-z-index
git fetch origin
git checkout -B stevedore-combined origin/stevedore-combined
git merge --no-ff fix/pseudo-z-index -m "merge: pseudo-z-index into stevedore-combined"
git push -u origin stevedore-combined
```

(If `origin/stevedore-combined` is unavailable, fall back to FX2's reconstruction: `git checkout -B stevedore-combined pin/puppeteer-23.11.1` then `git merge --no-ff fix/media-byte-embed fix/gradient-svg-stop fix/font-design-viewport fix/pseudo-z-index`.)

From your stevedore agent worktree:

```bash
cd <stevedore worktree>
scripts/vendor-sync.sh "$FK" dom-to-pptx
```

**`vendor/dom-to-pptx/VENDORED.md`** — add to the fork-branch list (after the `fix/font-design-viewport` entry) and update the `Synced:` line's date:

```markdown
  - fix/pseudo-z-index — off v2.1.2; ::before/::after pseudo-element items
    sort by the pseudo's OWN computed z-index (pseudoSortKey in src/utils.js)
    instead of a hardcoded below/above-everything level. An overlay like
    .panel::after{z-index:2} previously sorted below any in-flow child with
    z-index >= 1 (.panel .img{z-index:1}), exporting the gradient overlay
    under the photo it visually covers — slide 17's half-panel gradients
    invisible in the round-trip. Closes VERIFICATION addendum #4 gap 7
    (plan 02-FX7).
```

Stevedore-side sanity: `node --test scripts/test/*.test.mjs` stays green (no stevedore source touched beyond `vendor/`). Commit: `fix(02-FX7): vendor sync — dom-to-pptx stevedore-combined (+fix/pseudo-z-index)`.
</action>
<verify>git ls-remote https://github.com/progressEdd/dom-to-pptx.git refs/heads/fix/pseudo-z-index refs/heads/stevedore-combined (both resolve) && grep -q 'pseudoSortKey' vendor/dom-to-pptx/src/utils.js && grep -q 'pseudoSortKey(parentSortKey' vendor/dom-to-pptx/src/index.js && grep -q 'fix/pseudo-z-index' vendor/dom-to-pptx/VENDORED.md && node --test scripts/test/*.test.mjs && echo FX7-FIX-OK</verify>
<acceptance_criteria>
- `fix/pseudo-z-index` pushed on progressEdd/dom-to-pptx and merged into `stevedore-combined` (both resolve via ls-remote); fork vitest passes including the new key-shape tests
- Vendored copy carries `pseudoSortKey` in `src/utils.js`, the two rewritten pseudo call sites in `src/index.js` with the `(fix/pseudo-z-index)` comment, and the VENDORED.md entry above
- The stevedore diff for this task is confined to `vendor/dom-to-pptx/**`; the stevedore test suite stays green
- If task 1 indicted a different branch, the applied fix carries a `(02-FX7)` comment and the SUMMARY records the mapping from evidence to fix
</acceptance_criteria>
</task>

<task>
<name>Task 3: Commit the gradient-paint auditor and prove slide 17 paints on a fresh round-trip</name>
<files>scripts/audit-gradient-paint.mjs</files>
<action>
**Step 1 — promote the probe:** copy task 1's script into the repo unchanged and commit it:

```bash
cp "${TMPDIR:-/tmp}/stevedore-fx7/audit-gradient-paint.mjs" scripts/audit-gradient-paint.mjs
chmod +x scripts/audit-gradient-paint.mjs
```

(Run as `scripts/audit-gradient-paint.mjs`, the stevedore-root argument is optional — it defaults to the script's parent; 02-FX8 re-runs it as the closure gate.)

**Step 2 — the real-deck proof: full round-trip on the fixed toolchain** (from the stevedore worktree; the vendored exporter must have been rebuilt — `scripts/setup-roundtrip.sh` is idempotent and runs `bun run build` on the synced source):

```bash
TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)"; REF_HTML="$TESTS/reference/slides.html"; PPTX="$TESTS/tests/land-e-slides.pptx"
scripts/setup-roundtrip.sh
T="${TMPDIR:-/tmp}/stevedore-fx7"; F="${TMPDIR:-/tmp}/stevedore-fx7-rt"
rm -rf "$F"
scripts/roundtrip.sh "$REF_HTML" "$F" > "$T/fx7-roundtrip.log" 2>&1; echo "roundtrip exit=$?"
grep -E 'media survival|PASS|FAIL|ROUNDTRIP-OK' "$T/fx7-roundtrip.log"    # must show PASS + media survival: 15/15
for n in $(seq 1 20); do
  7z x -so "$F/land-e-slides.pptx" ppt/slides/slide$n.xml > "$T/fx7-slide$n.xml" 2>/dev/null
  7z x -so "$PPTX" ppt/slides/slide$n.xml > "$T/old-slide$n.xml" 2>/dev/null
  cmp -s "$T/fx7-slide$n.xml" "$T/old-slide$n.xml" || echo "slide$n.xml CHANGED"
done | tee "$T/fx7-pptx-census.log"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-paint.mjs "$F/land-e-roundtrip.html" 17 | tee "$T/fx7-close-17.json"; echo "exit=$? (expect 0)"
```

Gates:
- `scripts/roundtrip.sh` exits 0 and the log shows comparator **PASS** with `media survival: 15/15`.
- The auditor exits 0 on the fresh round-trip slide 17: **every gradient image painted** (meanDelta ≥ 2.0) — in particular the two half-panel overlays (rects ≈ (0,60,640,660) and (640,60,640,660)). Any exit 1 → the fix did not survive the pipeline: STOP, record, report to the orchestrator.
- The pptx census: expected exactly `slide17.xml CHANGED` (the z-reorder plus the `__z_*__` cNvPr name churn that re-queueing causes) and all other 19 slide XMLs byte-identical. If MORE slides changed, verify each is reorder-class (pic count and media parts unchanged — the survival gate plus `7z l` media listing) and record them; a lost/added media part → STOP and report.
- Eyeball spot check: `$F/exports/roundtrip/17.png` next to `$TESTS/tests/exports/reference/17.png` — the half-panel tints and the gradient pills visible (the formal visual gate is 02-FX8's).

Record in the SUMMARY: the checkout + commit used, the auditor's full gradient table (before/after meanDelta), the pptx census, and the comparator line.

Commit: `fix(02-FX7): gradient-paint auditor — per-element visibility A/B probe in scripts/`.
</action>
<verify>test -f scripts/audit-gradient-paint.mjs && grep -q '(02-FX7)' scripts/audit-gradient-paint.mjs && F="${TMPDIR:-/tmp}/stevedore-fx7-rt" && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-gradient-paint.mjs "$F/land-e-roundtrip.html" 17 && node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if(!j.allPainted) process.exit(1); console.log('gradients painted:', j.gradients.filter(g=>g.gradient).length);" "${TMPDIR:-/tmp}/stevedore-fx7/fx7-close-17.json" && node --test scripts/test/*.test.mjs && echo FX7-PROOF-OK</verify>
<acceptance_criteria>
- `scripts/audit-gradient-paint.mjs` committed with the `(02-FX7)` marker; it mirrors `scripts/export-slides.mjs`'s capture state (flatten + flags + 1280×720 viewport)
- Fresh full round-trip: comparator PASS with survival 15/15; the auditor exits 0 on slide 17 — both half-panel overlays and every gradient image painted (meanDelta ≥ 2.0, before/after table in the SUMMARY)
- pptx census recorded: slide17.xml changed, the other 19 slide XMLs byte-identical (or every extra change verified reorder-class and recorded)
- Stevedore diff for the whole plan confined to `vendor/dom-to-pptx/**` and `scripts/audit-gradient-paint.mjs`; suite green
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Diagnosis recorded: gradient census + per-element meanDelta + stack probes + reference sanity ≥ 2.0 + slide17.xml pic order, with an explicit confirmed-hypothesis verdict in the SUMMARY
- [ ] `fix/pseudo-z-index` pushed and merged into stevedore-combined; vendored with the VENDORED.md entry; fork vitest green
- [ ] Fresh round-trip: comparator PASS, slide 17's gradients painted (FX7-PROOF-OK); pptx census as expected (19 identical + slide17 reorder)
- [ ] No `00-supporting-files/` content touched on stevedore (purity); commits atomic with `(02-FX7): …` prefixes
