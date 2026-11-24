---
status: complete
duration: 15min
key-files:
  created: []
  modified:
    - scripts/compare-decks.mjs
    - scripts/test/compare.test.mjs
requirements-completed:
  - "T1: comparator image gate replaced by media survival counting (decision 9) — mediaRefs/mediaFingerprints/mediaSurvival added and exported, IMAGE_RATIO_THRESHOLD and its gate deleted, raw img-count line kept report-only, header gates list updated; committed-pair verify prints survival 0/15 with the missing list and exits 1"
  - "T2: survival tests added (embedded data URI of same bytes passes 1/1; missing media fails 0/1 naming the path), old suite adapted to the gate swap (real pic payloads survive 2/2, 0/0 no-media trivial pass kept green, 50% assertion removed); node --test scripts/test/compare.test.mjs green (11/11); committed-pair pre-fix baseline recorded verbatim below"
key-decisions:
  - "Plan code applied verbatim: survival functions, main() rewiring, header docstring, and both new tests are byte-for-byte the plan's snippets (CLI invoked as 'scripts/compare-decks.mjs' relative, valid under the standing repo-root test invocation)"
  - "Suite adaptation exactly as the plan's parenthetical instructs: CONVERTED_DECK's placeholder AAAA/BBBB payloads now embed the real bytes of the source's pic-a.png/pic-b.png (written to the suite tmpdir) so the PASS tests survive 2/2; the 'changed' test now uses a DATAURI_SOURCE_DECK variant (data-URI srcs ignored by mediaRefs by construction) as the required existing no-media 0/0 trivial-pass proof; the thresholds test drops the 50% assertion (gate gone by design) and gains a negative IMAGE_RATIO_THRESHOLD check plus survival-export checks — 0.70/0.30 verbatim checks untouched"
  - "Committed pair NOT regenerated (that is plan 02-06); the failing 0/15 run against the committed artifacts is the documented pre-fix baseline handed to plan 02-05"
deviations:
  - "Supporting-files cwd note (same as 02-01/02-02/03): the plan's standing fact cites '../../00-supporting-files/...' from any 02-worktrees/* worktree, but this phase's agent worktree nests at 02-worktrees/agent/02-roundtrip-fidelity/stevedore, so the real relative path is '../../../../00-supporting-files/...'. Same files, pure path arithmetic."
  - "gh-mirror.sh lives only in the main checkout (not inside the stevedore worktree), so both progress flips were invoked from the main tree root with the exact arguments given — T1 ✓ and T2 ✓ both landed on issue #56."
---

# Plan 02-04 Summary: Redefine the comparator's image metric to media survival counting

The comparator's lying image gate (233% junk rasterizations while real photos went missing) is gone: acceptance is now survival counting — every unique source media file must appear byte-identically in the converted deck, N/N or fail with the exact missing paths named.

## Accomplishments

