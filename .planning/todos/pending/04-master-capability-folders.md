---
name: master-capability-folders
captured: 2026-11-24
what: "restructure the master branch with shippEdd-style capability folders — extract (pptx→html), export (html→pptx), compare, render, audit, roundtrip — and expose the unique functions each in their own folder"
severity: medium
context: "master currently mixes five distinct functions flat in one scripts/ dir; the user wants shippEdd's pattern (progressEdd/shippEdd): one folder per capability, each self-contained, shared infra top-level"
files:
  - 02-worktrees/master/scripts/pptx-to-html.js
  - 02-worktrees/master/scripts/compare-decks.mjs
  - 02-worktrees/master/scripts/export-slides.mjs
  - 02-worktrees/master/scripts/roundtrip.sh
  - 02-worktrees/master/scripts/setup-roundtrip.sh
  - 02-worktrees/master/scripts/vendor-sync.sh
  - 02-worktrees/master/scripts/audit-code-ink.mjs
  - 02-worktrees/master/scripts/audit-font-metrics.mjs
  - 02-worktrees/master/scripts/audit-gradient-paint.mjs
  - 02-worktrees/master/scripts/audit-mono-width.mjs
  - 02-worktrees/master/SKILL.md
  - 02-worktrees/master/README.md
---

## Problem

The master branch (shipped skill content, merged from stevedore via PR #75) has no folder structure for its capabilities: the pptx→html CLI + converter lib, the comparator, the PNG exporter, the round-trip orchestration, and the four visual-QA auditors all sit flat in `scripts/`, unlike the shippEdd model (progressEdd/shippEdd) where each unique function gets its own folder with a README and scripts, and shared machinery stays top-level.

## Solution

Restructure per the proposed layout (settled in conversation, 2026-11-24):

```
extract/      pptx → html   (pptx-to-html.js, src/, test/, examples/)
export/       html → pptx   (NEW standalone entry html-to-pptx.sh wrapping vendor/dom-to-pptx — currently only reachable buried in roundtrip.sh)
compare/      deck diffing  (compare-decks.mjs, survival gate)
render/       deterministic per-slide PNG export (export-slides.mjs, playwright)
audit/        visual QA probes (audit-code-ink / font-metrics / gradient-paint / mono-width)
roundtrip/    orchestration (roundtrip.sh, setup-roundtrip.sh, vendor-sync.sh)
reference/, vendor/, SKILL.md, README.md, LICENSE stay top-level
```

Breaking-change handling required: SKILL.md + README path updates (`node .agents/skills/stevedore/scripts/pptx-to-html.js` is baked into subtree consumers' docs), a consumer note, and re-pointing the `stevedore` distribution branch to match master after the restructure.

## Research

- shippEdd's pattern (the model): each capability folder = `SKILL.md` + `scripts/` + `README.md`, self-contained; shared machinery in top-level `scripts/`; templates separate
- master's current inventory verified: `scripts/` holds pptx-to-html.js, compare-decks.mjs, export-slides.mjs, roundtrip.sh, setup-roundtrip.sh, vendor-sync.sh, 4× audit-*.mjs, src/ (opc, pptx, render, geometry, charts, util), test/, examples/; vendor/{dom-to-pptx,PPTX2HTML}; reference/ (usage, fidelity, validation); SKILL.md; README; LICENSE (GPL-2.0-only)
- The four auditors are calibrated, phase-02-proven probes (ink ≥0.01 thresholds, gradient toggle calibration 0.5, mono width-probe) — genuinely reusable standalone
- Subtree install documented in README/SKILL: `git subtree add --prefix=.agents/skills/stevedore … stevedore` — paths move in the restructure

## Decisions

- Folder-per-capability modeled on progressEdd/shippEdd
- Capabilities exposed: extract (pptx→html), export (html→pptx), compare, render (PNG export), audit, roundtrip (orchestration)
- export/ gains a standalone html-to-pptx entry (not just the buried roundtrip stage)
- vendor/ and reference/ stay top-level (shared, not functions)
- Not yet settled: execution mode (Phase 03 via the loop vs direct edit) — the user parked it before choosing
