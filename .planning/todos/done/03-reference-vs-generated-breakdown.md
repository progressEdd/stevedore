---
name: reference-vs-generated-breakdown
captured: 2026-11-23
what: "slide-by-slide breakdown of the reference vs the generated output for all non-media slides"
severity: medium
context: "beyond the missing gif/video slides, the 14 slides that DO render in the round-trip export still don't match the reference export — no per-slide account of where the formatting drift lives"
files:
  - 00-supporting-files/data/land-e-tests/reference/reference-slides-images/
  - 00-supporting-files/data/land-e-tests/tests/11-19-images/
  - 00-supporting-files/data/land-e-tests/reference/slides.html
  - 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html
---

## Problem

The gif/video slides aren't the only gap: the non-media slides that render in the round-trip export still differ from the reference export, and there is no breakdown of what differs per slide — the formatting drift is visible but undiagnosed.

## Solution

Produce a per-slide breakdown comparing `reference/reference-slides-images/` against `tests/11-19-images/` for the slides present in both — cataloguing per slide what differs (layout, text placement, fonts, colors, image sizing) so each drift has a named home.

## Research

- Slides present in both exports (the breakdown's scope): 01, 02, 05, 07, 08, 09, 10, 11, 12, 15, 16, 17, 19, 20 — reference has all 20, tests export has these 14
- Comparator for numeric grounding: `node scripts/compare-decks.mjs 00-supporting-files/data/land-e-tests/reference/slides.html 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html`
- Same thread as pending todos `01-roundtrip-images-formatting.md` and `02-roundtrip-rerun-image-export.md` — this is the diagnostic half; that pair is the re-run + export tooling

## Decisions

- The breakdown covers the non-media slides (all slides other than the gif/video ones missing from the test export)

## Resolution

Done — resolved by phase 02-roundtrip-fidelity (shipped 2026-11-24, PRs #59/#63/#64/#67/#68). Media survival 15/15 byte-exact (the missing images were a staging artifact + exporter byte-handling, closed by the decision-6 re-run and fork branch fix/media-byte-embed); the rerun used reference/slides.html and per-slide PNG export is built into scripts/roundtrip.sh (export-slides.mjs); the per-slide breakdown lives in 00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md — every drift fixed-with-pointer or decision-8 deferred with evidence.