- `scripts/compare-decks.mjs`: new `mediaRefs` (unique non-data/non-remote `src="…"` file refs), `mediaFingerprints` (md5 set of embedded `data:(image|video|audio)/*;base64` payloads plus file refs resolved against the deck's dir), and `mediaSurvival` (source refs fingerprinted against the converted deck's fingerprint set; unreadable source refs count as missing) — all exported, imports still `node:` built-ins only (`node:crypto`, `node:path` added)
- `IMAGE_RATIO_THRESHOLD` (0.50) and its gate deleted; the `images: source N converted M (…%)` line stays report-only; mean 0.70 / min 0.30 / slide-count gates untouched
- On the committed LAND.E pair the new gate does exactly what decision 9 demands: **0/15 survival, exit 1** — while the report-only raw count still reads 233%, exposing the old gate's lie
- `scripts/test/compare.test.mjs`: two survival tests (1/1 pass via embedded data URI; 0/1 fail naming `a.png` in stderr), PASS tests now carry real surviving payloads (2/2), the data-URI-source variant proves the 0/0 trivial pass, and no assertion requires the dead 50% gate; full suite **147/147 green** (`node --test scripts/test/*.test.mjs`)
- Nothing committed to progressEdd: the committed pair was only read, never regenerated (plan 02-06's job)

## Pre-fix baseline (committed pair, verbatim — hands the exact missing set to plan 02-05)

Command (from the worktree root; `../../../../` per the cwd deviation above):

```bash
node scripts/compare-decks.mjs ../../../../00-supporting-files/data/land-e-tests/reference/slides.html \
  ../../../../00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html || echo "exit=$? (expected 1 — plan 02-05 closes it)"
```

Output (report lines; the 20-slide table above them reads mean 0.988 / min 0.769, all Jaccards ≥ 0.769):

```
images: source 12   converted 28  (233% of source)
media survival: 0/15 — missing: 00-supporting-files/images/slides/Im-Troy-Mcclure.mp4, 00-supporting-files/images/slides/20260427235754.png, 00-supporting-files/images/slides/20260427093122.png, 00-supporting-files/images/slides/20260427231910.png, 00-supporting-files/images/slides/20260427231840.png, 00-supporting-files/images/slides/structured-outputs.png, 00-supporting-files/images/slides/spongebob-patrick.mp4, 00-supporting-files/images/slides/Evolution.png, 00-supporting-files/images/slides/zai-logo.svg, 00-supporting-files/images/slides/pi-logo-loop-true-vector.svg, 00-supporting-files/images/slides/gsd-logo-2000.svg, 00-supporting-files/images/slides/3-paths.png, 00-supporting-files/images/slides/copilot-agent-dropdown.png, 00-supporting-files/images/slides/terminal.svg, 00-supporting-files/images/slides/yu-gi-oh-yugi-muto.mp4
compare-decks: gate failed: media survival 0/15 — missing: 00-supporting-files/images/slides/Im-Troy-Mcclure.mp4, 00-supporting-files/images/slides/20260427235754.png, 00-supporting-files/images/slides/20260427093122.png, 00-supporting-files/images/slides/20260427231910.png, 00-supporting-files/images/slides/20260427231840.png, 00-supporting-files/images/slides/structured-outputs.png, 00-supporting-files/images/slides/spongebob-patrick.mp4, 00-supporting-files/images/slides/Evolution.png, 00-supporting-files/images/slides/zai-logo.svg, 00-supporting-files/images/slides/pi-logo-loop-true-vector.svg, 00-supporting-files/images/slides/gsd-logo-2000.svg, 00-supporting-files/images/slides/3-paths.png, 00-supporting-files/images/slides/copilot-agent-dropdown.png, 00-supporting-files/images/slides/terminal.svg, 00-supporting-files/images/slides/yu-gi-oh-yugi-muto.mp4
FAIL
exit=1 (expected 1 — plan 02-05 closes it)
```

Survival: **0/15** (10 raster/svg + 3 `.mp4` + 2 pngs — matches the plan's expected set of 15). Text gates all pass (mean 0.988, min 0.769, 20/20 slides); media survival is the sole failing gate — precisely the pre-fix state plan 02-05 must close to 15/15.

## Task commits

1. **Implement mediaSurvival and swap the images gate for it** — `ac3f623` feat(02-04): comparator image gate = media survival counting (decision 9), raw count report-only
2. **Survival tests + committed-pair sanity expectation** — `2ea9acd` test(02-04): media survival gate tests; committed-pair FAIL recorded as the pre-fix baseline

## Files created/modified

- `scripts/compare-decks.mjs` — survival functions added (exported), ratio gate deleted, survival gate + report line wired into main(), header gates list updated
- `scripts/test/compare.test.mjs` — two survival tests, PASS decks carry real surviving payloads, 0/0 no-media proof, 50%/IMAGE_RATIO assertions removed/replaced, survival exports checked

## Decisions & deviations

Decisions: plan code applied verbatim; suite adaptation followed the plan's own parenthetical instructions (matching payloads for PASS decks, one no-media 0/0 proof kept, dead-gate assertions removed without weakening coverage — 'same' now asserts 2/2 survival, 'changed' asserts `media survival: 0/0 (no source media)`, the count-mismatch test still fails on slide counts).

Deviations: only the two cwd notes above (fixture path depth, mirror invocation from the main checkout) — both identical to what 02-01/02-02/02-03 already recorded; no code deviations.

## Next phase readiness

- The acceptance metric decision 9 specifies is live: survival N/N gates the comparator, missing paths named on failure, 0/0 sources pass trivially; all other gates untouched
- Plan 02-05 has its exact worklist: the 15 missing paths verbatim above (resolved against `reference/slides.html`), with text fidelity already at mean 0.988 — media survival is the only red gate
- The committed pair remains the untouched pre-fix artifact for plan 02-06's post-fix regeneration comparison
