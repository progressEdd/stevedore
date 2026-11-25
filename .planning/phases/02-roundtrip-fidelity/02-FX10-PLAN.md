---
issue: "#72"
wave: 8
depends_on: []
target: stevedore
fixes: 02-03
---

# Plan 02-FX10: Slide-17 gradients round 3 — falsifiable diagnosis matrix, one conditional fix, hard STOP RULE

**Objective:** Close out VERIFICATION.md addendum #5 gap 11 (post-FX8 user SC4 re-review, 2026-11-24): FX8's 17.png changed vs FX5 (the z-order reorder landed) and the round-trip HTML embeds 6 SVG + 1 PNG gradient data-URIs on slide 17, but the user's eyes report the gradients still absent from the rendered PNG. **Two rounds spent** (FX7 pseudo-z-order, FX8 regeneration) — this round runs the dispatch-prescribed falsifiable diagnosis matrix and carries a **HARD STOP RULE**:

> **STOP RULE: if the matrix does not indict a fixable cause (all SVGs decode with ink, stacking is correct, toggles don't change the region), the plan's terminal task RECORDS gap 11 as an accepted gap in the SUMMARY — no fix, no fourth round.**

The matrix's three falsifiable probes, verbatim per the gap spec: (1) decode each slide-17 SVG data-URI in isolation (render to PNG via chromium, measure ink — a blank/malformed SVG is indicted); (2) probe elementsFromPoint stacking at the gradient regions in the live page (if the `<img>` sits under an opaque rect, the FX4-class fix must extend to positioned `<img>` elements — the flatten CSS currently fixes `.pp-text` only); (3) toggle-diff (hide the suspect overlay, re-screenshot, compare). Whatever flips the pixels gets the deterministic fix in `scripts/export-slides.mjs` (capture-side) or the converter emission (markup-side). Context the matrix must weigh, not presume: FX7's calibration record shows the exported overlay class = the reference's FIRST of two stacked gradients with no `mix-blend-mode:screen`, painting at roughly half the reference's full effect (round-trip toggles 0.883/1.217 vs reference full 3.772/5.916, reference export-equivalent 1.659/2.363) — if the matrix finds all three probes clean, THAT record (not a guess) is the accepted-gap evidence: the gradients render at the exported artifact class's strength, a fidelity limit of the html→pptx gradient model deferred per decision 8. The artifact half (regeneration, DRIFT-BREAKDOWN row 17) is 02-FX11's; this plan's `fixes: 02-03` names the capture-side surface — if the diagnosis routes the fix to the converter emission instead, record the routing in the SUMMARY (the branch table covers both).

**Standing facts:** bun not npm; nix chromium only — `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node …` (never bundled downloads, decision 13); playwright + pngjs importable via `createRequire(<stevedoreRoot>/vendor/PPTX2HTML/package.json)(…)`, installed by `scripts/setup-roundtrip.sh`; the test suite runs in glob form `node --test scripts/test/*.test.mjs`; commits atomic with subject prefix `(02-FX10): …`; stevedore purity — no `00-supporting-files/` content committed on this branch. The canonical LAND.E decks live on the worktree-adjacent progressEdd checkout (resolve absolute before use; the phase worktree layout puts it at `../progressEdd/00-supporting-files/data/land-e-tests`). The FX7-committed gradient auditor `scripts/audit-gradient-paint.mjs` (THRESHOLD 0.5 — calibrated: noise floor 0.000, weakest painted overlay 0.883) is the standing gradient gate; this plan's matrix re-runs it as its control. THREE committed auditors mirror `scripts/export-slides.mjs`'s flatten CSS (`audit-code-ink.mjs`, `audit-font-metrics.mjs`, `audit-gradient-paint.mjs` — each carries a `keep in sync` FLATTEN constant): any flatten change made here MUST update all three mirrors. `scripts/test/lib/ink.mjs` provides `loadPng`/`inkFraction` for tests; `scripts/test/export-ink.test.mjs` is the FX4 browser regression (skips without `STEVEDORE_CHROMIUM_PATH`). `unzip`/`file` are absent on this host (standing deviation — `7z x -so` for pptx XML, node IHDR for PNG dims). Slide-17's known census (FX7's record, 7 imgs): left half-panel overlay (0,60,640,660), left photo PNG (0,-26,640,832), left pill, right half-panel overlay (640,60,640,660), terminal svg, right pill, center divider — gradients are light translucent overlays (a luma<160 "ink" metric CANNOT detect them; the toggle-diff mean abs per-channel delta is the metric). The converter emits imgs STATIC (`scripts/src/render/slide.js:88` — `<img class="pp-img" style="width:100%;…">`, no position) inside positioned `.pp-el` boxes — the exact CSS 2.1 App E step-7-vs-step-8 exposure FX4 fixed for `.pp-text` only.

## Tasks

<task>
<name>Task 1: Falsifiable gradient diagnosis matrix — pair baseline, isolated decode, live stacking, toggle-diff; verdict per the branch table</name>
<files>none (scratch under ${TMPDIR:-/tmp}/stevedore-fx10; findings recorded in 02-FX10-SUMMARY.md and drive tasks 2–3)</files>
<action>
**Step 1 — preconditions** (from the stevedore agent worktree; STOP and report if any fails):

