---
status: complete
duration: 12min
key-files:
  created:
    - SKILL.md
    - reference/usage.md
    - reference/fidelity.md
    - reference/validation.md
    - scripts/examples/land-e/README.md
    - scripts/examples/land-e/deck.pptx
    - scripts/examples/land-e/deck.html
  modified:
    - README.md
requirements-completed:
  - decision 4 (skill shape: branch IS the skill folder — SKILL.md at root, subtree-lands at .agents/skills/stevedore/)
  - decision 6 (dom-to-pptx skill convention: frontmatter + reference docs + copy-paste command block)
  - decision 16 (credits: own implementation, inline-credited MIT references, pinned refs)
  - decision 18 (worked examples: real LAND.E round-trip pair)
  - decision 20 (no skills/ placeholder, no html-to-pptx folder on this branch; reserved name in README only)
  - decision 24 (README usage + git-subtree install instructions)
  - ROADMAP success criterion 1 (worked example converts, exit 0)
  - ROADMAP success criterion 2 (subtree consumption, zero installs — SUBTREE-OK)
key-decisions:
  - "SKILL.md instantiated verbatim from the plan's skeleton (dom-to-pptx frontmatter convention: name/description/license/compatibility)"
  - "Committed examples/land-e/deck.html is byte-identical to a fresh regeneration from deck.pptx — the converter is deterministic across runs"
  - "Subtree proof verified against the worktree's actual HEAD branch (see deviations); after the phase merge-back the README's literal `stevedore` ref works identically"
deviations:
  - "Subtree proof pointed at branch `agent/01-pptx-to-html/stevedore` instead of the plan's literal `stevedore` — the worktree branch is the pre-merge-back name of the same content; the plan's command assumed post-merge topology. Scratch consumer also needed repo-local git identity (fresh /tmp repo has none). No repo files affected."
  - "Suite verify runs as `node --test scripts/test/*.test.mjs` — Node v24.22.2 removed directory arguments from the test runner (runner-level MODULE_NOT_FOUND, not a test failure); identical suite 139/139 green. Adjudication carried forward from 01-04/01-05/01-07."
  - "Checklist box 4's grep shows credits in README.md; SKILL.md carries no upstream names because the plan's own Task 1 template (applied verbatim) contains none — license is in its frontmatter; full credits live in README per decision 16."
---

# Plan 01-08 Summary: Skills layer, worked examples, subtree-consumption proof, README and credits

User-facing surface delivered: root SKILL.md (the branch IS the skill folder), three reference docs, the real LAND.E worked pair, and a README with usage + subtree install + credits — proven consumable via `git subtree` with zero installs.

## Accomplishments

- Skill root written in the dom-to-pptx convention: frontmatter (`name`, `description`, `license: GPL-2.0-only`, `compatibility`), ROLE/WORKFLOW/DESIGN_NOTES body, and a Supporting Files table linking all reference docs and the example pair.
- Reference docs complete and non-stub (42–65 lines each): usage.md embeds the `--help` output verbatim plus flags, exit codes 0/1/2, and the four diagnostics kinds; fidelity.md carries the full three-tier table (Fully rendered / Approximated / Deferred) with the PPTX2HTML parity-target statement; validation.md gives the 7-step post-conversion checklist and common-fixes table.
- Worked example committed as the REAL 01-07 round-trip pair (not regenerated): `deck.pptx` (20 slides) + `deck.html`; a fresh regeneration exits 0 and is byte-identical to the committed HTML — deterministic.
- README rewritten: zero-dep usage (Node ≥ 18, no npm), `git subtree add --prefix=.agents/skills/stevedore …` install, layout map, and Credits naming PPTX2HTML (commit c8a96eb) and dom-to-pptx (v2.1.2) with pinned refs; GPL-2.0-only stated. The reserved `html-to-pptx` name appears in README prose only — no placeholder folder.
- **Subtree consumption proof (criterion 2), actual output:**

  ```
  git fetch <worktree> agent/01-pptx-to-html/stevedore
   * branch            agent/01-pptx-to-html/stevedore -> FETCH_HEAD
  Added dir '.agents/skills/stevedore'
  SUBTREE-OK
  ```

  A fresh scratch repo at `$TMPDIR/stevedore-subtree-check`, `git subtree add` of the phase branch, no `node_modules` anywhere, no npm/bun invocation at any point; the checked-out copy converted the example deck to `out.html` (starts `<!DOCTYPE html>`, contains `pp-slide`). Run under `set -e`, so `SUBTREE-OK` printed only after every step genuinely passed.

