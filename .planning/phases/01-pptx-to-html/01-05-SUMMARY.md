---
status: complete
duration: ≈40min (attempt 1 implementation ~27min before the provider usage-limit abort; attempt 2 resumed run — verify-only — ~13min)
key-files:
  created:
    - scripts/src/pptx/table.js
    - scripts/src/render/table.js
    - scripts/test/table.test.mjs
    - scripts/src/charts/parse.js
    - scripts/src/charts/render.js
    - scripts/test/chart.test.mjs
    - scripts/src/pptx/smartart.js
    - scripts/test/smartart.test.mjs
  modified:
    - scripts/src/pptx/slide.js
    - scripts/src/render/slide.js
requirements-completed:
  - 01-05 tables fully rendered — semantic <table>/<tr>/<td> with gridSpan/rowSpan origins (colspan/rowspan), hMerge/vMerge continuations emitting nothing, per-cell direct borders beating style parts, tcPr fills incl. grad/patt via svgPaint data-URI backgrounds, tableStyles.xml band1H/band2H/firstRow banding
  - 01-05 charts from cached values only — parse from c:chartSpace numCache/strCache (xlsx never opened by design), minimal honest SVG (clustered/stacked bars col+bar, line/area polylines with 30% alpha, pie/doughnut arcs, scatter by rank), fixed 6-color palette, hidden pp-chart-data machine-readable <table>, chartEx and unsupported kinds as placeholders, every simplification an approx diagnostic
  - 01-05 SmartArt from the pre-rendered dsp: drawing via the shared walkSpTree (real shapes/geometry/text at full fidelity, scale-to-fit guard with approx when children fall >10% outside the frame), placeholder + exactly one unsupported diagnostic when the drawing rel is absent
key-decisions:
  - "Missing tableStyles.xml is legitimate (pptxgenjs decks) — style null, flags ignored, no diagnostic; diagonal cell borders render nothing with a single approx"
  - "Charts are cache-only by design; each unsupported feature becomes both an entry in chart.unsupported and a diag.addOnce approx — the hidden data table keeps the output honest while visuals are minimal"
  - "The slide element-walk dispatch was refactored into exported walkSpTree(spTreeNode, ctx, layer) (spec-mandated) so the SmartArt pre-render path reuses it — full shape fidelity for free, no duplicated walker"
  - "Resumed-run discipline: attempt 1's three commits were verified against every acceptance criterion and the plan checklist, never redone or reverted (idempotence law); no fixes were required, so no fix commits exist"
deviations:
  - "Suite verify runs as `node --test scripts/test/*.test.mjs` — Node v24.22.2 removed directory arguments from the test runner (runner-level MODULE_NOT_FOUND, not a test failure); identical suites, 115/115 green; per-task file-form verify commands ran exactly as written (adjudication carried forward from 01-04)"
  - "Zero-dep grep `grep -rn \"from '[a-z@]\" scripts/src/ scripts/` matches only `node:` builtin imports — counted clean, per the 01-03 adjudication"
  - "Attempt 1 aborted mid-run on a provider usage-limit error after all three task commits but before the final checklist and SUMMARY; attempt 2 (this run) verified the committed work, ran the full verification (all suites green; combined table+bar-chart+pre-rendered-SmartArt smoke with only approx diagnostics and no error; zero-dep clean), discarded the stray uncommitted .planning/phases/01-pptx-to-html/01-03-PLAN.md dirt per orchestrator instruction, and wrote this SUMMARY"
---

# Plan 01-05 Summary: Tables, charts (minimal render + diagnostics), SmartArt (pre-rendered fallback)

Decision-21 tiering for structured content is complete: tables render fully as semantic HTML, charts parse from cached values into our own minimal SVG with honest approx diagnostics, and SmartArt renders at full fidelity from the pre-rendered `dsp:` drawing with an honest placeholder fallback.

## Accomplishments

