---
status: complete
duration: ≈35min attempt 2 (attempt 1 implemented and committed Tasks 1–2 before the provider connection abort; this run verified them, implemented Task 3, ran the full checklist)
key-files:
  created:
    - scripts/src/pptx/timing.js
    - scripts/src/pptx/transition.js
    - scripts/test/timing.test.mjs
    - scripts/test/document.test.mjs
    - scripts/test/split.test.mjs
  modified:
    - scripts/src/pptx/slide.js
    - scripts/src/pptx/presentation.js
    - scripts/src/render/document.js
    - scripts/src/index.js
    - scripts/pptx-to-html.js
    - scripts/test/e2e.test.mjs
    - scripts/test/lib/deck.mjs
requirements-completed:
  - 01-06 decision 22 — p:timing parsed to a plain-JSON tree (tag/attrs/children, spid as number, nodeType passthrough, bldLst as-is, 20,000-node cap + approx) and p:transition to a data record (type, attrs, advClick/advTm, p14 dur, known against the upstream KNOWN set; unknown → known:false + one addOnce approx), both embedded per slide inside .pp-slide as HTML-safe <script type="application/json" class="pp-timing-json"> with \u003c escaping — no player runtime emitted anywhere in scripts/src/render/
  - 01-06 document leftovers — speaker notes (notesSlide body placeholders → slide.notes, rendered as hidden pp-notes aside), p14:sectionLst sections (name + resolved 1-based slide indices, one pp-sections-json script per document), hidden-slide flags (data-hidden="true" + hidden attribute, .pp-slide[hidden]{display:none} in BASE_CSS), <title> fallback chain dc:title → slide-1 title placeholder → 'Deck'
  - 01-06 decision 12 — both output modes from one CLI: default single self-contained deck.html; --split -o <dir>/ (default <input-basename>-split/, mkdir recursive) writes index.html + slide-NN.html per slide, numbering by ORIGINAL index (--slides 3 → slide-03.html only), hidden slides get their own page with the flag but no hidden attribute, index lists every emitted slide with number, title text (≤80 chars), and a notes flag
  - CLI surface final — exit-3 stub removed, --split live, diagnostics/--strict/-q/exit codes unchanged from 01-02, --help wording verified verbatim ("Emit one HTML file per slide + index.html into the output directory")
key-decisions:
  - "documentShell(bodyHtml, presentation, opts) factored out of renderDocument and shared by both renderers (grep-verified in render/document.js and src/index.js) — split pages and index reuse the exact head/CSS/scaler; opts.centerViewport switches .pp-viewport to justify-content/align-items center + height:100vh, leaving single-file output byte-identical"
  - "Hidden slides in split mode keep data-hidden=\"true\" but drop the hidden attribute (decorateSlideHtml { hiddenAttr: false }, the seam Task 2's comment pre-declared) — a hidden slide opened directly must still show; single-file mode keeps flag + attribute"
  - "Shared deck setup (openDeck: package/presentation/theme/render-context; subsetSlides: 1-based filter keeping original indices) extracted so convert and convertSplit cannot drift; per-slide rendering keeps the same try/catch → pp-broken + error diagnostic tolerance in both modes"
  - "Index labels come from the first title/ctrTitle/subTitle placeholder text (slide-sorter convention), truncated at 80 chars with an ellipsis; slides without a title placeholder list with an empty label, never a fabricated one"
deviations:
  - "Full-suite verify runs as `node --test scripts/test/*.test.mjs` — Node v24.22.2 removed directory arguments from the test runner (runner-level MODULE_NOT_FOUND, not a test failure; reproduced on attempt-1's commit 5957f59, pre-existing); identical suite 130/130 green; per-task file-form verify commands ran exactly as written (adjudication carried forward from 01-04/01-05)"
  - "scripts/test/e2e.test.mjs modified although not named in Task 3's <files>: its '--split exits 3 naming plan 01-06' test (from 01-02) asserted the stub this plan removes — the plan's own acceptance criteria (stub gone via grep -c 01-06 → 0, full suite green) made retiring it mandatory; replaced with a comment pointing at split.test.mjs, which carries the full --split contract (4 subprocess tests)"
  - "GitHub mirror progress re-run for tasks 1–2 (idempotent tasklist flips on issue #27) because attempt 1's abort left their mirror state unknown; all three flips confirmed: T1 ✓ T2 ✓ T3 ✓"
