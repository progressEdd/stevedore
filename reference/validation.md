# Validation — post-conversion checklist and common fixes

Paths on this page are relative to the skill root. Run this checklist after
every conversion before handing the HTML to the user. Commands assume the
skill root as cwd (adjust the `scripts/` prefix for subtree installs).

## Checklist

1. **Exit code 0.** `echo $?` after the convert. Non-zero means an `error`
   diagnostic (code 1) or a usage/IO problem (code 2) — resolve before
   validating anything else.
2. **Slide count equals PowerPoint's.** Count slide containers in the output:

   ```bash
   node scripts/pptx-to-html.js deck.pptx -o deck.html -q
   grep -c 'class="pp-slide' deck.html   # or count files in the --split dir
   ```

   Compare against the slide count PowerPoint (or the user) reports. A
   mismatch with exit 0 usually means hidden slides — they are flagged, not
   dropped; check the diagnostics listing.
3. **Spot-check first and last slide text.** Open the HTML and confirm the
   title of slide 1 and the text of the final slide appear. In `--split`
   mode, open `slide-01.html` and the highest-numbered page.
4. **Grep a known word from an interior slide.** Pick a distinctive word the
   user mentioned from a middle slide and `grep` it in the output. Interior
   slides are where subset bugs would hide.
5. **`--strict` run documents the full approx list.** Re-run with `--strict`
   and read stderr: every approximation and deferral is named once. Record it
   when fidelity matters for the deliverable.
6. **Split-mode index links resolve.** In `--split` output, every link in
   `index.html` points at an existing `slide-NN.html` file:

   ```bash
   ls deck-split/   # index.html + one slide-NN.html per converted slide
   ```

7. **Open in a browser.** The single file (or `index.html`) opens directly —
   no server, no assets. Images are data URIs; offline viewing works.

## Common fixes

| Symptom | Cause | Fix |
|---|---|---|
| `cannot read … : …` exit 2 | Input path wrong, or the file is `.ppt` (OLE2), not `.pptx` | Ask the user to re-save as `.pptx` in PowerPoint; the converter rejects `.ppt` by design. |
| Fonts look wrong | Deck embeds EOT fonts — deferred tier | Text renders in fallback fonts; noted as `unsupported`. Nothing to fix client-side. |
| Chart looks plain | Charts render from **cached** data as minimal SVG — by design | Fidelity tier "Approximated"; the numbers match the cache, styling is simplified. |
| Blank rectangle where an image should be | EMF/WMF/TIFF image — deferred tier | Placeholder by design; report as `unsupported`. |
| Hidden slide missing | Hidden slides are converted but flagged | They appear in output with their hidden state recorded — not a bug. |
| Exit 1 with `error:` lines | A part failed to load (corrupt slide, unreadable media) | The rest of the deck converted; inspect the named slide if its content matters. |