- Tables: `a:tbl` → semantic `<table>` with `<colgroup>`, merged cells as colspan/rowspan on the origin (continuations emit nothing — verified by td count), direct per-cell borders/fills taking precedence over `tableStyles.xml` parts, banding fills from style parts when flags are set, absent `tableStyles.xml` costing no diagnostic
- Charts: `c:chartSpace` parsed strictly from `numCache`/`strCache` (embedded xlsx deliberately never opened), bar/line/area/pie/doughnut/scatter as minimal inline SVG from the fixed palette, `chartEx` and unsupported kinds as dashed placeholders, a hidden machine-readable data table always emitted, every simplification mirrored by an `approx` diagnostic
- SmartArt: data-part rels resolved to the pre-rendered `dsp:drawing`, walked by the same exported `walkSpTree` as slides (real `pp-el`/`pp-geom`/text, zero diagnostics), scale-to-fit with one `approx` if children fall >10% outside the frame box; absent drawing → titled placeholder + exactly one `unsupported` diagnostic
- Verification: `node --test` 115/115 green across all suites (incl. table 2, chart 3, smartart 2); a single-deck smoke converting table + 2×3 bar chart + pre-rendered SmartArt produced HTML for all three with diagnostics of kind `approx` only (`hasErrors` false); zero-dep grep clean (node: builtins only)

## Task commits

1. **Parse and render a:tbl tables with merged cells, borders, and style refs** — `a993fb5` feat(01-05): render a:tbl tables — merged cells, borders, tableStyles banding
2. **Parse charts to cached data and render minimal SVG charts with diagnostics** — `135728a` feat(01-05): parse charts from cached values, render minimal SVG + approx diagnostics
3. **Render SmartArt from the pre-rendered drawing, placeholder otherwise** — `887098f` feat(01-05): SmartArt from pre-rendered dsp drawing via shared walkSpTree, placeholder fallback

## Files created/modified

- `scripts/src/pptx/table.js` — builds the Table model (grid/rows/cells with merge flags, tcPr borders/fills/margins/anchor, styleRef + resolved tableStyle parts) and loadTableStyles
- `scripts/src/render/table.js` — emits the semantic `<table>` with per-side borders (absent sides omitted so border-collapse cannot invent lines), style-part banding fills, svgPaint data-URI backgrounds
- `scripts/src/charts/parse.js` — cache-only chart parsing to kind/title/plotGroups/axes/legend/unsupported
- `scripts/src/charts/render.js` — minimal SVG render (bars, lines, areas, arcs, rank-scatter), placeholders for the rest, pp-chart-title and hidden pp-chart-data table
- `scripts/src/pptx/smartart.js` — buildSmartArt via data-part rels → dsp drawing, shared-walker rendering, scale-to-fit guard, smartArtTitle, placeholder fallback
- `scripts/src/pptx/slide.js` — walkSpTree refactor+export, chart rel loading/parsing wiring
- `scripts/src/render/slide.js` — graphicFrame dispatch to renderTable/renderChart/buildSmartArt inside the frame's .pp-el box; 01-02 generic graphicFrame diagnostic replaced for these kinds
- `scripts/test/table.test.mjs`, `scripts/test/chart.test.mjs`, `scripts/test/smartart.test.mjs` — suites covering every acceptance criterion incl. td-count for continuations, cache-only guard, chartEx placeholder, zero-diagnostics pre-render walk

## Decisions & deviations

Decisions are in the frontmatter. Deviations: (1) suite verify runs as `node --test scripts/test/*.test.mjs` because Node v24.22.2 removed directory arguments from the test runner — identical suites, 115/115 green, per-task file-form verify commands ran verbatim (adjudication carried forward from 01-04); (2) zero-dep grep matches only `node:` builtin imports, counted clean per the 01-03 adjudication; (3) resumed run — attempt 1's provider usage-limit abort left the three task commits landed but the checklist and SUMMARY unwritten; this attempt verified everything idempotently (no fixes needed, no fix commits), discarded the stray uncommitted `01-03-PLAN.md` dirt per orchestrator instruction, and completed the artifacts. Everything else followed the plan as written.

## Next phase readiness

All five waves of phase 01 are now implemented on `agent/01-pptx-to-html/stevedore` with the full suite green — ready for the phase's merge point and gate. Deferred-by-decision-21 targets noted for later phases: chart axis-styling parity, the SmartArt layout engine (PPTX2HTML `smartart/engine.js` is the reference), and upstream visual parity beyond the minimal chart render.
