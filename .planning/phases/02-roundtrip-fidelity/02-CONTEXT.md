# Phase 02-roundtrip-fidelity Context

**Gathered:** 2026-11-23 — via `/skill:define` grilling

**GitHub parent:** #39

## Goal

Make the LAND.E round-trip faithful: all 20 slides — gif/video slides included — survive the dom-to-pptx → pptx-to-html loop, formatting drift is diagnosed per slide and fixed, and the flow exports per-slide PNGs so visual comparison never requires opening the pptx.

## Decisions

| # | Question | Decision | Why | Issue |
|---|-----------------------------------|-------------------|---------------------------|
| 1 | What is the reference for round-trip comparisons? | Source HTML — `00-supporting-files/data/land-e-tests/reference/slides.html` — is the full reference; `slides.pdf` is a visual formatting reference only | It has the most proper format; PDF media doesn't play (imported from todo 01/02) | #40 |
| 2 | Where does test data live? | `00-supporting-files/data/land-e-tests/` split into `reference/` (pristine) and `tests/` (round-trip artifacts + exports) | Self-contained copy for tests; old flat paths are gone (imported from todo 02) | #41 |
| 3 | May the LAND.E originals be touched? | No — `~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/` stays untouched | land-e-tests/ is the working copy (imported from todo 02) | #42 |
| 4 | Which slides does the reference-vs-generated breakdown cover? | The non-media slides present in both exports (01, 02, 05, 07, 08, 09, 10, 11, 12, 15, 16, 17, 19, 20) | The gif/video slides are the re-run/export half's problem (imported from todo 03) | #43 |
| 5 | What must be true at the end — the fix bar? | All 20 slides export; user signs off the reference-vs-generated side-by-side; comparator passes with the images budget tightened to ≤100% over; AND the generated pptx opened in PowerPoint matches the reference HTML | Comparator numbers have lied before (0.988 mean while images were visibly missing); the intermediate pptx is part of the deliverable, not just the final HTML | #44 |
| 6 | How far do the gif/video slides (03, 04, 06, 13, 14, 18) go? | Full fix — render in the round-trip HTML and export as PNGs; but re-run on `reference/slides.html` FIRST to test the hypothesis that the original run's downloaded HTML referenced images that weren't local | Cheap diagnosis before deep fixes — the media problem may collapse entirely if it was non-local refs | #45 |
| 7 | Where does the per-slide PNG export live? | stevedore's scripts/ (`02-worktrees/stevedore/scripts/`) — ships with the skill | User choice; comparison tooling lives with the skill that owns conversion | #46 |
| 8 | How does an unfixable / disproportionate drift close out? | Write it down and move on — accepted imperfections are recorded (slide + one-line reason) and deferred to a later phase; this phase must not over-invest in any one deck/slide | More decks and HTMLs are coming; the phase buys fidelity + the tooling, not perfection on LAND.E | #47 |
| 9 | How should the comparator judge images? | Switch to survival counting — each of the 15 real media files referenced by the source must be present in the round-trip output; bar = 15/15 (raw img-tag counting is dropped as the acceptance metric) | The old metric read 233% (junk gradient strips over-counted) while the real photos were missing — it demonstrably lies | #48 |
| 10 | Where do fixes to the third-party tools live? | Fork both upstreams under progressEdd — `progressEdd/dom-to-pptx` and `progressEdd/PPTX2HTML` — each fix on its own branch, so upstream PRs stay one-click | User wants upstream to be able to take our changes easily; both repos are MIT-licensed and active (pushed Oct 2026) | #49 |
| 11 | What is the combined-repo shape, and what happens to our own pptx→html code? | Stevedore carries copies of both forked codebases with our changes applied; our own implementation stays the pptx→html engine — the PPTX2HTML copy is a reference to port solutions from, the dom-to-pptx copy is the html→pptx half of the loop | User choice; phase-01 criterion 3 ("our own implementation, not vendored PPTX2HTML source") survives | #50 |
| 12 | When does the consolidation happen? | Inside phase 02, forks first — wave 1 forks both repos and assembles the combined structure; later waves fix fidelity there | No fix lands in a place that moves; fixes must be upstreamable from day one | #51 |
| 13 | Which browser driver for our own tooling (export-slides.mjs et al.)? | Playwright — pointed at nixpkgs chromium via executablePath/channel, never bundled downloads; dom-to-pptx keeps puppeteer internally (upstreamability beats driver purity) | Aligns our exporter with PPTX2HTML's proven playwright+pngjs deterministic-PNG pattern; puppeteer is not dead but one convention for code we own is cleaner | #52 |

## Constraints

- The `stevedore` branch stays pure: no `00-supporting-files/` content on it — fixtures and test data live on `progressEdd` (FX2 invariant). Test data may not move onto the stevedore branch to accommodate the vendored code
- Vendored codebases carry their MIT licenses and attribution (credits pattern already established in phase 01's README)
- The forks (progressEdd/*) are the git-history homes — branches per fix, upstream-PR-ready; stevedore carries the combined snapshot, mirroring the established subtree-consumption pattern
- Canonical comparator stays `scripts/compare-decks.mjs` (run from `02-worktrees/stevedore`); its images metric becomes survival counting (15/15 source media present in output) per decision 9
- Fixes and export tooling land on the `stevedore` branch via the phase-01 PR flow (agent branch → stevedore); fixture/artifact refreshes land on `progressEdd`

## Open questions

- none — frontier is clear; the five parked research questions are answered in `02-RESEARCH.md` (root cause: unresolvable relative media refs in the original run; image loss is dom-to-pptx-side plus our own `mergeProps` cascade inversion at `scripts/src/pptx/text.js:39–47`; old PNG exports were ad-hoc captures; per-slide drift table recorded)
