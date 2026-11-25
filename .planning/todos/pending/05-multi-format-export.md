---
name: multi-format-export
captured: 2026-11-24
what: "export whole decks to PDF and PNG at any requested resolution (currently PNG-only, hardcoded 1280×720)"
severity: medium
context: "the render path is PNG-only; the user wants PDF whole-deck output and resolution-configurable PNG from the same deterministic exporter"
files:
  - 02-worktrees/master/scripts/export-slides.mjs
  - 02-worktrees/master/scripts/roundtrip.sh
  - 02-worktrees/master/scripts/test/export-ink.test.mjs
---

## Problem

`scripts/export-slides.mjs` outputs exactly one format: per-slide PNG at a fixed 1280×720 viewport (element screenshots). No PDF output exists anywhere in the tooling (grep: zero PDF hits), and no way to request a different resolution — hi-res exports for print/zoom or smaller artifacts aren't possible without editing the script.

## Solution

Two extensions to the same exporter (scope as settled by the user, 2026-11-24):

1. **PDF (whole deck)** — stitch the deterministic per-slide PNGs into a single deck PDF. Preferred over playwright `page.pdf()` print-to-PDF: reuses the exact proven capture path (no new rendering variables — print engine ≠ screen engine), keeps determinism.
2. **PNG at any resolution** — resolution parameter on the export: `deviceScaleFactor` scaling and/or explicit viewport dimensions. Default stays 1280×720 so the round-trip comparison witness is unchanged.

Wire both into `scripts/roundtrip.sh` as opt-in stages (defaults unchanged — the committed comparison set must stay byte-stable).

## Research

- Current exporter: `els[i].screenshot({ path: … NN.png })` at fixed 1280×720 — line 108 of `scripts/export-slides.mjs`; playwright-driven (decision 13), nix chromium via `STEVEDORE_CHROMIUM_PATH`
- playwright screenshot options available: `type` (jpeg/png), `scale`/`deviceScaleFactor` via context, `clip` — resolution control is native
- PDF stitching needs only a tiny bundler step over the existing PNGs (no chromium involvement — e.g. a zero-dep PDF writer or img2pdf-style packer; keep zero-dependency posture of the skill)
- Determinism constraint: the committed land-e-tests comparison set (reference + roundtrip 20+20 PNGs) is byte-stable — new modes must be opt-in and default-off
- Related parked todo: 04-master-capability-folders — these modes land in its `render/` folder if the restructure runs first

## Decisions

- PDF whole-deck via stitching the deterministic PNGs (NOT print-to-PDF)
- PNG resolution: any requested resolution; default stays 1280×720
- Scope excludes JPEG/WebP, single-strip, and per-slide PDF modes (offered in conversation, not chosen)
- New modes opt-in, defaults unchanged (comparison witness byte-stability)