```bash
TESTS="$(realpath ../progressEdd/00-supporting-files/data/land-e-tests)"
RT_HTML="$TESTS/tests/land-e-roundtrip.html"
REF_PNG="$TESTS/tests/exports/reference/17.png"
RT_PNG="$TESTS/tests/exports/roundtrip/17.png"
test -s "$RT_HTML" && test -s "$REF_PNG" && test -s "$RT_PNG" \
  || { echo "canonical pair not found at the worktree-adjacent progressEdd checkout"; exit 1; }
test -f scripts/audit-gradient-paint.mjs || { echo "FX7 auditor missing — STOP"; exit 1; }
```

**Step 2 — the matrix script.** Write the FULL auditor to `$T/fx10-diagnose.mjs` (`T="${TMPDIR:-/tmp}/stevedore-fx10"`) — this is the final form task 3 commits (branch A) unchanged:

```js
#!/usr/bin/env node
// audit-gradient-matrix.mjs — gap-11 round-3 falsifiable diagnosis matrix
// (02-FX10, VERIFICATION addendum #5 gap 11). Four probes on ONE slide of
// a round-trip deck, cross-referenced with the export PNG pair:
//   0. pairBaseline — per-gradient-region mean RGB + meanDelta in the
//      reference vs round-trip export PNGs (the eyes' complaint, quantified)
//   1. isolated     — every img.pp-img data-URI rendered standalone on a
//      neutral background; mean abs per-channel delta vs the empty page
//      (deterministic-capture noise floor is 0.000; < 2.0 = blank or
//      malformed SVG payload — INDICTED)
//   2. stacking     — elementsFromPoint at a 5-point grid per gradient img
//      through the production capture state (flatten CSS): what paints ON
//      TOP, with ancestor flags; non-ancestor entries above the img are
//      cover candidates (tagged with data- attributes for the toggles)
//   3. controls + cover toggles — per gradient: hide the img itself and
//      measure its own visibility delta (the FX7 auditor's method). If it
//      is suppressed (< 0.5) while its payload decodes, hide each cover
//      candidate and re-measure the img's visibility delta: a candidate
//      that flips it to >= 0.5 IS the cover (indicted).
// Diagnostic only — prints one JSON line, exit 0 unless the slide/imgs are
// missing; the CALLER applies the verdict rule (02-FX10 task 1 step 4).
// KEEP the FLATTEN block in sync with scripts/export-slides.mjs.
// Usage:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
//     node scripts/audit-gradient-matrix.mjs <roundtrip.html> <slide#> \
//       <reference.png> <roundtrip.png> [stevedoreRoot]
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [rtHtml, slideArg, refPngPath, rtPngPath, rootArg] = process.argv.slice(2);
if (!rtHtml || !slideArg || !refPngPath || !rtPngPath) {
  process.stderr.write('usage: node audit-gradient-matrix.mjs <roundtrip.html> <slide#> <reference.png> <roundtrip.png> [stevedoreRoot]\n');
  process.exit(2);
}
if (!process.env.STEVEDORE_CHROMIUM_PATH) {
  process.stderr.write('audit-gradient-matrix: STEVEDORE_CHROMIUM_PATH is not set — run under nix shell nixpkgs#chromium\n');
  process.exit(2);
}
const root = resolve(rootArg ?? fileURLToPath(new URL('..', import.meta.url)));
const req = createRequire(resolve(root, 'vendor/PPTX2HTML/package.json'));
const { chromium } = req('playwright');
const { PNG } = req('pngjs');

// (02-FX10) mirror of export-slides.mjs's capture state — keep in sync.
const FLATTEN = `
  svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}
  .bespoke-marp-osc{display:none!important}
  .pp-slide{transform:none!important;margin:0!important}
  .pp-text{position:relative}
