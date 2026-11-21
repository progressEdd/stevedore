---
name: roundtrip-images-formatting
captured: 2026-11-20
what: "tested HTML had images that didn't show up in the round-trip loop; formatting doesn't line up with the roundtrip artifact"
severity: medium
context: "LAND.E round-trip: source presentation HTML loses its images and drifts in formatting through the dom-to-pptx → pptx-to-html loop"
files:
  - ~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/slides.html
  - 00-supporting-files/data/land-e-roundtrip.html
---

## Problem

The HTML used for the LAND.E round-trip test (local copy at `~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/slides.html`) had images that did not show up in the round-trip loop output, and the formatting doesn't line up between that source and the committed round-trip artifact `00-supporting-files/data/land-e-roundtrip.html`.

## Solution

not stated

## Research

- Source presentation HTML (local copy): `~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/slides.html`
- Committed round-trip pair on progressEdd: `00-supporting-files/data/land-e-slides.html` (source) and `00-supporting-files/data/land-e-roundtrip.html` (output); fixture deck `00-supporting-files/data/land-e-slides.pptx`
- Canonical comparator command (from `02-worktrees/stevedore`): `node scripts/compare-decks.mjs ../../00-supporting-files/data/land-e-slides.html ../../00-supporting-files/data/land-e-roundtrip.html`
- Verified facts from the phase-01 verification (2026-11-20): comparator PASSes at thresholds 0.70/0.30/0.50 — mean 0.988 / min 0.769 / **images 233%** — the images-over-budget metric is consistent with images not rendering correctly in the round-trip output despite the pass
- Visual formatting reference: `~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/slides.pdf` (confirmed on disk, next to `slides.html`) — use it as the ground-truth look for LAND.E formatting; note the PDF's videos and gifs don't play, so it's a formatting reference only, not a media one
- `scripts/compare-decks.mjs` thresholds live at lines 19–21 (0.70/0.30/0.50)

## Decisions

- Round-trip comparisons use the source HTML — `~/Documents/development_projects/progressEdd_projects/LAND.E/02-worktrees/presentation/slides.html` — as the full reference (it has the most proper format); the PDF is a visual formatting reference only
