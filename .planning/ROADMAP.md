# Roadmap: stevedore

## Overview

<One paragraph describing the journey from start to finish.>

## Next up

**⏭️ 01-pptx-to-html** — an agent skill converting `.pptx` → HTML (our own implementation, PPTX2HTML as reference), on a clean `stevedore` branch. Planned — run it with `/skill:implement`.

## Phases

- [ ] **Phase 01: pptx-to-html** — an agent skill that converts `.pptx` decks to HTML — our own implementation (PPTX2HTML as reference), living on a clean `stevedore` branch, consumed via git subtree
- [ ] **Phase 02: <slug>** — <one-line description>
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

### Phase 02: <slug>

- **Goal:** <what this phase delivers>
- **Depends on:** Phase 01
- **Requirements:** <REQ-03>
- **Success criteria** (what must be TRUE):
  1. <Observable behavior from the user's perspective>

Plans:
- [ ] 02-01: <brief description>

## Progress

| Phase | Plans complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01 `pptx-to-html` | 0/8 | Planned | — |
| 02 `<slug>` | 0/1 | Not started | — |

<!--
Conventions:
- Integer phases (1, 2, 3) are planned work; decimal phases (2.1) are urgent insertions.
- Phase numbering never restarts; completed milestones collapse into <details> blocks.
- Only /skill:review (ship) ticks boxes or edits history here.
-->
