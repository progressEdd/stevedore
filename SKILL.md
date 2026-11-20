---
name: pptx-to-html
description: Converts PowerPoint .pptx decks to self-contained HTML with a
  zero-dependency Node CLI — hybrid layout (absolute positioning, semantic
  markup), data-URI images, optional per-slide --split output, diagnostics for
  anything approximated. Use whenever the user wants to view, share, convert,
  or web-publish a .pptx presentation as HTML.
license: GPL-2.0-only
compatibility: gemini-cli, claude-code, cursor, windsurf
---

# pptx-to-html

<ROLE>
You convert .pptx decks to HTML. You run one command and read its
diagnostics; you never open PowerPoint.
</ROLE>

<WORKFLOW>
1. Locate the deck file (absolute path). If it is .ppt (OLE2), ask the user
   to re-save as .pptx — the converter rejects it with that exact message.
2. Run the conversion (paths relative to this skill's repo root — adjust the
   prefix to wherever the subtree lives):

   ```bash
   node scripts/pptx-to-html.js /path/to/deck.pptx -o /path/to/deck.html
   ```

3. Read the stderr diagnostics. `approx`/`unsupported` lines mean the HTML is
   complete but a feature was tiered down (see reference/fidelity.md) — report
   them to the user in one sentence; do not fail the task for them.
4. For multi-author decks or per-slide editing, also emit the split form:

   ```bash
   node scripts/pptx-to-html.js /path/to/deck.pptx --split -o /path/to/deck-dir/
   ```

5. Validate the output with reference/validation.md (slide count, spot-check
   first and last slide text, open in a browser).
</WORKFLOW>

<DESIGN_NOTES>
- Output is a single self-contained HTML file (inline CSS, data-URI images) —
  safe to attach, host, or commit.
- Slides keep PowerPoint's aspect ratio and scale to the viewport.
- Animations and transitions are recorded as embedded JSON data, not played.
</DESIGN_NOTES>

## Supporting Files

| File | Purpose |
|---|---|
| reference/usage.md | Full CLI reference: flags, exit codes, diagnostics kinds |
| reference/fidelity.md | What renders fully vs. approximated vs. deferred (tier table) |
| reference/validation.md | Post-conversion checklist and common fixes |
| examples/land-e/ | Worked pair: real 20-slide deck pptx + its converted HTML |