`;
const THRESHOLD = 0.5; // (02-FX7) calibrated — noise floor 0.000, weakest painted overlay 0.883

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
function regionMean(png, rect) {
  const x0 = Math.max(0, Math.floor(rect.x)), y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(png.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(png.height, Math.ceil(rect.y + rect.h));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (png.width * y + x) * 4;
    r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
}

const browser = await chromium.launch({
  executablePath: process.env.STEVEDORE_CHROMIUM_PATH,
  args: ['--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text', '--font-render-hinting=none'],
});
try {
  const scratch = mkdtempSync(join(tmpdir(), 'stevedore-fx10-'));
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(pathToFileURL(resolve(rtHtml)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: FLATTEN });
  const sel = '.pp-slide';
  const idx = Number(slideArg) - 1;
  const els = await page.locator(sel).all();
  if (!els[idx]) { process.stderr.write(`audit-gradient-matrix: no slide ${slideArg}\n`); process.exit(1); }

  // ---- census ----
  const census = await page.evaluate(([s, i]) => {
    const slide = document.querySelectorAll(s)[i];
    const base = slide.getBoundingClientRect();
    return [...slide.querySelectorAll('img.pp-img')].map((img, g) => {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      let kind = 'other', gradient = false;
      const m = /^data:image\/(svg\+xml|png);base64,(.*)$/.exec(img.src);
      if (m) {
        kind = m[1] === 'svg+xml' ? 'svg' : 'png';
        if (kind === 'svg') { try { gradient = atob(m[2]).includes('Gradient'); } catch { gradient = false; } }
      }
      return { g, src: img.src, kind, gradient, complete: img.complete,
        natural: [img.naturalWidth, img.naturalHeight],
        style: { display: cs.display, visibility: cs.visibility, opacity: cs.opacity },
        rect: { x: +(r.left - base.left).toFixed(1), y: +(r.top - base.top).toFixed(1),
                w: +r.width.toFixed(1), h: +r.height.toFixed(1) } };
    });
  }, [sel, idx]);
  if (!census.length) { process.stderr.write('audit-gradient-matrix: no img.pp-img on the slide\n'); process.exit(1); }

  // ---- probe 0: pair baseline (the eyes' complaint, quantified) ----
  const refPng = PNG.sync.read(readFileSync(resolve(refPngPath)));
  const rtPng = PNG.sync.read(readFileSync(resolve(rtPngPath)));
  const pairBaseline = census.filter(c => c.gradient).map(c => ({
    g: c.g, rect: c.rect, refMean: regionMean(refPng, c.rect), rtMean: regionMean(rtPng, c.rect),
    meanDelta: meanDelta(refPng, rtPng, c.rect),
  }));

  // ---- probe 1: isolated decode of every data-URI ----
  const isolated = [];
  {
    const pEmpty = await context.newPage();
    await pEmpty.setContent('<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;height:100%}body{background:#404860}</style></head><body></body></html>');
    const emptyPath = join(scratch, 'iso-empty.png');
    await pEmpty.screenshot({ path: emptyPath });
    await pEmpty.close();
    const empty = PNG.sync.read(readFileSync(emptyPath));
    for (const c of census) {
      const pIso = await context.newPage();
      await pIso.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;height:100%}body{background:#404860}img{display:block;width:100%;height:100%}</style></head><body><img src="${c.src}"></body></html>`);
      await pIso.evaluate(() => document.images[0].decode().catch(() => {}));
      const isoPath = join(scratch, `iso-${c.g}.png`);
      await pIso.screenshot({ path: isoPath });
      await pIso.close();
      const md = meanDelta(PNG.sync.read(readFileSync(isoPath)), empty, { x: 0, y: 0, w: 1280, h: 720 });
      isolated.push({ g: c.g, kind: c.kind, gradient: c.gradient, meanDelta: md, decodesWithInk: md != null && md >= 2.0 });
    }
  }

  // ---- baseline slide capture ----
  const aPath = join(scratch, 'slide-a.png');
  await els[idx].screenshot({ path: aPath });
  const pngA = PNG.sync.read(readFileSync(aPath));

  // ---- probe 3a: controls — each gradient's own visibility (FX7's method) ----
  const controls = [];
  for (const c of census.filter(c => c.gradient)) {
    await page.evaluate(([s, i, g]) => {
      [...document.querySelectorAll(s)[i].querySelectorAll('img.pp-img')][g].style.visibility = 'hidden';
    }, [sel, idx, c.g]);
    const bPath = join(scratch, `ctrl-${c.g}.png`);
    await els[idx].screenshot({ path: bPath });
    await page.evaluate(([s, i, g]) => {
      [...document.querySelectorAll(s)[i].querySelectorAll('img.pp-img')][g].style.visibility = '';
    }, [sel, idx, c.g]);
    const md = meanDelta(pngA, PNG.sync.read(readFileSync(bPath)), c.rect);
    controls.push({ g: c.g, meanDelta: md, painted: md != null && md >= THRESHOLD });
  }

  // ---- probe 2: stacking at a 5-point grid, cover candidates tagged ----
  const stacking = await page.evaluate(([s, i]) => {
    const slide = document.querySelectorAll(s)[i];
    const imgs = [...slide.querySelectorAll('img.pp-img')];
    const cls = (e) => {
      const c = typeof e.className === 'string' ? e.className : (e.className && e.className.baseVal) || '';
      return e.tagName + (c ? '.' + c.split(' ').join('.') : '');
    };
    const tagged = new Map();
    let next = 0;
    return imgs.map((img, g) => {
      const r = img.getBoundingClientRect();
      const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([fx, fy]) => [
        Math.min(Math.max(r.left + r.width * fx, r.left + 1), r.right - 1),
        Math.min(Math.max(r.top + r.height * fy, r.top + 1), r.bottom - 1),
      ]);
      const points = pts.map(([x, y]) => {
        const stack = document.elementsFromPoint(x, y).slice(0, 8).map((e) => {
          const own = e === img, anc = !own && img.contains(e);
          let id = null;
          if (!own && !anc) {
            if (!tagged.has(e)) { const k = `fx10-${g}-${next++}`; e.setAttribute(`data-${k}`, '1'); tagged.set(e, k); }
            id = tagged.get(e);
          }
          return { el: cls(e), own, anc, id };
        });
        return { x: Math.round(x), y: Math.round(y), stack };
      });
      return { g, points };
    });
  }, [sel, idx]);

  // ---- probe 3b: cover toggles (only for suppressed-but-decoding gradients) ----
  const coverToggles = [];
  for (const c of census.filter(c => c.gradient)) {
    const ctrl = controls.find(k => k.g === c.g);
    const iso = isolated.find(k => k.g === c.g);
    if (!ctrl || ctrl.painted) continue;          // paints — nothing suppresses it
    if (iso && !iso.decodesWithInk) continue;     // payload indicted — probe 1's branch
    for (const p of (stacking.find(st => st.g === c.g)?.points ?? []))
      for (const e of p.stack)
        if (e.id && !coverToggles.some(t => t.g === c.g && t.candidate === e.id)) {
          const attr = `data-${e.id}`;
          const c1 = join(scratch, `cov-${e.id}-1.png`);
          const c2 = join(scratch, `cov-${e.id}-2.png`);
          await page.evaluate(([s, i, a]) => {
            const el = document.querySelectorAll(s)[i].querySelector(`[${a}]`);
            if (el) el.style.visibility = 'hidden';
          }, [sel, idx, attr]);
          await els[idx].screenshot({ path: c1 });
          await page.evaluate(([s, i, g]) => {
            [...document.querySelectorAll(s)[i].querySelectorAll('img.pp-img')][g].style.visibility = 'hidden';
          }, [sel, idx, c.g]);
          await els[idx].screenshot({ path: c2 });
          await page.evaluate(([s, i, g, a]) => {
            [...document.querySelectorAll(s)[i].querySelectorAll('img.pp-img')][g].style.visibility = '';
            const el = document.querySelectorAll(s)[i].querySelector(`[${a}]`);
            if (el) el.style.visibility = '';
          }, [sel, idx, c.g, attr]);
          const uncovered = meanDelta(PNG.sync.read(readFileSync(c1)), PNG.sync.read(readFileSync(c2)), c.rect);
          coverToggles.push({ g: c.g, candidate: e.id, candidateEl: e.el,
            gradientDeltaUncovered: uncovered, coverIndicted: uncovered != null && uncovered >= THRESHOLD });
        }
  }

  const grads = census.filter(c => c.gradient);
  const out = {
    slide: Number(slideArg), threshold: THRESHOLD,
    census: census.map(({ src, ...rest }) => rest), pairBaseline, isolated, controls, stacking, coverToggles,
    allDecodeWithInk: isolated.filter(i => i.gradient).every(i => i.decodesWithInk),
    allPainted: grads.length > 0 && controls.every(c => c.painted),
    anyCoverIndicted: coverToggles.some(t => t.coverIndicted),
  };
  process.stdout.write(JSON.stringify(out) + '\n');
} finally {
  await browser.close();
}
```

**Step 3 — run the matrix on the committed defect + the standing-gate control:**

```bash
T="${TMPDIR:-/tmp}/stevedore-fx10"; rm -rf "$T"; mkdir -p "$T"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node "$T/fx10-diagnose.mjs" "$RT_HTML" 17 "$REF_PNG" "$RT_PNG" "$PWD" > "$T/fx10-matrix.json"
node -e '
const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
console.log("census:", j.census.map(c => `g${c.g} ${c.kind}${c.gradient ? " [GRAD]" : ""} (${c.rect.x},${c.rect.y},${c.rect.w},${c.rect.h})`).join(" | "));
console.log("pairBaseline:", JSON.stringify(j.pairBaseline));
console.log("isolated:", JSON.stringify(j.isolated));
console.log("controls:", JSON.stringify(j.controls));
for (const st of j.stacking) console.log(`stacking g${st.g}:`, st.points.map(p => p.stack.map(e => e.el + (e.own ? "(self)" : e.anc ? "(anc)" : "(CAND)")).join(",")).join(" || "));
console.log("coverToggles:", JSON.stringify(j.coverToggles));
console.log("allDecodeWithInk", j.allDecodeWithInk, "allPainted", j.allPainted, "anyCoverIndicted", j.anyCoverIndicted);
' "$T/fx10-matrix.json" | tee "$T/fx10-matrix-pretty.log"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-paint.mjs "$RT_HTML" 17 > "$T/fx7-control.json"; echo "fx7 auditor exit=$? (record; FX8 recorded exit 0)"
```

(Do NOT pipe node through tee before an `echo exit=$?` — FX7's recorded deviation: the pipe masks the exit status. Redirect to a file, then echo.)

**Step 4 — verdict (record ALL numbers in the SUMMARY; the branch table below dictates task 2).** Apply the rule per gradient img:

| Matrix verdict | Indicted cause | Task-2 branch |
|---|---|---|
| Some gradient: control `painted:false` AND its isolated `decodesWithInk:false` | blank/malformed SVG payload | **SVG-payload branch** |
| Some gradient: control `painted:false`, decodes, AND a cover candidate's `coverIndicted:true` | FX4-class: static `<img>` under a positioned cover | **flatten-CSS branch** (primary) |
| Some gradient: control `painted:false`, decodes, NO cover flips (and census `style` fields are sane) | suppression outside the two named surfaces | STOP and report to the orchestrator — a new class, not this round's plan |
| All gradients: `painted:true` AND `allDecodeWithInk` (the FX7-control concurs) | nothing suppressed — the gradients render at the exported artifact class's strength | **STOP RULE fires — no fix; task 3 branch B records the accepted gap** |

The STOP RULE, verbatim: **STOP RULE: if the matrix does not indict a fixable cause (all SVGs decode with ink, stacking is correct, toggles don't change the region), the plan's terminal task RECORDS gap 11 as an accepted gap in the SUMMARY — no fix, no fourth round.** Probe 0's pair baseline is the supporting record either way: it quantifies the eyes' complaint (region RGB means + meanDelta per gradient) and, on the STOP-RULE path, pairs with FX7's calibration table as the accepted-gap evidence (single gradient, no screen blend, ≈half the reference's full effect).

Nothing is committed by this task (scratch only); the worktree stays clean.
</action>
<verify>T="${TMPDIR:-/tmp}/stevedore-fx10"; test -s "$T/fx10-matrix.json" && test -s "$T/fx7-control.json" && node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); for (const k of ['census','pairBaseline','isolated','controls','stacking']) if (!j[k]) throw new Error('missing '+k); console.log('allDecodeWithInk', j.allDecodeWithInk, 'allPainted', j.allPainted, 'anyCoverIndicted', j.anyCoverIndicted);" "$T/fx10-matrix.json" && git status --porcelain | wc -l | grep -qx 0 && echo FX10-DIAGNOSIS-CAPTURED</verify>
<acceptance_criteria>
- `fx10-matrix.json` carries all four probes: census (kind/gradient/rect/style, src stripped), pairBaseline (per-gradient region means + meanDelta), isolated (per-img meanDelta + decodesWithInk), controls + stacking (5-point grids with own/ancestor flags) + coverToggles when run
- The FX7 committed auditor re-run on the committed pair is recorded (`fx7-control.json` + its exit code)
- SUMMARY records the full tables and an explicit verdict line naming the indicted branch OR the STOP-RULE verdict, per the branch table
- Nothing committed to the repo by this task (scratch only); worktree `git status --porcelain` empty afterward
</acceptance_criteria>
</task>

<task>
<name>Task 2: Apply the indicted fix — flatten-CSS branch shown; other branches per the table; locked with a paint-order regression test</name>
<files>scripts/export-slides.mjs, scripts/audit-code-ink.mjs, scripts/audit-font-metrics.mjs, scripts/audit-gradient-paint.mjs, scripts/test/export-ink.test.mjs</files>
<action>
**Run this task ONLY if task 1 indicted a fixable cause.** If the STOP RULE fired (all gradients painted, all SVGs decoded, no cover flips): SKIP this task entirely — record "task 2 skipped — STOP RULE fired" in the SUMMARY and go straight to task 3 branch B. No fix, no fourth round.

**Primary branch — flatten-CSS (the FX4-class extension to positioned `<img>` elements).** Task 1's stacking probe showed a non-ancestor positioned element above a gradient img whose cover toggle flipped the pixels: the converter emits `<img class="pp-img">` STATIC inside positioned `.pp-el` boxes (App E step 7), so any positioned box (step 8) paints above every img regardless of FX7's corrected tree order. The fix mirrors FX4's `.pp-text` rule:

**Step 1 — the rule in `scripts/export-slides.mjs`'s flatten block** (append after the `.pp-text{position:relative}` line, inside the same template literal):

```js
      /* (02-FX10) FX4's rule promoted .pp-text only — img.pp-img stayed
         static (App E step 7) below EVERY positioned box (step 8), so an
         earlier opaque shape fill covered a later spTree-ordered image
         regardless of z-order. position:relative moves imgs into the
         positioned phase in TREE ORDER = spTree z-order (FX7's corrected
         order). .pp-video is deliberately untouched (media-slide poster
         defers are recorded decision-8 defers). Marp decks have no .pp-img
         — no-op on the reference side. */
      img.pp-img{position:relative}
