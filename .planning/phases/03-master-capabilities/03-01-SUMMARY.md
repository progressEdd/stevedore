---
status: complete
duration: 50min
key-files:
  created:
    - extract/  # moved tree: pptx-to-html.js, src/ (30 files), package.json, test/ (17 suites + lib/deck.mjs), SKILL.md, README.md
    - render/   # moved tree: export-slides.mjs, test/{export,export-ink}.test.mjs, SKILL.md, README.md
    - export/html-to-pptx.sh
    - export/SKILL.md
    - export/README.md
  modified:
    - .gitignore
    - README.md
    - reference/usage.md
    - reference/validation.md
    - scripts/roundtrip.sh
    - scripts/audit-font-metrics.mjs
requirements-completed:
  - SC1  # master restructured into extract/ + export/ + render/ capability folders, verification machinery stays in scripts/
key-decisions:
  - "Direct layout per plan: capability folders hold SKILL.md + README.md + code with no inner scripts/ level; root keeps only README.md + LICENSE."
  - "export/html-to-pptx.sh wraps the vendored dom-to-pptx CLI with stevedore defaults (section, 13.333×7.5) — roundtrip.sh stage 1 routes through it, one code path."
  - "scripts/test/lib/ink.mjs stays in scripts/ as shared machinery; export-ink.test.mjs imports it cross-tree (../../scripts/test/lib/ink.mjs)."
deviations:
  - "FIX (export/html-to-pptx.sh): the plan's verbatim wrapper failed its own Task 3 proof — the vendored cli-exporter.js path.resolve()s input AND output against its own cwd, which the wrapper's inner `cd $VENDOR` sets to vendor/dom-to-pptx/, so the plan's relative $DATA invocation died with 'HTML file not found' (a relative -o would silently write into vendor/). Fixed by absolutizing INPUT (realpath) and OUT (realpath -m) after the wrapper's own -f check — exactly the idiom roundtrip.sh always used; that is why this never surfaced before. Commit 7e1f1b2, 7 lines."
  - "FLAKE OBSERVATION (no code change; machinery, pre-existing): the Task 3 verify's 40-PNG byte-equality gate is stochastic on this machine — one of three full verify runs flaked on roundtrip/02.png (205/921600 pixels, a thin antialiasing edge; witness gray, re-run white). Blob-diff proof: render/export-slides.mjs is byte-identical to the pre-move scripts/export-slides.mjs except the 3 plan-specified path strings — the capture recipe is untouched, so the restructure did not perturb determinism. The final verify run (logged) passed 40/40; a later gate may need to re-run on a flake. Matches the exporter's own header: 'it does NOT promise byte-identical PNGs across runs'."
  - "Trivial plan-text quoting artifacts, applied per intent: export-ink.test.mjs line 52 spawns `-o', out]` (variable) where the plan quoted `-o', 'out']`; usage.md's two `scripts/pptx-to-html.js` strings needed disambiguating context to edit (line 10 command block, line 16 verbatim --help block)."
---

# Plan 03-01 Summary: Restructure master into shippEdd-style capability folders (extract/, export/, render/)

Master's flat scripts/ layout is now three self-contained capabilities — extract/ (pptx→html: CLI, 30-file engine, 17 test suites, ESM package.json, SKILL.md), render/ (deck→PNG: the deterministic exporter + tests + docs), export/ (html→pptx: NEW standalone html-to-pptx.sh entry + docs) — with compare/audit/roundtrip machinery left in top-level scripts/, every reference rewired clean-break, and a full round-trip proven byte-identical to the committed LAND.E witness.

## Accomplishments

