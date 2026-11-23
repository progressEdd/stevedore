# Roadmap: stevedore

## Overview

<One paragraph describing the journey from start to finish.>

## Next up

**Phase 02: roundtrip-fidelity** — fix the LAND.E round-trip: media slides render, formatting drift diagnosed and fixed, per-slide PNG export in the flow

## Phases

- [x] **Phase 01: pptx-to-html** — an agent skill that converts `.pptx` decks to HTML — our own implementation (PPTX2HTML as reference), living on a clean `stevedore` branch, consumed via git subtree
- [ ] **Phase 02: roundtrip-fidelity** — fix the LAND.E round-trip (images, media slides, formatting drift) with per-slide PNG export built into the flow
- [ ] **Phase 03: <slug>** — <one-line description>

## Phase details

### Phase 01: pptx-to-html

- **Goal:** Deliver an agent skill (the inverse of dom-to-pptx) that converts `.pptx` files to HTML, as our own implementation informed by PPTX2HTML — living on a clean `stevedore` branch (README + `src/` only), distributed via git subtree, no npm packaging.
- **Depends on:** nothing
- **Requirements:** from grilling
- **Success criteria** (what must be TRUE):
  1. A command runnable from the skill converts a `.pptx` file to an HTML rendering of the deck
  2. The skill is consumable by git subtree and starts running without npm packaging
  3. The conversion code is our own implementation, not vendored PPTX2HTML source

Plans:
- [x] 01-01: Zero-dep foundation — ZIP reader, XML light DOM, OPC package
- [x] 01-02: Minimal end-to-end pipeline — model, renderer, CLI
- [x] 01-03: Styling engine — theme, colors, fills, geometry
- [x] 01-04: Text engine, media, groups
- [x] 01-05: Tables, charts, SmartArt
- [x] 01-06: Timing JSON, notes, --split mode
- [x] 01-07: Round-trip verification + hardening
- [x] 01-08: Skills layer, examples, subtree proof, README + credits

### Phase 02: roundtrip-fidelity

- **Goal:** Fork PPTX2HTML and dom-to-pptx under progressEdd and assemble them with our own pptx→html engine into one combined repo in stevedore (wave 1), then make the LAND.E round-trip visually faithful end-to-end — re-run from `reference/slides.html`, all 20 slides exported as PNGs (media slides included), per-slide drift breakdown with each drift fixed or explicitly deferred.
- **Depends on:** Phase 01
- **Requirements:** from grilling (consolidates pending todos 01–03: roundtrip-images-formatting, roundtrip-rerun-image-export, reference-vs-generated-breakdown)
- **Success criteria** (what must be TRUE):
  1. Stevedore contains both forked codebases (MIT-attributed, our changes applied) and the whole round-trip runs from it — one setup script, no /tmp scratch cloning
  2. The round-trip flow exports a PNG per slide (all 20) — export tooling in stevedore's scripts/ — so comparison never requires opening the pptx
  3. Media slides survive the loop: present in the export, rendering in the output HTML (re-run on `reference/slides.html` comes first — may reframe this as a staging artifact)
  4. The generated pptx, opened in PowerPoint, looks like the reference HTML
  5. Comparator passes with its images metric redefined to survival counting — 15/15 source media files present in the round-trip output — and every drift in the per-slide breakdown is fixed or explicitly deferred per the agreed policy

Plans:
- [x] 02-01: Fork + vendor — dom-to-pptx and PPTX2HTML forked under progressEdd, vendored into stevedore with MIT provenance, setup-roundtrip.sh + roundtrip.sh, loop proven from a clean checkout
- [x] 02-02: Fix the mergeProps cascade inversion (text.js first-set-wins) + regression tests + suite sweep
- [x] 02-03: Deterministic per-slide PNG export — scripts/export-slides.mjs via playwright on nix chromium, 1280×720, wired into roundtrip.sh, proven 20+20
- [x] 02-04: Comparator images gate → media survival counting (byte-exact 15/15; raw counts report-only)
- [x] 02-05: Re-run from reference/slides.html, gap census, converter-side video rendering, dom-to-pptx fixes as fork branches + vendor sync, defer valve
- [x] 02-06: Canonical artifacts on progressEdd (pptx + HTML + 40 PNGs), DRIFT-BREAKDOWN.md all 20 slides, user sign-off package

## Progress

| Phase | Plans complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01 `pptx-to-html` | 8/8 | Shipped | 2026-11-20 |
| 02 `roundtrip-fidelity` | 6/6 | Executed | — |

<!--
Conventions:
- Integer phases (1, 2, 3) are planned work; decimal phases (2.1) are urgent insertions.
- Phase numbering never restarts; completed milestones collapse into <details> blocks.
- Only /skill:review (ship) ticks boxes or edits history here.
-->
