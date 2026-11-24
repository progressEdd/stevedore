---
issue: "#62"
wave: 5
depends_on: ["02-FX1", "02-FX2"]
target: progressEdd
fixes: 02-06
---

# Plan 02-FX3: Regenerate the canonical artifacts and re-evidence the breakdown after the fixes

**Objective:** Close VERIFICATION.md gap 3 (post-verdict addendum, 2026-11-23): the canonical artifact set committed by 02-06 (`tests/land-e-slides.pptx`, `tests/land-e-roundtrip.html`, `tests/exports/{reference,roundtrip}/01..20.png`) and `DRIFT-BREAKDOWN.md` embed both fixed defects — the converter's attribute-breaking style emission (02-FX1) and the exporter's ~44–47% font sizes (02-FX2). Worse, the breakdown's text-slide rows (01, 07, 08, 09, 10, 11, 12) claim "fixed" for fonts/sizes/colors on evidence the visual sign-off just falsified (the spans rendered with size only — default serif family, no weight/color). This plan re-runs `scripts/roundtrip.sh` end-to-end on the fixed toolchain, regenerates the canonical artifacts, corrects the falsified rows (keeping every decision-8 defer intact), and enforces the visual pass on the PNG pairs of the seven text slides (01, 07, 08, 09, 10, 11, 12) — fonts/sizes/colors visibly matching. The PowerPoint human sign-off (decision 5) is re-requested for the new pptx; confirming it stays at ship time, outside this plan's contract.

**Standing facts:** this plan's target is **progressEdd**, not stevedore — you work in a progressEdd worktree; nothing here commits to stevedore. The run needs a stevedore checkout carrying BOTH fix plans (`STEVEDORE` below = the post-merge `stevedore` branch checkout if the phase flow has merged 02-FX1+02-FX2 by now, otherwise the phase's stevedore agent worktree with both vendored/landed — record which checkout + commit in the SUMMARY). `scripts/setup-roundtrip.sh` must have been run there (idempotent). Test data root: `00-supporting-files/data/land-e-tests/` (on progressEdd — your worktree has it directly). LAND.E originals stay untouched (decision 3). Commits atomic with subject prefix `(02-FX3): …`. Current committed artifact sizes for comparison: pptx 6,964,627 B, round-trip HTML 10,863,772 B (VERIFICATION, 2026-11-23). Current breakdown header cites stevedore @ `b607347`, exporter branches `pin/puppeteer-23.11.1` + `fix/media-byte-embed` + `fix/gradient-svg-stop`, comparator mean 0.988 / min 0.769 / survival 15/15.

## Tasks

<task>
<name>Task 1: Canonical re-run on the fixed toolchain; regenerate and commit the artifact set</name>
<files>00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx, 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html, 00-supporting-files/data/land-e-tests/tests/exports/reference/01.png..20.png, 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/01.png..20.png</files>
<action>
**Step 1 — the canonical run** (from `$STEVEDORE`, which must contain 02-FX1's style-quoting fix and 02-FX2's vendored `fix/font-design-viewport` — verify first: `git -C "$STEVEDORE" grep -c "font-family:'-apple-system'" -- scripts/src/render/fonts.js` and `grep -c 'font-design-viewport' "$STEVEDORE/vendor/dom-to-pptx/VENDORED.md"` must both be ≥ 1; if either fails, STOP and report — the plans have not landed where you are looking):

```bash
cd "$STEVEDORE"
scripts/setup-roundtrip.sh                       # idempotent
F="${TMPDIR:-/tmp}/stevedore-fx3"
rm -rf "$F"
scripts/roundtrip.sh ../../00-supporting-files/data/land-e-tests/reference/slides.html "$F"
ls "$F/exports/reference" | wc -l                # 20
ls "$F/exports/roundtrip" | wc -l                # 20
node scripts/compare-decks.mjs \
  ../../00-supporting-files/data/land-e-tests/reference/slides.html "$F/land-e-roundtrip.html"
```

The comparator must print **PASS** with `media survival: 15/15`. If it fails: STOP, record the failure, and report to the orchestrator — do not commit a downgraded bar.