- **extract/** — converter moved out of scripts/ (CLI, src/, 17 engine suites + lib/deck.mjs fixture builder, SKILL.md, README.md) with the two landmines defused: the nearest package.json keeps `"type": "module"` (ESM `.js` engine files load), and the .gitignore `lib/` exception follows the moved tree (`!extract/test/lib/`). `scripts/examples/` retired per decision 5; the LAND.E witness is linked from the progressEdd branch instead.
- **render/** — export-slides.mjs + its two tests moved; capture recipe untouched (blob-diff: only the 3 plan-specified self-reference strings changed), so the four calibrated auditors stay in sync by construction. export-ink.test.mjs now imports shared ink.mjs cross-tree.
- **export/** — NEW standalone `html-to-pptx.sh` (nix-self-wrapping, stevedore defaults: `section`, 13.333×7.5 in, title=basename) + SKILL.md + README.md; `scripts/roundtrip.sh` stage 1 routes through it (one code path, not two), stages 2/3 rewired to extract/render.
- **Clean break proven** — stale-path sweep (`scripts/pptx-to-html|scripts/export-slides|scripts/examples`) prints nothing tree-wide; only `scripts/src/` mentions left are the two upstream-credit comments in `extract/src/pptx/{transition,timing}.js` (sanctioned).
- **Full-system proof** — 155/155 tests green under nix chromium (browser-gated ink test included, 0 skips); fresh `scripts/roundtrip.sh` run: ROUNDTRIP-OK, round-trip HTML byte-identical to the witness, 40/40 PNGs byte-identical; standalone entry on pure defaults → pptx → converts back to 20 `class="pp-slide` slides.

## Task commits

1. **Task 1: extract/ capability (CLI, engine, tests, SKILL, package.json); retire scripts/examples** — `ffba7dc` feat(03-01): extract/ capability — move converter (CLI, src, tests, SKILL, package.json) out of scripts/; retire scripts/examples
2. **Task 2: render/ + export/ capabilities; standalone html-to-pptx entry; rewire roundtrip/auditors/tests** — `90a61b5` feat(03-01): render/ + export/ capabilities — move exporter, add standalone html-to-pptx entry, rewire roundtrip/auditors/tests
3. **Task 3: root README + reference docs for the new layout; full-system byte-stability proof** — `ccab564` feat(03-01): root README + reference docs point at the capability layout (clean break)
   - deviation fix (between Tasks 2 and 3): `7e1f1b2` fix(03-01): html-to-pptx wrapper absolutizes relative input/output paths

## Files created/modified

- `extract/` — the pptx→html capability (moved tree + new README.md; SKILL.md moved from root, supporting-files row now links the progressEdd witness)
- `render/` — the deck→PNG capability (export-slides.mjs + 2 tests moved; SKILL.md + README.md new)
- `export/html-to-pptx.sh` (new, executable) + `export/SKILL.md` + `export/README.md` (new)
- `README.md` — full rewrite for the capability layout; subtree install pins `master`
- `reference/usage.md`, `reference/validation.md` — CLI invocations rewired to extract/
- `scripts/roundtrip.sh` — all three stages rewired; stage 1 via the standalone wrapper
- `scripts/audit-font-metrics.mjs` — comment path text only
- `.gitignore` — `!extract/test/lib/` exception added beside the existing one

## Decisions & deviations

Deviations: two real ones, both recorded in the frontmatter — (1) the wrapper absolutization fix (the plan's wrapper code contradicted its own proof; minimum fix mirroring roundtrip.sh's realpath idiom, 7 lines in export/html-to-pptx.sh, commit 7e1f1b2); (2) the byte-equality flake observation (machinery-inherent, not introduced here — recipe-untouched proven by blob diff; final verify run passed 40/40; a gate re-run may occasionally need a retry). Everything else followed the plan as written, including the untouched capture recipe and the census move list.

Uncommitted setup side effects left in the worktree (toolchain noise, deliberately not committed): vendor/dom-to-pptx/package.json gains a bun `workspaces` field and three bin/ files flip to +x — produced by the phase-02-proven idempotent `scripts/setup-roundtrip.sh`; nothing outside the restructure is committed (`git ls-files 00-supporting-files/` empty; no vendor node_modules/dist tracked).

## Next phase readiness

The master tree is the shippEdd root shape: three self-contained capabilities + shared machinery, all references rewired, proven by the byte-stable witness round-trip. Ready for the phase's remaining master-targeting plans to build on this layout (they can reference extract/render/export paths directly), and for the eventual merge-back PR to master (disposition: pr). The stochastic PNG byte-equality note above is the one operational caveat for any future gate that re-runs the 40-PNG comparison.
