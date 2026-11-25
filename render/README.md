# render — HTML deck → per-slide PNG

Deterministic per-slide PNG export of any HTML deck (Marp `section` or
stevedore `.pp-slide` shapes) — one tool captures both sides of a round-trip
comparison, apples to apples.

## Usage

    nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
      node render/export-slides.mjs <deck.html> -o <outdir> [--selector css] [--width 1280] [--height 720]

- Slide shape auto-detects: `.pp-slide` if the deck has one, else `section`;
  `--selector` overrides.
- Output: `01.png` … `NN.png` in the outdir (DOM order, zero-padded).
- Requires `STEVEDORE_CHROMIUM_PATH` (nixpkgs chromium — never playwright's
  bundled downloads, NixOS) and the playwright install from
  `scripts/setup-roundtrip.sh` (run once).

## Determinism

Fixed tool (playwright, pinned by the vendored PPTX2HTML toolchain) + fixed
viewport (1280×720) + fixed launch flags ⇒ deterministic in tooling — proven
byte-identical across browser relaunches on one machine/toolchain; NOT
promised across chromium/playwright version changes. Never gate on byte
equality across environments. The four calibrated auditors in `scripts/`
replicate this capture recipe — KEEP IN SYNC with any change here.

## Tests

From the skill root: `node --test render/test/*.test.mjs` (the browser-gated
ink test skips without `STEVEDORE_CHROMIUM_PATH`).
