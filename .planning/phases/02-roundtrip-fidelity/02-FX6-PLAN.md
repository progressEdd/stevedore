---
issue: "#69"
wave: 7
depends_on: []
target: stevedore
fixes: 02-02
---

# Plan 02-FX6: Slide-8 code fonts — converter preserves true fractional px run metrics

**Objective:** Close VERIFICATION.md addendum #4 gap 6 (slide-8 fonts, 2026-11-24): the reference code font stack (`var(--fontStack-monospace, ui-monospace, …)`) and the round-trip stack (`'ui-monospace', Calibri, sans-serif`) resolve to the same family in chromium, yet the user sees font differences on the code slides. Diagnosis-first per the gap text: A/B computed-style + line-box geometry probes on both sides' slide-8 code areas (font-family, font-weight, font-size, letter-spacing, line-height, text boxes' x/y/w/h), diff them, fix what the diff indicts. Plan-time code reading predicts the indictment (task 1 must confirm, not assume): the parse side snaps run sizes to **integer px** — `scripts/src/pptx/text.js:172` `r.sz = Math.round(rPr.num('sz', 0) * HUNDREDTHS_PT_TO_PX)` — so the code runs' ground truth sz 718 (7.18pt = 9.57px; the deck's code font is `0.33rem` and `line-height:1.22` ⇒ 11.68px, matching the emitted `line-height:11.68px` exactly) becomes `font-size:10px` (+4.5%: bigger glyphs, wider monospace advance, re-wrapping inside the fixed-height per-line boxes — the visible "fonts off" signature). Same class one line down: `r.spc = rPr.num('spc', 0) / 100` reads `@spc` (1/100 pt) as px — 0.4pt emits `letter-spacing:0.4px` instead of 0.53px (~25% short on tracked headings, e.g. slide 17's "AGENT MODE"). The emission side already carries 2-decimal precision (`num()` in `scripts/src/render/text.js`), so the fix is parse-side precision matching the file's own spacing convention (`text.js:95/138` already round to 2 decimals). This is the text-engine emission surface (02-02/FX1's files — FX1's precedent: render/text+fonts fixes carry `fixes: 02-02`); the exporter-side per-line model is NOT touched (per-line layout stays the standing decision-8 defer). The artifact half of the gap is 02-FX8.

**Standing facts:** bun not npm; the test suite runs in glob form `node --test scripts/test/*.test.mjs` (the directory form fails on this Node); nix chromium only — `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node …` (never bundled downloads, decision 13); playwright + pngjs import via `createRequire(<root>/vendor/PPTX2HTML/package.json)(…)`, installed by `scripts/setup-roundtrip.sh`; commits atomic with subject prefix `(02-FX6): …`; stevedore purity — no `00-supporting-files/` content committed on this branch. The canonical LAND.E decks live on the worktree-adjacent progressEdd checkout — resolve to absolute paths before use (worktree depths differ between agents):

```bash
TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)"
REF_HTML="$TESTS/reference/slides.html"        # Marp deck: slides are <section>, code areas are
RT_HTML="$TESTS/tests/land-e-roundtrip.html"   # pre/code/span.del/.add blocks (display:block — one span per line)
PPTX="$TESTS/tests/land-e-slides.pptx"         # post-FX5 canonical; FX6 changes NOTHING in the pptx (parse-side fix)
```

Reference slide-8 code CSS (verified plan-time, `slides.html:112–130`): `.diff-panel pre { font-size:0.33rem; line-height:1.22 }`, lines are `.del/.add/.ctx` block spans. Round-trip slide-8 code markup: `.pp-el` boxes (12px-tall) each carrying `.pp-text > p > span[style*="ui-monospace"]` (committed HTML lines 233–639). Ground-truth sizes (FX2/FX5 records): code runs sz 718 → 9.57px, title sz 2827 → 37.69px; the committed round-trip HTML currently emits `font-size:10px` for the 9.57px runs and `font-size:38px` for 37.69px (grep-verifiable). `HUNDREDTHS_PT_TO_PX = 96/72/100` (text.js:34). Anticipated sweep fallout of the fix (only failing tests get touched, each with a `// (02-FX6)` comment): `scripts/test/text.test.mjs:249` `assert.equal(r.spc, 3)` → 4; `text.test.mjs:306` `assert.equal(run.rPr.sz, 19)` → 18.85 (sz 1414); `scripts/test/render-text.test.mjs:160` `'letter-spacing:3px'` → `'letter-spacing:4px'`. Exact-converting fixtures (sz 2400→32, 1800→24, 1200→16) are unaffected.

