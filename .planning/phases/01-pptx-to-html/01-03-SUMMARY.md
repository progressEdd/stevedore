---
status: complete
duration: 40min
key-files:
  created:
    - scripts/src/pptx/theme.js
    - scripts/src/pptx/color.js
    - scripts/src/pptx/fill.js
    - scripts/src/geometry/presets.js
    - scripts/src/geometry/geometry.js
    - scripts/src/render/paint.js
    - scripts/src/render/fonts.js
    - scripts/src/render/shape.js
    - scripts/test/color.test.mjs
    - scripts/test/geometry.test.mjs
    - scripts/test/render-shape.test.mjs
  modified:
    - scripts/src/pptx/context.js
    - scripts/src/pptx/slide.js
    - scripts/src/render/slide.js
    - scripts/src/render/document.js
    - scripts/src/index.js
    - scripts/test/lib/deck.mjs
requirements-completed:
  - 01-03 Task 1 — theme model (clrScheme/fontScheme/clrMap) + color engine (srgb/sys/scheme/prst bases, lumMod/lumOff/tint/shade/satMod/hueMod/alpha/gray/inv/gamma/invGamma transforms, clrMap-direction resolution, Office-default fallback theme)
  - 01-03 Task 2 — fill resolution (all six kinds: noFill/solidFill/gradFill/pattFill/blipFill/grpFill) + resolveLine with dash preset map; preset geometry engine (54 PRESETS builders, none null; custGeom walking with EMU→px; unknown presets → bbox + approximated)
  - 01-03 Task 3 — inline SVG shape rendering: pp-geom svg behind text, gradients/patterns/images as <defs>, dash arrays, marker arrowheads, flip transforms, compound-line parallel strokes, addOnce rate-limited diagnostics; slide backgrounds through the full fill engine (solid CSS / grad / patt / blip via pp-bg svg); fontFamily theme-relative resolution
  - Verification checklist — all suites green (80/80); gradient roundRect + dashed outline deck renders <defs><linearGradient> + stroke-dasharray; zero-dep grep clean (only node: builtins)
key-decisions:
  - "Theme loads in convert() into rctx.theme (part parse + master clrMap, Office-default fallback); the render layer reads it from rctx rather than threading it per call"
  - "Walker elements now carry their raw XML node (additive to the frozen 01-02 contract) — the styling engine resolves spPr fills/geometry/lines at render time, keeping parse- and render-time contracts separate"
  - "Every approximation (unknown/crashing presets, compound lines, ignored effects, pattern fallbacks, tileRect) funnels through diag.addOnce so shape-heavy slides can't flood the channel"
  - "Pie/chord/arc/blockArc/circularArrow/curvedRightArrow compute from adj angles with exact trig (formulas inline in presets.js); multi-part shapes (donut/noSmoking/sun/smiley) use evenodd subpaths"
deviations:
  - "Task 1 gray-transform test value: the plan's expected #b4b4b4 contradicts its own displayed formula (0.21r+0.72g+0.07b on red = 53.55 → #363636); implemented the formula as written and the test asserts each channel within ±2 of the formula's output — scripts/test/color.test.mjs"
  - "Verification command `node --test scripts/test/` (bare directory form) fails on this Node (v24.22.2, MODULE_NOT_FOUND loader quirk — pre-existing since 01-02); the equivalent `node --test scripts/test/*.test.mjs` (and `scripts/test/**/*.test.mjs`) run green, 80/80"
  - "Task 3 wiring touched five files beyond its files list, minimally and additively: scripts/src/index.js (theme load into rctx), scripts/src/pptx/slide.js (node on elements; stale 01-02 background diagnostic removed per the background upgrade), scripts/src/render/document.js (W/H passed to renderSlide), scripts/test/lib/deck.mjs (fixture styling knobs: geom/fill/grad/line/flipH/effects/bgSolid/bgGrad)"
  - "Found in worktree at start, left untouched/uncommitted (not this plan's work): a pre-existing modification to .planning/phases/01-pptx-to-html/01-03-PLAN.md rewriting paths to the scripts/ tree — apparently from the 01-02 relocation"
---

# Plan 01-03 Summary: Styling engine — theme, color transforms, fills, geometry, SVG shape rendering

Shapes now render at decision-21 "fully rendered" fidelity: theme-driven colors with the full transform chain, every fill kind as SVG defs, 54 preset geometries as real path data, and strokes with dashes, compound approximation, and marker arrowheads — all behind the semantic text in the 01-02 boxes, with rate-limited approximation diagnostics.

## Accomplishments

