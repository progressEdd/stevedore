---
name: html-to-pptx
description: Converts an HTML deck (Marp section slides or stevedore
  .pp-slide output) into a .pptx file via the vendored dom-to-pptx fork —
  the inverse of pptx-to-html. Use whenever the user wants an HTML
  presentation as a real PowerPoint file.
license: GPL-2.0-only
compatibility: gemini-cli, claude-code, cursor, windsurf
---

# html-to-pptx

<ROLE>
You convert HTML decks to .pptx. You run one command; the vendored
dom-to-pptx CLI does the conversion under nix chromium.
</ROLE>

<WORKFLOW>
1. Locate the deck HTML (absolute path) and the output .pptx path.
2. Convert (paths relative to this skill's repo root — adjust the prefix for
   subtree installs; run `scripts/setup-roundtrip.sh` once first):

   ```bash
   export/html-to-pptx.sh /path/to/deck.html -o /path/to/deck.pptx
   ```

   Defaults: slides selected by `section`, 13.333×7.5 in (16:9), title =
   input basename. Pass `-s .pp-slide` for stevedore converter output.
3. Verify the slide count matches the HTML (convert back with the
   pptx-to-html skill and count slides, or open in PowerPoint).
</WORKFLOW>

<DESIGN_NOTES>
- The wrapper self-wraps in `nix shell nixpkgs#chromium` and points the
  vendored tool at it via PUPPETEER_EXECUTABLE_PATH — no manual env needed.
- For flags beyond the wrapper's surface (author metadata, viewport
  overrides, --no-pseudo), invoke `vendor/dom-to-pptx/bin/cli-exporter.js`
  directly — see export/README.md.
</DESIGN_NOTES>

## Supporting Files

| File | Purpose |
|---|---|
| export/README.md | Full wrapper reference: flags, defaults, requirements |
| vendor/dom-to-pptx/VENDORED.md | Provenance of the vendored tool |
| scripts/setup-roundtrip.sh | One-time build of vendor/dom-to-pptx |
