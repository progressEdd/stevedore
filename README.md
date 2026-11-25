# stevedore — development branch (`progressEdd`)

The **shipped skill** lives on `master` (and the `stevedore` distribution
branch) — its README documents usage, zero-dependency install, the
round-trip loop, layout, and credits. Start there:
[README on master](https://github.com/progressEdd/stevedore/blob/master/README.md).

This branch is the **development copy** — everything used to build and verify
the skill, kept out of the shipped tree:

- `.planning/` — the shippEdd workflow state: roadmap, phases, plans,
  summaries, and the verification record (per-phase `VERIFICATION.md`)
- `.pi/agents/` — the agent personas (researcher, planner, executor, verifier)
- `.agents/skills/shippEdd/` — the workflow skills (git subtree from
  [progressEdd/shippEdd](https://github.com/progressEdd/shippEdd))
- `00-supporting-files/` — test fixtures and the canonical LAND.E round-trip
  artifact set (`data/land-e-tests/`: reference pair, generated pair, 20+20
  deterministic PNG exports, side-by-side composites, `DRIFT-BREAKDOWN.md`)
- `02-worktrees/` — git worktrees for the parallel-branch development flow
  (`master`, `stevedore`, per-phase agent worktrees)

## Replicating this development repo

Make your own copy of this branch — fork the repo on GitHub, then in your
clone:

    git checkout progressEdd

or branch locally under your own name from `progressEdd` in any clone. The
default branch (`master`) carries only the shipped skill; the full
development setup exists only here.