## Tasks

<task>
<name>Task 1: Falsifiable A/B diagnosis — computed styles + line-box geometry on both sides' slide-8 code areas</name>
<files>none (scratch under ${TMPDIR:-/tmp}/stevedore-fx6; findings recorded in 02-FX6-SUMMARY.md and drive task 2)</files>
<action>
**Step 1 — preconditions** (from the stevedore agent worktree; STOP and report if any fails):

```bash
TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)"
test -s "$TESTS/reference/slides.html" && test -s "$TESTS/tests/land-e-roundtrip.html" \
  || { echo "canonical decks not found at the worktree-adjacent progressEdd checkout"; exit 1; }
test "$(grep -c 'font-family:"' "$TESTS/tests/land-e-roundtrip.html")" -eq 0 \
  || { echo "stale pre-FX1 HTML — STOP"; exit 1; }
```

**Step 2 — the probe script.** Write the FULL auditor to `$T/audit-font-metrics.mjs` (`T="${TMPDIR:-/tmp}/stevedore-fx6"`) — this is the final form task 3 commits unchanged:

```js
#!/usr/bin/env node
// audit-font-metrics.mjs — reference-vs-round-trip text-metrics A/B probe
// (02-FX6, VERIFICATION addendum #4 gap 6). Probes ONE slide's code areas on
// BOTH decks through the production capture state (same flatten CSS, launch
// flags and 1280×720 viewport as scripts/export-slides.mjs — KEEP IN SYNC),
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
    return {
      mode: isRt ? 'roundtrip' : 'marp', lineCount: lines.length,
      style: cs ? { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontSize: cs.fontSize,
        letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight } : null,
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
  if (ref.style && rt.style) {
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
```

**Step 3 — run the A/B on the gap's canonical slide (8) and the tracked-span evidence slide (17):**

```bash
T="${TMPDIR:-/tmp}/stevedore-fx6"; mkdir -p "$T"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node "$T/audit-font-metrics.mjs" "$REF_HTML" "$RT_HTML" 8 "$PWD" > "$T/fx6-diagnosis-8.json"; echo "slide8 exit=$? (expect 1 pre-fix)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node "$T/audit-font-metrics.mjs" "$REF_HTML" "$RT_HTML" 17 "$PWD" > "$T/fx6-diagnosis-17.json"; echo "slide17 exit=$? (record)"
```

