---
issue: "#74"
wave: 8
depends_on: []
target: stevedore
fixes: 02-02
---

# Plan 02-FX9: Real mono font stacks — ui-monospace resolves to monospace in the round-trip HTML AND in the pptx

**Objective:** Close VERIFICATION.md addendum #5 gap 10 (post-FX8 user SC4 re-review, 2026-11-24): slide-8 code fonts are STILL proportional. The root cause is PROVEN (a playwright probe on nix chromium — plan the fix, not the diagnosis): the round-trip stack `'ui-monospace', Calibri, sans-serif` renders "iiiwww" at **45.3px = the sans-serif width** (real `monospace` → 47.0; Consolas → 57.8) — **ui-monospace does not resolve to a monospace font on this chromium**, falls through Calibri (absent) → generic sans-serif → proportional code. The pptx carries the same defect upstream: `latin typeface="ui-monospace"` — PowerPoint substitutes keyword typefaces proportionally the same way. FX6 fixed fractional SIZES but not the family resolution. Both halves are fixed here, per the gap's spec: **(a) converter emission** (`scripts/src/render/fonts.js`, the FX1/FX6 surface) maps the captured `ui-monospace` to a real fallback stack — `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace` (probe-verified resolvable) — in the emitted HTML; **(b) dom-to-pptx fork branch `fix/real-mono-typeface`** maps `ui-*` keyword typefaces to real fonts (Consolas) in the pptx run properties, pushed/merged/vendor-synced per the FX2/FX7 loop. Regression lock: static stack-contains unit tests + a committed chromium width-probe auditor (`scripts/audit-mono-width.mjs`) that re-runs the probe against the emitted HTML. Acceptance (the gap's own bar): slide-8 code spans carry a stack that resolves monospace in nix chromium, and pptx slide-8 code runs carry `typeface="Consolas"`. The artifact half (regenerated canonical pair, DRIFT-BREAKDOWN row 08) is 02-FX11.

**Standing facts:** bun not npm; the test suite runs in glob form `node --test scripts/test/*.test.mjs` (the directory form fails on this Node); nix chromium only — `nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node …` (never bundled downloads, decision 13); the fork's own runs keep `PUPPETEER_EXECUTABLE_PATH=$(command -v chromium)`; playwright importable via `createRequire(<stevedoreRoot>/vendor/PPTX2HTML/package.json)('playwright')`, installed by `scripts/setup-roundtrip.sh`; commits atomic with subject prefix `(02-FX9): …`; stevedore purity — no `00-supporting-files/` content committed on this branch. The canonical LAND.E decks live on the worktree-adjacent progressEdd checkout (resolve absolute before use — worktree depths differ between agents; the phase worktree layout puts it at `../progressEdd/00-supporting-files/data/land-e-tests`):

```bash
TESTS="$(realpath ../progressEdd/00-supporting-files/data/land-e-tests)"
REF_HTML="$TESTS/reference/slides.html"        # Marp deck; code stack = --fontStack-monospace (ui-monospace, SFMono-Regular, …)
RT_HTML="$TESTS/tests/land-e-roundtrip.html"   # post-FX8 canonical; code spans carry font-family:'ui-monospace', Calibri, sans-serif
PPTX="$TESTS/tests/land-e-slides.pptx"         # post-FX8 canonical; code runs carry latin typeface="ui-monospace" (slides 08–11)
```

