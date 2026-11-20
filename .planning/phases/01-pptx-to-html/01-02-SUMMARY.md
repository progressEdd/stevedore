---
status: complete
duration: 35min
key-files:
  created:
    - scripts/src/pptx/context.js
    - scripts/src/pptx/presentation.js
    - scripts/src/pptx/slide.js
    - scripts/test/presentation.test.mjs
    - scripts/test/lib/deck.mjs
    - scripts/src/render/context.js
    - scripts/src/render/slide.js
    - scripts/src/render/document.js
    - scripts/src/index.js
    - scripts/pptx-to-html.js
    - scripts/test/e2e.test.mjs
  modified:
    - scripts/src/pptx/presentation.js
    - .gitignore
requirements-completed:
  - 01-02/T1 — Diagnostics channel (four kinds) + loadPresentation (frozen Presentation shape, per-slide robustness loop with broken placeholders, masters/clrMap capture, core.xml title, hidden slides, px conversion)
  - 01-02/T2 — Three-layer slide walker (master/layout/slide, showMasterSp, sp/pic/grpSp/graphicFrame/cxnSp/mc:AlternateContent dispatch), RenderContext (cached data URIs), renderSlide (hybrid .pp-el + semantic tags + rotation), renderDocument (viewport scaling), convert(data, options)
  - 01-02/T3 — CLI scripts/pptx-to-html.js (bare-node, exit codes 0/1/2/3, --split seam naming 01-06, stderr diagnostics with -q, --strict, --slides range expansion) + e2e subprocess suite
  - 01-02 plan verification checklist — all three boxes demonstrated (full suite, consumer subprocess flow, ESM/zero-dep greps)
key-decisions:
  - "Per-slide render try/catch lives in renderDocument (it owns the slide loop); convert() stays thin and structural failures (not-a-zip, no package) still throw to the CLI's exit-2 path — both plan contracts hold"
  - "mc:AlternateContent preference = first mc:Choice whose Requires names a canonical prefix the parser understands (a/p/r/c/cx/dgm/dsp/p14/p15/a14), else mc:Fallback"
  - "grpSp children flattened with immediate-parent parentGeom and offset by the group's own a:off; chOff/chExt scaling deferred to 01-04 as planned"
  - "graphicFrame gets frameKind detection (a:tbl / c:chart|cx:chartEx / dgm:relIds|dsp:dataModelExt) but the 'unsupported' diagnostic fires only when content is actually present"
deviations:
  - "CLI import is './src/index.js', not the plan literal '../src/index.js' — the plan text predates the scripts/ relocation (commit 38d821f); from scripts/pptx-to-html.js the library is a sibling (scripts/pptx-to-html.js)"
  - "scripts/src/pptx/presentation.js (task-1 file) gained one additive line in task 2 — ctx now carries partName: name — because buildSlide must resolve the slide part's own rels (layout, image embeds) and the frozen ctx contract otherwise had no way to reach the part name"
  - "Node 24.22.2 rejects directory args to `node --test` (treats 'scripts/test' as a module entry); full-suite verification ran as `node --test \"scripts/test/*.test.mjs\"` — 46/46 pass (zip, xml, opc, presentation, e2e); per-task verifies used the plan's exact file-arg commands; bare `node --test` from root also passes 47/47 (it additionally loads test/lib/deck.mjs)"
  - "Task 2's `node -e \"import('./src/index.js')\"` verify ran from scripts/ (cwd note): the relocation put src under scripts/, so the relative specifier resolves from there"
  - "Attempt 3 resumed after a transient network kill mid-attempt-2: committed the correct-but-uncommitted .gitignore fix (ad4280e) as first action per orchestrator fix instructions, then continued from task 2"
---

# Plan 01-02 Summary: Minimal end-to-end pipeline — presentation model, slide walk, renderer, CLI

The first vertical slice cuts all the way through: bytes in, self-contained HTML out — `node scripts/pptx-to-html.js deck.pptx` works as a bare-node CLI against real fixture decks with per-slide/per-feature degradation reported through diagnostics.

## Accomplishments