```

**Step 2 — sync the three auditor mirrors** (each carries the FLATTEN constant with a `keep in sync` marker): add the same `img.pp-img{position:relative}` line with a `/* (02-FX10) see export-slides.mjs */` comment to `scripts/audit-code-ink.mjs`, `scripts/audit-font-metrics.mjs`, and `scripts/audit-gradient-paint.mjs`.

**Step 3 — the regression lock, appended to `scripts/test/export-ink.test.mjs`** (converter-shaped fixture: positioned opaque fill vs static img in TWO tree orders; must FAIL against the unfixed tool — that proves it reproduces the indicted class):

```js
// The bright data-URI img (deterministic ink) used by the FX10 regression.
const FX10_IMG = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><rect width="300" height="80" fill="#ffffff"/></svg>'
).toString('base64');
const fillBox = (top) => `
  <div class="pp-el" style="left:40px;top:${top}px;width:300px;height:80px">
    <svg class="pp-geom" viewBox="0 0 300 80" width="300" height="80" preserveAspectRatio="none" style="position:absolute;left:0;top:0;overflow:visible">
      <path d="M0,0 H300 V80 H0 Z" fill="#111827" fill-rule="evenodd" stroke="none"/>
    </svg>
  </div>`;
const imgBox = (top) => `
  <div class="pp-el" style="left:40px;top:${top}px;width:300px;height:80px">
    <img class="pp-img" src="${FX10_IMG}" alt="" style="width:100%;height:100%;object-fit:fill">
  </div>`;

