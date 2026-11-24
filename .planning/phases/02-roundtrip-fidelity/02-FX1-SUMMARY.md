---
status: complete
duration: 12min
key-files:
  created: []
  modified:
    - scripts/src/render/fonts.js
    - scripts/src/render/text.js
    - scripts/test/render-text.test.mjs
    - scripts/test/render-shape.test.mjs
    - scripts/examples/land-e/deck.html
requirements-completed:
  - VERIFICATION gap 1 (post-verdict addendum, 2026-11-23) — style attributes no longer terminate mid-declaration
key-decisions:
  - "Single-quote the emitted font name (CSS-valid, attribute-safe, readable HTML); embedded single quotes backslash-escaped per the CSS spec — the plan's chosen implementation of the gap's escape-or-single-quote fix."
  - "render-shape.test.mjs assertions updated to the single-quoted form (sweep rule: the failure encoded the old double-quoted emission, not a regression)."
deviations:
  - "Sweep touched scripts/test/render-shape.test.mjs (not in Task 2's files list): its fontFamily test asserted the double-quoted form ('\"Calibri Light\"' etc.) and failed under the fix; updated to single-quoted with the mandated // (02-FX1) comment — sanctioned by Task 2's action text, though the plan-time note had expected an empty sweep."
  - "gh-mirror.sh invoked from the main tree (cwd = repo root) instead of the worktree: .agents/ and .planning/ are untracked and absent from worktrees; the progress subcommand writes nothing locally (GitHub tasklist only), so intent was preserved. Both task flips succeeded (issue #60)."
---

# Plan 02-FX1 Summary: Attribute-safe font stacks — style attributes no longer terminate mid-declaration

Every styled span now emits a single-quoted font stack inside an intact `style` attribute, so browsers apply font-family, font-weight, font-style and color instead of silently dropping everything after the first inner double quote.

## Accomplishments

- `fontFamily` (`scripts/src/render/fonts.js`) returns `'name', fallback, generic` — single-quoted name, embedded single quotes backslash-escaped; the `+mj/+mn` theme resolution, fallback and generic families are untouched.
- Two regression tests added in `scripts/test/render-text.test.mjs`: the canonical repro (quoted stack + weight/style/color emitted after it) and a document-wide sweep (`font-family:"` must never appear in emitted HTML).
- Full suite swept: 150/150 pass. One test (`render-shape.test.mjs` fontFamily theme test) had encoded the double-quoted emission and was updated to the single-quoted form with the `// (02-FX1)` comment.
- Example deck regenerated: **broken spans old=800 → new=0**; byte-stable across two runs (`cmp` identical). Canonical repro now intact — slide 9 title span: `style="font-size:23px;font-family:'-apple-system', Calibri, sans-serif;font-weight:700;font-style:normal;color:#224466"` (before the fix, browsers parsed only `font-size` and dropped the rest).
- GitHub mirror: T1 and T2 flipped on issue #60.

## Task commits

1. **Task 1: Single-quote emitted font stacks and lock it with regression tests** — `76bbd7f` fix(02-FX1): single-quoted font stacks — style attributes no longer terminate mid-declaration
2. **Task 2: Sweep the suite and regenerate the example deck with intact style attributes** — `afa47e5` fix(02-FX1): sweep + example deck regenerated with intact style attributes

## Files created/modified

- `scripts/src/render/fonts.js` — return line now single-quotes the resolved face (with the 02-FX1 comment block); only change in the function.
- `scripts/src/render/text.js` — header-comment sentence only: "all font-family values are single-quoted (attribute-safe — 02-FX1)".
- `scripts/test/render-text.test.mjs` — two new 02-FX1 regression tests appended.
- `scripts/test/render-shape.test.mjs` — three assertions moved from double- to single-quoted form (sweep; carries `// (02-FX1)` comments).
- `scripts/examples/land-e/deck.html` — regenerated from `deck.pptx` by the fixed emitter; 800 broken spans → 0, 259 single-quoted stacks.

## Decisions & deviations

Decisions: the single-quote implementation exactly as planned — CSS single-quoted strings are valid font-family names with no HTML-attribute meaning, keeping the emitted HTML readable; fallback/generic stay unquoted identifier tokens. Deviations: the two recorded above (sweep touching render-shape.test.mjs beyond Task 2's nominal files list; mirror script run from the main tree because `.agents/`/`.planning/` are untracked). Both are minimal and intent-preserving.

## Next phase readiness

The converter half of the visual sign-off rejection is closed: round-tripped HTML carries complete style declarations. 02-FX2 (exporter size half) and 02-FX3 (artifact/breakdown half) can proceed; the regenerated `scripts/examples/land-e/deck.html` and the green suite (150 tests) are their baseline. `tests/exports/roundtrip/*.png` renders made before this fix will need re-export for any visual comparison.