## Task commits

1. **Write the skill root — SKILL.md plus reference docs** — `84776a7` feat(01-08): skill root — SKILL.md in dom-to-pptx convention + reference docs (usage, fidelity, validation)
2. **Add worked examples pair** — `c204886` feat(01-08): worked example pair — LAND.E 20-slide deck.pptx + converted deck.html
3. **Write README usage/credits and prove git-subtree consumption** — `3ebdebc` docs(01-08): README — usage, git-subtree install, layout, credits; subtree consumption proof passed (SUBTREE-OK, zero installs)

## Files created/modified

- `SKILL.md` — agent skill entry; subtree-lands at `.agents/skills/stevedore/SKILL.md`
- `reference/usage.md` — CLI contract (verbatim help), flags, exit codes, diagnostics kinds
- `reference/fidelity.md` — three-tier render-fidelity table
- `reference/validation.md` — post-conversion checklist + common fixes
- `scripts/examples/land-e/deck.pptx` — real LAND.E deck (copied from 00-supporting-files/data/land-e-slides.pptx)
- `scripts/examples/land-e/deck.html` — its converted output (copied from land-e-roundtrip.html)
- `scripts/examples/land-e/README.md` — names the exact reproduction command
- `README.md` — rewritten: usage, subtree install, layout, credits

## Decisions & deviations

Decisions: SKILL.md applied verbatim from the plan template; the example pair is the committed 01-07 artifact, with byte-identical regeneration as a bonus determinism proof; converter core untouched (verified: the three 01-08 commits touch only SKILL.md, reference/, scripts/examples/, README.md — zero overlap with `scripts/src/` or `scripts/pptx-to-html.js`).

Deviations (each minimal, blockers only):
1. **Subtree proof branch ref** — the plan's command fetches ref `stevedore` from `$WORKTREE`, but the worktree's HEAD (all phase work) is `agent/01-pptx-to-html/stevedore`; the local `stevedore` ref still points at the pre-phase base (b7b3635, no converter). Pointed the proof at the actual branch — same content the merge-back will name `stevedore`. Additionally the scratch consumer needed repo-local `git user.name/email` (a fresh `/tmp` git repo has none; my worktree inherits repo config). First proof attempt also revealed the plan's block is not fail-fast (`SUBTREE-OK` echoed despite failure); rerun under `set -e`. No repo files affected.
2. **Test-runner invocation** — `node --test scripts/test/` (directory arg) is rejected by Node v24.22.2's runner as a module (MODULE_NOT_FOUND); the identical suite ran as `node --test scripts/test/*.test.mjs`, 139/139 pass. Standing adjudication carried forward from 01-04/01-05/01-07.
3. **Checklist box 4 grep scope** — `grep PPTX2HTML|dom-to-pptx README.md SKILL.md` shows credits via README.md; SKILL.md contains no upstream names because the plan's Task 1 template (applied verbatim per the exact-string contract) has none. License `GPL-2.0-only` stated in README, SKILL.md frontmatter, and scripts/package.json.

No plan requirement dropped or descoped.

## Next phase readiness

Phase 01 user-facing surface is complete: the branch is a valid, self-contained agent skill consumable via `git subtree add` with zero installs (SUBTREE-OK), the worked example converts green, and full-suite tests are 139/139. Ready for the phase merge point; a later phase can pick up the reserved `html-to-pptx` direction and the Deferred tier (EMF/WMF, TIFF, EOT fonts, SmartArt layout engine, animation playback, 3D) as documented in reference/fidelity.md. Converter observations for the next phase: none — the example pair converted without diagnostics-relevant surprises.
