---
issue: "#35"
wave: 9
depends_on: []
target: progressEdd
fixes: 01-07
---

# Plan 01-FX1: Land the full LAND.E round-trip artifact triple on progressEdd

**Objective:** Close VERIFICATION gap 1 per the ship-time user directive: the round-trip fixtures belong on `progressEdd` (decision 14 — `00-supporting-files/` is progressEdd plumbing), NOT on `stevedore` (decision 24 — pure skill folder). This plan lands the two artifacts that currently exist only on the `stevedore` branch (`land-e-slides.pptx`, `land-e-roundtrip.html`) onto `progressEdd`, completing the fixture triple alongside the already-present `land-e-slides.html`. The stevedore-side cleanup is 01-FX2, which depends on this plan — its comparator verify reads these fixtures from the main checkout via `../../00-supporting-files/data/…`.

**Environment facts the executor must know (verified at plan time on this machine):**
- **Work in the main checkout** `~/Documents/development_projects/progressEdd_projects/stevedore` — it IS on `progressEdd` (decision 19; `git worktree list` confirms). Do NOT fork a temp worktree: 01-FX2's comparator reads the fixtures from this checkout's working tree, so the commit must land here.
- The main checkout is clean except the untracked verifier artifact `.planning/phases/01-pptx-to-html/VERIFICATION.md` — **leave it alone** (orchestrator's file; fix plans never touch `.planning/`).
- The `stevedore` branch (ref `stevedore`, HEAD `6cdf60f`) carries exactly two files under `00-supporting-files/`: `data/land-e-slides.pptx` (148,820 bytes) and `data/land-e-roundtrip.html` (324,269 bytes). `progressEdd` already carries `data/land-e-slides.html` (655,581 bytes) — do not modify it.
- Expected commit-message style: `fix(01-FX1): …` (matches the phase's `fix(01-07): …` convention).

## Tasks

<task>
<name>Task 1: Copy the two missing round-trip artifacts from stevedore and commit them on progressEdd</name>
<files>00-supporting-files/data/land-e-slides.pptx, 00-supporting-files/data/land-e-roundtrip.html</files>
<action>
**Step 1 — preflight** (from the main checkout root):

```bash
cd ~/Documents/development_projects/progressEdd_projects/stevedore
git rev-parse --abbrev-ref HEAD        # must print progressEdd — stop and report BLOCKED otherwise
test -f 00-supporting-files/data/land-e-slides.html   # the third triple member, already present
```

**Step 2 — copy both artifacts from the stevedore branch ref** (blob-exact, no working-tree detour through `02-worktrees/stevedore` needed):

```bash
git checkout stevedore -- 00-supporting-files/data/land-e-slides.pptx 00-supporting-files/data/land-e-roundtrip.html
git add 00-supporting-files/data/land-e-slides.pptx 00-supporting-files/data/land-e-roundtrip.html
git commit -m "fix(01-FX1): land LAND.E round-trip artifacts on progressEdd (decision 14) — fixture triple complete in 00-supporting-files/data/"
```

If `git checkout stevedore -- …` errors (ref missing / path absent), stop and report BLOCKED — do not regenerate or substitute the artifacts; the committed pair is the verified round-trip evidence.

**Step 3 — sanity-check sizes before walking away:**

```bash
git cat-file -s HEAD:00-supporting-files/data/land-e-slides.pptx      # 148820
git cat-file -s HEAD:00-supporting-files/data/land-e-roundtrip.html   # 324269
```

Anything other than these exact byte counts means the wrong blobs landed — revert (`git reset --hard HEAD~1`, the commit touches nothing else) and report BLOCKED.
</action>
<verify>git ls-files 00-supporting-files/data/ | sort (must list exactly 3 files: land-e-roundtrip.html, land-e-slides.html, land-e-slides.pptx) && test "$(git rev-parse stevedore:00-supporting-files/data/land-e-slides.pptx)" = "$(git rev-parse HEAD:00-supporting-files/data/land-e-slides.pptx)" && test "$(git rev-parse stevedore:00-supporting-files/data/land-e-roundtrip.html)" = "$(git rev-parse HEAD:00-supporting-files/data/land-e-roundtrip.html)" && echo BLOB-IDENTICAL</verify>
<acceptance_criteria>
- `git ls-files 00-supporting-files/data/` on progressEdd lists exactly `land-e-roundtrip.html`, `land-e-slides.html`, `land-e-slides.pptx`
- `BLOB-IDENTICAL` prints: both new blobs rev-parse-equal to their `stevedore:` counterparts (byte-exact copy, not a regeneration)
- `git cat-file -s` reports 148820 (pptx) and 324269 (roundtrip.html); `land-e-slides.html` untouched at 655581 bytes
- The commit touches only the two named files (`git show --stat --name-only HEAD`); no `.planning/` file is staged or committed
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Task 1 verify prints the 3-file listing and `BLOB-IDENTICAL`
- [ ] `git status` in the main checkout shows no new staged changes (only the pre-existing untracked `VERIFICATION.md`)
- [ ] 01-FX2's fixture prerequisite is satisfied: `test -f 00-supporting-files/data/land-e-roundtrip.html` from the main checkout root

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
