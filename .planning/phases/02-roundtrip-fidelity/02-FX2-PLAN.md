---
issue: "#61"
wave: 5
depends_on: []
target: stevedore
fixes: 02-05
---

# Plan 02-FX2: Exporter writes true font sizes — capture viewport must match the deck's design size

**Objective:** Close VERIFICATION.md gap 2 (post-verdict addendum, 2026-11-23): dom-to-pptx writes run sizes at ~44–47% of the true computed size — committed pptx slide9.xml ground truth: code runs `sz="359"` (3.59pt vs ≈8.25pt / 11px reference), title `sz="1414"` (14.14pt vs ≈30pt / 40px reference). Ratios (43.5% / 47.1%) are non-constant ⇒ per-element capture defect, not a fixed scale factor. Verified facts at plan time: the deck sizes most type against the viewport — `reference/slides.html:7` declares `@auto-scaling true` and the deck CSS uses rem sizes (`0.33rem` code, `1rem` h1, `0.92rem`, …); the exporter CLI defaults the capture viewport to `slideWidth × 192` (= **2560×1440** for LAND.E's 13.333×7.5in, `bin/cli-exporter.js:165–168`) and `scripts/roundtrip.sh` passes no `--bw/--bh`; the exporter reads `getComputedStyle().fontSize` (used values, viewport-dependent for this deck) at `vendor/dom-to-pptx/src/utils.js:589` and `index.js:1385`, then writes `fontSizePx × 0.75 × scale` where the layout scale (`index.js:405–418`) is **1.0** for a fixed 1280×720 `<section>` — it cannot compensate for viewport-derived type shrinkage. Working hypothesis (to confirm or refute in task 1): capture happens at the wrong viewport, so viewport-sized type resolves at the wrong scale while px-sized type stays right. Fix lives on a `progressEdd/dom-to-pptx` fork branch (decisions 10/12 — 02-05's `fix/*` pattern), vendor-synced into stevedore via `scripts/vendor-sync.sh`. Decision bar is root-cause-agnostic: written sz must land within ±5% of the reference sizes and slide 9's PNG pair must show matching type visually. Our converter reproduces the pptx faithfully (gap 1's attribute bug is 02-FX1's surface; converter behavior is not touched here).

