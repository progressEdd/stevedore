---
issue: "#66"
wave: 6
depends_on: ["02-FX4"]
target: progressEdd
fixes: 02-06
---

# Plan 02-FX5: Regenerate the canonical artifacts with the capture-fixed exporter and re-evidence the breakdown

**Objective:** Close the artifact half of VERIFICATION.md gap 4 (post-verify2 addendum #3, 2026-11-24): the canonical artifact set committed by 02-06/FX3 (`tests/land-e-slides.pptx`, `tests/land-e-roundtrip.html`, `tests/exports/{reference,roundtrip}/01..20.png`) still carries the capture defect on the four code slides — round-trip PNGs 08–11 paint tints/chrome/titles but no code runs (02-FX4 fixes the export tool on stevedore; this plan regenerates what it produces). This plan re-runs `scripts/roundtrip.sh` end-to-end from a stevedore checkout carrying FX4, recommits the artifact set, updates `DRIFT-BREAKDOWN.md` — rows 08–11 replace the capture-defect note with real PNG-witnessed verdicts, the tail capture-note paragraph becomes a resolution note, and the addendum-#3 gap-5 minor drifts (slide-15 heading wrap, slide-07 bullet markers/indent) are recorded as decision-8 defer-class rows WITHOUT being fixed — and enforces the visual pass: with the runs now painting, the four code-slide pairs (08–11) must show matching code ink. Every decision-8 defer stays verbatim: video posters, per-line layout, callouts, literal-glyph bullets, presenter notes, slide-05 h1, `<p:bg>`. The PowerPoint human sign-off (decision 5) stays re-requested; confirming it remains at ship time, outside this plan's contract.

**Standing facts:** this plan's target is **progressEdd**, not stevedore — you work in a progressEdd worktree; nothing here commits to stevedore. `$PROGRESS` below = your progressEdd worktree root; `$STEVEDORE` = a stevedore checkout carrying ALL fix plans — **FX4** (02-FX4's capture fix in `scripts/export-slides.mjs`), FX1 (single-quote stacks in `scripts/src/render/fonts.js`), FX2 (vendored `fix/font-design-viewport`): the post-merge `stevedore` branch checkout if FX4 has merged by now, otherwise the phase's stevedore agent worktree carrying FX4 — record which checkout + commit in the SUMMARY; task 1's precondition greps prove it before anything runs. `scripts/setup-roundtrip.sh` must have been run there (idempotent). Test data root: `00-supporting-files/data/land-e-tests/` (on progressEdd — your worktree has it directly); resolve deck paths with `realpath` into absolute form before use (FX3's record shows a `../../00-supporting-files/…` relative form — worktree depths differ between agents, so absolute paths are mandatory here). LAND.E originals stay untouched (decision 3). `unzip`/`file` binaries are absent on this host (standing deviation: `7z x -so` for pptx XML, node IHDR parse for PNG dimensions). Determinism promise: HTML and pptx slide XML reproduce byte-identically; PNGs are never gated on byte equality — a changed-PNG census is recorded instead. Commits atomic with subject prefix `(02-FX5): …`. Current committed artifact sizes (FX3-era, for comparison): pptx 6,951,111 B, round-trip HTML 10,864,059 B.

## Tasks

<task>
<name>Task 1: Canonical re-run on the FX4-fixed toolchain; ink-gate the code slides; regenerate and commit the artifact set</name>
<files>00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx, 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html, 00-supporting-files/data/land-e-tests/tests/exports/reference/01.png..20.png, 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/01.png..20.png</files>
<action>
**Step 1 — set up and prove preconditions** (STOP and report if any fails — the plans have not landed where you are looking):

```bash
PROGRESS="$PWD"        # your progressEdd worktree root (adjust if you run from a subdir)
TESTS="$PROGRESS/00-supporting-files/data/land-e-tests"
grep -q '(02-FX4)' "$STEVEDORE/scripts/export-slides.mjs" \
  && grep -q 'pp-text{position:relative}' "$STEVEDORE/scripts/export-slides.mjs" \
  && grep -q "font-family:'-apple-system'" "$STEVEDORE/scripts/src/render/fonts.js" \
  && grep -q 'font-design-viewport' "$STEVEDORE/vendor/dom-to-pptx/VENDORED.md" \
  && test -f "$STEVEDORE/scripts/audit-code-ink.mjs" \
  || { echo "stevedore checkout does not carry FX4+FX1+FX2 — STOP"; exit 1; }
SRC="$(realpath "$TESTS/reference/slides.html")"
RT_HTML="$(realpath "$TESTS/tests/land-e-roundtrip.html")"
```

(If task 1 of 02-FX4 recorded a non-stack fix, the second grep's pattern is whatever that branch's `(02-FX4)` marker rule is — the `(02-FX4)` marker grep is the hard one.) Record in the SUMMARY: the `$STEVEDORE` checkout + commit used, and the FX4 commit short-hash (`git -C "$STEVEDORE" log --oneline | grep '02-FX4'`).

**Step 2 — the canonical run** (from `$STEVEDORE`; outputs to scratch):

```bash
cd "$STEVEDORE"
scripts/setup-roundtrip.sh                       # idempotent
F="${TMPDIR:-/tmp}/stevedore-fx5"
rm -rf "$F"
scripts/roundtrip.sh "$SRC" "$F"
ls "$F/exports/reference" | wc -l                # 20
ls "$F/exports/roundtrip" | wc -l                # 20
node scripts/compare-decks.mjs "$SRC" "$F/land-e-roundtrip.html"
```

The comparator must print **PASS** with `media survival: 15/15`. If it fails: STOP, record the failure, and report to the orchestrator — do not commit a downgraded bar.

**Step 3 — ground-truth gates** (FX4 is capture-only, so the loop's non-PNG outputs must reproduce the committed ones exactly):

```bash
# round-trip HTML byte-identical to the committed canonical (converter untouched by FX4):
cmp "$F/land-e-roundtrip.html" "$RT_HTML" && echo FX5-HTML-STABLE || { echo "FX5-HTML-CHANGED — STOP, report"; exit 1; }
# pptx true sizes preserved (FX2's numbers; zip timestamp bytes may differ — slide XML must not):
7z x -so "$F/land-e-slides.pptx" ppt/slides/slide9.xml > /tmp/fx5-slide9.xml 2>/dev/null \
  || unzip -p "$F/land-e-slides.pptx" ppt/slides/slide9.xml > /tmp/fx5-slide9.xml
MAXSZ=$(grep -o 'sz="[0-9]*"' /tmp/fx5-slide9.xml | grep -o '[0-9]*' | sort -n | tail -1)
echo "slide9 max sz: $MAXSZ (expect in [2850,3150])"
! grep -qE 'sz="(1414|359)"' /tmp/fx5-slide9.xml && echo FX5-SZ-STABLE
# PNG inventory: 40 files, all 1280×720 (node IHDR parse — `file` is absent):
node -e '
const { readFileSync, readdirSync } = require("fs");
for (const d of ["exports/reference", "exports/roundtrip"]) {
  const dir = process.argv[1] + "/" + d;
  for (const f of readdirSync(dir)) {
    const b = readFileSync(dir + "/" + f);
    if (b.readUInt32BE(12) !== 0x49484452 || b.readUInt32BE(16) !== 1280 || b.readUInt32BE(20) !== 720)
      throw new Error(d + "/" + f + " not 1280x720");
  }
}
console.log("FX5-PNG-DIMS-OK");
' "$F"
```

If `FX5-HTML-STABLE` fails, the converter drifted since FX3 — STOP and report; that is a new finding, not an artifact refresh.

**Step 4 — changed-PNG census + code-ink gate** (determinism evidence + the gap-4 acceptance on the FRESH artifacts; the auditor runs from `$STEVEDORE`):

```bash
for side in reference roundtrip; do
  for n in $(seq -w 1 20); do
    if cmp -s "$F/exports/$side/$n.png" "$TESTS/tests/exports/$side/$n.png"; then echo "$side/$n.png identical"; else echo "$side/$n.png CHANGED"; fi
  done
done | tee "${TMPDIR:-/tmp}/fx5-png-census.log"
cd "$STEVEDORE"
for n in 8 9 10 11; do
  nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
    node scripts/audit-code-ink.mjs "$F/land-e-roundtrip.html" $n "$F/ink-audit" > "${TMPDIR:-/tmp}/fx5-ink-$n.json"
  cat "${TMPDIR:-/tmp}/fx5-ink-$n.json"
done
```

Expected census: round-trip 08–11 CHANGED (ink appears); everything else identical or antialiasing-noise (record exactly which — this is the SUMMARY's determinism evidence; the reference side is expected all-identical since FX4's fix is a no-op on Marp markup). Every fresh code-slide ink fraction must be ≥ 0.01 — if any slide falls below, FX4's fix did not survive the canonical pipeline: STOP and report to the orchestrator (do not commit).

**Step 5 — commit the artifacts on progressEdd** (from your progressEdd worktree root):

```bash
TESTS=00-supporting-files/data/land-e-tests
cp "$F/land-e-slides.pptx"      "$TESTS/tests/"
cp "$F/land-e-roundtrip.html"   "$TESTS/tests/"
cp "$F/exports/reference/"*.png "$TESTS/tests/exports/reference/"
cp "$F/exports/roundtrip/"*.png "$TESTS/tests/exports/roundtrip/"
git add "$TESTS/tests"
git commit -m "fix(02-FX5): canonical artifacts regenerated — capture-fixed exporter (02-FX4)"
```

Record in the SUMMARY: new pptx/HTML byte sizes (vs 6,951,111 / 10,864,059), the comparator's full table (mean/min/survival — task 2's header numbers), the slide-9 max sz, the PNG census, and the four ink fractions.
</action>
<verify>node "$STEVEDORE/scripts/compare-decks.mjs" "$PROGRESS/00-supporting-files/data/land-e-tests/reference/slides.html" "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" && test "$(ls "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/reference" | wc -l)" -eq 20 && test "$(ls "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/roundtrip" | wc -l)" -eq 20 && for n in 8 9 10 11; do node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!(j.fraction>=0.01))process.exit(1)" "${TMPDIR:-/tmp}/fx5-ink-$n.json" || exit 1; done && echo FX5-ARTIFACTS-OK</verify>
<acceptance_criteria>
- Canonical comparator on the COMMITTED pair: `PASS`, `media survival: 15/15` (new mean/min recorded verbatim in the SUMMARY)
- Committed `tests/land-e-roundtrip.html` byte-identical to the FX3 canonical (FX5-HTML-STABLE); committed pptx slide-9 max sz in [2850, 3150] with `sz="359"`/`sz="1414"` absent
- `tests/exports/reference/` and `tests/exports/roundtrip/` each contain exactly `01.png`..`20.png`, all 1280×720
- Fresh code-slide ink fractions ≥ 0.01 for round-trip 08–11 (recorded in SUMMARY); PNG census recorded (08–11 CHANGED expected)
- Nothing committed outside `00-supporting-files/data/land-e-tests/`
</acceptance_criteria>
</task>