Fork: `https://github.com/progressEdd/dom-to-pptx`, branches `pin/puppeteer-23.11.1`, `fix/media-byte-embed`, `fix/gradient-svg-stop`, `fix/font-design-viewport`, `fix/pseudo-z-index`, integration `stevedore-combined`. Fix branches fork off upstream tag **v2.1.2** (upstream-PR-ready; the vendored copy's line numbers may shift a few lines vs a v2.1.2 checkout — anchor by grep, not line number). The only site where a computed font family becomes a pptx typeface is `getTextStyle`'s return in `vendor/dom-to-pptx/src/utils.js` (anchor: `fontFace: style.fontFamily.split(',')[0]`); every other `fontFace` mention is downstream pass-through (`index.js`'s `__spc_` suffixes, table cell options) or the separate font-embedder concern — none writes a typeface. FX7-recorded fork mechanics baked in: stage EXACTLY the fix files (bun install pollutes the checkout — `workspaces` field, `+x` mode bits, untracked bun.lock); the full fork vitest run has 2 pre-existing browser-launch failures in `node-exporter.test.js` (NixOS chrome lacks libnspr4.so — pre-existing on pristine v2.1.2, "if the environment allows" applies); `scripts/vendor-sync.sh`'s `--delete` mirror removes `vendor/dom-to-pptx/VENDORED.md` (a stevedore-side file absent from the fork) — restore it via `git checkout` before editing the entry. `unzip`/`file` are absent on this host (standing deviation — `7z x -so` for pptx XML). The suite currently reads 152–153 pass / 0 fail / 1 skip (the FX4 browser test skips without chromium). The code-carrying slides are 08–11 (grep-verified: every `font-family:'ui-monospace'` span in the committed round-trip HTML falls inside slides 8–11's line ranges), and the stevedore-side example deck (`scripts/examples/land-e/deck.html`, regenerated from `deck.pptx`) carries the same ui-monospace stacks.

## Tasks

<task>
<name>Task 1: Converter emission — real mono stacks in fonts.js, locked with regression tests, suite sweep, example regen</name>
<files>scripts/src/render/fonts.js, scripts/test/render-text.test.mjs, scripts/examples/land-e/deck.html</files>
<action>
**The edit — `scripts/src/render/fonts.js`.** Add the constants after `SERIF_FACES` (line 6):

```js
// (02-FX9) Real monospace faces: these need a MONO fallback chain and the
// monospace generic — a proportional theme fallback (Calibri) shadows the
// generic wherever it is installed, re-breaking the family class there.
const MONO_FACES = new Set(['Consolas', 'Menlo', 'Courier New', 'Liberation Mono',
  'SFMono-Regular', 'SF Mono', 'Cascadia Mono', 'JetBrains Mono', 'Fira Mono',
  'DejaVu Sans Mono', 'Ubuntu Mono']);
// (02-FX9) ui-monospace resolves to NOTHING on some chromium builds (nix:
// probe "iiiwww" 45.3px = the sans-serif width; monospace 47.0, Consolas
// 57.8), so the old emission `'ui-monospace', <theme>, sans-serif` fell
// through the absent theme fallback onto generic sans-serif — code rendered
// proportionally (VERIFICATION addendum #5 gap 10). Keyword faces never
// resolve through the theme: emit the probe-verified real stack; keep the
// keyword first so hosts that DO resolve it keep their system mono.
const UI_MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, ' +
  "'Liberation Mono', monospace";
```

Then replace the tail of `fontFamily` — everything from `const fallback =` through the `return` — with (the `+mj/+mn` resolution block above it and the FX1 comment content on the return line stay as they are):

```js
  // (02-FX9) CSS ui-* keyword faces map to real resolvable stacks — the
  // theme fallback is proportional and must not shadow a mono class.
  if (typeof name === 'string' && name.toLowerCase() === 'ui-monospace') return UI_MONO_STACK;
  const mono = MONO_FACES.has(name);
  // (02-FX9) mono faces fall back to real mono fonts, never the theme's
  // proportional minor face (it would shadow the monospace generic).
  const fallback = mono ? "'Liberation Mono', 'Courier New'"
    : (ctx?.theme?.fontScheme?.minor?.latin ?? 'sans-serif');
  const generic = SERIF_FACES.has(name) ? 'serif' : mono ? 'monospace' : 'sans-serif';
  // (02-FX1) single-quoted name. A double-quoted family inside a style="…"
  // attribute terminated the attribute mid-declaration, so browsers applied
  // only font-size and silently dropped font-family/font-weight/font-style/
  // color (VERIFICATION gap 1). CSS single-quoted strings are valid
  // font-family names and carry no HTML-attribute meaning; embedded single
  // quotes are backslash-escaped per the CSS spec.
  return `'${name.replace(/'/g, "\\'")}', ${fallback}, ${generic}`;
```

And the file's header sentence "concrete typefaces pass through. Always returns a quoted stack with a scheme fallback and a generic family so the browser never guesses." — append one clause so the self-description stays true: `…never guesses (02-FX9: ui-monospace and real mono faces map to resolvable mono stacks — a proportional fallback must never shadow a mono class).` Implementation choice recorded: the converter maps the keyword per the gap's specified stack AND gives every known mono face a mono fallback chain + `monospace` generic (so a post-fork pptx carrying `typeface="Consolas"` converts to a stack that resolves mono even on hosts without Consolas — the pptx half below feeds this path).

**Regression tests — append to `scripts/test/render-text.test.mjs`** (the `render` helper exists at its top):

```js
test('ui-monospace emits the real resolvable mono stack — VERIFICATION addendum #5 gap 10 (02-FX9)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{ rels: [], texts: [{ paragraphs: [{ runs: [
      { t: 'code', sz: 718, latin: 'ui-monospace', color: '4B5563' },
    ] }] }] }],
  });
  assert.ok(html.includes(
    "font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"),
    'the keyword maps to the probe-verified real stack');
  assert.ok(!html.includes("font-family:'ui-monospace',"),
    'the old theme-fallback stack (falls through to proportional sans) is gone');
});