**Step 4 — verdict (record ALL numbers in the SUMMARY; the diff dictates task 2):**
- **fontSize delta > 0.2px** (expected: reference ≈9.57px vs round-trip 10px, delta ≈0.43) → **sz fractional fix** (task 2, primary).
- **tracked pair delta > 0.05px** (expected on slide 17: ref "AGENT MODE" ≈0.53px vs rt 0.4px) → **spc pt→px fix** (task 2, same file, same commit).
- fontWeight differs → weight-emission branch: `scripts/src/render/text.js` runSpan's `font-weight:${r.b ? '700' : '400'}` — correct to the indicted mapping.
- lineHeight delta > 0.2px → lnSpc branch: check `spacingOf` (text.js:132–141) output vs the indicted value.
- **Sizes match (all deltas ≤ tolerance) and ONLY pitch/firstY/box geometry differ** → the standing per-line-layout defer's visible signature — that is decision-8 territory: do NOT force a code fix; STOP, record the numbers, and report to the orchestrator (a fix would need a new hypothesis, not a guess).
Record also `overflowRt` (round-trip boxes whose re-wrapped text is taller than the fixed box — the re-wrap signature; expect > 0 pre-fix on multi-line code boxes if the sz branch fires, 0 or reduced post-fix) and both decks' `style.fontFamily` (same-family confirmation, per the gap text).
</action>
<verify>T="${TMPDIR:-/tmp}/stevedore-fx6"; test -s "$T/fx6-diagnosis-8.json" && test -s "$T/fx6-diagnosis-17.json" && node -e "for (const f of process.argv.slice(1)) { const j = JSON.parse(require('fs').readFileSync(f, 'utf8')); if (!j.ref.style || !j.rt.style || !j.deltas) process.exit(1); console.log(f, JSON.stringify(j.deltas), 'tracked:', JSON.stringify(j.tracked)); }" "$T/fx6-diagnosis-8.json" "$T/fx6-diagnosis-17.json" && echo FX6-DIAGNOSIS-CAPTURED</verify>
<acceptance_criteria>
- Both diagnosis JSONs exist and carry per-side `style` (family/weight/size/letter-spacing/line-height), line geometry (`lineCount`, `firstLine`, `pitchMedian`), `overflow`, `tracked` pairs, and computed `deltas`
- SUMMARY records the full delta table for slides 8 and 17 with an explicit verdict naming each indicted property and the task-2 branch it dictates (or the defer-class STOP)
- Nothing committed to the repo by this task (scratch only); worktree `git status --porcelain` clean afterward
</acceptance_criteria>
</task>

<task>
<name>Task 2: Apply the indicted precision fix — fractional sz/spc through the parse — with regression tests, suite sweep, example regen</name>
<files>scripts/src/pptx/text.js, scripts/test/text.test.mjs, scripts/test/render-text.test.mjs, scripts/examples/land-e/deck.html</files>
<action>
**The edit — `scripts/src/pptx/text.js`, extractRPr (apply each branch task 1 indicted; both shown — they are the same pt→px precision class in one file):**

Current (line 172):
```js
  if (rPr.attrs.sz !== undefined) r.sz = Math.round(rPr.num('sz', 0) * HUNDREDTHS_PT_TO_PX);
```
Fixed:
```js
  // (02-FX6) preserve fractional px — Math.round snapped 9.57px code runs
  // to 10px (+4.5% visible size/advance/wrap drift vs the reference
  // rendering; the sz attribute already carries hundredths of a point).
  // Same 2-decimal convention as the spacing conversions above (lines 95/138).
  if (rPr.attrs.sz !== undefined) r.sz = Math.round(rPr.num('sz', 0) * HUNDREDTHS_PT_TO_PX * 100) / 100;
```

Current (lines 179–180):
```js
  if (rPr.attrs.spc !== undefined)
    r.spc = rPr.num('spc', 0) / 100; // @spc is 1/100 pt — read as px (documented approximation)
```
Fixed:
```js
  // (02-FX6) @spc is 1/100 pt — convert to px like every other pt-derived
  // value (the old /100 read 0.4pt as 0.4px instead of 0.53px, a ~25%
  // letter-spacing shortfall on tracked headings)
  if (rPr.attrs.spc !== undefined)
    r.spc = Math.round(rPr.num('spc', 0) * HUNDREDTHS_PT_TO_PX * 100) / 100;
```