<task>
<name>Task 2: Re-evidence the breakdown — PNG-witnessed code-slide rows, capture-note resolution, gap-5 defers recorded; visual gate on the four pairs</name>
<files>00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md</files>
<action>
**Step 1 — header.** Update the generation line: stevedore @ `<FX5 run's commit>` (checkout record from task 1), exporter tooling line gains `02-FX4 capture paint-order fix`, and the comparator line gets the NEW mean/min/survival from task 1. Extend the fix-round sentence to:

```markdown
Fix round (VERIFICATION gaps 1–3 + addendum-#3 gap 4): 02-FX1 converter attribute-safe font stacks ·
02-FX2 exporter capture viewport (`fix/font-design-viewport`) · 02-FX3 regeneration + re-check ·
02-FX4 capture-safe paint order (`scripts/export-slides.mjs` — code runs now paint in the PNGs) · 02-FX5 this regeneration + re-check.
```

**Step 2 — the four code-slide rows (08–11) become PNG-witnessed.** Replace the "see capture note" / capture-defect caveat in each row with the real visual verdict from the NEW pair, citing FX4's real short-hash (from the SUMMARY's checkout record — never a placeholder). Keep each row's root-cause text and the per-line-layout defer VERBATIM. Re-measure Δluma for these four rows from the NEW pair (same method as 02-06: per-pixel luma difference, same-tool 1280×720):