test('mono faces carry a mono fallback chain and monospace generic — (02-FX9)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{ rels: [], texts: [{ paragraphs: [{ runs: [
      { t: 'code', sz: 718, latin: 'Consolas', color: '4B5563' },
    ] }] }] }],
  });
  assert.ok(html.includes("font-family:'Consolas', 'Liberation Mono', 'Courier New', monospace"),
    'Consolas falls back to real mono faces, not the theme sans');
  assert.ok(!html.includes("font-family:'Consolas', Calibri"),
    'no proportional fallback inside a mono stack');
});
```

**Sweep** — `node --test scripts/test/*.test.mjs`. Anticipated fallout (update each with an inline `// (02-FX9)` comment; fix the fix, not the test, for genuine regressions): exactly one — FX1's document-sweep test at `render-text.test.mjs:216` asserts `html.includes("font-family:'ui-monospace'")` ("monospace stack single-quoted"); replace that assertion with `assert.ok(html.includes("font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"), 'monospace keyword emits the real stack'); // (02-FX9)`. The neighboring sans assertion (line 217) and FX6's fractional-size test (line 220, asserts `font-size:9.57px` only) are unaffected — verify by running the suite.

**Example-deck regen** (the example pptx carries `typeface="ui-monospace"` code runs — the regen proves the fix visibly in a committed artifact):

```bash
OLD=$(grep -c "font-family:'ui-monospace', Calibri, sans-serif" scripts/examples/land-e/deck.html)   # record in SUMMARY
node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o scripts/examples/land-e/deck.html
node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o /tmp/fx9-check.html
cmp /tmp/fx9-check.html scripts/examples/land-e/deck.html && echo REGEN-STABLE
test "$(grep -c "font-family:'ui-monospace', Calibri, sans-serif" scripts/examples/land-e/deck.html)" -eq 0
test "$(grep -c 'font-family:ui-monospace, SFMono-Regular, Menlo, Consolas' scripts/examples/land-e/deck.html)" -gt 0
echo "old stacks: $OLD -> 0; keyword stacks now present"
```

Commit: `fix(02-FX9): real mono font stacks — ui-monospace and mono faces resolve monospace, not proportional sans`.
</action>
<verify>node --test scripts/test/render-text.test.mjs && node --test scripts/test/*.test.mjs && cmp /tmp/fx9-check.html scripts/examples/land-e/deck.html && test "$(grep -c "font-family:'ui-monospace', Calibri, sans-serif" scripts/examples/land-e/deck.html)" -eq 0 && test "$(grep -c 'font-family:ui-monospace, SFMono-Regular, Menlo, Consolas' scripts/examples/land-e/deck.html)" -gt 0 && echo FX9-EMISSION-OK</verify>
<acceptance_criteria>
- `scripts/src/render/fonts.js` contains `UI_MONO_STACK` and `MONO_FACES` verbatim; `fontFamily('ui-monospace')` returns the full keyword stack; a Consolas face emits `'Consolas', 'Liberation Mono', 'Courier New', monospace`
- `scripts/test/render-text.test.mjs` carries both new tests; the suite passes 0-fail; the only touched pre-existing assertion is the FX1 sweep line, marked `// (02-FX9)`
- Regenerated `scripts/examples/land-e/deck.html` byte-stable across two runs; 0 occurrences of the old `'ui-monospace', Calibri, sans-serif` stack; keyword-stack occurrences > 0 (before/after counts in SUMMARY)
- `git diff` confined to `scripts/src/render/fonts.js`, `scripts/test/render-text.test.mjs`, `scripts/examples/land-e/deck.html` — no `00-supporting-files/` content (purity)
</acceptance_criteria>
</task>

<task>
<name>Task 2: Fork branch fix/real-mono-typeface — map ui-* keyword typefaces to real fonts in pptx run properties; push, merge, vendor-sync</name>
<files>vendor/dom-to-pptx/src/utils.js, vendor/dom-to-pptx/src/__tests__/real-mono-typeface.test.js, vendor/dom-to-pptx/VENDORED.md (all via the fork + scripts/vendor-sync.sh)</files>
<action>
**Step 1 — scratch fork checkout** (FX2/FX7's recipe):

```bash
FK="${TMPDIR:-/tmp}/stevedore-fx9-fork"
rm -rf "$FK" && git clone https://github.com/progressEdd/dom-to-pptx.git "$FK" && cd "$FK"
git checkout -b fix/real-mono-typeface v2.1.2        # off the upstream tag: upstream-PR-ready
PUPPETEER_SKIP_DOWNLOAD=1 bun install && bun run build
```

**Step 2 — the pure helper, `src/utils.js`** (next to `resolveCaptureViewport`/`pseudoSortKey`, so the mapping is unit-testable in their vitest convention):

```js
/**
 * Maps a CSS ui-* generic keyword family to a real font for pptx run
 * properties (fix/real-mono-typeface). font-family resolution is a browser
 * concept: PowerPoint does not resolve keyword typefaces by family class —
 * `latin typeface="ui-monospace"` renders with a proportional default, the
 * same failure chromium shows when the keyword resolves to nothing. Real
 * families pass through unchanged.
 */
