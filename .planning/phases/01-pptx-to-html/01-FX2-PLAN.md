---
issue: "#36"
wave: 10
depends_on: ["01-FX1"]
target: stevedore
fixes: 01-07
---

# Plan 01-FX2: Strip 00-supporting-files/ from stevedore; re-point the comparator verify at the main-checkout fixtures

**Objective:** Close the stevedore half of VERIFICATION gap 1 per the ship-time user directive: decision 24 makes `stevedore` the pure skill folder (`SKILL.md` + `README.md` + `LICENSE` + `reference/` + `scripts/` only) — the round-trip fixtures it accidentally carries move to `progressEdd` (landed by 01-FX1). This plan removes `00-supporting-files/` from the branch entirely, then re-establishes the LAND.E comparator verification (01-07 Task 2's proof) against the fixture triple on the main checkout — from the stevedore worktree that resolves as `../../00-supporting-files/data/…`. `scripts/examples/land-e/` stays untouched (01-08 plan-mandated).

**Environment facts the executor must know (verified at plan time on this machine):**
- **Work directly in the stevedore worktree** `~/Documents/development_projects/progressEdd_projects/stevedore/02-worktrees/stevedore` — it IS on `stevedore` (HEAD `6cdf60f`, clean). Do NOT fork a temp worktree elsewhere: the comparator's `../../` path contract requires running from this exact location (two dirs up = the main checkout on `progressEdd`).
- **Dependency:** 01-FX1 must already be merged/committed on `progressEdd` with the fixture triple present in the main checkout's working tree. Preflight it (Task 2, Step 0) — if the files are absent, 01-FX1 hasn't run; stop and report BLOCKED rather than copying anything back.
- The branch carries exactly two files under `00-supporting-files/` (`data/land-e-slides.pptx`, `data/land-e-roundtrip.html`) and **no tracked file outside that directory references it** — verified at plan time by grepping every tracked file on the branch for `00-supporting-files|land-e-slides|land-e-roundtrip` (zero hits in README.md, SKILL.md, LICENSE, reference/, scripts/, .gitignore). The only documents naming the old on-branch path are `.planning/` phase records (01-07-PLAN/SUMMARY, 01-08-PLAN) — historical artifacts on `progressEdd`, not to be rewritten; this plan's SUMMARY records the re-pointed canonical command instead.
- Expected comparator result (reproduced at plan time with exactly this path shape): `PASS`, exit 0, mean 0.988 / min 0.769 / images 233%.
- Expected commit-message style: `fix(01-FX2): …` (matches the phase's `fix(01-07): …` convention).

## Tasks

<task>
<name>Task 1: Remove 00-supporting-files/ from the stevedore branch (decision 24 purity)</name>
<files>00-supporting-files/data/land-e-slides.pptx, 00-supporting-files/data/land-e-roundtrip.html</files>
<action>
From the stevedore worktree root (`~/Documents/development_projects/progressEdd_projects/stevedore/02-worktrees/stevedore`):

```bash
git rev-parse --abbrev-ref HEAD   # must print stevedore — stop and report BLOCKED otherwise
git rm -r 00-supporting-files/    # removes exactly the two tracked files above
git commit -m "fix(01-FX2): drop 00-supporting-files/ from stevedore — round-trip fixtures live on progressEdd (decisions 14, 24); branch is the pure skill folder"
```

**Do NOT touch anything else** — in particular `scripts/examples/land-e/` (deck.pptx + deck.html + README.md) stays byte-for-byte: it is the 01-08 plan-mandated worked example, not a fixture. `.gitignore`, `SKILL.md`, `README.md`, `LICENSE`, `reference/`, `scripts/` all stay.
</action>
<verify>git ls-files 00-supporting-files/ (must print nothing) && git ls-tree --name-only HEAD (must list exactly: .gitignore LICENSE README.md SKILL.md reference scripts) && git diff --stat 6cdf60f HEAD -- scripts/examples/ (must print nothing) && echo PURITY-OK</verify>
<acceptance_criteria>
- `git ls-files 00-supporting-files/` → empty on stevedore
- `git ls-tree --name-only HEAD` at the branch root lists exactly `.gitignore`, `LICENSE`, `README.md`, `SKILL.md`, `reference`, `scripts` — the decision-24 shape
- `PURITY-OK` prints; `git diff --stat 6cdf60f HEAD -- scripts/examples/` is empty (examples untouched)
- The commit's stat touches only the two removed files
</acceptance_criteria>
</task>

<task>
<name>Task 2: Re-point the LAND.E comparator verify at the main-checkout fixtures and record the canonical command</name>
<files>01-FX2-SUMMARY.md</files>
<action>
**Step 0 — fixture prerequisite (01-FX1 landed):**

```bash
test -f ../../00-supporting-files/data/land-e-slides.html \
  && test -f ../../00-supporting-files/data/land-e-slides.pptx \
  && test -f ../../00-supporting-files/data/land-e-roundtrip.html \
  || { echo "BLOCKED: fixture triple absent from main checkout — 01-FX1 not landed"; exit 3; }
```

**Step 1 — run the comparator against the main-checkout triple** (still from the stevedore worktree root; `../..` is the main checkout on `progressEdd`):

```bash
node scripts/compare-decks.mjs \
  ../../00-supporting-files/data/land-e-slides.html \
  ../../00-supporting-files/data/land-e-roundtrip.html
```

Expected: `PASS`, exit 0, `mean 0.988   min 0.769`, `images: source 12   converted 28  (233% of source)` — the exact figures VERIFICATION reproduced. A FAIL here means the fixtures moved wrong or the converter regressed — diagnose before proceeding; do not lower thresholds (those are 01-07's, already met).

**Step 2 — stale-reference sweep:** prove no tracked file on the branch still names the removed on-branch path:

```bash
grep -rn "00-supporting-files" README.md SKILL.md LICENSE reference/ scripts/ .gitignore   # exit 1, no output = clean
```

**Step 3 — regression guard:** `node --test scripts/test/` → 139/139 pass (nothing in `scripts/` changed; this proves no collateral damage).

**Step 4 — record in `01-FX2-SUMMARY.md`** (next to this plan, on `progressEdd`): the removal commit hash, the Step 1 command verbatim as **the canonical gap-1 re-verify command going forward** (superseding 01-07 Task 2's on-branch path), its PASS output, and a note that fixture references live at the main checkout's `00-supporting-files/data/` per decision 14. Paste the sweep result and the test tally.
</action>
<verify>node scripts/compare-decks.mjs ../../00-supporting-files/data/land-e-slides.html ../../00-supporting-files/data/land-e-roundtrip.html (must print PASS, exit 0) && ! grep -rn "00-supporting-files" README.md SKILL.md LICENSE reference/ scripts/ .gitignore && node --test scripts/test/ 2>&1 | tail -3</verify>
<acceptance_criteria>
- Comparator PASSes with mean ≥ 0.70 / min ≥ 0.30 via the `../../00-supporting-files/data/…` paths (expected exactly 0.988 / 0.769 / 233%)
- Zero references to `00-supporting-files` in branch-tracked docs/tests outside the (now removed) directory — sweep exits 1 with no output
- `node --test scripts/test/` green, 139/139, 0 fail
- `01-FX2-SUMMARY.md` carries the re-pointed canonical command verbatim and its PASS output
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Task 1 verify prints `PURITY-OK`; branch root is exactly SKILL.md/README.md/LICENSE/reference/scripts (+`.gitignore`)
- [ ] Task 2 comparator run PASSes via `../../00-supporting-files/data/…` from the stevedore worktree
- [ ] Full suite green; `scripts/examples/land-e/` unchanged since `6cdf60f`
- [ ] Stale-reference sweep clean; canonical command recorded in the SUMMARY

<!--
wave/depends_on carry the phase's LOGICAL order — /skill:implement executes
the phase's plans sequentially in that order (one executor at a time, one
temp worktree per target branch); target names the branch whose per-target
agent worktree the plan's executor works in and that the phase merges back
into at its merge point. All three are precomputed at plan time —
/skill/implement reads them from this frontmatter, no runtime analysis.
Each plan's executor walks the task sections in order, commits each task
atomically inside the phase's per-target worktree, and writes NN-YY-SUMMARY.md
next to this file on completion.
-->
