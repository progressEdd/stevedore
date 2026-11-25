---
status: complete
duration: 11min
key-files:
  created:
    - scripts/audit-mono-width.mjs
    - vendor/dom-to-pptx/src/__tests__/real-mono-typeface.test.js
  modified:
    - scripts/src/render/fonts.js
    - scripts/test/render-text.test.mjs
    - scripts/examples/land-e/deck.html
    - scripts/audit-code-ink.mjs
    - vendor/dom-to-pptx/src/utils.js
    - vendor/dom-to-pptx/VENDORED.md
requirements-completed:
  - VERIFICATION addendum #5 gap 10 (post-FX8 user SC4 re-review, 2026-11-24) — slide-8 code fonts render monospace, not proportional: the converter now maps ui-monospace to the probe-verified real stack (ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace) and every known mono face to a mono fallback chain, the pptx run properties carry typeface="Consolas" (keyword gone, fork branch fix/real-mono-typeface pushed/merged/vendor-synced), and the committed mono-width auditor proves both halves on a fresh full round-trip (issue #74)
key-decisions:
  - "Both halves fixed as specified AND they compose: the fork maps the leading ui-* keyword to Consolas in <a:latin typeface>, the converter then maps the Consolas face to 'Consolas, Liberation Mono, Courier New, monospace' in the HTML — the round-trip composes them, so the mono class survives even on hosts without Consolas installed (probe: keyword path 57.609px and Consolas path 57.609px, both = the monospace class 57.797 vs sans 45.328)"
  - "Minimality of the fork fix proven by the pptx census: exactly the code-carrying slides 08–11 changed, every changed line in every changed slide XML is a typeface line (0 non-typeface changed lines), all other slide XMLs byte-identical — the typeface mapping touched nothing else in the export"
  - "Regression lock is two-layered as planned: static stack-contains unit tests (render-text.test.mjs, 2 new tests) plus the committed chromium width-probe auditor (audit-mono-width.mjs) that re-runs the gap's diagnosis against any emitted HTML — pre-fix committed HTML still fails it (exit 1, 45.328 = sans), the reference deck and every fixed output pass it (exit 0)"
deviations:
  - "Fork helper placement: the plan says 'next to resolveCaptureViewport/pseudoSortKey', but those functions do not exist on the v2.1.2 base (they arrive via the prior fix branches) and inserting in either occupied gap (before getSoftEdges / before getTextStyle) would conflict at the plan's scripted stevedore-combined merge. resolveRealTypeface + UI_TYPEFACE_MAP placed immediately AFTER getTextStyle instead — a region no fix branch touches; same file, same export, same verbatim content, position only. The merge then auto-resolved cleanly (no conflict)"
  - "Repo-local git identity set in the scratch fork clone (progressEdd <progressEdd@gmail.com>, matching the stevedore worktree's effective identity) — the fresh clone had none, blocking the fix-branch commit"
  - "scripts/audit-code-ink.mjs selector widened (one file beyond the plan's diff-confinement list): FX4's ink auditor detects code areas by span[style*=\"ui-monospace\"], a signature Tasks 1+2 retired — on the fixed round-trip it found no code areas and Task 3's ink gate (fraction >= 0.01) was unsatisfiable. Filter extended to span[style*=\"monospace\" i], span[style*=\"Consolas\" i] — the plan's own audit-mono-width selector convention, a strict superset of the old signature (old decks still match). Committed separately as ff893ab"
  - "Auditor header punctuation: the plan's verify greps the literal marker (02-FX9) but the plan's own code block writes (02-FX9, — adjusted two header comment lines (comma -> ').', stray ')' -> '.') so the marker exists; no code changed"
  - "gh-mirror.sh invoked from the main tree (standing FX1/FX7 deviation class — .agents/ and .planning/ are untracked, absent from worktrees); all three task flips succeeded (issue #74)"
---

# Plan 02-FX9 Summary: Real mono font stacks — ui-monospace resolves to monospace in the round-trip HTML AND in the pptx

Both halves of gap 10 closed and composed: the converter emits probe-verified mono stacks (keyword AND real mono faces), the fork maps ui-* keyword typefaces to real fonts in pptx run properties (fix/real-mono-typeface → stevedore-combined → vendor), and the committed mono-width auditor proves the closure end-to-end — the fresh round-trip's slide-8 code spans resolve monospace in nix chromium (57.609px = the mono class) and its pptx slide-8 code runs carry `typeface="Consolas"` with the keyword gone, media survival 15/15, only typeface-class slides changed.

## Proof record (task 3 — every number from the run)

