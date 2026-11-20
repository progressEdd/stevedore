---
status: complete
duration: 35min
key-files:
  created:
    - scripts/compare-decks.mjs
    - scripts/test/compare.test.mjs
    - 00-supporting-files/data/land-e-slides.pptx
    - 00-supporting-files/data/land-e-roundtrip.html
  modified:
    - scripts/src/render/text.js
requirements-completed:
  - REQ-01-07 (round-trip verification on real decks, decision 13)
  - zero-dep comparator with gates 0.70/0.30/50%
  - LAND.E fixture round-trip artifacts committed and PASSing
  - PPTX2HTML breadth run: all 5 sample decks convert, zero error diagnostics
key-decisions:
  - "Comparator empty-source-slide drop applies only when source slide count exceeds converted — the rule exists to deflate inflated Marp counts; unconditional dropping mispaired the 20-to-20 LAND.E decks (empty slides at identical indexes on both sides)."
  - "dom-to-pptx v2.1.2 scratch install pinned puppeteer 25.18.1, whose async executablePath() can never satisfy the exporter's sync check, silently defeating PUPPETEER_EXECUTABLE_PATH; pinning puppeteer@23.11.1 in the scratch dir (outside the repo) restored the plan's prescribed browser flow with nix chromium."
  - "Round-trip gap on slide 5 (0.769 jaccard, 13-to-10 words) left as-is: well above the 0.30 min gate, single-slide, provably exporter-side text loss."
deviations:
  - "Environment: node --test scripts/test/ (bare directory) fails on Node v24.22.2 — the runner treats a directory arg as a module (MODULE_NOT_FOUND). Full suite run as node --test scripts/test/*.test.mjs (139/139 pass). Affects only the checklist's literal invocation, not any test."
  - "dom-to-pptx scratch setup: puppeteer downgraded to 23.11.1 in $RT (bun add, outside repo) because v2.1.2's ensureBrowser uses a sync executablePath() check that puppeteer 25 (installed by its own ^25.1.0 range) broke; without it PUPPETEER_EXECUTABLE_PATH is ignored and the exporter tries a 208 MB Chrome download. Also ran `bun run build` once — the repo ships no dist/ UMD bundle and the CLI refuses to export without it (the build script internally invokes npx; the command I wrote was bun run build)."
  - "PPTX2HTML clone: `git fetch --depth 1 origin c8a96eb` was rejected by GitHub (couldn't find remote ref), but the clone's HEAD already was the pinned commit c8a96eb (master tip) — pinned ref achieved without the fallback branch."
  - "Comparator hardening (d7240df) landed as a fix to Task 1's file during Task 2: the real LAND.E deck exposed the pairing rule; thresholds unchanged (0.70/0.30/50% verbatim)."
  - "GitHub mirror progress posts were no-ops all run: 'progress miss: no issue for lookup key [01] plan 01-07 (run capture first)' — script itself reports task NOT blocked."
---

# Plan 01-07 Summary: Round-trip verification against LAND.E and PPTX2HTML samples, robustness hardening

The converter survives both real-deck gauntlets: the LAND.E 20-slide round trip through dom-to-pptx v2.1.2 and back passes the comparator at mean 0.988 / min 0.769 with zero converter diagnostics, and all five PPTX2HTML sample decks convert cleanly with one crash-class bug found and fixed.

## Accomplishments

- **Zero-dep deck comparator** (`scripts/compare-decks.mjs`): script/style-stripping slide splitter for both deck shapes (Marp `<section>`, our `<div class="pp-slide">`), count-aware multiset Jaccard on words, gates 0.70 mean / 0.30 min / 50% image retention; importable + CLI, 9 tests.
- **LAND.E round trip (decision 13)**: fixture exported to pptx with nix Chromium (148 KB, 20 slides), converted back, comparator **PASS — mean 0.988, min 0.769, images 233%**; the pptx converted with an empty diagnostics file (zero error/approx/unsupported). All three artifacts committed under `00-supporting-files/data/`.
- **Breadth run over PPTX2HTML samples (c8a96eb)** — final loop output, zero FAIL lines:

  ```
  OK   sample.pptx 490100 bytes
  OK   animation.pptx 369809 bytes
  OK   drawing.pptx 402158 bytes
  OK   objects.pptx 147157 bytes
  OK   text.pptx 102520 bytes
  ```

  Each output has `<!DOCTYPE html>` and 19/54/13/18/8 `pp-slide` divs respectively.