test('regression: positioned fills no longer hide .pp-img content in exports — VERIFICATION addendum #5 gap 11 (02-FX10)',
  { skip: process.env.STEVEDORE_CHROMIUM_PATH ? false : 'requires STEVEDORE_CHROMIUM_PATH (nix shell nixpkgs#chromium)' },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'stevedore-fx10-test-'));
    const html = join(dir, 'fixture.html');
    const out = join(dir, 'out');
    writeFileSync(html, `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
:root { --pp-w: 1280px; --pp-h: 720px; }
* { box-sizing: border-box; }
body { margin: 0; background: #1a1a1a; }
.pp-slide { position: relative; width: var(--pp-w); height: var(--pp-h); background: #fff; overflow: hidden; margin: 0; }
.pp-el { position: absolute; }
</style></head><body>
<div class="pp-slide">
  ${fillBox(120)}${imgBox(120)}
  ${imgBox(260)}${fillBox(260)}
</div>
</body></html>`);
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/export-slides.mjs'), html, '-o', out],
      { encoding: 'utf8' });
    assert.equal(r.status, 0, `exporter failed: ${r.stderr}`);
    assert.deepEqual(readdirSync(out), ['01.png']);
    const png = loadPng(join(out, '01.png'));
    // top pair: fill tree-EARLIER, img tree-LATER (spTree-above) -> img must win
    const bright = 1 - inkFraction(png, { x: 42, y: 122, w: 296, h: 76 }, 200).fraction;
    assert.ok(bright >= 0.9, `img hidden under the earlier positioned fill — bright fraction ${bright.toFixed(3)} < 0.9 (gap-11 regression)`);
    // bottom pair: img tree-EARLIER, fill tree-LATER (spTree-above) -> fill must still win (z-order preserved)
    const dark = inkFraction(png, { x: 42, y: 262, w: 296, h: 76 }, 60).fraction;
    assert.ok(dark >= 0.9, `later positioned fill no longer covers the earlier img — dark fraction ${dark.toFixed(3)} < 0.9 (z-order inversion)`);
  });
