---
name: roundtrip-rerun-image-export
captured: 2026-11-23
what: "re-run the LAND.E round-trip now that reference/slides.html is available, and add an image export so comparing doesn't require opening the pptx"
severity: medium
context: "round-trip test export is missing every gif/video slide (14/20 PNGs) and even non-media slides differ from the reference export; user suspects the reference html failed during the original run — redo it against the now-available reference copy"
files:
  - 00-supporting-files/data/land-e-tests/tests/11-19-images/
  - 00-supporting-files/data/land-e-tests/reference/reference-slides-images/
  - 00-supporting-files/data/land-e-tests/reference/slides.html
  - 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html
  - 00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx
---

## Problem

The exported slide images from the round-trip test (`tests/11-19-images/` — 14 of 20 slides) are missing every slide carrying gifs/videos (03, 04, 06, 13, 14, 18 absent), and even the non-media slides don't match the reference export (`reference/reference-slides-images/` — all 20 present). Probable cause per the user: the reference html render failed during the original run; `reference/slides.html` is now available locally, so the comparison can be redone properly. Comparing today requires opening the pptx by hand — there is no image-export step in the flow.

## Solution

- Re-run the round-trip using `00-supporting-files/data/land-e-tests/reference/slides.html` as the source; compare the new output against the existing `tests/land-e-roundtrip.html` to isolate what the failed reference run cost (image gaps + formatting drift)
- Add an image export (per-slide PNGs, like the two folders already on disk) to the round-trip flow so visual comparison never requires opening the pptx

## Research

- Missing test-export slides: 03, 04, 06, 13, 14, 18 — the gif/video slides; reference export has all 20 (`01.png`–`20.png`)
- Fixture locations after this session's reorg: source `reference/slides.html` (655,581 bytes, byte-identical to the LAND.E presentation worktree copy), round-trip pair `tests/land-e-roundtrip.html` (324,269 bytes) + `tests/land-e-slides.pptx` (148,820 bytes); old flat paths under `00-supporting-files/data/` are gone
- Canonical comparator: `node scripts/compare-decks.mjs <source html> <roundtrip html>` — the `../../00-supporting-files/data/…` form recorded in 01-FX2-SUMMARY predates the land-e-tests reorg
- Same thread as pending todo `01-roundtrip-images-formatting.md` (comparator PASSes at 0.988 mean but images at 233% over budget — consistent with images not rendering in the round-trip output)
- LAND.E originals under `~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/` stay untouched — `land-e-tests/` is the self-contained copy for tests

## Decisions

- Test data lives under `00-supporting-files/data/land-e-tests/` split into `reference/` (pristine) and `tests/` (round-trip artifacts + exports)
- The re-run uses `reference/slides.html` as the full reference source (consistent with todo 01's decision: source HTML is the reference, PDF is formatting-only)
