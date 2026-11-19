# Phase pptx-to-html Context

**Gathered:** 2026-11-19 — via `/skill:define` grilling

**GitHub parent:** #1

## Goal

Deliver an agent skill (the inverse of dom-to-pptx) that converts `.pptx` decks to HTML — our own implementation with PPTX2HTML as the reference — living on a clean development branch shaped like the shippEdd repo, consumed via git subtree, no npm packaging.

## Decisions

| # | Question | Decision | Why | Issue |
|---|-----------------------------------|-------------------|---------------------------|
| 1 | What does phase 01 deliver? | An agent skill converting `.pptx` → HTML | The inverse direction of dom-to-pptx; completes the round-trip story | #2 |
| 2 | Vendor PPTX2HTML or write our own? | Our own implementation — replicate the approach in our code, no vendored source | User directive: "replicate/make our own version of the same code" | #3 |
| 3 | Where does the app live? | The `progressEdd` development branch, forked from `master`; `master` is the merge target (shippEdd-style: master carries the suite) | User revised: "make the progressEdd branch off of master, and make master more like the target similar to shippEdd" — base moved off 00-experiments | #4 |
| 4 | How is it distributed? | git subtree add — no npm packaging | User directive: "a skill people use git subtree to add and start running" | #5 |
| 5 | Runtime for the converter? | Node CLI — agent executes `node` scripts directly | "Agent will take care of it" — no browser interaction in the loop; testable headless | #6 |
| 6 | Branch/skill layout? | shippEdd-shaped: `README.md` + `scripts/` (shared runnable scripts) + `skills/` (SKILL.md folders) + `src/` (converter library) | "Make it like progressEdd/shippEdd — scripts in scripts/, skills in skills/" | #7 |
| 7 | Phase-1 fidelity scope? | Full PPTX2HTML parity — everything research finds it supports (charts, tables, media, …) | User chose "everything PPTX2HTML does"; research enumerates the concrete feature list | #8 |
| 8 | Where does development happen? | On that dedicated branch (just like the shippEdd repo's master carries the suite) — plan executors fork from and merge back into it | User directive: "make a branch just like shippEdd where we do the development on" | #9 |
| 9 | Development branch name? | `progressEdd` | User choice and cross-repo convention (LAND.E has one too); forked from master | #10 |
| 10 | Converter output? | ~~settled in round 3~~ → settled as decision 12 (both modes) | resolved | #11 |
| 11 | Dependencies? | Zero-dep — everything self-implemented in `src/`; runs on bare `node`, node built-ins (e.g. `node:zlib`) allowed | User choice; makes subtree-add → run truly frictionless | — |
| 12 | Converter output? | Both modes: default one self-contained `deck.html` (inline CSS, data-URI images) + `--split` flag emitting a per-slide folder + `index.html` | Single file = best viewing artifact; per-slide files = GitHub-collab without conflicts; shared render core makes both cheap | #12 |
| 13 | Verification decks? | Round-trip: LAND.E `presentation/slides.html` (655 KB real deck) → dom-to-pptx → pptx → our converter → HTML, compared to original; plus PPTX2HTML's samples for breadth | User-supplied anchor + round 2 Q2 choice | #13 |
| 14 | What does `progressEdd` carry from master? | Workflow plumbing stays (`.planning/`, `.agents/`, `AGENTS.md`, `02-worktrees/`, `.gitignore`, `00-supporting-files/`, LICENSE, README); template decor removed (`00-dev-log/`, `01-dev-onboarding/` submodule, `.foam/`); scaffolds `scripts/ + skills/ + src/` | User choice; master untouched until the phase merges in | #14 |
| 15 | Positioning model? | Hybrid — absolute boxes for placement, semantic tags inside (`<h1>`, `<p>`, `<ul>`); slides scale to viewport preserving aspect ratio on resize | "I like hybrid. If I resize, the content will scale and maintain the aspect ratios" | #15 |
| 16 | Relationship to dom-to-pptx? | Standalone — zero code dependency; cross-referenced in docs; credit given where logic is adapted from dom-to-pptx / PPTX2HTML (both MIT) | "No dependency, but give credit that it reuses their code where applicable" | #16 |
| 17 | When is the branch created? | Now, during grilling — user directive: "let's just do it now so that we don't have a PR conflict" | Branch exists before executor waves fork from it | #17 |
| 18 | Skill name(s)? | `skills/pptx-to-html/` — our converter. Reverse direction named `skills/html-to-pptx/` (scope settled in round 6) | Self-describing names; phase slug matches | #18 |
| 19 | Checkout topology? | Main checkout = `progressEdd` (dev happens here); `master` checked out in the `02-worktrees/master` worktree since master gets modified by phase merges | User directive: "checkout the current branch to progressEdd … then have a master branch as a worktree" — executed during grilling | #19 |
| 20 | Scope of `skills/html-to-pptx/`? | Name reserved only — empty placeholder folder; built in a later phase. Sequencing: core scripts (`src/` + `scripts/`) come first; no skills testing until the core is up | "We aren't doing any skills testing until the core scripts are up" | — |
| 21 | Parity depth for phase 01? | Staged parity — full parse-model coverage with tiered render fidelity: text/fills/images/tables/inheritance fully rendered; charts + SmartArt parsed → minimal render + diagnostics; EMF/WMF, TIFF, EOT fonts, animation player deferred to later phases | Research-forced choice; keeps decision 7 as the roadmap target while phase 01 stays shippable | #20 |
| 22 | Animations in phase-01 output? | Static-first — parse `p:timing` fully, emit as embedded JSON data; no player runtime yet (upstream `player=false` seam) | Matches "core scripts up first"; player is a later-phase add-on |
| 23 | Which branch carries the JS work? | `stevedore` — own worktree at `02-worktrees/stevedore`, forked from `progressEdd`; ALL phase-01 executor plans retargeted (`target: stevedore`). `progressEdd` = committed repo-level shell, no app work piles onto it. Merge chain: agent branch → `stevedore` at phase end; `stevedore` integrates into `progressEdd`/`master` at ship | User directive: "it should be on the stevedore worktree branch if you are doing any js. All the progressEdd repo level is already committed. Correct the plans." | #21 |

## Constraints

- No npm packaging — consumers git subtree the skill and run it
- Conversion logic is our own code; PPTX2HTML (MIT) and dom-to-pptx (MIT) are references, not vendored sources; this repo is GPL-2
- Branch topology (decision 23): `master` (final target, parked in `02-worktrees/master`) ← `progressEdd` (repo-level shell, main checkout, carries `.planning/` state) ← `stevedore` (JS/app dev branch, own worktree `02-worktrees/stevedore`) ← `agent/01-pptx-to-html/stevedore` (executor worktrees). All plan `target:` fields read `stevedore`
- Zero external dependencies — bare `node` runs the converter after subtree add; no `npm install`, no package.json deps
- Slides scale to the viewport preserving aspect ratio (resize-safe rendering)
- Where logic is adapted from dom-to-pptx or PPTX2HTML (both MIT), credit it — inline comments and/or a credits section; the code stays our own implementation
- The `progressEdd` branch was created during grilling (2026-11-19), off master, decor removed, scaffold in place — plans fork from it; main checkout is on it; `master` lives in `02-worktrees/master`
- Phase-01 priority order: core converter scripts (`src/` + `scripts/`) first; the skills layer (`SKILL.md`) after the core works; `skills/html-to-pptx/` is a reserved placeholder, nothing more
- Verification fixture: `00-supporting-files/data/land-e-slides.html` (LAND.E `presentation` branch, 655 KB); round-trip input is pptxgenjs-shaped — the OPC reader must tolerate `[Content_Types].xml` advertising absent parts
- Architecture mirror: `opc/` (zip via node:zlib, rels, content types) → `pptx/` model builders → `render/` string emitters; diagnostics channel + `--strict` CLI convention adopted from upstream
- Workflow state (`.planning/`) advances on `progressEdd` (grilling → planning → summaries) and reaches master via phase merges

## Open questions

- none — frontier is clear; research questions resolved in 01-RESEARCH.md