- **One hardening fix**: sample.pptx slide 19 crashed the renderer (`Invalid URL`) on a hyperlink rel target `test/%5bContent_Types%5d.xml` — the scheme-not-allowed diagnostic called `new URL()` unguarded. Fixed; full suite 139/139 after.

### Diagnostics table (deck → counts by kind) and top-5 messages

| deck      | unsupported | approx | error | missing | total |
|-----------|------------:|-------:|------:|--------:|------:|
| sample    |           0 |     18 |     0 |     151 |   169 |
| animation |           0 |      0 |     0 |     162 |   162 |
| drawing   |           0 |    192 |     0 |      39 |   231 |
| objects   |           3 |     13 |     0 |      61 |    77 |
| text      |           0 |     11 |     0 |      24 |    35 |

Top-5 most frequent messages (the later-phase parity backlog):

1. 437 × `shape without xfrm` (missing) — dominates every deck; usually layout-inherited geometry we already resolve for placeholders, but flagged per shape
2. 10 × `chart feature data labels rendered without fidelity` (approx)
3. 3 × `geometry preset bentConnector2 approximated` (approx)
4. 3 × `geometry preset curvedConnector3 approximated` (approx)
5. 3 × `geometry preset bentConnector3 approximated` (approx)

## Task commits

1. **Task 1: zero-dep deck comparator** — `2a0c725` feat(01-07): add zero-dep deck comparator (splitSlides/words/jaccard) with gates 0.70/0.30/50%
2. **Task 2: LAND.E round-trip + artifacts** — `d7240df` fix(01-07): comparator drop rule deflates only when source slide count exceeds converted (LAND.E 20-to-20 pairing); `a011d3a` feat(01-07): LAND.E round-trip artifacts — dom-to-pptx v2.1.2 export + converter output, comparator PASS mean 0.988
3. **Task 3: breadth run + hardening** — `85a6fe3` fix(01-07): PPTX2HTML sample.pptx slide 19 — unparsable hyperlink rel target (test/%5bContent_Types%5d.xml) crashed render via unguarded new URL in scheme diagnostic

## Files created/modified

- `scripts/compare-decks.mjs` — created; the comparator (pure node:fs/node:url)
- `scripts/test/compare.test.mjs` — created; 9 tests: module functions + spawnSync CLI exit codes + verbatim-threshold/built-in-only assertions
- `00-supporting-files/data/land-e-slides.pptx` — created (committed artifact); dom-to-pptx v2.1.2 export of the fixture
- `00-supporting-files/data/land-e-roundtrip.html` — created (committed artifact); our converter's output from that pptx
- `scripts/src/render/text.js` — modified; hyperlink scheme diagnostic guards `new URL` (unparsable rel targets degrade to an approx diagnostic instead of crashing the slide)

## Decisions & deviations

Decisions and environment deviations are recorded in the frontmatter above. No plan task was skipped, reordered, or lowered: both gates passed at full thresholds (0.70/0.30/50%), no threshold relaxation was needed. Nothing from the scratch dir (`$TMPDIR/stevedore-roundtrip`) was committed; `git status` clean, no `node_modules` in the repo.

## Next phase readiness

Phase 01's converter is proven on real decks end-to-end (HTML→pptx→HTML fidelity ≈ 0.99) and on foreign sample decks (5/5 clean, zero error diagnostics). The parity backlog for later phases is quantified above — `shape without xfrm` noise (437 occurrences) is the top candidate for either suppression or placeholder-geometry resolution, followed by chart data-label fidelity and connector presets. Artifacts for repeatability live in `00-supporting-files/data/`.