**Pre-fix gap re-proof (committed post-FX8 round-trip HTML, slide 8):**
```json
{"slide":8,"family":"ui-monospace, Calibri, sans-serif","familyWidth":45.328,"sansWidth":45.328,"monoWidth":57.797,"monoClass":false}
```
exit 1 — the gap exactly as diagnosed: the old emission falls through to the sans class (45.3 = the plan's 45.3px).

**Reference sanity (Marp deck, slide 8):**
```json
{"slide":8,"family":"ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace","familyWidth":57.609,"sansWidth":45.328,"monoWidth":57.797,"monoClass":true}
```
exit 0 — the metric detects mono where mono exists.

**Converter half against the keyword-carrying pptx (fresh conversion of the committed deck):**
```json
{"slide":8,"family":"ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace","familyWidth":57.609,"sansWidth":45.328,"monoWidth":57.797,"monoClass":true}
```
exit 0; 211 keyword-stack occurrences in the emitted HTML — the keyword path resolves mono.

**Full round-trip on the fixed toolchain (both halves composed):** exit 0, `media survival: 15/15 (all source media present)`, `PASS`, `ROUNDTRIP-OK`. slide8.xml: CONSOLAS-PRESENT, KEYWORD-GONE. Emitted stack present: `font-family:'Consolas', 'Liberation Mono', 'Courier New', monospace`. Width probe on the round-trip HTML:
```json
{"slide":8,"family":"Consolas, \"Liberation Mono\", \"Courier New\", monospace","familyWidth":57.609,"sansWidth":45.328,"monoWidth":57.797,"monoClass":true}
```
exit 0. Code ink (FX4's bar): fraction **0.0440** (17454 dark px / 396291), rect (48,134,1169,339) — ≥ 0.01 with room.

**pptx census:** `slide8/9/10/11.xml CHANGED`, each classified typeface-class (Consolas present, ui-monospace absent); all other slide XMLs byte-identical. Line-level check across 08–11: 0 non-typeface changed lines per slide — every change is a typeface change.

**Example deck regen (task 1):** old `'ui-monospace', Calibri, sans-serif` stacks 211 → 0; keyword stacks 0 → 211; REGEN-STABLE (byte-identical across two runs).

**Suites:** stevedore `node --test scripts/test/*.test.mjs` = 155 tests / 154 pass / 0 fail / 1 skip (the FX4 browser test, no chromium). Fork vitest on the new suite: 3/3 green; full fork run 118 tests / 115 pass / 2 fail / 1 skip — both failures are node-exporter.test.js browser-launch (NixOS libnspr4.so), the FX7-recorded pre-existing environment limit, proven pre-existing on pristine v2.1.2.

## Task commits

1. **Converter emission — real mono stacks in fonts.js, regression tests, suite sweep, example regen** — `761f28d` fix(02-FX9): real mono font stacks — ui-monospace and mono faces resolve monospace, not proportional sans
2. **Fork branch fix/real-mono-typeface — push, merge, vendor-sync** — `12b81d8` fix(02-FX9): vendor sync — dom-to-pptx stevedore-combined (+fix/real-mono-typeface) (fork-side: `8dcace0` fix branch pushed; `8d67971` merged into stevedore-combined and pushed)
3. **Commit the mono-width auditor and prove both halves on a fresh round-trip** — `e7d54a2` fix(02-FX9): mono-width auditor — code-stack resolution probe in scripts/
4. **(task-3 unblocking deviation)** — `ff893ab` fix(02-FX9): code-ink auditor detects mono spans by family — the retired ui-monospace signature no longer matches the fixed emission

## Files created/modified

- `scripts/src/render/fonts.js` — UI_MONO_STACK + MONO_FACES constants; fontFamily maps ui-monospace to the keyword stack, mono faces to `'Liberation Mono', 'Courier New'` fallback + monospace generic; header self-description extended
- `scripts/test/render-text.test.mjs` — 2 new regression tests (keyword stack, mono fallback chain); the FX1 sweep assertion updated to the real stack (marked `// (02-FX9)`)
- `scripts/examples/land-e/deck.html` — regenerated: 211 old stacks → 211 keyword stacks, byte-stable
- `scripts/audit-mono-width.mjs` — committed width-probe auditor: extracts the computed font-family of a slide's code spans, measures "iiiwww" at 16px, same-page sans/mono calibration; exit 0 iff mono class
- `scripts/audit-code-ink.mjs` — code-area detection widened from the retired ui-monospace signature to mono-family spans (deviation, see below)
- `vendor/dom-to-pptx/src/utils.js` — resolveRealTypeface + UI_TYPEFACE_MAP; getTextStyle's fontFace call site maps leading ui-* keywords (quote/whitespace stripping moved into the helper)
- `vendor/dom-to-pptx/src/__tests__/real-mono-typeface.test.js` — fork-convention vitest suite (3 tests / 5 assertions)
- `vendor/dom-to-pptx/VENDORED.md` — fix/real-mono-typeface entry added; Synced line updated (02-FX9)

## Decisions & deviations

Decisions are recorded in the frontmatter; deviations (all five, each minimum-scope and none blocking):

- **Fork helper placement** (position only): `resolveRealTypeface` sits immediately after `getTextStyle` rather than "next to resolveCaptureViewport/pseudoSortKey" — those helpers do not exist on the v2.1.2 base, and both adjacent gaps are already occupied by prior fix branches (inserting there would conflict the plan's scripted `git merge --no-ff` into stevedore-combined). The merge auto-resolved cleanly.
- **Git identity** in the scratch fork clone: repo-local `progressEdd <progressEdd@gmail.com>` (the fresh clone had none; matches the stevedore worktree).
- **`scripts/audit-code-ink.mjs`** (one file beyond the plan's diff-confinement list): FX4's ink auditor locates code areas via `span[style*="ui-monospace"]` — a signature this plan's Tasks 1+2 retired, so on the fixed round-trip it found no code areas and Task 3's ink gate was unsatisfiable. The filter now matches mono-family spans (`span[style*="monospace" i], span[style*="Consolas" i]`) — the same selector convention the plan itself specifies for audit-mono-width.mjs, and a strict superset of the old signature. Own commit `ff893ab`.
- **Auditor header marker**: the plan's verify greps literal `(02-FX9)` while the plan's own code block writes `(02-FX9,` — two comment lines adjusted to carry the marker; no code change.
- **gh-mirror.sh from the main tree** (standing class): all three task flips succeeded (issue #74); no mirror failures.

## Next phase readiness

Gap 10 is closed on both halves and regression-locked (unit tests + committed auditor); the artifact half (regenerated canonical pair, DRIFT-BREAKDOWN row 08) is 02-FX11, which can now run against this toolchain — the auditor, the census evidence, and the ink fraction above give it its inputs. The example deck visibly demonstrates the fix in a committed artifact.
