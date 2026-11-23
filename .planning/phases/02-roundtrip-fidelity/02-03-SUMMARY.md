---
status: complete
duration: 25min
key-files:
  created:
    - scripts/export-slides.mjs
    - scripts/test/export.test.mjs
  modified:
    - scripts/roundtrip.sh
    - README.md
requirements-completed:
  - "T1: export-slides.mjs — deterministic per-slide PNG exporter (fixed 1280×720 viewport, element screenshots, `.pp-slide`/`section` auto-detect, playwright via createRequire from vendor/PPTX2HTML, nix chromium via STEVEDORE_CHROMIUM_PATH) + 4 unit tests green"
  - "T2: export stage wired into roundtrip.sh between pptx→html and compare; proven on the real LAND.E decks — 20+20 PNGs, all 1280×720, non-zero; full roundtrip.sh run produces exports in-flow (ROUNDTRIP-OK); README Layout bullet added"
key-decisions:
  - "Exporter code applied verbatim from the plan (driver wiring, flags, arg errors, tests); the one addition is a capture-mode flatten stylesheet injected after fonts.ready — see deviations"
  - "Flatten rules are shape-scoped no-ops: `svg[data-marpit-svg]`/`.bespoke-marp-osc` selectors only exist in Marp bespoke decks, `.pp-slide` only in ours — one tool, both shapes, per the plan's core objective"
  - "Determinism documented in the file header as fixed tool+viewport+flags, explicitly NOT byte-identical PNGs (plan's own note) — nothing gates on byte equality"
deviations:
  - "Capture-mode flatten stylesheet added to export-slides.mjs (blocker fix, committed with T2): the plan's verbatim code cannot capture the real decks — the Marp bespoke viewer hides inactive slides (`svg.bespoke-marp-slide{content-visibility:hidden;opacity:0;...}`) so locator.screenshot times out at slide 2+, and our converter's fit-scaler (`transform:scale(var(--pp-k,1))` + `margin:16px 0`) shrinks .pp-slide boxes to 1248×702, failing the 1280×720 contract. Added `addStyleTag` after fonts.ready neutralizing both (static position, opacity/content-visibility forced visible, OSC controls hidden, transform/margin reset) so every slide renders as a plain viewport-sized box. Verified: probe showed bespoke classes/opacities; without the fix slide 6 of reference is uncapturable and roundtrip slides measure 1248×702."
  - "Supporting-files cwd note (same as 02-01/02-02): the plan's standing fact cites '../../00-supporting-files/...' from any 02-worktrees/* worktree, but this phase's agent worktree nests at 02-worktrees/agent/02-roundtrip-fidelity/stevedore, so the real relative path is '../../../../00-supporting-files/...'. Same files, pure path arithmetic."
  - "`file` is not on PATH in this environment; the task-2 verify's `file ... | grep -q '1280 x 720'` was run with the binary via `nix shell nixpkgs#file` (same repo-established nix-shell pattern, command and grep untouched). Additionally all 40 PNGs were dimension-checked by reading PNG IHDR (1280×720) as an independent confirmation. EXPORT-OK printed."
  - "gh-mirror.sh is not present inside the stevedore worktree (skill scripts live only in the main checkout), so the progress flips were invoked from the main tree root with the exact arguments given — T1 ✓ and T2 ✓ both landed on issue #55."
---

# Plan 02-03 Summary: Deterministic per-slide PNG export tooling in stevedore's scripts/

One deterministic playwright-on-nix-chromium exporter now screenshots every slide of both deck shapes at a fixed 1280×720 viewport, wired into roundtrip.sh and proven on the real LAND.E decks (20+20 PNGs).

## Accomplishments

- `scripts/export-slides.mjs`: playwright-driven (decision 13, loaded via createRequire from `vendor/PPTX2HTML`), nixpkgs chromium exclusively via `executablePath: STEVEDORE_CHROMIUM_PATH` (no bundled downloads, NixOS-safe), fixed viewport 1280×720 @ deviceScaleFactor 1, deterministic launch flags (`--force-color-profile=srgb --hide-scrollbars --disable-lcd-text --font-render-hinting=none`), `document.fonts.ready` wait, `.pp-slide`/`section` selector auto-detect, zero-padded `01..NN.png` element screenshots
- 4 unit tests (pure helpers + CLI arg/env errors) — no browser needed in unit tests; full suite 145/145 green
- `scripts/roundtrip.sh` gained the `== export PNGs (both sides, deterministic exporter) ==` stage between pptx→html and compare; the dom-to-pptx stage keeps `PUPPETEER_EXECUTABLE_PATH` untouched (decision 10)
- Proof on the real decks from scratch space: reference 20 PNGs + roundtrip 20 PNGs, every file 1280×720 non-zero (IHDR-checked + `file`); full `roundtrip.sh` run ends ROUNDTRIP-OK with both export dirs in-flow
- README.md Layout documents the exporter (playwright driver, `STEVEDORE_CHROMIUM_PATH`, setup via `scripts/setup-roundtrip.sh`)

## Task commits

1. **Write scripts/export-slides.mjs and its unit tests** — `44fe37b` feat(02-03): export-slides.mjs — deterministic per-slide PNG export (both deck shapes)
2. **Wire exports into roundtrip.sh and prove 20+20 PNGs on the real decks** — `7f21323` feat(02-03): roundtrip.sh exports both sides per-slide; exporter proven on LAND.E (20+20 PNGs)

## Files created/modified

- `scripts/export-slides.mjs` — the exporter (created in T1; T2 added the capture-mode flatten stylesheet — see deviations)
- `scripts/test/export.test.mjs` — unit tests: pad2, parseArgs, usage exit 2, missing-env exit 2 with nix hint
- `scripts/roundtrip.sh` — export stage inserted before compare; header stage list updated
- `README.md` — Layout bullet for the exporter

## Decisions & deviations

See frontmatter. The one substantive deviation is the capture-mode flatten stylesheet (blocker: the plan's verbatim code times out on the bespoke reference deck and under-sizes our fit-scaled slides); it is shape-scoped, deterministic, and stays inside the exporter — the smallest change that makes the plan's own acceptance criteria ("every file a 1280×720 PNG", "20+20") true on the real decks. Path depth, missing `file` binary, and mirror-script location are environment notes recorded above; commands were otherwise run as written.

## Next phase readiness

- Both sides of the LAND.E comparison are now captured by ONE tool at ONE viewport — plans 02-04/02-05 (image-diff verification) can consume `$OUT/exports/{reference,roundtrip}/01..20.png` directly from any roundtrip.sh run
- Final committed exports remain future work (plan 02-06, progressEdd) — nothing was committed outside scripts/ + README; all PNGs stayed in scratch (`${TMPDIR:-/tmp}/stevedore-export-verify`)
- Known non-blocker for later phases: chromium antialiasing means PNGs are deterministic-in-tooling, not byte-identical across runs — any future gating must use image comparison, never byte equality
