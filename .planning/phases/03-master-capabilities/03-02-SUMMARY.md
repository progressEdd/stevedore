---
status: complete
duration: 25min
key-files:
  created:
    - render/pdf-bundler.mjs
    - render/test/pdf-bundler.test.mjs
  modified:
    - render/export-slides.mjs
    - render/test/export.test.mjs
    - render/README.md
    - render/SKILL.md
    - README.md
requirements-completed:
  - SC2-a (--scale: PNG at any requested resolution via deviceScaleFactor, viewport auto-tracking at non-default scale)
  - SC2-b (--pdf: whole-deck PDF via zero-dependency IDAT-passthrough bundler)
  - SC2-c (defaults byte-stable: 20/20 witness re-capture byte-identical)
key-decisions:
  - "PDF built by stitching (IDAT passthrough into FlateDecode+Predictor-15 image XObjects), not print-to-PDF — banked CONTEXT decision 2"
  - "Page geometry fixed at 7.5in (540pt) height, width = 540pt × slide aspect — banked CONTEXT decision 4"
  - "PDF write reads back the just-written PNGs so the proven screenshot-to-path capture loop stays byte-untouched"
deviations:
  - "nix attribute poppler_utils was renamed to poppler-utils in current nixpkgs (throws with the replacement named); the poppler cross-validation ran as `nix shell nixpkgs#poppler-utils --command pdftoppm ...` and passed (page 1 at 96 dpi → exactly 1280×720). Recorded here per the plan's standing-facts instruction."
---

# Plan 03-02 Summary: Multi-format render — PNG at any requested resolution (--scale) + whole-deck PDF (--pdf), defaults byte-stable

The render capability gained opt-in `--scale N` (deviceScaleFactor capture at any resolution, viewport auto-tracking the deck's natural CSS size) and `--pdf` (zero-dependency whole-deck PDF via verbatim IDAT passthrough), while the default capture recipe re-proved byte-stable against the committed LAND.E witness 20/20.

## Accomplishments

- `render/pdf-bundler.mjs`: zero-dependency (pure `node:fs`/`node:url`) whole-deck PDF writer — pure IDAT passthrough into PDF FlateDecode image XObjects with PNG predictors (the img2pdf approach), pages fixed at 7.5in (540pt) height with width = 540pt × slide aspect (PowerPoint's standard sizes), no metadata — output is a pure function of the input bytes. CLI + library forms; rejects non-passthrough PNG profiles (non-RGB, non-8-bit, interlaced) with diagnostics. 8 unit tests green.
- Witness proof at the bundler level: the 20 committed reference PNGs bundle to a 4,977,172-byte PDF that passes `qpdf --check` ("No syntax or stream encoding errors found") and is byte-identical across two builds.
- `render/export-slides.mjs` gained `--scale` (deviceScaleFactor; viewport auto-tracks the deck's natural CSS size at non-default scale unless `--width`/`--height` was passed, so Marp sections capture at exactly natural × N) and `--pdf` (bundles the just-written PNGs via read-back, so the screenshot-to-path loop is byte-untouched). Bad `--scale` (≤ 0 / NaN) exits 2 with a diagnostic.
- Default-mode hard gate: default re-capture of the reference deck reproduced all 20 committed witness PNGs byte-for-byte (DEFAULT-BYTE-STABLE-20-20) — the new modes did not perturb the phase-02 capture recipe.
- `--scale 2`: 20 PNGs, every one 2560×1440 (IHDR-checked), byte-identical across two full browser-relaunched runs (SCALE2-BYTE-STABLE-20-20).
- `--pdf`: 20-page deck.pdf written alongside the PNGs; qpdf-clean; raw structure carries `/Count 20`, `/MediaBox [0 0 960 540]` (LAND.E 16:9 → 13.33×7.5in), `/Columns 1280`; poppler cross-validation renders page 1 at 96 dpi to exactly 1280×720; two `--pdf` runs byte-identical.
- Full suite green under `nix shell nixpkgs#chromium` with `STEVEDORE_CHROMIUM_PATH` set: 165 tests, 0 fail, 0 skipped (extract + render incl. the chromium-gated ink test + scripts).
- Zero new runtime dependencies; no file under `scripts/` touched by 03-02's commits (auditors' KEEP-IN-SYNC calibration untouched by construction). Docs updated: `render/README.md` (flag reference + Resolution/Whole-deck PDF sections + determinism note), `render/SKILL.md` (description, WORKFLOW step 4, DESIGN_NOTES bullet), root `README.md` (render section + Layout bullet).
- GitHub mirror: task-list lines T1/T2 flipped on issue #83 (mirror is on in `.planning/config.json`).

## Task commits

1. **render/pdf-bundler.mjs — zero-dep IDAT-passthrough PDF writer + unit tests** — `4c54224` feat(03-02): render/pdf-bundler.mjs — zero-dep IDAT-passthrough whole-deck PDF writer + tests
2. **--scale and --pdf in render/export-slides.mjs + docs + byte-stability proofs** — `78ad1db` feat(03-02): render gains --scale (any requested resolution) + --pdf (whole-deck); defaults byte-stable

## Files created/modified

- `render/pdf-bundler.mjs` (new) — the zero-dependency whole-deck PDF bundler (IDAT passthrough, 540pt-height pages, CLI + library)
- `render/test/pdf-bundler.test.mjs` (new) — 8 pure-function tests: parse, validation diagnostics, scaffolding, geometry, xref offsets, verbatim passthrough, determinism, CLI usage
- `render/export-slides.mjs` — `--scale`/`--pdf` args, deviceScaleFactor knob, viewport auto-tracking at non-default scale, PDF write-back; default capture recipe untouched
- `render/test/export.test.mjs` — two new tests (flag parsing opt-in defaults, bad `--scale` CLI exit)
- `render/README.md` — flags in usage block + list, new Resolution and Whole-deck PDF sections, determinism section line
- `render/SKILL.md` — description mentions --scale/--pdf, WORKFLOW step 4, DESIGN_NOTES bullet
- `README.md` — render section paragraph + Layout `render/` bullet mention both flags

## Decisions & deviations

Decisions followed the plan verbatim (stitching not print-to-PDF, 540pt page geometry, read-back PDF write, viewport auto-tracking only at non-default scale). One environmental deviation: the nix attribute `poppler_utils` has been renamed to `poppler-utils` in current nixpkgs (the failed evaluation throws with the replacement named); the poppler cross-validation check ran successfully as `nix shell nixpkgs#poppler-utils --command pdftoppm -png -r 96 -f 1 -l 1 ...` and rendered page 1 at exactly 1280×720 — the check was completed, not skipped, per the plan's instruction to record the exact invocation. `nixpkgs#qpdf` resolved as-is (matching the research PoC's version family). Pre-existing uncommitted `vendor/dom-to-pptx` workspace-config noise was present in the worktree before this run; left untouched and uncommitted (outside this plan's file set).

## Next phase readiness

The render capability is complete for phase 03's roadmap scope: default PNG capture (byte-stable, witness-proven), any-resolution PNG (`--scale`), and whole-deck PDF (`--pdf`) — all deterministic on this toolchain, all documented in the skill's README/SKILL and the root README. No `scripts/` coupling was disturbed, so the auditors and round-trip loop remain calibrated. Ready for the phase's remaining plans and eventual merge-back to master.
