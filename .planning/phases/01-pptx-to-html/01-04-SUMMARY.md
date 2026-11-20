---
status: complete
duration: 35min
key-files:
  created:
    - scripts/src/pptx/text.js
    - scripts/src/pptx/symbols.js
    - scripts/src/render/text.js
    - scripts/test/text.test.mjs
    - scripts/test/render-text.test.mjs
    - scripts/test/media.test.mjs
  modified:
    - scripts/src/pptx/slide.js
    - scripts/src/render/slide.js
    - scripts/src/util/xml.js
    - scripts/test/lib/deck.mjs
requirements-completed:
  - 01-04 text engine with inheritance chain (slide → layout → master + list styles)
  - 01-04 semantic HTML text rendering (lists, runs, fields, hyperlinks, autofit, vertical text)
  - 01-04 media fidelity (crop, SVG blips, deferred EMF/WMF/TIFF), groups with child-coordinate transforms, connectors
key-decisions:
  - "Runs with zero merged properties render as bare escaped text inside <p>/<li>/<h1> instead of a style-less <span> — keeps property-free titles/paragraphs semantically clean and preserves the 01-02 e2e <h1> contract; the plan's span template applies whenever any property exists"
  - "buildTextBody ctx carries the plan's four named keys plus ph/masterRoot/defaultTextStyle/pkg/partName — the extra keys are the plumbing the chain itself needs (levels 1-2 of the merge and link/bullet rel resolution); buildSlide stashes layoutRoot/masterRoot/defaultTextStyle on each slide to feed it"
  - "srcRect stored as per-mille ints (raw 0..100000 / 100) so the render-side crop math operates in the plan's 0..1000 space"
  - "Group transforms implemented as an affine accumulator {kx, ky, dx, dy} composed down the walk (innermost groupId wins for rotation wrappers); rotated groups wrap their contiguous children in one .pp-group div with origin-compensated offsets"
  - "Connectors without prstGeom get a synthesized a:prstGeom prst='line' in the walker (OOXML default), keeping the default-geometry rule inside a plan-named file"
deviations:
  - "Bullet hanging indent: the plan's literal formula padding-left:${marL - indent}px;text-indent:${-indent}px inverts OOXML's signed indent (PowerPoint writes negative indents; the literal formula would double the hang). Emitted padding-left:${marL}px;text-indent:${indent}px — mathematically correct for signed values; files: scripts/src/render/text.js"
  - "Suite verify command: node --test scripts/test/ (and scripts/test) no longer accepts a directory on Node v24.22.2 (runner-level MODULE_NOT_FOUND, not a test failure). Ran the identical suite as node --test scripts/test/*.test.mjs — same suites, all green; per-task file-form verify commands ran exactly as written"
  - "Field/link/bullet contracts carry small extra keys beyond the plan's shapes where needed for faithful rendering (field.rawType for the unknown-type diagnostic, bullet.font for symbol-mapped bullet chars) — additive, contract-compatible"
---

# Plan 01-04 Summary: Text engine with inheritance, semantic text rendering, media, groups, connectors

The decision-21 "fully rendered" tier landed: the complete a:txBody model with the seven-level placeholder inheritance chain, semantic self-contained HTML text (real lists, inline-styled runs, fields, whitelisted hyperlinks, autofit, vertical text), picture fidelity (crop, SVG-over-raster preference, deferred EMF/WMF/TIFF placeholders), concatenated group transforms, and connectors through the full shape path — 108/108 tests green.

## Accomplishments

- `buildTextBody` merges paragraph and run properties down the full chain (presentation defaultTextStyle → master a:txStyles → master placeholder → layout placeholder → own a:lstStyle → a:pPr → a:rPr), most-specific-wins, with buNone overrides, colors resolved post-merge, symbol fonts (Wingdings/Symbol, ~40 glyphs) mapped to Unicode before storage, and rel-backed hyperlinks/bullet images
- `renderText` emits decision-15 semantics: `<h1>`/`<h2>` titles, char bullets as `<ul>` with aria-hidden chars and PowerPoint hanging indents, auto bullets as native `<ol type>`, the full 18-variant underline map (dbl → border-bottom fallback), fields resolved to live slide numbers, http/https/mailto-only anchors (javascript: and friends never reach href), autofit scaling at emit, and writing-mode for vertical text
- Media: exact object-position crop math, asvg:svgBlip preferred over raster fallbacks (namespace added to the canonical map), EMF/WMF/TIFF flagged `unsupported` with truthful dashed placeholders, OLE/ink frames diagnosed and not rendered
- Groups: child-coordinate remap via composed affine transforms (kx/ky from ext/chExt, guarded against zero chExt), nested groups exact, rotated groups wrapped in one rotating container
- Connectors verified through the existing shape path (line preset, arrowhead markers) with a synthesized line default when prstGeom is absent

## Task commits

1. **Build the txBody model with the full inheritance chain** — `f9b9492` feat(01-04): add txBody model with full placeholder inheritance chain and symbol map
2. **Render semantic HTML text — lists, runs, fields, links, autofit, vertical text** — `674b1cf` feat(01-04): render semantic HTML text — lists, runs, fields, links, autofit, vertical text
3. **Media fidelity — crop, SVG blips, unsupported formats; groups; connectors** — `76d8cda` feat(01-04): media fidelity — crop, SVG blips, deferred formats; group transforms; connectors

## Files created/modified

- `scripts/src/pptx/text.js` — created: buildTextBody model, mergeProps, matchPlaceholder, the seven-level chain
- `scripts/src/pptx/symbols.js` — created: Wingdings/Symbol glyph map with addOnce fallback
- `scripts/src/render/text.js` — created: semantic renderer (lists, runs, fields, links, autofit, vertical)
- `scripts/src/pptx/slide.js` — modified: chain-input stashing, srcRect/SVG-blip/unsupported media, group transform accumulator, cxnSp line default, OLE/ink detection
- `scripts/src/render/slide.js` — modified: renderText wiring with titleLevel, phChain assembly, crop style, deferred placeholders, rotated-group wrappers
- `scripts/src/util/xml.js` — modified: asvg namespace in the canonical prefix map
- `scripts/test/text.test.mjs`, `scripts/test/render-text.test.mjs`, `scripts/test/media.test.mjs` — created: 28 new tests
- `scripts/test/lib/deck.mjs` — modified: fixture seam grew layouts, rich paragraphs/runs, rels, pictures (srcRect/svg), raw shapes, ctDefaults, txStyles/defaultTextStyle knobs

## Decisions & deviations

Key decisions are in the frontmatter. Deviations: (1) the bullet hanging-indent formula corrected for OOXML's signed indent (the plan's literal form doubles the hang for the negative indents PowerPoint actually writes); (2) suite verify runs as `node --test scripts/test/*.test.mjs` because Node 24 removed directory arguments from the test runner — same suites, all green, per-task file-form commands ran verbatim; (3) additive contract keys (field.rawType, bullet.font) where faithful rendering needed them. Everything else followed the plan as written.

## Next phase readiness

Text, media, and geometry are at the decision-21 fully-rendered tier; the render surface is self-contained (data URIs, whitelisted links only). Deferred and ready for later plans/waves: EMF/WMF/TIFF conversion, tables/charts/SmartArt (currently `unsupported` diagnostics), wordArt vertical variants, and the fmtScheme style-matrix (still parsed lazily). The e2e fixture contract held throughout — no regressions.