---

# Plan 01-06 Summary: Timing/transitions as embedded JSON, speaker notes, metadata, and the --split output mode

Decision 22 closed (timing/transition are embedded data, never a runtime) and decision 12 completed (both output modes live from one CLI) — the deck converter's v1 CLI surface is final and --split works instead of exiting 3.

## Accomplishments

- p:timing → pure JSON tree and p:transition → data record, embedded per slide as HTML-safe `pp-timing-json` (`\u003c` escaping, JSON round-trip proven, no Map/Set/function values); morph known, unknown transitions recorded-not-interpreted with exactly one approx diagnostic; zero player runtime under scripts/src/render/ (grep 0)
- Document-level leftovers landed: speaker notes (hidden `pp-notes` aside), p14 sections (one `pp-sections-json` per document, resolved slide indices), hidden-slide flags with CSS, and the three-step `<title>` fallback
- `--split` emits index.html + slide-NN.html per slide (original-index numbering, verified with `--slides 3` → slide-03.html alone) through a shared `documentShell`; single-file default mode regression-guarded in the same test run; exit-3 stub gone (`grep -c "01-06" scripts/pptx-to-html.js` → 0)
- Full verification checklist demonstrably checked: 130/130 tests; both modes run from the CLI on one fixture (single → exit 0 one file; `--split -o out/` → exit 0, index + per-slide files); timing JSON escaping/purity verified on both modes' outputs

## Task commits

1. **Parse p:timing and p:transition to plain JSON** — `5957f59` feat(01-06): parse p:timing + p:transition to embedded per-slide JSON (parse yes, player no)
2. **Add speaker notes, sections, hidden-slide flags, document metadata** — `a7ae6e9` feat(01-06): speaker notes, p14 sections, hidden-slide flags, title fallback
3. **Implement the --split output mode and finalize the CLI surface** — `c7ddfef` feat(01-06): --split output mode — per-slide pages + index.html, CLI surface final

## Files created/modified

- `scripts/src/pptx/timing.js` — timing tree parser (JSON-only, node cap, enrichments)
- `scripts/src/pptx/transition.js` — transition record parser (KNOWN set, p14 dur, approx-once)
- `scripts/src/pptx/slide.js` — timing/transition/notes wired into the slide model
- `scripts/src/pptx/presentation.js` — p14:sectionLst → presentation.sections with resolved indices
- `scripts/src/render/document.js` — per-slide JSON embed, notes/hidden/title/sections in single-file mode, `documentShell` factored out and exported
- `scripts/src/index.js` — `convertSplit` (per-slide pages + index, original numbering), shared `openDeck`/`subsetSlides`
- `scripts/pptx-to-html.js` — `--split` directory mode, default `<input>-split/`, stub removed, exit codes unchanged
- `scripts/test/timing.test.mjs` — round-trip, escaping, morph/unknown, cap tests
- `scripts/test/document.test.mjs` — notes/sections/hidden/title-fallback tests
- `scripts/test/split.test.mjs` — 4 subprocess tests: split contract, subset numbering, default dir, single-file regression
- `scripts/test/e2e.test.mjs` — stale exit-3 stub test retired (superseded by split.test.mjs)
- `scripts/test/lib/deck.mjs` — fixture knobs: notes slides, sections, transition/timing raw XML

## Decisions & deviations

See frontmatter `key-decisions` and `deviations`. Nothing else deviated: tasks 1–2 from attempt 1 were verified against their acceptance criteria and continued from (idempotence law), never redone; Task 3 implemented exactly per its action text, including the plan-specified `--help` wording verified verbatim rather than reworded.

## Next phase readiness

The converter's CLI surface is final (plan 01-06 was the last surface-changing plan for it): one zero-dep command, two output modes, embedded timing/transition/sections data, no runtime. Branch `agent/01-pptx-to-html/stevedore` carries commits `5957f59` → `a7ae6e9` → `c7ddfef` on top of 01-05, clean tree, ready for the phase's remaining plans (01-07, 01-08) and the orchestrator's merge-back.