**Step 2 — slide-9 ground-truth spot check** (02-FX2's numbers must reproduce through the whole loop):

```bash
unzip -p "$F/land-e-slides.pptx" ppt/slides/slide9.xml | grep -o 'sz="[0-9]*"' | grep -o '[0-9]*' | sort -n | tail -1
# expect in [2850, 3150] (was 1414)
grep -o 'font-family:"' "$F/land-e-roundtrip.html" | wc -l    # expect 0 (02-FX1's signature absent)
```

**Step 3 — commit the artifacts on progressEdd** (from your progressEdd worktree):

```bash
TESTS=00-supporting-files/data/land-e-tests
cp "$F/land-e-slides.pptx"     "$TESTS/tests/"
cp "$F/land-e-roundtrip.html"  "$TESTS/tests/"
cp "$F/exports/reference/"*.png "$TESTS/tests/exports/reference/"
cp "$F/exports/roundtrip/"*.png "$TESTS/tests/exports/roundtrip/"
git add "$TESTS/tests"
git commit -m "fix(02-FX3): canonical artifacts regenerated — style quoting + exporter font-size fixes"
```

Record in the SUMMARY: the `$STEVEDORE` checkout + commit used, new pptx/HTML byte sizes (vs 6,964,627 / 10,863,772), the comparator's full table (mean/min/survival — the new headline numbers for task 2's header), the slide-9 max sz, and the `font-family:"` count (expect 0).
</action>
<verify>cd "$STEVEDORE" && node scripts/compare-decks.mjs ../../00-supporting-files/data/land-e-tests/reference/slides.html ../../00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html && test "$(ls ../../00-supporting-files/data/land-e-tests/tests/exports/reference | wc -l)" -eq 20 && test "$(ls ../../00-supporting-files/data/land-e-tests/tests/exports/roundtrip | wc -l)" -eq 20 && echo FX3-ARTIFACTS-OK</verify>
<acceptance_criteria>
- Canonical comparator on the COMMITTED pair: `PASS`, `media survival: 15/15` (new mean/min recorded verbatim in the SUMMARY)
- `tests/exports/reference/` and `tests/exports/roundtrip/` each contain exactly `01.png`..`20.png` (1280×720)
- Committed `tests/land-e-slides.pptx`: slide-9 max sz in [2850, 3150], `sz="359"`/`sz="1414"` absent; committed `tests/land-e-roundtrip.html`: `font-family:"` count 0
- Nothing committed outside `00-supporting-files/data/land-e-tests/`
</acceptance_criteria>
</task>

<task>
<name>Task 2: Correct the falsified breakdown rows, run the visual gate on the text slides, re-request sign-off</name>
<files>00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md</files>
<action>
**Step 1 — header.** Update the generation line: stevedore @ `<FX3 run's commit>` (branch list from the SUMMARY's checkout record), exporter branch list gains `fix/font-design-viewport`, converter commit updated, and the comparator line gets the NEW mean/min/survival from task 1. Add one sentence after the comparator line:

```markdown
Fix round (VERIFICATION gaps 1–3): 02-FX1 converter attribute-safe font stacks ·
02-FX2 exporter capture viewport (`fix/font-design-viewport`) · 02-FX3 this regeneration + re-check.
```

**Step 2 — the seven falsified text-slide rows.** These rows attributed all font drift to the 02-02 cascade fix and claimed it "fixed — `38e403c`", on exports that actually rendered size-only (attribute truncation) at ~45% sizes (exporter). Rewrite each row's Root-cause and Status so the evidence matches the NEW pair — keep each row's drift description accurate to what the new pair still shows, keep the defer halves intact, and re-measure the word counts/Δluma from the NEW pair (same method as 02-06: same-tool 1280×720 captures):

- **01**: root cause gains "+ unescaped quotes in emitted `style` attributes dropped font/weight/color at render time (02-FX1)" and "+ exporter font sizes at ~44–47% of true (02-FX2)". Status becomes: `fixed — 38e403c (cascade) + 02-FX1 <short-hash> (attribute-safe quoting) + 02-FX2 fix/font-design-viewport (true sz); visual pass ✓; N/N words, Δluma <new>`.
- **07**: fonts half gains the two extra causes; Status: `Fonts fixed — 38e403c + 02-FX1 + 02-FX2 (visual pass ✓); callout approximation deferred — shape-based approximation is the exporter's native model, cosmetic only (decision 8); …` — the defer stays verbatim in meaning.
- **08**: monospace/colors restoration gains the two extra causes; Status: `fixed — 38e403c + 02-FX1 + 02-FX2 (visual pass ✓ …); per-line positioned text boxes deferred — structural to the html→pptx text model (decision 8)`.
- **09**: same attribution correction as 08; keep the "dark-theme claim refuted by 02-05 investigation" note verbatim.
- **10, 11**: mirror 08's correction ("As 08" rows keep pointing at 08's corrected text — update their Status to the same fixed-pointer form with their own re-measured numbers).
- **12**: same; its "Fonts only — near-identical" drift line stays (that was true — but now the fonts actually match visually).

