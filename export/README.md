# export — HTML → .pptx

Standalone html→pptx via the vendored dom-to-pptx fork (the invocation
roundtrip.sh used to bury as its stage 1 — now a consumer entry of its own).

## Usage

    export/html-to-pptx.sh <input.html> -o <output.pptx> [options]

| Flag | Meaning | Default |
|---|---|---|
| `-o <path>` | Output .pptx path | required |
| `-s, --selector <css>` | Slide elements | `section` (pass `.pp-slide` for stevedore converter output) |
| `--title <text>` | Presentation title metadata | input basename |
| `--width <in>` | Slide width in inches | `13.333` (16:9) |
| `--height <in>` | Slide height in inches | `7.5` |
| `-h, --help` | Usage | |

The wrapper self-wraps in `nix shell nixpkgs#chromium` and points the vendored
tool at it via `PUPPETEER_EXECUTABLE_PATH`. Run `scripts/setup-roundtrip.sh`
once first (builds `vendor/dom-to-pptx/dist`).

For flags beyond this surface (`--author`, `--browser-width/--browser-height`,
`--no-pseudo`, `--inject`), invoke the vendored CLI directly:

    nix shell nixpkgs#chromium --command bash -c \
      'cd vendor/dom-to-pptx && PUPPETEER_EXECUTABLE_PATH=$(command -v chromium) node bin/cli-exporter.js <htmlFile> [options]'

See `vendor/dom-to-pptx/` (MIT; fork: progressEdd/dom-to-pptx).
