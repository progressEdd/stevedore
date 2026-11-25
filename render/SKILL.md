---
name: render-slides
description: Renders every slide of an HTML deck (Marp section or stevedore
  .pp-slide shape) to deterministic per-slide PNG captures with one tool —
  fixed viewport, fixed launch flags, playwright on nix chromium — and, on
  request, higher-resolution captures (--scale) or a whole-deck PDF (--pdf).
  Use whenever the user wants slide images, a deck PDF, or pixel-level
  comparison artifacts from HTML slides.
license: GPL-2.0-only
compatibility: gemini-cli, claude-code, cursor, windsurf
---

# render-slides

<ROLE>
You render HTML decks to per-slide PNG images. You run one command and read
its output line; you never screenshot by hand.
</ROLE>

<WORKFLOW>
1. Locate the deck HTML (absolute path) and an output directory.
2. Render (paths relative to this skill's repo root — adjust the prefix to
   wherever the subtree lives; run `scripts/setup-roundtrip.sh` once first —
   playwright comes from the vendored PPTX2HTML toolchain):

   ```bash
   nix shell nixpkgs#chromium --command env \
     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
     node render/export-slides.mjs /path/to/deck.html -o /path/to/outdir
   ```

3. The tool auto-detects the slide shape (`.pp-slide` or `section`) and
   writes `01.png` … `NN.png` into the output directory. Non-zero exit with
   an `export-slides:` message means a usage or environment problem — read it.
4. Optional formats: `--scale 2` doubles output pixel dimensions (any
   positive n works); `--pdf` additionally writes `<outdir>/deck.pdf` (7.5in
   pages, PowerPoint aspect sizes). Both are opt-in — defaults are the
   byte-stable 1280×720 capture.
</WORKFLOW>

<DESIGN_NOTES>
- Determinism = fixed tool + fixed viewport (1280×720) + fixed launch flags;
  it does NOT promise byte-identical PNGs across tool versions. Both sides
  of any comparison must be captured by THIS tool — apples to apples.
- Slides render as plain viewport-sized boxes (capture-mode flatten CSS
  neutralizes presentation chrome; shape-scoped, no-op on the other shape).
- Optional `--selector`, `--width`, `--height` flags control capture.
- Optional --scale/--pdf: see render/README.md — defaults never change.
</DESIGN_NOTES>

## Supporting Files

| File | Purpose |
|---|---|
| render/README.md | Full CLI reference: flags, environment, determinism doctrine |
| scripts/setup-roundtrip.sh | One-time playwright/chromium prep |