**Standing facts:** same as 02-05 (bun not npm — `bun install`/`bun run build` for the fork, `PUPPETEER_SKIP_DOWNLOAD=1`; NixOS chromium via `nix shell nixpkgs#chromium --command`, puppeteer pointed at it with `PUPPETEER_EXECUTABLE_PATH=$(command -v chromium)`; test data at `../../00-supporting-files/data/land-e-tests/` from any stevedore worktree; LAND.E originals untouched, decision 3; commits atomic with subject prefix `(02-FX2): …`). Fork: `https://github.com/progressEdd/dom-to-pptx`, existing branches `pin/puppeteer-23.11.1`, `fix/media-byte-embed`, `fix/gradient-svg-stop`, integration `stevedore-combined`. Fork fixes branch off upstream tag **v2.1.2** (upstream-PR-ready, no pin stacked in — the vendored tree's line numbers may shift by a few lines vs the v2.1.2 checkout; the code sites are identical). `sz` units are hundredths of a point; px→pt is ×0.75, so 40px → sz≈3000 and 11px → sz≈825.

## Tasks

<task>
<name>Task 1: A/B the capture viewport and confirm (or refute) the size-capture diagnosis</name>
<files>none (scratch clone under $TMPDIR; findings recorded in 02-FX2-SUMMARY.md and drive task 2)</files>
<action>
**Step 1 — scratch clone + toolchain** (mirrors `scripts/setup-roundtrip.sh`'s proven recipe):

```bash
FK="${TMPDIR:-/tmp}/stevedore-fx2"
rm -rf "$FK" && git clone https://github.com/progressEdd/dom-to-pptx.git "$FK" && cd "$FK"
git checkout pin/puppeteer-23.11.1           # the pinned base the vendored snapshot tracks
PUPPETEER_SKIP_DOWNLOAD=1 bun install && bun run build   # dist/dom-to-pptx.bundle.js
SRC="$(realpath ../../00-supporting-files/data/land-e-tests/reference/slides.html)"
```

**Step 2 — A/B the exported sz values** (A = shipped config, viewport 2560×1440; B = design-size viewport 1280×720, the CLI's own documented example at `cli-exporter.js:82`):

```bash
nix shell nixpkgs#chromium --command bash -c \
  "cd '$FK' && PUPPETEER_EXECUTABLE_PATH=\$(command -v chromium) \
   node bin/cli-exporter.js '$SRC' -o /tmp/fx2-A.pptx -s section --width 13.333 --height 7.5"
nix shell nixpkgs#chromium --command bash -c \
  "cd '$FK' && PUPPETEER_EXECUTABLE_PATH=\$(command -v chromium) \
   node bin/cli-exporter.js '$SRC' -o /tmp/fx2-B.pptx -s section --width 13.333 --height 7.5 --bw 1280 --bh 720"
for f in /tmp/fx2-A.pptx /tmp/fx2-B.pptx; do
  echo "== $f slide9 sz histogram =="
  unzip -p "$f" ppt/slides/slide9.xml | grep -o 'sz="[0-9]*"' | sort | uniq -c | sort -rn | head -8
done
```

**Step 3 — probe the computed styles at both viewports** (proves the mechanism, not just the correlation):

```bash
cat > "$FK/fx2-probe.mjs" <<'EOF'
import puppeteer from 'puppeteer';
const [src] = process.argv.slice(2);
const vp = process.env.PROBE_VP === 'design' ? { width: 1280, height: 720 } : { width: 2560, height: 1440 };
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
const page = await browser.newPage();
await page.setViewport(vp);
await page.goto('file://' + src, { waitUntil: 'networkidle0' });
const probe = await page.evaluate(() => {
  const sec = document.querySelector('section');
  const r = sec.getBoundingClientRect();
  const h1 = sec.querySelector('h1');
  return {
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
    sectionFontSize: getComputedStyle(sec).fontSize,
    h1FontSize: h1 ? getComputedStyle(h1).fontSize : null,
    sectionRectW: r.width,
    sectionRectH: r.height,
  };
});
console.log(JSON.stringify({ vp, ...probe }, null, 2));
await browser.close();
EOF
nix shell nixpkgs#chromium --command bash -c "cd '$FK' && PUPPETEER_EXECUTABLE_PATH=\$(command -v chromium) node fx2-probe.mjs '$SRC'"
PROBE_VP=design nix shell nixpkgs#chromium --command bash -c "cd '$FK' && PUPPETEER_EXECUTABLE_PATH=\$(command -v chromium) node fx2-probe.mjs '$SRC'"
```

**Step 4 — verdict.** Record in the SUMMARY: both sz histograms, both probe dumps. Expected (hypothesis confirmed): A's slide-9 sz values sit at ~44–47% of truth (`sz="359"`/`sz="1414"` present), B's land at ≈825/≈3000, and the probe's font sizes differ between viewports while `sectionRectW/H` stay 1280×720. If B does NOT move the sz values, the hypothesis is refuted — do not force it: instrument the actual capture (`console.log` inside `getTextStyle` in `src/utils.js`: `fontSizePx`, `scale`, per element), re-run A, record the numbers, and fix whatever they indict. The task-2 decision bar below is root-cause-agnostic.
</action>
<verify>test -s /tmp/fx2-A.pptx && test -s /tmp/fx2-B.pptx && unzip -p /tmp/fx2-A.pptx ppt/slides/slide9.xml | grep -q 'sz="1414"' && echo DIAGNOSIS-DATA-CAPTURED (SUMMARY carries: A/B sz histograms, both probe dumps, confirmed-or-refuted verdict)</verify>
<acceptance_criteria>
- Both pptx variants built from the pin branch with the nix chromium; slide-9 sz histograms recorded for A and B
- Probe output recorded for both viewports (root/section/h1 font sizes + section rect)
- SUMMARY states explicitly: hypothesis confirmed or refuted, with the numbers
</acceptance_criteria>
</task>

<task>
<name>Task 2: Fix the capture viewport on a fork branch, vendor-sync, prove slide 9 at true size</name>
<files>vendor/dom-to-pptx/** (via scripts/vendor-sync.sh), vendor/dom-to-pptx/VENDORED.md</files>
<action>
**The fix — capture at the deck's own design size when the caller did not pin a viewport.** On the fork:

```bash
cd "$FK" && git checkout -b fix/font-design-viewport v2.1.2   # off the upstream tag: upstream-PR-ready
```

1. **`src/utils.js`** — add this pure helper (near `getTextStyle`), so the decision is unit-testable in their vitest convention:

```js
/**
 * Resolves the capture viewport for an export run.
 * Returns null when the caller pinned an explicit viewport (respect it) or
 * when the slide's design rect is unusable; otherwise the design rect,
 * rounded — capturing at the deck's own size keeps viewport-dependent
 * computed styles (Marp auto-scaling, vw/rem themes) at their true scale.
 */
export function resolveCaptureViewport(explicit, designRect) {
  if (explicit && explicit.width > 0 && explicit.height > 0) return null;
  if (!designRect || !(designRect.width > 0) || !(designRect.height > 0)) return null;
  return { width: Math.round(designRect.width), height: Math.round(designRect.height) };
}
```

2. **`src/node-exporter.js`** — after the page navigation (`page.goto` / `page.setContent`) and before the "Check for dom-to-pptx presence" step, insert:

```js
    // (fix/font-design-viewport) Decks that size type against the viewport
    // (Marp @auto-scaling, vw/rem themes) resolve used font sizes from the
    // window size, not from the slide's design size. When the caller did
    // not pin a viewport, capture at the first slide element's own design
    // rect so every computed style matches the deck's reference rendering.
    const pinnedViewport = options.browserWidth && options.browserHeight
      ? { width: options.browserWidth, height: options.browserHeight }
      : null;
    const designRect = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const r = el && el.getBoundingClientRect();
      return r && r.width > 0 && r.height > 0
        ? { width: r.width, height: r.height }
        : null;
    }, options.selector || '.slide');
    const captureViewport = resolveCaptureViewport(pinnedViewport, designRect);
    if (captureViewport) {
      await page.setViewport(captureViewport);
      // re-resolve styles + the page's own resize handlers at design size
      await page.reload({ waitUntil: 'networkidle0' });
    }
```

3. **`bin/cli-exporter.js`** — stop defaulting the viewport to `slideWidth × 192`; leave it unset so node-exporter normalizes (slide inch dimensions in `pptxOptions` stay untouched). Current (v2.1.2):

```js
  const browserWidth = args.browserWidth || Math.round(slideWidth * 192);
  const browserHeight = args.browserHeight || Math.round(slideHeight * 192);
```

Fixed:

```js
  // (fix/font-design-viewport) Only pin the viewport when the user asked
  // for one (--bw/--bh); otherwise node-exporter sizes the capture viewport
  // to the deck's own design rect, so viewport-dependent computed font
  // sizes match the deck's reference rendering instead of slideWidth × 192.
  const browserWidth = args.browserWidth || undefined;
  const browserHeight = args.browserHeight || undefined;
```

4. **Their-convention test** — `src/__tests__/capture-viewport.test.js` (match the import/expect style of a neighboring file such as `text-whitespace.test.js`):

```js
import { describe, it, expect } from 'vitest';
import { resolveCaptureViewport } from '../utils.js';

describe('resolveCaptureViewport (fix/font-design-viewport)', () => {
  it('returns null when the caller pinned an explicit viewport', () => {
    expect(resolveCaptureViewport({ width: 2560, height: 1440 }, { width: 1280, height: 720 })).toBeNull();
  });
  it('returns the rounded design rect when no viewport was pinned', () => {
    expect(resolveCaptureViewport(null, { width: 1280.4, height: 719.6 })).toEqual({ width: 1280, height: 720 });
  });
  it('returns null for an unusable design rect', () => {
    expect(resolveCaptureViewport(null, null)).toBeNull();
    expect(resolveCaptureViewport(null, { width: 0, height: 720 })).toBeNull();
  });
});
```

Run the fork's suite (`bunx vitest run src/__tests__/capture-viewport.test.js`, then the full `bunx vitest run` if the environment allows) and the task-1 A/B again with the patched build — B's numbers become the new default's numbers.

**Push, integrate, vendor-sync** (02-05's proven loop; merge onto the EXISTING integration branch):

```bash
git add -A && git commit -m "fix: capture at the deck's design viewport (viewport-dependent font sizes exported at wrong scale)"
git push -u origin fix/font-design-viewport
git fetch origin
git checkout -B stevedore-combined origin/stevedore-combined
git merge --no-ff fix/font-design-viewport -m "merge: font-design-viewport into stevedore-combined"
git push -u origin stevedore-combined
```

(If `origin/stevedore-combined` is unavailable, fall back to 02-05's reconstruction: `git checkout -B stevedore-combined pin/puppeteer-23.11.1` then `git merge --no-ff fix/media-byte-embed fix/gradient-svg-stop fix/font-design-viewport`.)

From your stevedore agent worktree:

```bash
scripts/vendor-sync.sh "$FK" dom-to-pptx
```

**`vendor/dom-to-pptx/VENDORED.md`** — add to the fork-branch list (after the `fix/gradient-svg-stop` entry):

```markdown
  - fix/font-design-viewport — off v2.1.2; capture viewport now defaults to
    the first slide element's own design rect (explicit --bw/--bh still
    wins). Decks sizing type against the viewport (Marp `@auto-scaling`,
    vw/rem themes) previously resolved every computed font size at the CLI
    default (slideWidth × 192 = 2560px for LAND.E) and exported sz at
    ~44–47% of the true design size. Closes VERIFICATION gap 2 (plan 02-FX2).