const UI_TYPEFACE_MAP = {
  'ui-monospace': 'Consolas',
  'ui-sans-serif': 'Calibri',
  'ui-serif': 'Georgia',
  'ui-rounded': 'Calibri',
};
export function resolveRealTypeface(firstFamilyToken) {
  const token = String(firstFamilyToken ?? '').trim().replace(/['"]/g, '');
  return UI_TYPEFACE_MAP[token] ?? token;
}
```

**Step 3 — the call site, `src/utils.js` `getTextStyle`'s return** (anchor by grep: `fontFace: style.fontFamily.split(',')[0]` — currently line ~658 in the vendored copy). Current:

```js
    fontFace: style.fontFamily.split(',')[0].replace(/['"]/g, ''),
```

Fixed:

```js
    // (fix/real-mono-typeface) a leading ui-* keyword would land verbatim
    // in <a:latin typeface="…"> and render proportionally in PowerPoint —
    // map it to a real font (ui-monospace -> Consolas).
    fontFace: resolveRealTypeface(style.fontFamily.split(',')[0]),
```

(Quote/whitespace stripping moved into the helper. The deck's body text carries `-apple-system`, not a `ui-*` keyword — deliberately untouched; gap 10 is the mono class. `getUsedFontFamilies` (utils.js:~1192) is the font-embedder's @font-face scanner — keywords never appear as @font-face families, so it needs no change.)

**Step 4 — their-convention test, `src/__tests__/real-mono-typeface.test.js`:**

```js
import { describe, it, expect } from 'vitest';
import { resolveRealTypeface } from '../utils.js';

describe('resolveRealTypeface (fix/real-mono-typeface)', () => {
  it('maps ui-monospace to a real monospace font', () => {
    expect(resolveRealTypeface('ui-monospace')).toBe('Consolas');
  });
  it('maps the proportional ui-* keywords to real defaults', () => {
    expect(resolveRealTypeface('ui-sans-serif')).toBe('Calibri');
    expect(resolveRealTypeface('ui-serif')).toBe('Georgia');
    expect(resolveRealTypeface('ui-rounded')).toBe('Calibri');
  });
  it('strips quotes/whitespace and passes real families through', () => {
    expect(resolveRealTypeface(' "SF Mono" ')).toBe('SF Mono');
    expect(resolveRealTypeface('Consolas')).toBe('Consolas');
    expect(resolveRealTypeface('')).toBe('');
  });
});
```

Run `bunx vitest run src/__tests__/real-mono-typeface.test.js` (then the full `bunx vitest run` if the environment allows — the 2 pre-existing `node-exporter.test.js` browser-launch failures are FX7-recorded NixOS environment limits, not regressions).

**Step 5 — push, integrate, vendor-sync** (FX7's proven loop with its recorded lessons baked in — stage EXACTLY the fix files):

```bash
git add src/utils.js src/__tests__/real-mono-typeface.test.js
git commit -m "fix: map ui-* keyword font families to real fonts in run properties (ui-monospace -> Consolas — PowerPoint renders keyword typefaces proportionally)"
git push -u origin fix/real-mono-typeface
git fetch origin
git checkout -B stevedore-combined origin/stevedore-combined
git merge --no-ff fix/real-mono-typeface -m "merge: real-mono-typeface into stevedore-combined"
git push -u origin stevedore-combined
```

(If `origin/stevedore-combined` is unavailable, fall back to FX2's reconstruction: `git checkout -B stevedore-combined pin/puppeteer-23.11.1` then `git merge --no-ff fix/media-byte-embed fix/gradient-svg-stop fix/font-design-viewport fix/pseudo-z-index fix/real-mono-typeface`.)

From your stevedore agent worktree:

```bash
cd <stevedore worktree>
scripts/vendor-sync.sh "$FK" dom-to-pptx
git checkout -- vendor/dom-to-pptx/VENDORED.md   # FX7-recorded: the --delete mirror removes this stevedore-side file
```

**`vendor/dom-to-pptx/VENDORED.md`** — add to the fork-branch list (after the `fix/pseudo-z-index` entry) and update the `Synced:` line's date + owner:

```markdown
  - fix/real-mono-typeface — off v2.1.2; getTextStyle maps a leading ui-*
    keyword family to a real font (resolveRealTypeface in src/utils.js;
    ui-monospace -> Consolas) before writing the run's <a:latin typeface>.
    font-family resolution is a browser concept — PowerPoint renders
    `typeface="ui-monospace"` with a proportional default, so code exported
    from decks using CSS keyword font stacks rendered proportionally. Closes
    VERIFICATION addendum #5 gap 10 (plan 02-FX9).
```

`Synced: <date> via scripts/vendor-sync.sh (02-FX9: fix/real-mono-typeface)`.

Stevedore-side sanity: `node --test scripts/test/*.test.mjs` stays green (no stevedore source touched beyond `vendor/`). Commit: `fix(02-FX9): vendor sync — dom-to-pptx stevedore-combined (+fix/real-mono-typeface)`.
</action>
<verify>git ls-remote https://github.com/progressEdd/dom-to-pptx.git refs/heads/fix/real-mono-typeface refs/heads/stevedore-combined (both resolve) && grep -q 'resolveRealTypeface' vendor/dom-to-pptx/src/utils.js && grep -q 'fix/real-mono-typeface' vendor/dom-to-pptx/VENDORED.md && node --test scripts/test/*.test.mjs && echo FX9-FORK-OK</verify>
<acceptance_criteria>
- `fix/real-mono-typeface` pushed on progressEdd/dom-to-pptx and merged into `stevedore-combined` (both resolve via ls-remote); fork vitest passes on the new suite (5 assertions green)
- The fork branch carries exactly the two fix files + the test (no bun-install pollution — FX7's recorded deviation baked in)
- Vendored copy carries `resolveRealTypeface` in `src/utils.js`, the rewritten `fontFace:` call site with the `(fix/real-mono-typeface)` comment, and the VENDORED.md entry above with the updated Synced line
- The stevedore diff for this task is confined to `vendor/dom-to-pptx/**`; the stevedore test suite stays green
</acceptance_criteria>
</task>

<task>
<name>Task 3: Commit the mono-width auditor and prove both halves on a fresh round-trip</name>
<files>scripts/audit-mono-width.mjs</files>
<action>
**Step 0 — paths** (re-derive; run from the stevedore agent worktree):

```bash
TESTS="$(realpath ../progressEdd/00-supporting-files/data/land-e-tests)"
REF_HTML="$TESTS/reference/slides.html"
RT_HTML="$TESTS/tests/land-e-roundtrip.html"
PPTX="$TESTS/tests/land-e-slides.pptx"
T="${TMPDIR:-/tmp}/stevedore-fx9"; mkdir -p "$T"
```

**Step 1 — the auditor, `scripts/audit-mono-width.mjs`** (the committed width probe — re-runs the gap's diagnosis against any emitted HTML; DOM-only, no PNG decode):

```js
#!/usr/bin/env node
// audit-mono-width.mjs — code-font width-probe auditor (02-FX9,
// VERIFICATION addendum #5 gap 10). Extracts the ACTUAL computed
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
```

**Step 2 — pre-fix diagnosis re-proof + reference sanity:**

```bash
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-mono-width.mjs "$RT_HTML" 8 > "$T/fx9-pre.json"; echo "pre-fix exit=$? (expect 1 — the gap)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-mono-width.mjs "$REF_HTML" 8 > "$T/fx9-ref.json"; echo "reference exit=$? (expect 0 — the metric detects mono where mono exists)"
cat "$T/fx9-pre.json" "$T/fx9-ref.json"   # record both in the SUMMARY
```

**Step 3 — the converter half against a keyword-carrying pptx** (the committed pptx carries `typeface="ui-monospace"` — a fresh conversion must now emit a stack that resolves mono):

```bash
node scripts/pptx-to-html.js "$PPTX" -o "$T/fx9-rt-keyword.html"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-mono-width.mjs "$T/fx9-rt-keyword.html" 8 | tee "$T/fx9-keyword.json"; echo "exit=$? (must be 0)"
grep -c "font-family:ui-monospace, SFMono-Regular" "$T/fx9-rt-keyword.html"   # > 0 — record
```

**Step 4 — the full round-trip on the fixed toolchain** (fork fix live in the rebuilt vendored dist; from the stevedore worktree):

```bash
scripts/setup-roundtrip.sh                       # idempotent — rebuilds vendor/dom-to-pptx/dist
F="${TMPDIR:-/tmp}/stevedore-fx9-rt"; rm -rf "$F"
scripts/roundtrip.sh "$REF_HTML" "$F" > "$T/fx9-roundtrip.log" 2>&1; echo "roundtrip exit=$?"
grep -E 'media survival|PASS|FAIL|ROUNDTRIP-OK' "$T/fx9-roundtrip.log"    # PASS + media survival: 15/15
```

Gates (any failure → STOP, record, report to the orchestrator — do not commit the auditor as if proven):

```bash
# pptx ground truth — the gap's acceptance: real typeface, keyword gone
7z x -so "$F/land-e-slides.pptx" ppt/slides/slide8.xml > "$T/fx9-slide8.xml" 2>/dev/null
grep -q 'typeface="Consolas"' "$T/fx9-slide8.xml" && echo CONSOLAS-PRESENT
! grep -q 'typeface="ui-monospace"' "$T/fx9-slide8.xml" && echo KEYWORD-GONE
# emitted stack + width probe on the fresh round-trip (the gap's acceptance, HTML half)
grep -q "font-family:'Consolas', 'Liberation Mono', 'Courier New', monospace" "$F/land-e-roundtrip.html" && echo STACK-PRESENT
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-mono-width.mjs "$F/land-e-roundtrip.html" 8 | tee "$T/fx9-close.json"; echo "exit=$? (must be 0)"
# mono text still inks (FX4's bar — cheap de-risk before 02-FX11's canonical gates)
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-code-ink.mjs "$F/land-e-roundtrip.html" 8 "$T/fx9-ink" | tee "$T/fx9-ink-8.json"
```

**Step 5 — pptx census** (which slides changed; every change must be typeface-class):

```bash
for n in $(seq 1 20); do
  7z x -so "$F/land-e-slides.pptx" ppt/slides/slide$n.xml > "$T/fx9-slide$n.xml" 2>/dev/null
  7z x -so "$PPTX" ppt/slides/slide$n.xml > "$T/old-slide$n.xml" 2>/dev/null
  cmp -s "$T/fx9-slide$n.xml" "$T/old-slide$n.xml" || echo "slide$n.xml CHANGED"
done | tee "$T/fx9-pptx-census.log"
for n in $(grep -o 'slide[0-9]*' "$T/fx9-pptx-census.log" | grep -o '[0-9]*' | sort -un); do
  grep -q 'typeface="Consolas"' "$T/fx9-slide$n.xml" && ! grep -q 'typeface="ui-monospace"' "$T/fx9-slide$n.xml" \
    && echo "slide$n: typeface-class" || { echo "slide$n: UNCLASSIFIED — STOP"; exit 1; }
done | tee "$T/fx9-pptx-class.log"
```

Expected: exactly the code-carrying slides 08–11 changed (grep-verified at plan time: every `font-family:'ui-monospace'` span in the committed HTML lives in slides 8–11); all other slide XMLs byte-identical. Any UNCLASSIFIED change → STOP and report.

Commit: `fix(02-FX9): mono-width auditor — code-stack resolution probe in scripts/`. Suite still green: `node --test scripts/test/*.test.mjs`. Record in the SUMMARY: the pre-fix/reference/close JSONs, the keyword-conversion proof, the census, the round-trip comparator line, the ink fraction.
</action>
<verify>test -f scripts/audit-mono-width.mjs && grep -q '(02-FX9)' scripts/audit-mono-width.mjs && F="${TMPDIR:-/tmp}/stevedore-fx9-rt" && 7z x -so "$F/land-e-slides.pptx" ppt/slides/slide8.xml 2>/dev/null | grep -q 'typeface="Consolas"' && ! 7z x -so "$F/land-e-slides.pptx" ppt/slides/slide8.xml 2>/dev/null | grep -q 'typeface="ui-monospace"' && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-mono-width.mjs "$F/land-e-roundtrip.html" 8 && node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!(j.fraction>=0.01))process.exit(1)" "${TMPDIR:-/tmp}/stevedore-fx9/fx9-ink-8.json" && node --test scripts/test/*.test.mjs && echo FX9-PROOF-OK</verify>
<acceptance_criteria>
- `scripts/audit-mono-width.mjs` committed with the `(02-FX9)` marker; pre-fix round-trip HTML fails it (exit 1, the gap re-proven) and the reference deck passes it (the metric's sanity)
- Fresh conversion of the committed (keyword-carrying) pptx: keyword stack present, auditor exit 0 — the converter half closed against real keyword input
- Fresh full round-trip on the fixed toolchain: comparator PASS with survival 15/15; slide8.xml carries `typeface="Consolas"` with `typeface="ui-monospace"` absent; the emitted code stack is `'Consolas', 'Liberation Mono', 'Courier New', monospace` and the auditor exits 0 on it; code-slide 8 ink fraction ≥ 0.01
- pptx census: changed slides are exactly the typeface-class set (expected 08–11), each verified `Consolas`-present/keyword-absent; all other slide XMLs byte-identical
- Suite green; stevedore diff for the whole plan confined to `scripts/src/render/fonts.js`, `scripts/test/render-text.test.mjs`, `scripts/examples/land-e/deck.html`, `vendor/dom-to-pptx/**`, `scripts/audit-mono-width.mjs` — no `00-supporting-files/` content (purity)
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Converter half: `fontFamily` maps `ui-monospace` to the probe-verified stack and mono faces to mono fallback chains; suite green; example deck regenerated byte-stably with the keyword stack present
- [ ] Fork half: `fix/real-mono-typeface` pushed + merged into stevedore-combined + vendor-synced (VENDORED.md entry); fork vitest green on the new suite
- [ ] Both-halves proof: fresh round-trip carries `typeface="Consolas"` (keyword absent) in the pptx and a mono-resolving stack in the HTML (auditor exit 0); pre-fix gap re-proven (auditor exit 1 on the committed HTML); pptx census typeface-class only
- [ ] No `00-supporting-files/` content touched on stevedore (purity); commits atomic with `(02-FX9): …` prefixes