Every `02-FX1 <short-hash>` and `02-FX2` pointer uses the REAL landed short hashes (from `git -C "$STEVEDORE" log --oneline | grep '02-FX'` and the fork's `git ls-remote`); never a placeholder.

**Step 3 — the visual gate (this plan's non-negotiable).** For each of 01, 07, 08, 09, 10, 11, 12 open the pair side by side — `tests/exports/reference/NN.png` vs `tests/exports/roundtrip/NN.png` (the breakdown's inline images render them adjacent) — and judge with eyes: font family, font size, weight, and color visibly matching. Record a per-slide verdict table in the SUMMARY (`slide | PASS/FAIL | one-line observation`). **Any FAIL → STOP: make no further breakdown edits, commit nothing, and report the failing slide(s) to the orchestrator** — a visual fail after 02-FX1+02-FX2 means a fix did not close its gap; that is a new finding, not a doc edit.

**Step 4 — sign-off re-request (decision 5's human gate).** In the SUMMARY and your final message, present: the corrected `DRIFT-BREAKDOWN.md` (side-by-side), the regenerated `tests/land-e-slides.pptx` path for opening in PowerPoint against `reference/slides.html`/`reference/slides.pdf`, and the new headline numbers. Record verbatim: "user sign-off re-requested post-fix (side-by-side + pptx path)" — confirmation happens outside this plan.

Commit: `fix(02-FX3): drift breakdown re-evidenced — text-slide rows corrected post visual pass`.
</action>
<verify>D=00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md; N=$(grep -c '^| [0-9][0-9] ' "$D"); S=$(grep -cE '^\| [0-9][0-9] .*(fixed|deferred)' "$D"); L=$(grep -c 'tests/exports/reference/' "$D"); test "$N" -eq 20 && test "$N" -eq "$S" && test "$L" -ge 20 && grep -q '02-FX1' "$D" && grep -q 'fix/font-design-viewport' "$D" && grep -q 'font-design-viewport' "$D" && echo FX3-BREAKDOWN-OK</verify>
<acceptance_criteria>
- All 20 rows still carry a fixed/deferred disposition; the decision-8 defers (05 h1 visibility, 07 callouts, 08/10/11 per-line layout, 19 literal-glyph model, 20 presenter notes, video poster, `<p:bg>` nicety) remain intact and unchanged in meaning
- Rows 01, 07, 08, 09, 10, 11, 12 cite the real 02-FX1/02-FX2 pointers and re-measured numbers from the NEW pair; no row claims font fidelity on pre-fix evidence
- Header records the new stevedore commit, the four-branch exporter list, and the new comparator numbers
- SUMMARY contains the per-slide visual verdict table (7 rows, all PASS — or the plan stopped and reported at the first FAIL)
- SUMMARY records "user sign-off re-requested post-fix (side-by-side + pptx path)"
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Canonical comparator PASS, survival 15/15, 20+20 committed PNGs, slide-9 sz at true size, `font-family:"` count 0 in the committed HTML
- [ ] Visual gate passed on all seven text-slide pairs (verdict table in the SUMMARY)
- [ ] DRIFT-BREAKDOWN.md: 20 rows, all statused, defers intact, fix-round pointers real
- [ ] Sign-off re-request recorded; LAND.E originals untouched; progressEdd diff confined to `00-supporting-files/data/land-e-tests/`