- **08**: Status becomes: `fixed — 38e403c + 02-FX1 76bbd7f + 02-FX2 fix/font-design-viewport + 02-FX4 <fx4-short-hash> (capture paint-order fix — code runs PNG-witnessed; visual pass ✓ — code ink matches on both sides); per-line positioned text boxes deferred — structural to the html→pptx text model (decision 8); 316/316 words, Δluma <new>`.
- **09**: same attribution form; keep "dark-theme claim refuted by 02-05 investigation" verbatim; `506/506 words, Δluma <new>`.
- **10, 11**: mirror 08's form ("as 08"), own Δluma `<new>` each; the word counts (259/259, 118/118) stay.

**Step 3 — resolve the tail capture note; record the gap-5 defers.** Replace the whole "Text-slide capture note (02-FX3): … (follow-up plan)." paragraph with:

```markdown
Text-slide capture resolution (02-FX4 + 02-FX5): the code-slide capture defect is fixed —
02-FX4 (`scripts/export-slides.mjs`) stops opaque shape fills from painting over their own
text in captures, and rows 08–11 are now witnessed by the PNG pair itself (code ink visible
on both sides). Post-visual-pass residual drifts recorded as decision-8 defers: slide 15 —
the "GLM Coding Plan" heading wraps to two lines in the round-trip only (converter text-box
width/font metrics slightly wider than reference; cosmetic); slide 07 — bullet markers/indent
styling (the standing literal-glyph/list model, visible but cosmetic).
```

