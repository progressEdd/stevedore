---
status: complete
duration: 15min
key-files:
  created: []
  modified:
    - 00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx
    - 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/08.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/09.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/10.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/11.png
    - 00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md
requirements-completed:
  - "VERIFICATION addendum #5 gap 10 (2026-11-24: canonical artifacts carry the proportional code-family defect) — CLOSED on both halves, proven on the COMMITTED pair: pptx slide-8 code runs carry typeface=\"Consolas\" with typeface=\"ui-monospace\" absent, and the round-trip HTML's code spans resolve monospace in chromium (audit-mono-width exit 0, familyWidth = the reference's exact 57.609)"
  - "VERIFICATION addendum #5 gap 11 — CLOSED-AS-RECORDED per 02-FX10's branch-B outcome: the accepted-gap decision-8 defer carried verbatim into DRIFT-BREAKDOWN row 17 (no fix to regenerate; the FX7 committed auditor remains the standing gradient gate)"
  - "02-06 artifact halves re-evidenced: the canonical artifact set regenerated on the mono-family-fixed toolchain and recommitted; DRIFT-BREAKDOWN row 08 gains the mono-family verdict, row 17 the accepted-gap record, every decision-8 defer verbatim"
key-decisions:
  - "$STEVEDORE = the phase's stevedore agent worktree (branch agent/02-roundtrip-fidelity/stevedore @ ff893ab, 02-FX9's tip) — the main `stevedore` branch is NOT the post-merge checkout (it carries FX1+FX2 only, ff893ab not an ancestor), so the plan's otherwise-clause applied; $REPO = the main stevedore checkout (branch progressEdd @ c3a6fdc) carrying .planning, resolved at ../../../../ from the worktree as recorded"
  - "02-FX10 landed as BRANCH B (accepted gap): no (02-FX10) marker in $STEVEDORE/scripts or VENDORED.md, its SUMMARY records the hard-STOP-RULE verdict — so the branch-B commit-message tail, row-17 verbatim defer, skipped matrix gate, and 17-deferred visual verdict all applied; the pptx/HTML/PNG censuses expected exactly the FX9 typeface-class footprint with nothing extra, and that is what the run produced"
  - "Row 08 cites 02-FX9 `761f28d` (the 'real mono font stacks' converter commit) as the FX9 short-hash; the PowerPoint half of the same fix is the exporter fork `fix/real-mono-typeface` (vendored via 12b81d8), recorded in the header's exporter branch list — same split as FX2/FX7 entries"
  - "FX9 commits on the checkout, for the record: 761f28d (real mono font stacks), 12b81d8 (vendor sync +fix/real-mono-typeface), e7d54a2 (mono-width auditor), ff893ab (code-ink auditor family detection); FX10: none by design (STOP-RULE path is commit-free)"
deviations:
  - "Visual gate judged QUANTITATIVELY, not by rendered image: this executor model cannot render images (read-image omitted by the model). Per the plan's sanctioned fallback (02-06/FX8-recorded precedent) the slide-08 verdict rests on auditor A/B probes — including a three-way mono-width contrast run on reference vs new round-trip vs the FX8-era round-trip extracted from git (old: family ui-monospace/Calibri/sans-serif, familyWidth 45.328 = sansWidth, monoClass FALSE; new: familyWidth 57.609 = the reference's exact familyWidth, monoClass TRUE) — plus ink totals (rt 0.0440 vs ref 0.0475, old rt 0.0425), code-region mean RGB (new rt within 0.3–0.4 of ref on every channel, old within 0.4–0.7), and the Δluma trend (5.98 → 5.74, toward the reference). Method recorded per the plan's instruction."
  - "First run of task 1 step 4's HTML census script carried a transcription slip in the split() loop (marks[i].length for marks.length) that distorted per-slide chunk attribution; re-ran with the plan's exact script (fontStackLines 211, otherLines 0) and added a whole-file control: the old and new HTML are byte-identical after removing all font-family lines. The recorded census is the corrected run; the gate outcome is unchanged."
  - "Standing host deviation inherited (02-06): 7z x -so for pptx XML, node IHDR parse for PNG dims (unzip/file absent on this host)."
---

# Plan 02-FX11 Summary: canonical artifacts regenerated on the mono-family-fixed toolchain — gap 10 closed on both halves, gap 11 carried as 02-FX10's accepted gap

