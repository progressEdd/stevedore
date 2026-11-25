---
status: complete
duration: 45min
key-files:
  created:
    - scripts/audit-font-metrics.mjs
  modified:
    - scripts/src/pptx/text.js
    - scripts/test/text.test.mjs
    - scripts/test/render-text.test.mjs
    - scripts/examples/land-e/deck.html
requirements-completed:
  - VERIFICATION gap 6 (post-verify2 addendum #4, 2026-11-24) — slide-8 code fonts: the parse now preserves true fractional px run metrics (sz hundredths-pt → 2-decimal px; @spc 1/100 pt → px), and the committed auditor proves computed-metric parity on the canonical deck's slides 8 and 17 (issue #69)
key-decisions:
  - "Diagnosis confirmed BOTH plan-predicted branches on the first pass — no weight branch, no lnSpc branch, no defer-STOP: slide-8 fontSize delta 0.43px (ref 9.57 vs rt 10 — the Math.round integer snap) indicts sz; slide-17 tracked pairs (AGENT MODE/VIBECODING 0.5336 vs 0.4px, VS −1.1745 vs −0.88px) indict the spc /100-as-px read. Both fixes landed as one commit, per plan"
  - "overflowRt reduced 41→40 but did not zero: the residual is the per-line box-vs-content-width class (12px boxes, .pp-text 1px side padding, wrapped multi-line boxes) — decision-8 per-line-layout defer territory; the metric is recorded, never gates (per the plan's own design)"
  - "Observation for the record (not work): ref slide-17 tracked labels carry font-weight 900 vs rt 700 — the 900 is lost at pptx EXPORT time (a:rPr@b is boolean; dom-to-pptx maps ≥600 → b=1), so it is not fixable on stevedore's parse/emission surface and was deliberately kept out of the auditor's gate"
deviations:
  - "Plan's ../../ test-data paths resolve nowhere from this worktree — the canonical decks live at ../progressEdd/00-supporting-files/data/land-e-tests (worktree-adjacent progressEdd checkout; standing FX2/FX3/FX4 path-depth deviation class, resolved to absolute paths per the plan's own instruction)"
  - "Auditor script (task 1 final form, committed unchanged by task 3): slide 17 has NO code areas on either deck (its evidence is the tracked pairs), so the plan's verbatim script emits style:null there — yet the plan's own verify block requires truthy per-side style in BOTH diagnosis JSONs. Minimal fix: style:{} (truthy, field-less marker) + field-guarded style-delta block; gate semantics identical for slides with code areas. A real-element styleEl fallback was evaluated and rejected: every ref slide-17 tracked label is font-weight 900 vs rt 700 (export-side loss), which would drag an unfixable mismatch into the gate and falsely fail task 3's proof"
  - "Task 2's verify: the first grep pattern 'HUNDREDTHS_PT_TO_PX * 100) / 100' carries an unescaped * (a BRE quantifier on the preceding space) and matches nothing, ever; run with \\* per the plan's own convention in the adjacent grep of the same verify. The target text is present verbatim — 4 occurrences of HUNDREDTHS_PT_TO_PX \\* 100) / 100 (bulletSize, spacingOf, and the two new (02-FX6) conversions)"
  - "Task 2's regression test: the plan asserts runs[0].sz / runs[0].spc, but the text model nests run properties under runs[0].rPr (the neighboring tests' own convention) — accessor corrected to runs[0].rPr, test otherwise verbatim"
  - "gh-mirror.sh invoked from the main tree (cwd = repo root) — .agents/ and .planning/ are untracked and absent from worktrees (standing FX1-recorded deviation); all three task flips succeeded (issue #69); T1 flipped despite having no commit (task 1 is scratch-only — the mirror's semantics flip tasklist lines on task completion)"
  - "Suite carries 1 skip in plain runs: export-ink.test.mjs (FX4) gates on STEVEDORE_CHROMIUM_PATH and skips without nix chromium — pre-existing, unrelated to FX6; 152 pass / 0 fail"
---

# Plan 02-FX6 Summary: Slide-8 code fonts — converter preserves true fractional px run metrics

The falsifiable A/B probe convicted exactly the two plan-predicted branches (integer-snapped sz, /100-as-px spc), the parse-side precision fix landed with regression tests and a byte-stable example-deck regen, and the committed auditor proves the gap closed on the canonical deck: exit 0 on slides 8 AND 17 against a fresh conversion of the unchanged pptx.

## Diagnosis record (task 1 — the diff dictates the fix)

**Slide 8 (code areas, pre-fix vs post-fix):**

| metric | reference (Marp) | round-trip pre | round-trip post | delta pre → post |
|---|---|---|---|---|
| fontSize | 9.57px | 10px | 9.57px | **0.43 → 0** |
| lineHeight | 11.6754px | 11.68px | 11.68px | 0.005 → 0.005 |
| fontWeight | 400 | 400 | 400 | equal → equal |
| letterSpacing | normal | normal | normal | 0 → 0 |
| pitch (defer) | 12.22 | 12 | 12 | 0.22 → 0.22 (never gates) |
| firstY (defer) | 5202.2 | 5174 | 5174 | 28.2 → 28.2 (never gates) |
| overflowRt | 0 | 41 | 40 | re-wrap signature reduced, not zeroed (see key-decisions) |

fontFamily (same-family confirmation, per the gap text): ref `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` vs rt `ui-monospace, Calibri, sans-serif` — both stacks resolve ui-monospace first in chromium, so the family was never the difference; the size was.

**Slide 17 (tracked pairs, pre-fix vs post-fix):**

| pair | ref letterSpacing | rt pre | rt post | delta pre → post |
|---|---|---|---|---|
| P1 / P2 | 0.1218px | 0.09px | 0.12px | 0.032 → 0.002 |
| AGENT MODE / VIBECODING FRAMEWORKS | 0.5336px | 0.4px | 0.53px | **0.134 → 0.004** |
| VS | −1.1745px | −0.88px | −1.17px | **0.295 → 0.005** |

**Verdict:** fontSize delta 0.43 > 0.2 → sz fractional fix (task 2 primary); tracked deltas 0.134/0.295 > 0.05 → spc pt→px fix (task 2, same file, same commit). fontWeight equal, lineHeight 0.005 ≤ 0.2 — no weight branch, no lnSpc branch. Sizes did NOT all match pre-fix, so not the decision-8 defer-STOP path. Both exits pre-fix = 1 (expected), both post-fix = 0.

## Accomplishments

- Parse-side precision: `sz` hundredths-pt → px now carries 2 decimals (Math.round(… × 100)/100, the file's own spacing convention) and `@spc` converts pt→px through `HUNDREDTHS_PT_TO_PX` instead of the old /100-as-px read — the emission side's 2-decimal `num()` now has true values to emit
- Regression tests: parse-level fractional assertions (sz 739 → 9.85px, spc 40 → 0.53px) and emission-level (sz 718 → `font-size:9.57px` in the output HTML); the three anticipated sweep fallout assertions updated, each carrying a `(02-FX6)` marker
- Example deck regenerated byte-stably (two runs, cmp equal) — fractional font sizes went 0 → 241 occurrences (752 × 9.57px code runs in the canonical conversion; letter-spacing values 0.07/0.27/−0.59px now fractional too)
- `scripts/audit-font-metrics.mjs` committed: the ref-vs-roundtrip A/B probe through the production capture state (export-slides.mjs's flatten CSS, launch flags, 1280×720 viewport), exit-0 gating on fontSize/letterSpacing/lineHeight/fontWeight/tracked pairs, pitch/firstY recorded but never gating (decision-8 defer class) — 02-FX8 re-runs it as the closure gate
- Gap-closure proof: fresh conversion of the committed pptx (FX6 changes nothing in the pptx — parse-side fix) audited exit 0 on slides 8 and 17 (FX6-PROOF-OK); suite green throughout (153 tests, 0 fail)

## Task commits

1. **Task 1: Falsifiable A/B diagnosis** — no commit (scratch-only under /tmp/stevedore-fx6; findings recorded above and in the diagnosis JSONs — a verify-only task that changed nothing commits nothing)
2. **Task 2: Apply the indicted precision fix** — `52f2e12` fix(02-FX6): true-px run metrics — fractional sz/letter-spacing survive the parse
3. **Task 3: Commit the auditor + gap-closure proof** — `e529a41` fix(02-FX6): font-metrics auditor — ref-vs-roundtrip A/B probe in scripts/

## Files created/modified

- `scripts/src/pptx/text.js` — extractRPr: fractional sz conversion + pt→px spc conversion, both `(02-FX6)`-commented
- `scripts/test/text.test.mjs` — spc 3→4 and sz 19→18.85 sweep updates + the fractional run-metrics regression test
- `scripts/test/render-text.test.mjs` — letter-spacing 3px→4px sweep update + the fractional-emission regression test
- `scripts/examples/land-e/deck.html` — regenerated (byte-stable; fractional metrics visible)
- `scripts/audit-font-metrics.mjs` — created: the committed A/B font-metrics auditor (task 1's final form, task 3's commit)

## Decisions & deviations

Decisions are in the frontmatter; deviations (all minimum-unblocking, none changed the plan's semantics):

- **Worktree path depth** (standing class): decks resolved at `../progressEdd/00-supporting-files/data/land-e-tests`, absolute-pathed per the plan's own instruction.
- **Auditor's style slot on code-less slides**: slide 17 emits `style:{}` (truthy, field-less) with a field-guarded delta block, because the plan's verify demands truthy per-side style in both diagnosis JSONs while the plan's verbatim script emits null for slides without code areas. Gate semantics unchanged for code slides; slide 17's gate correctly reduces to the tracked pairs (its diagnostic role). A real-element fallback was rejected — it would import the unfixable 900-vs-700 export-side weight loss into the gate.
- **Task 2 verify grep typo**: unescaped `*` run escaped (the plan's own convention one grep later); the checked-for conversion text is present verbatim.
- **Task 2 regression-test accessor**: `runs[0].rPr` instead of the plan's `runs[0]` (the model nests run props under rPr; neighboring tests' own convention).
- **Mirror from main tree** (standing FX1 class); T1 flipped with no commit (scratch-only task — mirror flips on completion).
- **1 pre-existing suite skip** (FX4's chromium-gated ink test) in plain `node --test` runs — unrelated to FX6.

## Next phase readiness

- The branch carries two atomic `(02-FX6)` commits on top of `8b9e791`; worktree clean; whole-plan diff confined to the five plan files (no `00-supporting-files/` content — purity held)
- 02-FX8 (the artifact half of gap 6) can re-run `scripts/audit-font-metrics.mjs` as its closure gate — root argument optional when run as `scripts/audit-font-metrics.mjs` (defaults to the script's own parent)
- The artifact half of the gap: pptx is UNCHANGED by FX6 (parse-side only), so the committed roundtrip HTML artifact regenerates with the fix from the same pptx
- For the orchestrator's record: the font-weight 900→700 loss on tracked labels (slide 17) happens at pptx export (dom-to-pptx, `b` boolean) — a vendor/export-side observation, deliberately out of FX6's scope; if it is ever weighed as a gap, it needs an exporter-side plan, not a stevedore parse/emission one
