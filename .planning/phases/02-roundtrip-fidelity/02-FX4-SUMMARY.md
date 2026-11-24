---
status: complete
duration: 8min
key-files:
  created:
    - scripts/test/lib/ink.mjs
    - scripts/test/export-ink.test.mjs
    - scripts/audit-code-ink.mjs
  modified:
    - scripts/export-slides.mjs
requirements-completed:
  - VERIFICATION gap 4 (post-verify2 addendum #3, 2026-11-24) — tint fills no longer hide code runs in exported PNGs; slides 08–11 code-area ink proven ≥ 0.01 through the committed auditor (issue #65)
key-decisions:
  - "Task 1's falsifiable matrix confirmed the paint-order hypothesis on the FIRST pass: only the `stack` variant flipped (0.00012 → 0.05492); settle/motion/lifecycle stayed at 0.00012 — no timing/media/lifecycle ingredient, no combined variants needed, no z-index escalation needed (plain `.pp-text{position:relative}` sufficed, per the primary stack branch)"
  - "The probe's points[].stack is VACUOUS, not contradicting: slide 8 sits at viewport y≈5067 in the un-scrolled 20-slide-tall converted page, below the 720px viewport, so elementsFromPoint hit nothing (empty stacks). The verdict rests on the stack-variant flip — the matrix's decisive datum"
  - "spanRect sanity: the first ui-monospace span on slide 8 is \"- \" (2 chars) → 5.9×11px at 10px monospace is metrically sane; fontsCheck true, spanFont resolves 'ui-monospace, Calibri, sans-serif' — no font-metrics indictment (corroborated by the stack variant painting 21764 ink px)"
deviations:
  - "Plan's ../../ test-data paths ran as ../../../../ from the agent worktree (standing phase path-depth deviation, FX2/FX3-recorded) — plan's ../../ resolves to 02-worktrees/ which carries no data"
  - "Task 3's eyeball spot check executed as ASCII ink renders + band-structure comparison instead of literal eyes — the session model cannot render images (FX3 standing precedent); one-line notes per slide below, quantitative pair evidence recorded"
  - "gh-mirror.sh invoked from the main tree (cwd = repo root) — .agents/ and .planning/ are untracked and absent from worktrees (standing deviation, FX1-recorded); all three task flips succeeded (issue #65)"
  - "Task 1 command ordering: the plan writes fx4-diagnose.mjs into $T then `rm -rf $T` (which would delete the script); the script was preserved across the cleanup — the rm's intent (clean scratch dir) honored, script content verbatim"
  - "no unzip needed this run (7z standing host deviation not exercised — no pptx XML extraction in this plan)"
---

# Plan 02-FX4 Summary: Capture-safe paint order — tint fills no longer hide code runs in exported PNGs

The falsifiable variant matrix convicted paint order on the first pass (only `stack` flipped), the one-rule CSS 2.1 App E fix landed in `scripts/export-slides.mjs` behind a browser-driven fixture regression that fails pre-fix (0.00072) and passes post-fix, and the committed `scripts/audit-code-ink.mjs` proves slides 08–11 of the canonical round-trip deck now ink at 0.032–0.055 code-area fraction (bar: ≥ 0.01; reference sanity 0.02824).

## Diagnosis record (task 1 — the matrix decides)

Slide 8 of the canonical round-trip HTML, ink fraction (luma<160) inside the code-area union rect (x48 y134 w1169 h339, total 396291 px):

| variant | ink | fraction | flips (≥0.01 jump)? |
|---|---|---|---|
| baseline | 49 | 0.00012 | — (specks only, as the gap predicted) |
| settle (+rAF×2, 500ms) | 49 | 0.00012 | no |
| motion (reducedMotion + MOTION_CSS) | 49 | 0.00012 | no |
| lifecycle (waitUntil:load + 1500ms) | 49 | 0.00012 | no |
| **stack (`.pp-text{position:relative}`)** | **21764** | **0.05492** | **YES** |

Reference-deck sanity (Marp side, slide 8, `<pre>` union rect): fraction **0.02824** (19274/682596) — ≥ 0.01, the metric demonstrably detects ink where ink exists.

Probe dump (baseline page state): `fontsCheck: true` · `spanFont: "ui-monospace, Calibri, sans-serif"` · `spanRect: {w: 5.9, h: 11}` (first span is `"- "`, 2 chars — metrically sane at 10px monospace; the deck also carries 388-char spans) · `points[].stack: []` at all five code-run points — vacuous, not contradicting: the probe ran at viewport y≈5204 (slide 8 is below the un-scrolled 720px viewport of the 20-slide-tall converted page), so `elementsFromPoint` hit nothing. The live-page paint-order fact therefore could not be witnessed directly by this probe; the stack-variant flip is the decisive datum and it landed on the plan's primary expected branch.

**Verdict: paint order confirmed (CSS 2.1 Appendix E — the positioned `.pp-geom` fill svg paints in step 8 above its static `.pp-text` sibling's step-7 text). Fix dictated: the `stack` branch — `.pp-text{position:relative}` appended to the exporter's flatten block.** No z-index escalation, no settle/emulateMedia/waitUntil changes, no combined variants required.

## Accomplishments

- **Diagnosis captured** (task 1, scratch only): five-variant matrix + probe + reference sanity at `${TMPDIR:-/tmp}/stevedore-fx4/variants/matrix.json`; FX4-DIAGNOSIS-CAPTURED
- **Fix applied and locked** (task 2): `.pp-text{position:relative}` with the full `(02-FX4)` App E comment in `scripts/export-slides.mjs`'s flatten block — tree-order-preserving, no-op on Marp decks (no `.pp-text` there); launch args, 1280×720 viewport, `STEVEDORE_CHROMIUM_PATH` guard untouched
- **Regression captured**: the fixture (converter-exact markup: positioned `pp-geom` tint svg + static `pp-text` sibling) FAILED pre-fix at panel fraction **0.00072 < 0.01** and PASSES post-fix — gap 4 is reproduced and locked; the miniature needed no scale-up
- **Example deck unchanged-or-better** (FX4-EXAMPLE-OK): 20 slides pre vs post, no slide dropped > 0.001; the four code slides gained ink (08: 0.00076→0.00287, 09: 0.00081→0.00439, 10: 0.00081→0.00241, 11: 0.00097→0.00249) — "better", not noise
- **Auditor committed and proven** (task 3, FX4-INK-OK): canonical round-trip slides 08/09/10/11 code-area fractions **0.05492 / 0.04651 / 0.05515 / 0.03217**; reference slide 8 sanity **0.02824** — all ≥ 0.01
- Suite green both ways: `node --test scripts/test/*.test.mjs` browser-less (151 tests: 150 pass, 1 skip — the new test skips cleanly) and under the nix chromium wrapper (1/1 pass)

## Task commits

1. **Falsifiable capture diagnosis — variant matrix on the real code slide** — no commit (scratch-only task by design; findings above and in `${TMPDIR:-/tmp}/stevedore-fx4/`)
2. **Apply the indicted fix to export-slides.mjs and lock it with a fixture ink-fraction regression test** — `b93135f` fix(02-FX4): capture-safe paint order — tint fills no longer hide code runs in exported PNGs
3. **Commit the code-ink auditor and prove slides 08–11 ink on the canonical deck** — `8b9e791` fix(02-FX4): code-ink auditor — per-slide capture-path ink measurement in scripts/

## Files created/modified

- `scripts/export-slides.mjs` — +9 lines: the `(02-FX4)` stack-branch rule (comment + `.pp-text{position:relative}`) appended to the flatten block
- `scripts/test/lib/ink.mjs` — ink helper: lazy-pngjs `loadPng` + rec.701-luma `inkFraction` (threshold 160) + CLI spot-check form
- `scripts/test/export-ink.test.mjs` — browser-driven capture regression: converter-exact fixture (fill-less title + five tinted code-line boxes), panel ≥ 0.01 / title ≥ 0.01 assertions, skips without `STEVEDORE_CHROMIUM_PATH`
- `scripts/audit-code-ink.mjs` — per-slide code-ink auditor through the production capture path (mirror of the post-fix flatten state), JSON output, optional PNG write; reusable by 02-FX5

## Decisions & deviations

Decisions: the matrix's verdict was taken verbatim to the branch table's primary `stack` row — no improvisation needed; the z-index escalation and combined variants were never triggered because the plain form flipped on the first pass. Deviations: the five frontmatter items — test-data paths at `../../../../` (standing FX2/FX3), eyeball spot check by ASCII ink renders + band comparison (model cannot render images, FX3 precedent; notes: slide 08 "two code panels now paint periodic code-line ink bands matching the reference's band structure, title/chrome unchanged"; slide 09 "both panels dense with text-line bands to row ~21, matching the reference's ~19 code-line rows"; slide 10 "two code panels with text-line bands at the reference's block positions"; slide 11 "left panel + right code block both inked at the reference's positions — pre-fix all four showed only faint stripes at 0.00012"), mirror from the main tree (standing FX1), the $T script-preservation ordering note, and the not-exercised 7z note.

## Next phase readiness

- VERIFICATION gap 4 closed on the capture side: the exporter paints converter code runs; the committed auditor gives 02-FX5 the exact tool for its canonical re-export + breakdown update (stevedore @ this branch's tip; the merge-back and artifact regeneration belong to the orchestrator and 02-FX5)
- The converter-side observation stands for the orchestrator only (per the gap text, out of this plan's surface): the converted HTML itself still stacks the tint fill above its own text in live rendering — the capture-side flatten neutralizes it for exports, but a converter emission change (positioned `.pp-text` or static fill) would fix it at the source if ever desired
- Fixture regression + suite keep the fix locked; `scripts/audit-code-ink.mjs` FLATTEN must be kept in sync with `scripts/export-slides.mjs` (noted in both files)
