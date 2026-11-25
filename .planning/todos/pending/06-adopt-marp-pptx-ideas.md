---
name: adopt-marp-pptx-ideas
captured: 2026-11-25
what: "Document and selectively adopt fidelity ideas from KatsuYuzu/marp-to-editable-pptx into our dom-to-pptx round-trip"
severity: medium
context: "Compared marp-to-editable-pptx (typed IR + renderer profiles + contract-test regime) against our vendored dom-to-pptx (in-browser build, style math, font embedding); borrow their text-metric and verification architecture"
files:
  - 02-worktrees/master/vendor/dom-to-pptx/src/index.js
  - 02-worktrees/master/vendor/dom-to-pptx/src/node-exporter.js
  - 02-worktrees/master/vendor/dom-to-pptx/src/pptx-normalizer.js
  - 02-worktrees/master/vendor/dom-to-pptx/bin/cli-exporter.js
---

## Problem

Our html-to-pptx direction (vendored dom-to-pptx fork) lets PowerPoint re-wrap text
(`wrap: true` default, only honoring `white-space: nowrap/pre`) and has no
cross-renderer font-metric compensation — CJK-heavy decks reflow in PowerPoint
because DirectWrite renders CJK ~2% wider than Chromium/Skia. Its verification
oracle is one deck (LAND.E 20-slide round-trip, deterministic PNGs,
DRIFT-BREAKDOWN.md), while marp-to-editable-pptx ships a 96-slide fixture with
~494 tests, three contract layers, and per-renderer visual baselines — defects
our pipeline classifies as OK would be caught by theirs.

## Solution

Selectively adopt from https://github.com/KatsuYuzu/marp-to-editable-pptx (MIT,
v1.4.1; pptxgenjs + puppeteer-core, VS Code extension):

- **Renderer profiles** — JSON files modeling PowerPoint-vs-Chromium metric
  drift (`cjkFontSizeScale: 0.98`, `columnWidthScale: 1.05`, line-leading
  divisors, `badgeAverageGlyphWidthEm: 0.58`, `listCjkFontSizeScale: 0.94`,
  `code.lineSpacing: 1.2`), versioned separately from code.
- **Measured line boxes** — DOM `Range` per-line measurement emitted as
  per-line editable text boxes with wrapping disabled, so PowerPoint cannot
  re-wrap browser-measured lines (biggest CJK win).
- **Typed IR + plan separation** — their walker returns `SlideData[]`,
  `createPptxRenderPlan()` builds an immutable plan (visibility, clipping,
  grouping, ownership), executor only executes — far more unit-testable than
  our monolithic in-browser `exportToPptx` (2,589-line index.js).
- **Contract-test layers** — browser→SlideData extraction contract, plan→OOXML
  contract with ordered/multiplicity-aware text oracles (substring presence
  hides duplicate loss and reordering).
- **Visual regression** — pixelmatch plus 16×9 regional diff metrics
  (whole-slide AND localized thresholds, so small damaged regions don't vanish
  into the average), baselines per renderer (LibreOffice + Windows PowerPoint).
- Their raster fallback ideas: in-page Puppeteer screenshots for CSS-filtered
  backgrounds, Mermaid foreignObject SVGs, overflow-clipped images.

## Research

- Upstream pipeline (src/native-pptx/index.ts, `generateNativePptx`): Marp CLI
  HTML → puppeteer load with readiness contract (readyState/fonts/images/stable
  geometry), CSS animations frozen, Marp fragments revealed, OSC UI hidden →
  injected pre-compiled DOM-walker IIFE (esbuild-bundled string constant —
  `page.evaluate(fn)` breaks under webpack minification) → `SlideData[]` →
  `createPptxRenderPlan` → `executePptxRenderPlan` (pptxgenjs, Node) →
  `pptx.write({outputType:'nodebuffer'})`.
- Renderer profile lives at
  `src/native-pptx/renderer-profiles/windows-powerpoint.json`; profile selection
  and per-font/glyph-category overrides tested in `renderer-profile.test.ts`.
- Their walker is Marp-specific (pagination → native slide-number field,
  `![bg]` background layers, bespoke SVG structure, fragments) — ours is generic
  HTML (`.slide` selector); adoption means porting the *techniques*, not the
  Marp coupling.
- Our existing assets they lack: web-font embedding as `fntdata`
  (`src/font-embedder.js` — fixes the root cause their compensation patches
  around), animations/transitions/speaker notes/video media
  (`src/animations/`, `pptx-normalizer.js`), byte-exact media embed
  (fix/media-byte-embed).
- Our fork already does per-line text preservation concepts? No — only
  `white-space` honor (src/index.js:1188-1198, 1549); no metric compensation.
- Reference clone was inspected at /tmp/marp-to-editable-pptx (ephemeral);
  ~83 ADRs in src/native-pptx/README.md document the fidelity history and are
  worth mining for failure modes.
- Their "readiness contract" (wait for document.readyState, fonts, images,
  stable slide geometry before extraction) is more robust than our
  `networkidle0` alone.

## Decisions

- Adoption is selective, not wholesale: keep our font embedding (the lever they
  lack entirely) and our animations/media features; take their text-metric
  compensation, measured-line preservation, and verification architecture.