**Step 4 — extend rows 07 and 15 with the gap-5 residuals** (decision-8 defer class — recorded, NOT fixed; keep their existing fixed halves and numbers intact):

- **07**: append to the Status cell: `; bullet marker/indent styling deferred — the literal-glyph/list model is the exporter's native rendering, cosmetic only (decision 8, addendum-#3 gap 5)`.
- **15**: append to the Status cell: `; "GLM Coding Plan" heading wraps to two lines in the round-trip only — deferred (converter text-box width/font metrics slightly wider than reference; cosmetic, decision 8, addendum-#3 gap 5)`.

**Defers stay verbatim everywhere:** video poster capture (rows 02/13/18 + media notes ¶), slide-05 h1 (row 05), per-line layout (08/10/11), callout approximation (07), literal-glyph bullets (19), presenter notes (20), `<p:bg>` nicety (tail list) — none may be reworded or dropped. The sign-off line stays verbatim: `**user sign-off re-requested post-fix (side-by-side + pptx path)**`.

**Step 5 — the visual gate (this plan's non-negotiable).** For each of 08, 09, 10, 11 open the pair side by side — `tests/exports/reference/NN.png` vs `tests/exports/roundtrip/NN.png` (the breakdown's inline images render them adjacent) — and judge with eyes: the code runs must be VISIBLE IN INK on BOTH sides, with matching code text, size and placement (per-line layout defer acknowledged: line positioning is approximate — judge ink presence and code content, not pixel-exact line geometry). Record a per-slide verdict table in the SUMMARY (`slide | PASS/FAIL | one-line observation`). **Any FAIL → STOP: make no further breakdown edits, commit nothing, and report the failing slide(s) to the orchestrator** — a visual fail after 02-FX4 means the capture fix did not close its gap; that is a new finding, not a doc edit.

Commit: `fix(02-FX5): drift breakdown — code-slide rows PNG-witnessed; gap-5 residuals recorded as defers`.
</action>
<verify>D="$PROGRESS/00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md"; N=$(grep -c '^| [0-9][0-9] ' "$D"); S=$(grep -cE '^\| [0-9][0-9] .*(fixed|deferred)' "$D"); L=$(grep -c 'tests/exports/reference/' "$D"); test "$N" -eq 20 && test "$N" -eq "$S" && test "$L" -ge 20 && grep -q '02-FX4' "$D" && grep -q 'PNG-witnessed' "$D" && grep -q 'GLM Coding Plan' "$D" && grep -q 'bullet marker/indent styling deferred' "$D" && grep -q 'per-line positioned text boxes deferred' "$D" && grep -q 'poster capture deferred' "$D" && grep -q 'user sign-off re-requested post-fix (side-by-side + pptx path)' "$D" && ! grep -q 'does not paint the per-line code runs' "$D" && echo FX5-BREAKDOWN-OK</verify>
<acceptance_criteria>
- All 20 rows still carry a fixed/deferred disposition; every decision-8 defer intact and unchanged in meaning (video posters, 05 h1, per-line layout, callouts, literal-glyph bullets, presenter notes, `<p:bg>`)
- Rows 08–11 cite the real 02-FX4 short-hash, claim "PNG-witnessed … visual pass ✓", and carry re-measured Δluma from the NEW pair; no row still references the capture-defect caveat (`does not paint the per-line code runs` grep must find nothing)
- Rows 07 and 15 record the addendum-#3 gap-5 residuals as decision-8 defers (slide-15 heading wrap, slide-07 bullet markers/indent) — recorded only, no fix attempted
- Header records the new stevedore checkout/commit, the FX4 tooling line, and the new comparator numbers
- SUMMARY contains the per-slide visual verdict table (4 rows, all PASS — or the plan stopped and reported at the first FAIL) and preserves the verbatim sign-off re-request line
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Canonical comparator PASS, survival 15/15, 20+20 committed PNGs (1280×720), HTML byte-stable, slide-9 sz at true size
- [ ] Fresh code-slide ink fractions ≥ 0.01 on round-trip 08–11; PNG census recorded; visual gate passed on all four code-slide pairs (verdict table in the SUMMARY)
- [ ] DRIFT-BREAKDOWN.md: 20 rows, all statused, decision-8 defers verbatim, 08–11 PNG-witnessed with real FX4 pointers, gap-5 residuals recorded as defers, capture note resolved, sign-off line intact
- [ ] LAND.E originals untouched; progressEdd diff confined to `00-supporting-files/data/land-e-tests/`
