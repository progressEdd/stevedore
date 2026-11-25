---
status: complete
duration: 15min
key-files:
  created: []
  modified:
    - 00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx
    - 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/01.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/07.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/08.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/09.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/10.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/11.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/12.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/15.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/16.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/17.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/19.png
    - 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/20.png
    - 00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md
requirements-completed:
  - VERIFICATION addendum #4 gap 6 (converter integer-snapped run metrics — closed on the committed pair, auditor-witnessed)
  - VERIFICATION addendum #4 gap 7 (exporter inverted pseudo-element z-order — closed on the committed pair, auditor-witnessed)
  - 02-FX8 objective (regenerate canonical artifacts on the FX6+FX7 toolchain; re-evidence DRIFT-BREAKDOWN rows 08/17; keep every decision-8 defer verbatim; recompute gates vs FX5)
key-decisions:
  - "$STEVEDORE = the phase's stevedore agent worktree (02-worktrees/agent/02-roundtrip-fidelity/stevedore, branch agent/02-roundtrip-fidelity/stevedore, HEAD c0cf682) — the post-merge stevedore branch (4703ecf) still carries only FX1+FX2, so the phase worktree is the checkout carrying FX1+FX2+FX4+FX6+FX7"
  - "FX6 pointer recorded as 52f2e12 (the true-px metrics fix; auditor at e529a41); FX7 fix = 30f7c52 vendored fix/pseudo-z-index + c0cf682 auditor"
  - "Extra changed round-trip PNGs beyond 08–11+17 (01/07/12/15/16/19/20) accepted as FX6's designed fractional-metric footprint — every one of those slides' HTML diffs are metric-class-only (zero unclassified lines); the PNG census is record-only per the plan's standing facts"
deviations:
  - "Precondition grep #7 path: the literal `font-family:'-apple-system'` lives in the checkout's generated scripts/examples/land-e/deck.html (and the committed round-trip HTML), not in scripts/src/render/fonts.js as the plan's grep wrote; FX1's presence in fonts.js verified via its (02-FX1) comment and single-quote return. Intent (FX1 fix live in the checkout) proven both ways; no file changed."
  - "Task 1 Step 5 ink audits: the plan's command omits audit-code-ink.mjs's optional [outdir] argument, which yields fraction:null and would fail the plan's own verify (j.fraction>=0.01); the outdir ($T/ink-png) was passed so the auditor measures — its documented optional arg, no script changed."
  - "Task 2 visual gate: the executor model cannot render images; judged quantitatively per the 02-06 precedent (auditor A/B probes, per-region RGB means, ink totals, Δluma trends) — both slides PASS, evidence in the verdict table below."
  - "Standing host deviation inherited from 02-06: 7z x -so for pptx slide XML, node IHDR parse for PNG dimensions (unzip/file absent)."
---

# Plan 02-FX8 Summary: Regenerate the canonical artifacts with the metric- and z-order-fixed toolchain and re-evidence the breakdown

Both artifact halves of addendum-#4 gaps 6 and 7 are closed on the committed canonical pair: code runs now carry true fractional metrics (9.57px, auditor fontSize delta 0) and slide-17's gradient overlays paint above their content (auditor allPainted:true) — both auditors flipped exit 1 → exit 0, and DRIFT-BREAKDOWN rows 08/17 carry the new verdicts with every decision-8 defer verbatim.

## Checkout record (task 1, for the breakdown header's pointers)

- `$STEVEDORE`: `02-worktrees/agent/02-roundtrip-fidelity/stevedore` (branch `agent/02-roundtrip-fidelity/stevedore`, HEAD **c0cf682**) — the phase's stevedore agent worktree; the post-merge `stevedore` branch (4703ecf) carries FX1+FX2 only, so this is the checkout carrying FX1+FX2+FX4+FX6+FX7.
- FX commits in it: FX1 `76bbd7f`/`afa47e5` · FX2 `8d8dd44` · FX4 `b93135f`/`8b9e791` · **FX6 `52f2e12` (true-px run metrics) + `e529a41` (auditor)** · **FX7 `30f7c52` (vendored fix/pseudo-z-index) + `c0cf682` (auditor)**.
- `scripts/setup-roundtrip.sh` re-run (idempotent): vendor `dist/` rebuilt — `pseudoSortKey` present in `dist/dom-to-pptx.bundle.js` (FX7 live in the dist the exporter actually runs).

## Canonical run + gates (task 1)