- Color engine resolves srgbClr/sysClr/schemeClr/prstClr through the theme (including the clrMap tx1→dk1 direction) and applies the full transform set (lumMod/lumOff/tint/shade/satMod/hueMod/alpha/gray/inv/gamma/invGamma) in document order; tint-on-red yields the exact #ff8080; absent themes degrade to Office defaults without throwing
- Fill engine returns structured Fills for all six kinds (blipFill resolves r:embed through package rels, stretch or tile); resolveLine carries width/dash/cap/arrowheads/compound; the OOXML→SVG dash map covers all 11 presets
- Geometry: 54 preset builders (arrows, stars, callout wedges, exact-trig arc family, evenodd multi-subpath shapes), custGeom walking (moveTo/lnTo/beziers/close, arcTo straight-line approximation, guide references flagged approximate), unknown presets → bbox + exactly one addOnce diagnostic
- Rendering: `.pp-geom` inline SVG behind text with `<defs>` gradients (objectBoundingBox vectors from DrawingML angles)/patterns (10 common tiles + diagonal fallback)/images, `stroke-dasharray`, flipH/flipV path transforms, compound lines as ±w/3 parallel strokes, effects ignored once per slide; slide backgrounds upgrade from 01-02's solid-hex-only to full resolveFill (gradient backgrounds as full-slide `.pp-bg` SVG)
- Test suite grew 46 → 80, all green; fixture builder (test/lib/deck.mjs) gained styling knobs for later plans

## Task commits

1. **Task 1: theme model and color engine** — `c2c4f5a` feat(01-03): add theme model and color engine with transform chain
2. **Task 2: fill resolution and preset geometry paths** — `a20ab56` feat(01-03): add fill resolution and preset geometry path engine
3. **Task 3: render shapes as inline SVG** — `12a00a9` feat(01-03): render shapes as inline SVG with defs fills, strokes, and arrowheads

## Files created/modified

- `scripts/src/pptx/theme.js` — loadTheme: clrScheme slots kept raw, fontScheme latin+scripts, clrMap passthrough, Office-default fallback
- `scripts/src/pptx/color.js` — resolveColor: bases + transform chain, rgba for alpha < 100%, approx diagnostics for unknown values/transforms
- `scripts/src/pptx/fill.js` — resolveFill (six kinds), resolveLine, DASH_MAP
- `scripts/src/geometry/presets.js` — PRESETS: 54 builders, none null
- `scripts/src/geometry/geometry.js` — shapePath: prstGeom/custGeom → path data + approximated flag
- `scripts/src/render/paint.js` — svgPaint (defs + attr), svgMarkers (arrowhead markers)
- `scripts/src/render/fonts.js` — fontFamily: +mj/+mn resolution, quoted stacks, serif fallback
- `scripts/src/render/shape.js` — geometrySvg: the pp-geom emitter with flips, compound strokes, addOnce diagnostics
- `scripts/src/render/slide.js` — wired geometrySvg behind text; slideBackground via full fill engine
- `scripts/src/render/document.js` — passes slide px size to renderSlide
- `scripts/src/pptx/context.js` — Diagnostics.addOnce (rate limiter)
- `scripts/src/pptx/slide.js` — elements carry `node`; stale background diagnostic removed
- `scripts/src/index.js` — convert() loads the theme into rctx
- `scripts/test/lib/deck.mjs` — fixture styling knobs (geom/fill/grad/line/flipH/effects/backgrounds)
- `scripts/test/color.test.mjs`, `scripts/test/geometry.test.mjs`, `scripts/test/render-shape.test.mjs` — the three new suites

## Decisions & deviations

See frontmatter key-decisions and deviations. Headline deviations: the plan's gray-on-red expected value conflicted with its own formula (formula kept, test tightened to the formula's output ±2); the bare `node --test scripts/test/` directory form is broken on Node v24.22.2 (glob form used, 80/80 green); Task 3's wiring required five additive file changes beyond its files list (listed above). No plan requirement was dropped or descoped.

## Next phase readiness

- 01-04 (text runs/styles) can consume: rctx.theme (fontScheme with scripts maps), fontFamily stacks, fmtScheme slot reserved (parsed lazily when shape style refs a:style/fmtScheme are consumed), bgRef backgrounds still deferred to 01-04 alongside shape style refs
- Every approximation the styling engine makes is visible and rate-limited in diagnostics; the fixture builder can now express styled shapes for any later plan's tests
- The worktree carries three 01-03 commits on agent/01-pptx-to-html/stevedore, ready for the wave merge-back; the uncommitted pre-existing plan-file path rewrite noted in deviations awaits the orchestrator
