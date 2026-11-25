# Phase 03-master-capabilities Context

**Gathered:** 2026-11-24 — via `/skill:todo promote` (todos banked mid-work, not grilled)

**GitHub parent:** #76

## Goal

Deliver the 2 promoted todos: master capability folders, multi-format export.

## Decisions

| # | Question | Decision | Why | Issue |
|---|-----------------------------------|-------------------|---------------------------|
| 1 | master capability folders | restructure the master branch with shippEdd-style capability folders — extract (pptx→html), export (html→pptx), render (deck→PNG) — with verification machinery (compare/audit/roundtrip) in a top-level scripts/ | promoted todo 04 (medium), captured 2026-11-24 | #77 |
| 2 | multi-format export | export whole decks to PDF and PNG at any requested resolution (currently PNG-only, hardcoded 1280×720) | promoted todo 05 (medium), captured 2026-11-24 | #78 |
| 3 | path compatibility after restructure | clean break — no shims; every path reference (README, SKILL, examples, scripts calling scripts) updated in the same phase | repo is young; subtree consumers re-sync on update; shims rot | #79 |
| 4 | PDF page geometry | fixed slide-size page: height 7.5in, width = 7.5 × slide aspect (16:9 → 13.33×7.5in, 4:3 → 10×7.5in — PowerPoint's standard sizes); PNG scaled to fit; requested resolution affects sharpness only | PowerPoint-like output; aspect already flows from the deck (converter bakes `p:sldSz`, exporter element-captures) | #80 |
| 5 | worked example (`scripts/examples/land-e/`) | remove entirely — canonical LAND.E data lives on the progressEdd branch under `00-supporting-files/data/land-e-tests/`; the skill docs link there instead | the example duplicates the land-e-tests witness set; no reason to ship a stale copy in the subtree | #81 |

## Constraints

- clean break — no compatibility shims for moved paths; all references (README, SKILL.md, examples, script-to-script) updated in-phase
- determinism preserved — new render modes opt-in, defaults byte-stable (land-e comparison witness)
- zero-dependency posture — PDF via own minimal bundler over the deterministic PNGs, no new runtime deps
- ESM survives the move — moved `.js` engine files need a package.json with `"type": "module"` at their new root (no root package.json exists on master; otherwise every import silently crashes as CJS)
- .gitignore `lib/` exception must follow any moved `test/lib/` (the Python-template `lib/` rule silently ignores it otherwise)
- auditor sync coupling — any touch to the exporter's capture recipe (launch flags, flatten CSS, viewport) is mirrored in all four calibrated auditors

## Open questions

- none — `03-RESEARCH.md` landed (background run, 2026-11-24) and answered all three parked questions; remaining structural micro-choices (test-suite split details, mismatched-aspect fit rule, progressEdd stale-reference handling) are planner territory

## Banked research

### From todo 04 — master capability folders

- shippEdd's pattern (the model): each capability folder = `SKILL.md` + `scripts/` + `README.md`, self-contained; shared machinery in top-level `scripts/`; templates separate
- master's current inventory verified: `scripts/` holds pptx-to-html.js, compare-decks.mjs, export-slides.mjs, roundtrip.sh, setup-roundtrip.sh, vendor-sync.sh, 4× audit-*.mjs, src/ (opc, pptx, render, geometry, charts, util), test/, examples/; vendor/{dom-to-pptx,PPTX2HTML}; reference/ (usage, fidelity, validation); SKILL.md; README; LICENSE (GPL-2.0-only)
- The four auditors are calibrated, phase-02-proven probes (ink ≥0.01 thresholds, gradient toggle calibration 0.5, mono width-probe) — genuinely reusable standalone
- Subtree install documented in README/SKILL: `git subtree add --prefix=.agents/skills/stevedore … stevedore` — paths move in the restructure

### From todo 05 — multi-format export

- Current exporter: `els[i].screenshot({ path: … NN.png })` at fixed 1280×720 — line 108 of `scripts/export-slides.mjs`; playwright-driven (decision 13), nix chromium via `STEVEDORE_CHROMIUM_PATH`
- playwright screenshot options available: `type` (jpeg/png), `scale`/`deviceScaleFactor` via context, `clip` — resolution control is native
- PDF stitching needs only a tiny bundler step over the existing PNGs (no chromium involvement — e.g. a zero-dep PDF writer or img2pdf-style packer; keep zero-dependency posture of the skill)
- Determinism constraint: the committed land-e-tests comparison set (reference + roundtrip 20+20 PNGs) is byte-stable — new modes must be opt-in and default-off
- Related parked todo: 04-master-capability-folders — these modes land in its `render/` folder if the restructure runs first

## Banked decisions

### From todo 04 — master capability folders

- Folder-per-capability modeled on progressEdd/shippEdd — capability = a consumer-invoked function
- Capabilities exposed (trimmed 2026-11-24): extract (pptx→html), export (html→pptx), render (deck→PNG)
- compare/audit/roundtrip are NOT capability folders — they live in the top-level `scripts/` as verification machinery, per shippEdd's shared-machinery convention
- export/ gains a standalone html-to-pptx entry (not just the buried roundtrip stage)
- vendor/ and reference/ stay top-level (shared, not functions)
- Not yet settled: execution mode (Phase 03 via the loop vs direct edit) — the user parked it before choosing

*(settled by this promotion: the loop route — Phase 03 now exists)*

### From todo 05 — multi-format export

- PDF whole-deck via stitching the deterministic PNGs (NOT print-to-PDF)
- PNG resolution: any requested resolution; default stays 1280×720
- Scope excludes JPEG/WebP, single-strip, and per-slide PDF modes (offered in conversation, not chosen)
- New modes opt-in, defaults unchanged (comparison witness byte-stability)