```

(The `inkFraction`, `loadPng`, `mkdtempSync`, `writeFileSync`, `spawnSync`, `ROOT` imports already exist at the top of that file from FX4's test — `inkFraction(png, rect, threshold)` counts pixels BELOW the threshold, so `1 - inkFraction(…, 200)` is the bright fraction.) Run it NOW against the unfixed tool — the FIRST assertion must FAIL (the fill covers the static img): `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/export-ink.test.mjs`. Record the pre-fix bright fraction in the SUMMARY. If it PASSES pre-fix, the fixture does not reproduce the indicted class — extend it toward exactly what task 1 indicted (same cover element shape/structure) until it fails; record what it took.

**Step 4 — apply the fix (steps 1–2), re-prove, and sweep:**

```bash
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/export-ink.test.mjs   # now passes
node --test scripts/test/*.test.mjs                                                                                              # browser-less: green, new test skips cleanly
```

**Step 5 — example-deck unchanged-or-better gate** (FX4's step-5 pattern; capture the pre-fix exports BEFORE applying the fix if not already captured; run from the stevedore worktree root):

```bash
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/export-slides.mjs scripts/examples/land-e/deck.html -o "${TMPDIR:-/tmp}/stevedore-fx10/pre-example"
# …apply the fix…, then:
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/export-slides.mjs scripts/examples/land-e/deck.html -o "${TMPDIR:-/tmp}/stevedore-fx10/post-example"
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
  if (b < a - 0.001) { bad++; console.log("DROP on", n); }
}
process.exit(bad ? 1 : 0);
' "${TMPDIR:-/tmp}/stevedore-fx10/pre-example" "${TMPDIR:-/tmp}/stevedore-fx10/post-example" \
  && echo FX10-EXAMPLE-OK
```

Gate: same slide count, no per-slide whole-image ink drop > 0.001. A drop > 0.001 is acceptable ONLY if it is verifiably a z-order correction (the slide's own tree order puts a spTree-above img over that content — the FX4 semantics: tree order = spTree order is the intended model) — classify and record each such drop in the SUMMARY; an unclassifiable drop → revert the rule, STOP, report. Commit: `fix(02-FX10): capture-safe image paint order — positioned fills no longer hide .pp-img content`.

**Other branches (apply ONLY what task 1 indicted; record the mapping in the SUMMARY):**

- **SVG-payload branch** (a gradient data-URI renders blank in isolation): extract that data-URI to `$T/gradient-NN.svg` and record the malformed fragment in the SUMMARY. The bytes are generated by dom-to-pptx's `generateGradientSVG` (`fix/gradient-svg-stop`'s file — a NEW fork branch per decision 10, following task 2 of 02-FX9's push/merge/vendor-sync loop verbatim) OR embedded by our converter's image path — apply the fix where the fragment's defect lives, with a `(02-FX10)` comment and a matching regression test (parse- or emission-level on our side; vitest on the fork side). If the fragment's defect traces to the SOURCE deck's own image, record that and treat it as the STOP-RULE outcome (a source-side defect is not a loop defect — task 3 branch B with this evidence).
- **Markup branch** (the converter's emitted markup itself is indicted — e.g. elements emitted out of spTree order in the live page independent of capture): fix the emission in `scripts/src/render/slide.js` (the `elementBox`/img emission) with a `(02-FX10)` comment so the round-trip HTML is faithful standalone; regression: a render-level unit test in `scripts/test/` asserting the indicted structure; the auditor mirrors do NOT change (the flatten CSS is untouched on this branch).
</action>
<verify>node --test scripts/test/*.test.mjs && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test scripts/test/export-ink.test.mjs && grep -q '(02-FX10)' scripts/export-slides.mjs && grep -q 'img.pp-img{position:relative}' scripts/audit-gradient-paint.mjs && grep -q 'img.pp-img{position:relative}' scripts/audit-code-ink.mjs && grep -q 'img.pp-img{position:relative}' scripts/audit-font-metrics.mjs && echo FX10-FIX-OK</verify>
<acceptance_criteria>
- (Flatten branch) `scripts/export-slides.mjs` carries the `(02-FX10)` marker + the `img.pp-img{position:relative}` rule; all three auditor mirrors carry the same rule with the `(02-FX10)` comment
- The new regression test FAILS on the pre-fix tool (pre-fix bright fraction recorded in SUMMARY) and PASSES post-fix; the inverse-order control assertion (later fill still covers earlier img) passes both — z-order semantics preserved
- Suite green without nix chromium (new test skips cleanly) and with it; example-deck re-export: same slide count, no unclassified ink drop > 0.001 (FX10-EXAMPLE-OK)
- Other branches: the applied fix carries a `(02-FX10)` comment, a matching regression test, and the SUMMARY maps matrix evidence → fix surface
- STOP-RULE path: NOTHING committed by this task (recorded skip in the SUMMARY); worktree clean
</acceptance_criteria>
</task>

<task>
<name>Task 3 (terminal): fresh-round-trip proof (fix landed) OR the accepted-gap record (STOP RULE fired)</name>
<files>scripts/audit-gradient-matrix.mjs (branch A only)</files>
<action>
**Branch A — task 2 landed a fix.** Promote the matrix script and prove the fix on a fresh round-trip:

```bash
cp "${TMPDIR:-/tmp}/stevedore-fx10/fx10-diagnose.mjs" scripts/audit-gradient-matrix.mjs
chmod +x scripts/audit-gradient-matrix.mjs
```

(If task 2's flatten branch landed, the copied script's FLATTEN block must first gain the SAME `img.pp-img{position:relative}` rule with its `/* (02-FX10) see export-slides.mjs */` comment — the keep-in-sync discipline; the task-1 scratch form carries the pre-fix state, the committed form must mirror the post-fix exporter. Run as `scripts/audit-gradient-matrix.mjs`, the stevedore-root argument is optional — it defaults to the script's parent; 02-FX11 re-runs it as the closure gate.)

```bash
TESTS="$(realpath ../progressEdd/00-supporting-files/data/land-e-tests)"; REF_HTML="$TESTS/reference/slides.html"
scripts/setup-roundtrip.sh                       # idempotent — rebuilds the vendored dist
T="${TMPDIR:-/tmp}/stevedore-fx10"; F="${TMPDIR:-/tmp}/stevedore-fx10-rt"; rm -rf "$F"
scripts/roundtrip.sh "$REF_HTML" "$F" > "$T/fx10-roundtrip.log" 2>&1; echo "roundtrip exit=$?"
grep -E 'media survival|PASS|FAIL|ROUNDTRIP-OK' "$T/fx10-roundtrip.log"    # PASS + media survival: 15/15
# the closure gate: re-run the matrix on the FRESH outputs — the indicted probe must now read clean
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-matrix.mjs "$F/land-e-roundtrip.html" 17 "$F/exports/reference/17.png" "$F/exports/roundtrip/17.png" > "$T/fx10-close.json"
node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log("allDecodeWithInk",j.allDecodeWithInk,"allPainted",j.allPainted,"anyCoverIndicted",j.anyCoverIndicted);' "$T/fx10-close.json"
# the FX7 standing gate stays green:
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-paint.mjs "$F/land-e-roundtrip.html" 17 > "$T/fx10-close-gradient.json"; echo "exit=$? (must be 0)"
```

Gates (any failure → STOP, record, report to the orchestrator): the matrix's previously-indicted field now reads clean — suppressed gradients `painted:true` (was false), or blank SVGs `decodesWithInk:true` (was false), or `anyCoverIndicted:false` with the gradients painted — AND the FX7 auditor exits 0. Compare the fresh matrix's `pairBaseline` to task 1's (the round-trip gradient regions must move TOWARD the reference means; record both). Then the artifact census: `scripts/roundtrip.sh` outputs to scratch — compare against the committed canonical: pptx slide-XML byte-compare via `7z x -so` for all 20 slides (capture-side fix ⇒ all 20 identical; markup branch ⇒ HTML changed — classify every line against the fix's footprint; fork branch ⇒ the recorded pptx slides changed), and a changed-PNG census (each changed round-trip PNG must map to the fix's footprint — img-under-fill slides on the flatten branch; reference side expected all-identical, `.pp-img` never matching Marp markup). Suite green: `node --test scripts/test/*.test.mjs`. Eyeball spot check: `$F/exports/roundtrip/17.png` next to `$TESTS/tests/exports/reference/17.png` — the gradient tints visibly present (the formal visual gate is 02-FX11's). Commit: `fix(02-FX10): gradient-matrix auditor — isolated-decode/stacking/toggle probe in scripts/`. Record in the SUMMARY: the checkout + commit, the before/after matrix fields, the FX7 gate, the censuses.

**Branch B — the STOP RULE fired.** No fix, no commit. This terminal task RECORDS gap 11 as an accepted gap in the SUMMARY, with:

1. The full matrix tables from task 1 (census, pairBaseline, isolated, controls, stacking, coverToggles-if-any) and the FX7-control re-run — the falsifiable evidence that nothing fixable is indicted: all SVGs decode with ink (the numbers), stacking is correct (the stacks), toggles change nothing (the controls ≥ 0.5, no cover flips).
2. The pair-baseline + FX7-calibration context: the gradients paint at the exported artifact class's strength — the reference's FIRST of two stacked gradients, no `mix-blend-mode:screen`, ≈half the reference's full effect — a fidelity limit of the html→pptx gradient model, NOT a paint-order/blank-SVG/cover defect.
3. The decision-8 defer record (verbatim text 02-FX11 carries into row 17): `gradient visibility at exported strength — accepted gap (02-FX10 matrix: all gradient SVGs decode with ink, stacking correct, nothing covers them; the exported single-gradient/no-blend overlay class paints at ≈half the reference's full effect — FX7's calibration; decision 8, addendum #5 gap 11; no fourth round per the hard STOP RULE)`.
4. The explicit line: gap 11 is CLOSED as an accepted gap — no fix attempted beyond this round, per the STOP RULE; the FX7 committed auditor remains the standing gradient gate.

Nothing else: no stevedore file changes, no commits, worktree clean. (The branch-B verify below checks exactly that: the record exists, the tree is clean.)
</action>
<verify>BRANCH A: test -f scripts/audit-gradient-matrix.mjs && grep -q '(02-FX10)' scripts/audit-gradient-matrix.mjs && F="${TMPDIR:-/tmp}/stevedore-fx10-rt" && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-gradient-paint.mjs "$F/land-e-roundtrip.html" 17 && node --test scripts/test/*.test.mjs && echo FX10-PROOF-OK. BRANCH B: node -e "const s=require('fs').readFileSync('.planning/phases/02-roundtrip-fidelity/02-FX10-SUMMARY.md','utf8').length" && git status --porcelain | wc -l | grep -qx 0 && echo FX10-ACCEPTED-GAP-RECORDED (the SUMMARY carries the accepted-gap record with the matrix tables; the worktree carries no fix — run this branch's check from the main checkout where .planning lives, or verify the SUMMARY file exists in the phase dir). Both branches: the SUMMARY states which branch ran and why, citing the matrix numbers.</verify>
<acceptance_criteria>
- Branch A: `scripts/audit-gradient-matrix.mjs` committed with the `(02-FX10)` marker; fresh round-trip PASS 15/15; the indicted matrix field reads clean post-fix (before/after in the SUMMARY); the FX7 auditor stays exit 0; artifact census recorded and classified; suite green
- Branch B: the accepted-gap record present in 02-FX10-SUMMARY.md with the matrix tables, the FX7-calibration context, the decision-8 defer text (item 3 above verbatim), and the explicit no-fourth-round line; NO fix committed — worktree clean, no stevedore source touched
- Either branch: the SUMMARY names the branch and the verdict with numbers; nothing outside the phase's scratch/SUMMARY/stevedore-script surfaces was touched
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Diagnosis matrix recorded: pair baseline + isolated decode + live stacking + controls/toggles + FX7-control re-run, with an explicit verdict per the branch table
- [ ] Either the indicted fix landed (regression test fails pre-fix / passes post-fix; auditor mirrors synced; example-deck gate; fresh round-trip proof; matrix auditor committed) — or the STOP RULE fired and the accepted-gap record is in the SUMMARY (verbatim defer text, no fourth round)
- [ ] The STOP RULE was honored exactly: no fix attempted when the matrix indicts nothing; no third-and-a-half round invented
- [ ] No `00-supporting-files/` content touched on stevedore (purity); commits atomic with `(02-FX10): …` prefixes