```

Update the `Synced:` line's date. Commit: `fix(02-FX2): vendor sync — dom-to-pptx stevedore-combined (+fix/font-design-viewport)`.

**The proof — full scratch round-trip, slide 9 at true size** (from the stevedore worktree):

```bash
scripts/setup-roundtrip.sh
RT="${TMPDIR:-/tmp}/stevedore-fx2"
rm -rf "$RT"
scripts/roundtrip.sh ../../00-supporting-files/data/land-e-tests/reference/slides.html "$RT" || true
unzip -p "$RT/land-e-slides.pptx" ppt/slides/slide9.xml > /tmp/fx2-slide9.xml
MAXSZ=$(grep -o 'sz="[0-9]*"' /tmp/fx2-slide9.xml | grep -o '[0-9]*' | sort -n | tail -1)
echo "slide9 max sz: $MAXSZ (was 1414; true ≈3000)"
test "$MAXSZ" -ge 2850 && test "$MAXSZ" -le 3150 \
  && ! grep -qE 'sz="(1414|359)"' /tmp/fx2-slide9.xml && echo FX2-SIZE-OK
grep -o 'font-size:40px\|font-size:11px' "$RT/land-e-roundtrip.html" | sort | uniq -c   # converter cross-check (record counts)
```

The comparator may still PASS/FAIL on the survival gate either way (untouched by this fix) — the gate for THIS plan is the sz ground truth plus the visual pair: open `$RT/exports/roundtrip/09.png` next to `$RT/exports/reference/09.png` and confirm the title and code text sizes now visibly match (the formal visual gate is 02-FX3's). Stevedore-side sanity: `node --test scripts/test/*.test.mjs` stays green (no stevedore source touched beyond `vendor/`).
</action>
<verify>RT="${TMPDIR:-/tmp}/stevedore-fx2"; unzip -p "$RT/land-e-slides.pptx" ppt/slides/slide9.xml | grep -o 'sz="[0-9]*"' | grep -o '[0-9]*' | sort -n | tail -1 (must print a value in [2850, 3150]); ! unzip -p "$RT/land-e-slides.pptx" ppt/slides/slide9.xml | grep -qE 'sz="(1414|359)"'; git ls-remote https://github.com/progressEdd/dom-to-pptx.git refs/heads/fix/font-design-viewport refs/heads/stevedore-combined (both resolve); node --test scripts/test/*.test.mjs</verify>
<acceptance_criteria>
- `fix/font-design-viewport` pushed on progressEdd/dom-to-pptx (`git ls-remote` resolves it), merged into `stevedore-combined`, vendored (VENDORED.md lists it with the entry text above)
- Fresh scratch round-trip: slide9.xml max sz within [2850, 3150]; `sz="1414"` and `sz="359"` absent (true ≈3000 / ≈825)
- Fork suite (`vitest run`) passes on the fork clone, including the new capture-viewport tests
- 09.png pair inspected: title/code sizes visibly match the reference (verdict recorded in SUMMARY)
- `node --test scripts/test/*.test.mjs` green on the stevedore side; stevedore diff confined to `vendor/dom-to-pptx/**`
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Diagnosis recorded: A/B sz histograms + probe dumps + confirmed/refuted verdict
- [ ] Fork branch pushed and merged into stevedore-combined; vendor-synced with VENDORED.md updated
- [ ] Slide 9 exported at true size (max sz ≈3000 band, old 359/1414 gone); 09.png pair visually sane
- [ ] Stevedore test suite green; no stevedore source touched outside `vendor/dom-to-pptx/**`
