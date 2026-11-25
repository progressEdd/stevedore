# render — HTML deck → per-slide PNG

Deterministic per-slide PNG export of any HTML deck (Marp `section` or
stevedore `.pp-slide` shapes) — one tool captures both sides of a round-trip
comparison, apples to apples.

## Usage

    nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
      node render/export-slides.mjs <deck.html> -o <outdir> [--selector css] [--width 1280] [--height 720] [--scale 1] [--pdf]

- Slide shape auto-detects: `.pp-slide` if the deck has one, else `section`;
  `--selector` overrides.
- Output: `01.png` … `NN.png` in the outdir (DOM order, zero-padded).
- `--scale <n>`: capture resolution — output pixels = ceil(slide CSS rect)
  × n. At non-default scale the viewport auto-tracks the deck's natural CSS
  size (unless `--width`/`--height` was passed). Default `1`.
- `--pdf`: additionally write `<outdir>/deck.pdf` (see below).
- Requires `STEVEDORE_CHROMIUM_PATH` (nixpkgs chromium — never playwright's
  bundled downloads, NixOS) and the playwright install from
  `scripts/setup-roundtrip.sh` (run once).

## Resolution (`--scale`)

`--scale <n>` sets the capture deviceScaleFactor: output pixels =
ceil(slide CSS rect) × n — a 1280×720 deck at `--scale 2` exports 2560×1440
PNGs. At non-default scale the viewport auto-tracks the deck's natural CSS
size (unless `--width`/`--height` was passed), so viewport-scaled deck shapes
(Marp sections) capture at exactly natural × n instead of letterboxing.
Byte-stable across browser relaunches on this toolchain at every scale
probed (03-RESEARCH Q3) — same doctrine as the default mode.

## Whole-deck PDF (`--pdf`)

`--pdf` additionally writes `<outdir>/deck.pdf`: one page per slide, fixed
7.5in (540pt) page height, width = 540pt × slide aspect (16:9 → 13.33×7.5in,
4:3 → 10×7.5in — PowerPoint's standard sizes), each PNG embedded verbatim
(IDAT passthrough — see `render/pdf-bundler.mjs`). Requested resolution
affects sharpness only (page geometry is fixed); combine with `--scale` for
crisper PDFs. The PDF is a pure function of the PNG bytes — byte-identical
across runs. Supported input: opaque 8-bit RGB PNGs (exactly what this tool
captures); anything else is rejected with a diagnostic.

## Determinism

Fixed tool (playwright, pinned by the vendored PPTX2HTML toolchain) + fixed
viewport (1280×720) + fixed launch flags ⇒ deterministic in tooling — proven
byte-identical across browser relaunches on one machine/toolchain; NOT
promised across chromium/playwright version changes. Never gate on byte
equality across environments. The four calibrated auditors in `scripts/`
replicate this capture recipe — KEEP IN SYNC with any change here.
Both `--scale` and `--pdf` are strictly opt-in — the default capture recipe is unchanged and witness-proven byte-stable.

## Tests

From the skill root: `node --test render/test/*.test.mjs` (the browser-gated
ink test skips without `STEVEDORE_CHROMIUM_PATH`).