- Diagnostics channel (unsupported | approx | error | missing) funneling every degradation, with `hasErrors`/`format()`
- `loadPresentation` establishing the frozen Presentation interface: slide size (EMU→px, 4:3 default), eagerly built slides in `sldIdLst` order with corrupt-slide placeholders, masters with theme part + raw clrMap, core.xml title, hidden slides
- Three-layer slide walk (master → layout → slide with `showMasterSp` respect) dispatching sp/pic/grpSp/graphicFrame/cxnSp and preferring understood `mc:Choice`; hybrid-positioning renderer emitting absolute `.pp-el` boxes with semantic `<h1>/<h2>/<p>` inside and viewport-scaled `.pp-slide` containers (`--pp-k`, resize listener)
- `convert(data, { slides })` library entry keeping original slide indices; CLI with exit codes 0/1/2/3, `--strict`, `-q`, `--slides 1,3-5` range expansion, and the `--split` seam (exit 3, names plan 01-06)
- e2e proves the consumer flow as a real subprocess: phantom content-type override → exit 0 with HTML on disk; non-zip → exit 2; `--split` → exit 3

## Task commits

1. **Task 1: diagnostics context and presentation loader** — `681f15a` feat(01-02): add diagnostics channel and presentation loader *(attempt 2; verified and continued, not redone)*
2. **Task 2: slide walker, render context, renderers, convert()** — `83e9528` feat(01-02): add slide walker, render context, slide/document renderers, convert() entry
3. **Task 3: CLI entry + e2e** — `625c486` feat(01-02): add pptx-to-html CLI entry and end-to-end subprocess test

Support commits carrying the plan id: `b6490ca` chore(01-02): unignore test/lib fixture dir · `38d821f` chore(01-02): relocate app tree under scripts/ · `ad4280e` fix(01-02): track gitignore pattern with relocated scripts/test/lib fixture dir (attempt-3 first action per fix instructions)

## Files created/modified

- `scripts/src/pptx/context.js` — Diagnostics class, the four-kind degradation channel
- `scripts/src/pptx/presentation.js` — loadPresentation → frozen Presentation shape; per-slide robustness loop (+ `partName` threaded into ctx)
- `scripts/src/pptx/slide.js` — buildSlide: three-layer walk, element dispatch, geom/text/image extraction, mc:AlternateContent preference
- `scripts/test/lib/deck.mjs` — declarative fixture builder (writeZip seam; advertiseMissing phantom overrides; exact slide XML template)
- `scripts/test/presentation.test.mjs` — loader contracts (order, broken placeholders, phantom override, px math, masters, hidden, title)
- `scripts/src/render/context.js` — RenderContext: cached media data URIs, cssPx
- `scripts/src/render/slide.js` — renderSlide: .pp-el boxes + semantic tags, broken placeholders, backgrounds, rotation
- `scripts/src/render/document.js` — renderDocument: full document skeleton with exact viewport-scaling CSS/JS, per-slide render try/catch
- `scripts/src/index.js` — convert(data, options) → { html, diagnostics, slideCount }
- `scripts/pptx-to-html.js` — CLI (usage contract, exit codes, diagnostics listing, range expansion, --split seam)
- `scripts/test/e2e.test.mjs` — subprocess consumer-flow suite (7 tests)
- `.gitignore` — unignore pattern corrected to `scripts/test/lib`

## Decisions & deviations

See frontmatter deviations. Beyond them, the plan was followed as written — exact-string contracts (usage block, slide XML template, element/ctx shapes, CSS/JS skeleton) applied verbatim. Deep-path smoke beyond the required suites (picture data URI + rotation, group offset, graphicFrame table diag, mc:Choice preference) all verified green.

## Next phase readiness

- 01-03 (fills/theme engine) builds directly on: masters[].clrMap captured raw, `theme` part name resolved, background seam (`solid` srgbClr only) and the `approx` diagnostic already firing for non-trivial fills
- 01-04 (text/structure) replaces the concatenate-`a:t` text extraction and the group offset approximation (`parentGeom` field already on elements)
- 01-06 implements `--split` behind the existing flag/exit-3 seam
- GitHub mirror progress flipped per task: [01-02] T1 (attempt 2) · T2, T3 (this run) on issue #23
