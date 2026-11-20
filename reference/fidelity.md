# Fidelity — what renders fully, what is approximated, what is deferred

Paths on this page are relative to the skill root. The parity target is
PPTX2HTML's feature set, staged across phases: every deferred row below is a
candidate for a later phase, and the diagnostics channel
(`reference/usage.md`) names each one at conversion time.

## Tier table

| Tier | Feature | Notes |
|---|---|---|
| Fully rendered | Text + full placeholder inheritance chain (master → layout → slide), runs, fields, links, lists, autofit, vertical-text variants | Semantic HTML markup (`pp-slide`, `pp-shape`, real `<li>`, `<a>`, `<span>` elements) — not a canvas of positioned bytes. |
| Fully rendered | Fills: solid, gradient, pattern; no-fill | Inline SVG `<defs>` per slide. |
| Fully rendered | 40+ preset geometries | Full path data emitted via the preset geometry path engine. |
| Fully rendered | Pictures, including crop and SVG blips | Inlined as data URIs — the output file is self-contained. |
| Fully rendered | Tables | Merged cells, borders, tableStyles banding. |
| Fully rendered | Groups and connectors | Group child transforms composed. |
| Fully rendered | Speaker notes, p14 sections, hidden-slide flags | Rendered as metadata in the output. |
| Fully rendered | Timing and transitions | Parsed and embedded as per-slide JSON data in the HTML — recorded, not played. |
| Approximated | Charts | Rendered as minimal SVG from the **cached** values stored in the pptx (not recomputed from the workbook). |
| Approximated | Exotic preset geometries | Not in the 40+ set → bounding-box rectangle. |
| Approximated | Compound lines | Simplified to single-stroke. |
| Approximated | Scatter charts | Plotted by rank, not by value axis. |
| Approximated | Vertical-text variants | Rendered with simplified flow. |
| Deferred | EMF/WMF images | Placeholder emitted; `unsupported` diagnostic. |
| Deferred | TIFF images | Placeholder emitted; `unsupported` diagnostic. |
| Deferred | EOT embedded fonts | Placeholder; text renders in fallback fonts. |
| Deferred | SmartArt layout engine (without a pre-rendered drawing) | When the deck carries a pre-rendered `dsp` drawing it is used; otherwise placeholder fallback. |
| Deferred | Animation playback | Timing data is embedded as JSON (see above) but not animated. |
| Deferred | 3D effects | Not rendered. |

## How to read a diagnostic against this table

- `approx` → the row is in the Approximated tier: it rendered, simplified.
  The output is complete; report it in one sentence and move on.
- `unsupported` → Deferred tier: placeholder emitted, `--strict` will flag it.
- `missing` → the deck referenced a part that is not in the package; tolerated.
- `error` → a part failed to load; check whether the content matters.

Nothing in the Deferred tier blocks conversion — the converter's contract is
to always produce a complete, viewable HTML deck and *tell you* what was
tiered down.