The canonical LAND.E artifact set was re-run end-to-end from a stevedore checkout carrying FX1–FX9 (FX10 = branch B, accepted gap) and recommitted: the pptx's code runs now carry `typeface="Consolas"` (keyword typeface gone, slides 08–11 only), the round-trip HTML's 211 code spans now emit the Consolas/Liberation Mono/Courier New mono stack (0 unclassified diff lines), and DRIFT-BREAKDOWN.md's row 08 carries the mono-family verdict with re-measured Δluma 5.74 while row 17 carries 02-FX10's accepted-gap defer verbatim — every decision-8 defer preserved untouched.

## The run's checkout record (task 1 step 1)

- **$STEVEDORE**: `02-worktrees/agent/02-roundtrip-fidelity/stevedore`, branch `agent/02-roundtrip-fidelity/stevedore` @ **ff893ab** (02-FX9's tip). The main `stevedore` branch (4703ecf) carries FX1+FX2 only — not merged, so the plan's otherwise-clause (the phase's stevedore agent worktree) applied. Precondition greps passed: `UI_MONO_STACK` in `scripts/src/render/fonts.js`, `fix/real-mono-typeface` in VENDORED.md, `resolveRealTypeface` in vendor src/utils.js, all four auditors + export-slides.mjs/text.js fix markers present.
- **FX10 branch**: B (accepted gap) — no `(02-FX10)` marker anywhere in `$STEVEDORE/scripts` or VENDORED.md; `02-FX10-SUMMARY.md` records the hard-STOP-RULE verdict. Its stevedore worktree stands at ff893ab by design (STOP-RULE path is commit-free), so the FX1–FX9 checkout IS the FX10-final toolchain state.
- **FX9 short-hashes**: 761f28d / 12b81d8 / e7d54a2 / ff893ab (above). **$REPO**: main checkout (progressEdd @ c3a6fdc), `.planning/ROADMAP.md` resolved as recorded.
- `scripts/setup-roundtrip.sh` re-run (idempotent; dist rebuilt so the fork fix is live).

## Task 1 evidence, in full (the canonical re-run + gates)

**Comparator (committed pair, `compare-decks.mjs`)**: **PASS**, `media survival: 15/15`, mean **0.988**, min **0.769** (slide 5 — comparator artifact, row 05). Per-slide jaccard/words: 1=1.000 9/9 · 2=1.000 0/0 · 3=1.000 0/0 · 4=1.000 0/0 · 5=0.769 13/10 · 6=1.000 0/0 · 7=1.000 55/55 · 8=1.000 **316/316** · 9=1.000 506/506 · 10=1.000 259/259 · 11=1.000 118/118 · 12=1.000 3/3 · 13=1.000 0/0 · 14=1.000 0/0 · 15=1.000 12/12 · 16=1.000 4/4 · 17=1.000 10/10 · 18=1.000 0/0 · 19=1.000 17/17 · 20=1.000 1/1. Images: source 12, converted 55 (458%).

**Byte sizes**: pptx **6,950,985 B** (was 6,951,113 — the Consolas typeface is shorter than the ui-monospace keyword on 211 runs); round-trip HTML **10,880,673 B** (was 10,865,633 — the 5-family mono stack is longer than the 3-family proportional stack on the same 211 spans).

**pptx census + classification** (7z x -so vs FX8-committed): `slide8/9/10/11.xml CHANGED` — **all four typeface-class** (Consolas present, ui-monospace absent per slide); nothing else changed. Exactly FX9's designed footprint; FX10 branch B adds no footprint (expected, and confirmed: none needed).

**HTML classified diff census** (plan's script, corrected run): `{"fontStackLines":211,"otherLines":0}` — every changed line is a font-family stack line. Old `font-family:'ui-monospace'` count: **211** (recorded); new: **0**; new `font-family:'Consolas', 'Liberation Mono', 'Courier New', monospace` count: **211**. Whole-file control: after stripping all font-family lines, old and new HTML are byte-identical.

**Auditors (fresh outputs, re-confirmed on the committed pair)**:

| gate | result |
|---|---|
| mono-width, round-trip slide 8 (gap 10 HTML half) | exit 0 — family `Consolas, "Liberation Mono", "Courier New", monospace`, familyWidth **57.609** vs mono 57.797 / sans 45.328, monoClass **true** |
| mono-width, reference slide 8 (sanity) | exit 0 — familyWidth **57.609** (= the round-trip's exact width), monoClass true |
| mono-width, FX8-era round-trip (A/B contrast, extracted from git) | family `ui-monospace, Calibri, sans-serif`, familyWidth **45.328** = sansWidth, monoClass **false** — the before/after witness |
| font-metrics slide 8 (FX6 preserved) | exit 0 — pass true, ref mode marp 43 lines 9.57px, overflow 0 |
| font-metrics slide 17 (FX6 preserved) | exit 0 — pass true, tracked letter-spacing deltas ≤ 0.005px |
| gradient-paint slide 17 (FX7 preserved) | exit 0 — allPainted true, gradient toggles 0.883 / 74.869 / 1.217 / 82.011 / 91.425 (exactly the FX7/FX10 calibration values) |
| code-ink 08–11 (FX4 preserved) | fractions **0.0440 / 0.0370 / 0.0430 / 0.0271** — all ≥ 0.01 |
| FX10 branch A matrix gate | skipped — branch B (no `audit-gradient-matrix.mjs` exists; the STOP-RULE path never created one) |

**PNG census**: all 40 fresh PNGs 1280×720 (node IHDR). Reference side **01–20 all identical** to FX8-committed (the reference deck never passes through the converter — FX9 is a pptx/HTML emission fix). Round-trip side **08–11 CHANGED** (code text now monospace), 01–07 and 12–20 identical — exactly the designed footprint on branch B (17 identical: no FX10 fix, nothing to regenerate).

## Task 2 evidence (the breakdown re-evidence + visual gate)

Row 08 root cause appends, before the layout-cause semicolon (FX8's placement convention): `+ the code font FAMILY resolved proportionally — ui-monospace resolves to nothing on nix chromium and PowerPoint substitutes keyword typefaces the same way (02-FX9)`. Row 08 status gains, after the FX6 clause: `+ 02-FX9 761f28d (real mono stacks — code spans resolve monospace, width-probe-witnessed; pptx code runs carry typeface="Consolas" — same fix on the PowerPoint side; carried by 09–11's code spans as well)`. Per-line defer verbatim; word count 316/316 kept; Δluma re-measured **5.74** (was 5.98 — drifted toward the reference, both sides mono now).

Row 17 (branch B): root cause unchanged; status appends the accepted-gap defer **verbatim** from 02-FX10-SUMMARY's item-3 record (`gradient visibility at exported strength — accepted gap (02-FX10 matrix: … no fourth round per the hard STOP RULE)`); `7/7 imgs` kept; Δluma re-measured **7.02** (identical value — roundtrip/17.png is byte-identical, recorded as the accepted state). The tail paragraph's "Other recorded defers" list gains `gradient visibility at exported strength (17 — accepted gap, 02-FX10 matrix, addendum #5 gap 11)`.

Header: stevedore @ `ff893ab` (branch record above), exporter branch list gains `fix/real-mono-typeface` (now six branches), converter @ ff893ab, comparator line carries this run's mean/min/survival (identical values to FX8 — the word-level content was unchanged by the family swap), fix-round sentence extended with the FX9/FX10(branch-B)/FX11 entries and the addendum-#5 gaps 10–11 scope.

**Defers verbatim, verified by the task's greps** (`FX11-BREAKDOWN-OK`): 20 rows, all statused; per-line positioned text boxes (08, carried by "as 08" in 10/11), poster capture (02/13/18 + media notes), slide-05 h1, callout approximation (07), bullet marker/indent styling (07, addendum-#3 gap 5), "GLM Coding Plan" wrap (15), literal-glyph bullets (19), presenter notes (20), `<p:bg>` nicety (tail) — rows 07/19 and every other defer-carrying row untouched (git diff hunks: header lines 4–5/8/13, row 08, row 17, tail only). Addendum-#5 gaps 8–9 (slides 7/19) got no new text. Sign-off line verbatim: `**user sign-off re-requested post-fix (side-by-side + pptx path)**`.

**Visual gate verdict table** (quantitative method — model cannot render images; method and probes in deviations):

| slide | verdict | basis |
|---|---|---|
| 08 | **PASS** | mono-width A/B: new rt familyWidth 57.609 = reference's exact 57.609, monoClass true (old rt: 45.328 = sans, false) — equal glyph rhythm at the width-metric level; code ink 0.0440 vs ref 0.0475; region RGB within 0.3–0.4/channel; Δluma 5.98→5.74; font-metrics pass. Per-line layout defer acknowledged — line positioning approximate. |
| 17 | **deferred (accepted gap)** | branch B: the standing FX7-calibration state, not a PASS/FAIL — gradient-paint exit 0, allPainted, calibration toggles reproduced. |

## Accomplishments

- The canonical artifact set was regenerated on the FX9-fixed toolchain (setup + full round-trip re-run) and recommitted atomically: 6 files, only `00-supporting-files/data/land-e-tests/` touched; reference side and LAND.E originals byte-untouched.
- Gap 10 is closed on the COMMITTED pair on both halves: pptx typeface ground truth (slide-8 Consolas present / keyword absent; census typeface-class 08–11, nothing unexplained) and chromium mono resolution (mono-width exit 0 round-trip + reference; the A/B contrast proves the old HTML measured the sans width).
- All standing gates preserved on the regenerated artifacts: FX4 ink ≥ 0.01 on 08–11, FX6 font-metrics 8+17, FX7 gradient-paint 17, comparator PASS 15/15 with identical mean/min.
- Gap 11 closed-as-recorded: row 17 now carries 02-FX10's accepted-gap defer verbatim plus the tail-list entry; the breakdown's header records the full fix-round chain through FX11.

## Task commits

1. **Canonical re-run, gate gap 10, regenerate + commit the artifact set** — `ea1d882` fix(02-FX11): canonical artifacts regenerated — real mono stacks (02-FX9); gap 11 recorded as accepted gap (02-FX10)
2. **Re-evidence the breakdown + visual gate + sign-off re-request** — `be02de7` fix(02-FX11): drift breakdown — mono row 08 + gradients row 17 re-evidenced post FX9/FX10

## Files created/modified

- `00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx` — regenerated; code runs carry typeface="Consolas" (slides 08–11 changed, typeface-class only)
- `00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html` — regenerated; 211 code spans emit the Consolas mono stack (211 font-family diff lines, 0 unclassified)
- `00-supporting-files/data/land-e-tests/tests/exports/roundtrip/{08,09,10,11}.png` — regenerated (code text now monospace); all other PNGs byte-identical to FX8
- `00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md` — header (stevedore @ ff893ab, six-branch exporter list incl. fix/real-mono-typeface, fix-round sentence through FX11), row 08 (mono-family verdict, FX9 pointer, Δluma 5.74), row 17 (accepted-gap defer verbatim), tail defer list

## Decisions & deviations

Decisions: the checkout record and FX10-branch determination (above); the branch-B forms everywhere the plan offered A/B alternatives (commit-message tail, row-17 defer, skipped matrix gate, 17-deferred visual verdict); 761f28d as row 08's FX9 pointer with the exporter half recorded in the header's branch list. Deviations: three, all recorded in frontmatter — the quantitative visual gate (model cannot render images; the plan's sanctioned fallback with the three-way mono-width A/B as the decisive probe), the corrected re-run of the step-4 HTML census script after a transcription slip in the split() loop (same gate outcome, plus a whole-file control), and the standing host tooling deviation (7z/node-IHDR). Nothing else differed: all preconditions, censuses, gates, and verify blocks ran as written and passed first-try.

## Next phase readiness

The artifact half of addendum #5 is fully closed: gaps 10 (both halves, committed-pair-proven) and 11 (branch B, closed-as-recorded) are done, and DRIFT-BREAKDOWN.md is the current, complete evidence record — 20 rows statused, every decision-8 defer verbatim, FX1–FX11 fix-round chain in the header. The standing gates (comparator, mono-width, font-metrics, gradient-paint, code-ink) all pass on the committed pair and remain the phase's regression surface. The PowerPoint human sign-off (decision 5) is re-requested via the breakdown's verbatim line — it stays at ship time, outside this plan's contract, per the objective. The branch `agent/02-roundtrip-fidelity/progressEdd` stands at be02de7 with FX11's two atomic commits, ready for the orchestrator's merge-back.