(The emission side needs no change — `runSpan`'s `font-size:${num(r.sz * scale)}px` and `letter-spacing:${num(r.spc)}px` already carry 2 decimals. If task 1 indicted weight/line-height instead, apply that branch to `scripts/src/render/text.js` with a `(02-FX6)` comment and add its regression below.)

**Regression tests — append to `scripts/test/text.test.mjs`** (the `load`/`bodyOf` helpers exist at the top of that file):

```js
test('run metrics preserve fractional px — VERIFICATION addendum #4 gap 6 (02-FX6)', () => {
  const base = load({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [
        { t: 'code line', sz: 739, spc: 40, latin: 'ui-monospace', color: '4B5563' },
      ] }] }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const r = bodyOf(base, el).paragraphs[0].runs[0];
  assert.equal(r.sz, 9.85, 'sz 739 (7.39pt) -> 9.85px, NOT Math.round -> 10');
  assert.equal(r.spc, 0.53, 'spc 40 (0.4pt) -> 0.53px (pt->px), NOT the old /100 -> 0.4');
});
```

(If task 1 indicted only the sz branch, keep the `r.spc` assertion only when the spc branch also fired; adjust the fixture accordingly and note it in the SUMMARY.)

**Emission assertion — append to `scripts/test/render-text.test.mjs`** (the `render` helper exists at its top):

```js
test('fractional run sizes survive emission — VERIFICATION addendum #4 gap 6 (02-FX6)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{ rels: [], texts: [{ paragraphs: [{ runs: [
      { t: 'x = 1', sz: 718, latin: 'ui-monospace', color: '4B5563' },
    ] }] }] }],
  });
  assert.ok(html.includes('font-size:9.57px'), 'sz 718 -> 9.57px emitted, not the integer-snapped 10px');
});
```

**Sweep** — `node --test scripts/test/*.test.mjs`. Expected failing assertions (update each with an inline `// (02-FX6)` comment; fix the fix, not the test, for genuine regressions):
- `text.test.mjs:249` `assert.equal(r.spc, 3)` → `assert.equal(r.spc, 4, '3pt -> 4px (02-FX6 pt->px)')` (only if the spc branch fired)
- `text.test.mjs:306` `assert.equal(run.rPr.sz, 19)` → `assert.equal(run.rPr.sz, 18.85, '1414 hundredths-pt -> 18.85px (02-FX6)')`
- `render-text.test.mjs:160` `'letter-spacing:3px'` → `'letter-spacing:4px'` in the fragments list (only if the spc branch fired)

**Example-deck regen** (determinism + the fix visibly taking effect in the committed example):

```bash
node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o scripts/examples/land-e/deck.html
node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o /tmp/fx6-check.html
cmp /tmp/fx6-check.html scripts/examples/land-e/deck.html && echo REGEN-STABLE
grep -o 'font-size:[0-9]*\.[0-9][0-9]px' scripts/examples/land-e/deck.html | sort | uniq -c | head   # fractional values now present — record
```

(Pre-fix the deck's font-size values are all integers — `grep -c 'font-size:[0-9]*\.[0-9]'` was 0; record the before/after counts in the SUMMARY.)

Commit: `fix(02-FX6): true-px run metrics — fractional sz/letter-spacing survive the parse`.
</action>
<verify>node --test scripts/test/*.test.mjs && grep -q 'HUNDREDTHS_PT_TO_PX \* 100) / 100' scripts/src/pptx/text.js && ! grep -q 'Math.round(rPr.num(.sz., 0) \* HUNDREDTHS_PT_TO_PX);' scripts/src/pptx/text.js && cmp /tmp/fx6-check.html scripts/examples/land-e/deck.html && test "$(grep -c 'font-size:[0-9]*\.[0-9][0-9]px' scripts/examples/land-e/deck.html)" -gt 0 && echo FX6-FIX-OK</verify>
<acceptance_criteria>
- `scripts/src/pptx/text.js` carries the indicted `(02-FX6)` conversion(s) verbatim; the integer snap `Math.round(rPr.num('sz', 0) * HUNDREDTHS_PT_TO_PX);` appears nowhere
- Full glob-form suite passes (0 fail); every touched test carries a `// (02-FX6)` comment
- Regenerated `scripts/examples/land-e/deck.html` byte-stable across two runs and now contains fractional `font-size:…px` values (count > 0, before/after recorded in SUMMARY)
- `git diff` confined to `scripts/src/pptx/text.js`, the two test files, and `scripts/examples/land-e/deck.html` — no `00-supporting-files/` content (purity)
</acceptance_criteria>
</task>

<task>
<name>Task 3: Commit the font-metrics auditor and prove the gap closed on the canonical deck</name>
<files>scripts/audit-font-metrics.mjs</files>
<action>
**Step 0 — paths** (re-derive; run from the stevedore agent worktree):

```bash
TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)"
REF_HTML="$TESTS/reference/slides.html"
PPTX="$TESTS/tests/land-e-slides.pptx"
T="${TMPDIR:-/tmp}/stevedore-fx6"
```

**Step 1 — promote the probe:** copy task 1's script into the repo unchanged and commit it:

```bash
cp "$T/audit-font-metrics.mjs" scripts/audit-font-metrics.mjs
chmod +x scripts/audit-font-metrics.mjs
```

(When run as `scripts/audit-font-metrics.mjs` the stevedore-root argument is optional — it defaults to the script's own parent; 02-FX8 re-runs it as the closure gate.)

**Step 2 — the gap-closure proof on the canonical deck.** The pptx is UNCHANGED by FX6 (parse-side fix only), so a fresh conversion of the committed pptx must now match the reference's computed metrics:

```bash
node scripts/pptx-to-html.js "$PPTX" -o "$T/fx6-rt.html"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-font-metrics.mjs "$REF_HTML" "$T/fx6-rt.html" 8 | tee "$T/fx6-close-8.json"; echo "exit=$? (expect 0)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-font-metrics.mjs "$REF_HTML" "$T/fx6-rt.html" 17 | tee "$T/fx6-close-17.json"; echo "exit=$? (expect 0 — tracked pairs close too)"
```

Gates: both runs exit 0 — slide-8 fontSize delta ≤ 0.2px (expect ≤ 0.05: both sides now derive from the same sz), fontWeight equal, lineHeight delta ≤ 0.2px, every tracked pair delta ≤ 0.05px. **Any exit 1 → the fix did not close the gap: STOP, record the numbers, report to the orchestrator — do not commit the auditor as if proven.** Record the before (task 1) vs after (this step) delta tables and `overflowRt` (expect 0 or reduced — the re-wrap signature gone) in the SUMMARY. Suite still green after the auditor lands: `node --test scripts/test/*.test.mjs`.

Commit: `fix(02-FX6): font-metrics auditor — ref-vs-roundtrip A/B probe in scripts/`.
</action>
<verify>test -f scripts/audit-font-metrics.mjs && grep -q '(02-FX6)' scripts/audit-font-metrics.mjs && TESTS="$(realpath ../../00-supporting-files/data/land-e-tests)" && T="${TMPDIR:-/tmp}/stevedore-fx6" && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-font-metrics.mjs "$TESTS/reference/slides.html" "$T/fx6-rt.html" 8 && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-font-metrics.mjs "$TESTS/reference/slides.html" "$T/fx6-rt.html" 17 && node --test scripts/test/*.test.mjs && echo FX6-PROOF-OK</verify>
<acceptance_criteria>
- `scripts/audit-font-metrics.mjs` committed with the `(02-FX6)` marker; it mirrors `scripts/export-slides.mjs`'s capture state (flatten + launch flags + 1280×720 viewport)
- Fresh conversion of the committed pptx: auditor exits 0 on slides 8 AND 17 (fontSize/letterSpacing/lineHeight/weight within tolerance; tracked pairs ≤ 0.05px) — before/after tables in the SUMMARY
- Suite green; stevedore diff for the whole plan confined to `scripts/src/pptx/text.js`, `scripts/test/text.test.mjs`, `scripts/test/render-text.test.mjs`, `scripts/examples/land-e/deck.html`, `scripts/audit-font-metrics.mjs`
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Diagnosis recorded: both slides' computed-style + geometry diff tables + explicit verdict naming the indicted properties (or the defer-class STOP)
- [ ] `(02-FX6)` fractional conversions in `scripts/src/pptx/text.js`; suite green; only failing tests touched, each with the `(02-FX6)` comment
- [ ] Example deck regenerated byte-stably with fractional font sizes present
- [ ] Canonical proof: auditor exits 0 on slides 8 and 17 against a fresh conversion of the committed pptx (FX6-PROOF-OK)
- [ ] No `00-supporting-files/` content touched on stevedore (purity); commits atomic with `(02-FX6): …` prefixes