**Comparator (fresh run and re-verified on the COMMITTED pair):** `PASS` — mean **0.988**, min **0.769** (slide 5 — the standing comparator artifact, see row 05), media survival **15/15** (all source media present); per-slide jaccard 1.000 on 19/20 slides, slide 5 at 0.769 (13/10 hidden-h1 words, standing defer).

**New byte sizes:** pptx **6,951,113** (was 6,951,111 — +2 bytes) · round-trip HTML **10,865,633** (was 10,864,059 — +1,574 bytes).

**pptx census** (7z slide-XML byte compare, new vs FX5 canonical): exactly **`slide17.xml CHANGED`**, the other **19/19 byte-identical**. Slide-17 change is reorder-class: pic count 7 → 7, `r:embed` ref set identical (rId1–rId13), byte count identical (12,694) — only element order differs (FX7's z-reorder). No lost/added media parts.

**HTML classified diff census** (replaces FX5's byte-stability gate): `{metricLines: 231, slide17Lines: 15, unclassified: 0}` — every changed line outside slide 17 is a `font-size:`/`letter-spacing:` value line; slide 17's churn is FX7's element reorder. Old HTML: **0** fractional `font-size:` values (integer-snapped); new HTML fractional inventory: **`9.57px` ×752** (code runs), `9.85` ×8, `37.69` ×7, `46.4` ×5, `8.12` ×2, `26.68` ×2, `12.17` ×2, `39.15` ×1; `letter-spacing` snapped `0.09/0.4/−0.88` → true `0.12/0.53/−1.17`.

**Gap-closure auditors, before → after (before = FX5-era committed pair, after = regenerated COMMITTED pair):**

| auditor | before | after |
|---|---|---|
| `audit-font-metrics.mjs` slide 8 | exit 1 — fontSize delta **0.43** (ref 9.57px vs rt 10px), overflow 41 | exit **0** — fontSize delta **0**, lineHeight 0.005, pitch 0.22, fontWeightDiff false, `pass:true` |
| `audit-font-metrics.mjs` slide 17 | exit 1 — tracked letter-spacing deltas 0.032/0.134/0.134/0.032/0.295 | exit **0** |
| `audit-gradient-paint.mjs` slide 17 | exit 1 — half-panel gradient `painted:false`, meanDelta 0 (overlays exported under the photos) | exit **0** — `allPainted:true`; half-panels meanDelta **0.883 / 1.217**, gradient pills **74.869 / 82.011**, center divider **91.425** (the two `skipped:"not a gradient image"` entries are the photos, by design) |

**Ink gate (round-trip 08–11, FX4's bar ≥ 0.01 preserved):** 08 **0.0425** · 09 **0.0368** · 10 **0.0433** · 11 **0.0257**.

**PNG census** (IHDR 1280×720 on all 40 — `FX8-PNG-DIMS-OK`): reference side **20/20 identical** (FX6/FX7 are no-ops on Marp markup). Round-trip **CHANGED: 01, 07, 08, 09, 10, 11, 12, 15, 16, 17, 19, 20** — the expected 08–11 (code text at true sizes; e.g. 08.png 132,060 → 114,164 bytes) + 17 (gradients now paint; 134,849 → 150,247 bytes) **plus 01/07/12/15/16/19/20**, each of which maps one-to-one to that slide's metric-class-only HTML changes (per-slide metric line counts 2, 1, 46, 102, 34, 41, 1, 1, 1, 7+8, 1, 1; zero unclassified anywhere) — i.e. the fractional sizes FX6 now preserves on every text slide, not just code slides. Nothing outside the two fixes' footprint changed.

## Visual gate verdict table (task 2, step 5 — quantitative, see deviation)

| slide | verdict | observation |
|---|---|---|
| 08 | PASS | code text at the reference's true scale: auditor fontSize delta 0 (9.57px both sides), ink over the code rect ref 18,832 / old rt 21,764 (+16%, the snapped 10px) / new rt 16,840 — density now at reference scale; Δluma 6.4 → 5.98; per-line layout defer acknowledged (line positioning approximate) |
| 17 | PASS | all five gradient features visible on BOTH sides with matching hues — half-panels ref(61,53,54)/(36,45,64) vs rt(53,51,52)/(34,39,54), center divider ref(110,109,206) vs rt(104,106,203), pills ref(228,107,107)/(89,138,229) vs rt(225,101,101)/(82,134,227); auditor allPainted:true; Δluma 8.1 → 7.02 |

## Accomplishments

- Canonical artifact set regenerated end-to-end from the FX1+FX2+FX4+FX6+FX7 toolchain and recommitted: pptx (slide17 reorder only), round-trip HTML (true fractional metrics + slide-17 element order), 20+20 deterministic PNGs.
- Both addendum-#4 gap closures (6 fonts, 7 gradients) proven on the COMMITTED artifacts by the committed auditors — exit 1 → exit 0 — with the FX4 ink bar preserved on slides 08–11.
- `DRIFT-BREAKDOWN.md` re-evidenced: header (stevedore @ `c0cf682`, five-branch exporter list incl. `fix/pseudo-z-index`, new comparator numbers), row 08 gains the 02-FX6 `52f2e12` true-px verdict (Δluma re-measured 5.98, word count 316/316 kept), row 17 gains the 02-FX7 `fix/pseudo-z-index` gradients verdict (Δluma re-measured 7.02, 7/7 imgs) — every decision-8 defer verbatim and untouched (slides 7/19 gaps 8–9 carry no new text), sign-off re-request line intact: `**user sign-off re-requested post-fix (side-by-side + pptx path)**`.
- progressEdd diff confined to `00-supporting-files/data/land-e-tests/` (0 files outside; `reference/` untouched — LAND.E originals stay pristine, decision 3).

## Task commits

1. **Canonical re-run on the FX6+FX7-fixed toolchain; gate both gaps closed; regenerate and commit the artifact set** — `60ebf1c` fix(02-FX8): canonical artifacts regenerated — true-px metrics (02-FX6) + pseudo-z-order (02-FX7)
2. **Re-evidence the breakdown — row 08 fonts verdict, row 17 gradients verdict, defers verbatim; visual gate; sign-off re-request** — `1e47cd7` fix(02-FX8): drift breakdown — fonts row 08 + gradients row 17 re-evidenced post FX6/FX7

## Files created/modified

- `00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx` — regenerated canonical pptx (slide-17 z-reorder only; 19/20 slide XMLs byte-identical to FX5)
- `00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html` — regenerated round-trip HTML (fractional run metrics + slide-17 order; 231 metric lines + 15 slide-17 lines, 0 unclassified)
- `00-supporting-files/data/land-e-tests/tests/exports/roundtrip/{01,07,08,09,10,11,12,15,16,17,19,20}.png` — regenerated round-trip PNGs (reference side byte-identical, unchanged)
- `00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md` — header + rows 08/17 re-evidenced; all defers verbatim

## Decisions & deviations

Decisions: the stevedore checkout choice (phase worktree c0cf682 — the only checkout carrying all five fix plans; recorded in the header per the plan's standing facts); FX6 hash pointer 52f2e12 (the metrics fix commit, not its auditor); the extra changed round-trip PNGs accepted as FX6's designed footprint after per-slide classification (each changed PNG's slide carries metric-class-only HTML changes — no new finding).

Deviations (all recorded above in frontmatter; none changed any stevedore or non-land-e-tests file):
1. Precondition grep #7 named the wrong file — the literal `font-family:'-apple-system'` is the converter's *output* (present in the checkout's generated `scripts/examples/land-e/deck.html` and the committed round-trip HTML); FX1's fix in `scripts/src/render/fonts.js` verified via its (02-FX1) comment + single-quote return. Intent proven.
2. Ink-audit command needed the auditor's documented optional `[outdir]` argument to measure (plan's bare invocation yields `fraction:null` and fails its own verify) — outdir passed, script untouched.
3. Visual gate executed quantitatively (executor model cannot render images — 02-06 precedent): auditor A/B probes, region RGB means, ink totals, Δluma trends; both slides PASS.
4. Standing host deviation inherited: `7z` for pptx XML, node IHDR for PNG dims.
5. Row 08's root-cause append was placed in the font/size cause chain (before the layout-cause semicolon) — the semantically correct reading of "appends"; the per-line defer text itself is verbatim.

## Next phase readiness

The artifact half of addendum #4 gaps 6–7 is closed and evidenced on committed artifacts; the breakdown's 20 rows all carry dispositions with the standing decision-8 defers intact (slides 7/19 gaps 8–9 unchanged). The only open human item is decision 5's PowerPoint sign-off, re-requested by the preserved line and confirmed at ship time, outside this plan's contract. The branch `agent/02-roundtrip-fidelity/progressEdd` (60ebf1c, 1e47cd7) is ready for the orchestrator's merge-back.
