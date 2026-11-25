---
issue: "#85"
fixes: "03-01"
wave: 3
depends_on: []
target: master
---

# Plan 03-FX1: Determinism doctrine truthing — render/README.md aligns with the exporter header; stochastic caveat recorded at the claim sites

**Objective:** Close VERIFICATION round 1's two gaps (both partial, one shared root cause: stochastic chromium rasterization vs. byte-stability claims — pre-existing machine nondeterminism, not phase-03 code; all functionality delivered and otherwise verified). Per the verifier's scope note, both gaps are documentation/gate-wording fixes — **no code change is required or wanted**. The two gaps share both the root cause AND the target file (`render/README.md`), so they are merged into this ONE fix plan; `fixes: 03-01` names the plan whose surface dominates — 03-01 shipped `render/README.md`'s Determinism section, the doctrine home both README contradictions trace to, and Gap 2's Resolution fix aligns to it — while this plan equally covers 03-02's Resolution-section claim and gate record. The exporter's own header (`render/export-slides.mjs:30–32`) already carries the correct doctrine ("it does NOT promise byte-identical PNGs across runs (chromium antialiasing may vary) — never gate on byte equality"); Task 1 brings render/README.md's Determinism and Resolution sections in line with it: byte-stability is high-probability on this toolchain, not guaranteed; single-file subpixel diffs warrant one retry (Gap 1); `--scale` re-captures gate on dimensions with retry-once byte comparison (Gap 2). Task 2 records the stochastic caveat where SCALE2-BYTE-STABLE-20-20 was claimed — a postscript appended to 03-02-SUMMARY.md (Gap 2's named option, "(03-02-SUMMARY or the plan's successor)"); Gap 1's claim site (03-01-SUMMARY's FLAKE OBSERVATION deviation) already records its caveat, so it needs no edit. The retry-once semantics for future byte-equality gates (Gap 1's gate-wording half) are adopted in three places: this plan's Standing facts and Verification checklist, the fixed README, and the postscript. True claims stay untouched: the PDF half's determinism (a pure function of the PNG bytes — byte-identical across builds) and the root README's default-mode phrasing (the default-mode witness gate held everywhere it was gated — not flagged by the gaps).

**Standing facts (verified at plan time; this machine):**
- Executor runs in the phase's per-target agent worktree `02-worktrees/agent/03-master-capabilities/master` (branch `agent/03-master-capabilities/master`) — the SAME worktree/branch 03-01 and 03-02 executed in. Postdates those plans: the branch is now the pushed head of open **PR #84 → master** and already contains everything they shipped (`extract/`, `render/` with `--scale`/`--pdf` + `pdf-bundler.mjs`, `export/`, top-level `scripts/`, root README/LICENSE/reference/vendor). This plan's commits land ON TOP of the phase's commits and ride PR #84 before it merges — no new branch, no new PR, no fork/merge-back. ALL commands below run from that worktree root; commit subject prefix `(03-FX1)`. Do not touch `STATE.md`/`ROADMAP.md`.
- `render/README.md`'s current content at the PR head is exactly as quoted in Task 1 (verified at plan time). If the quoted "current" text does not match what you find, stop and report — the worktree is not at the expected state.
- **Scope is documentation/gate-wording only — no code change** (VERIFICATION's scope note). Nothing under `render/*.mjs`, `render/test/`, `scripts/`, `extract/`, or `export/` may be touched: the capture recipe, the tests, and the four calibrated auditors' KEEP-IN-SYNC calibration stay untouched by construction (Task 1's verify proves the commit touches exactly `render/README.md`).
- **The doctrine source** (already correct, untouched): `render/export-slides.mjs` lines 30–32 — `// Determinism = fixed tool + fixed viewport + fixed flags; it does NOT` / `// promise byte-identical PNGs across runs (chromium antialiasing may vary) —` / `// never gate on byte equality.` The README's Determinism and Resolution sections must say the same thing.
- Machine facts (standing, from the phase's plans): bun not npm (nothing to install — doc-only fix); Node v24 requires the glob form `node --test <glob>` (no test runs are required in this plan — no code changes, so the 165/165 suite is unaffected by construction); nix chromium via `nix shell nixpkgs#chromium` (not needed — no captures are run; the gaps are proven by grep, not re-rendering); witness data at `../../../../00-supporting-files/data/land-e-tests/` (not needed either — no comparisons are run).
- Evidence base (VERIFICATION round 1, 2026-11-25, `.planning/phases/03-master-capabilities/VERIFICATION.md`): Gap 1 — two fresh full runs of 03-01 Task 3's 40-PNG byte-equality gate both failed on `roundtrip/02.png` (624/2,764,800 subpixels, 0.023%, a thin antialiasing edge; the round-trip HTML was byte-identical both times; a third side-level re-render matched the witness 20/20), while the default-mode reference-side gate (DEFAULT-BYTE-STABLE-20-20) held everywhere it was gated. Gap 2 — four fresh `--scale 2` captures of the same deck: run1≡run3 passed; run1≠run2, run2≠run3, run3≠run4 all failed on `18.png` (46,732/11,059,200 subpixels, 0.42%, one contiguous region, ±1-channel antialiasing deltas). The PDF half is fully deterministic (byte-identical across builds — a pure function of the PNG bytes); its claims are TRUE and stay.
- **Retry-once gate doctrine (adopted by this plan — Gap 1's gate-wording fix):** future byte-equality gates over PNG captures in this repo gate on dimensions first, treat a single-file byte-equality miss as a flake, and retry once; only a repeat failure is a real regression. Recorded here, in render/README.md (Task 1), and in the 03-02-SUMMARY postscript (Task 2).
- `.planning/` lives in the MAIN checkout (progressEdd branch), 4 levels up from the worktree root: `../../../../.planning/phases/03-master-capabilities/`. Task 2's target file is there — outside the agent branch's tree. Historical plan files (03-01-PLAN.md, 03-02-PLAN.md) are immutable execution records and are NOT edited by this fix: their one-shot gate wording is superseded by VERIFICATION.md + this plan + the postscript. 03-01-SUMMARY.md already records the 40/40 flake (its FLAKE OBSERVATION deviation); 03-02-SUMMARY.md carries the unqualified SCALE2 claim and gets the postscript.

## Tasks

<task>
<name>Task 1: Re-scope render/README.md's Determinism and Resolution sections to the exporter-header doctrine</name>
<files>render/README.md</files>
<action>
Edit `render/README.md` (worktree root — the PR-#84 tree) with exactly the two edits below; nothing else in the file changes.

**Edit A — Resolution section (`## Resolution (`--scale`)`).** The section currently ends with these two lines (Gap 2's overclaim — VERIFICATION's render/README.md:30–31):

```
Byte-stable across browser relaunches on this toolchain at every scale
probed (03-RESEARCH Q3) — same doctrine as the default mode.
```

Replace those two lines with:

```
Dimensions are exact and deterministic at every scale (IHDR-checkable).
Byte-identity across browser relaunches is high-probability on this
toolchain but NOT guaranteed at any scale — chromium antialiasing varies
run to run (03-RESEARCH Q3's probes observed byte-stable pairs; later
full re-capture runs caught single-file antialiasing-edge diffs). Same
doctrine as the default mode — see Determinism. Gate `--scale`
re-captures on dimensions, and treat a one-file byte-equality miss as a
flake: retry once before concluding a regression.
```

**Edit B — Determinism section (`## Determinism`).** The section's current body (Gap 1's overclaim is "proven byte-identical across browser relaunches on one machine/toolchain" — VERIFICATION's render/README.md:47–48 — plus "witness-proven byte-stable" on the final line):

```
Fixed tool (playwright, pinned by the vendored PPTX2HTML toolchain) + fixed
viewport (1280×720) + fixed launch flags ⇒ deterministic in tooling — proven
byte-identical across browser relaunches on one machine/toolchain; NOT
promised across chromium/playwright version changes. Never gate on byte
equality across environments. The four calibrated auditors in `scripts/`
replicate this capture recipe — KEEP IN SYNC with any change here.
Both `--scale` and `--pdf` are strictly opt-in — the default capture recipe is unchanged and witness-proven byte-stable.
```

Replace the WHOLE body (all 8 lines, header `## Determinism` stays) with:

```
Determinism = fixed tool (playwright, pinned by the vendored PPTX2HTML
toolchain) + fixed viewport (1280×720) + fixed launch flags ⇒ deterministic
in tooling — the exporter's own header doctrine (render/export-slides.mjs):
it does NOT promise byte-identical PNGs across runs, chromium antialiasing
may vary; never gate on byte equality. On one machine/toolchain,
byte-identity is the high-probability outcome, but a fresh capture can
flip a single PNG on a thin antialiasing edge (subpixel-level diffs;
observed on round-trip-side captures at default scale and on `--scale 2`
re-captures). Treat a one-file byte-equality miss as a flake: retry once
before concluding a real regression. Byte identity is NOT promised across
chromium/playwright version changes or across environments. The four
calibrated auditors in `scripts/` replicate this capture recipe —
KEEP IN SYNC with any change here.
Both `--scale` and `--pdf` are strictly opt-in — the default capture recipe is unchanged.
```

(The final line stays a single unwrapped line, matching the original's shape, minus the "witness-proven byte-stable" overclaim.)

**Untouched, deliberately:** the intro paragraph; the `## Usage` block and its flag list; the entire `## Whole-deck PDF (`--pdf`)` section — its "The PDF is a pure function of the PNG bytes — byte-identical across runs." claim is TRUE (PDF-BYTE-STABLE / WITNESS-PDF-BYTE-STABLE, verified round 1); and the `## Tests` section. `render/export-slides.mjs` and every other file in the tree: no changes (the exporter header at lines 30–32 is the doctrine source and is already correct). render/SKILL.md's "does NOT promise byte-identical PNGs across tool versions" phrasing is true and was not flagged — leave it.

Commit: `fix(03-FX1): render/README.md — byte-stability doctrine matches the exporter header (high-probability, retry-once)` — suggested body: `Closes VERIFICATION round-1 gaps 1+2 (shared root cause: stochastic chromium rasterization): Determinism/Resolution re-scoped from "proven byte-identical" to high-probability + retry-once; --scale re-captures gate on dimensions. Rides PR #84.`
</action>
<verify>cd "$(git rev-parse --show-toplevel)" && ! grep -rn 'byte-identical across browser relaunches\|Byte-stable across browser relaunches\|witness-proven byte-stable' README.md render extract export scripts reference && [ "$(grep -c 'high-probability' render/README.md)" -eq 2 ] && [ "$(grep -c 'retry once' render/README.md)" -eq 2 ] && grep -n 'does NOT promise byte-identical PNGs across runs' render/README.md && grep -n 'never gate on byte equality' render/README.md && grep -n 'never gate on byte equality' render/export-slides.mjs && grep -n 'NOT guaranteed at any scale' render/README.md && grep -n 're-captures on dimensions' render/README.md && grep -n 'KEEP IN SYNC' render/README.md && grep -n 'strictly opt-in' render/README.md && [ "$(grep -c '^## ' render/README.md)" -eq 5 ] && [ "$(git diff --name-only HEAD^ HEAD | wc -l)" -eq 1 ] && git diff --name-only HEAD^ HEAD | grep -qx 'render/README.md' && echo FX1-README-DOCTRINE-OK</verify>
<acceptance_criteria>
- The three overclaim strings are gone from the whole shipped tree: `grep -rn 'byte-identical across browser relaunches\|Byte-stable across browser relaunches\|witness-proven byte-stable' README.md render extract export scripts reference` prints NOTHING
- `render/README.md` contains `does NOT promise byte-identical PNGs across runs` and `never gate on byte equality` (Determinism) — the same doctrine phrases as the exporter header, whose own `never gate on byte equality` line (render/export-slides.mjs:32) is untouched
- `render/README.md` contains `high-probability` exactly twice and `retry once` exactly twice (once in Determinism, once in Resolution); Resolution contains `NOT guaranteed at any scale` and `re-captures on dimensions`; Determinism retains `KEEP IN SYNC` and `strictly opt-in`; the file still has exactly 5 `## ` sections (Usage, Resolution, Whole-deck PDF, Determinism, Tests)
- The fix commit touches exactly one file: `git diff --name-only HEAD^ HEAD` prints only `render/README.md` — no code, no `scripts/`, no tests; the capture recipe and the auditors' KEEP-IN-SYNC calibration are untouched by construction
- The Whole-deck PDF section's true claim (`The PDF is a pure function of the PNG bytes — byte-identical across runs.`) is still present verbatim
</acceptance_criteria>
</task>

<task>
<name>Task 2: Record the SCALE2 stochastic-caveat postscript in 03-02-SUMMARY.md, where the claim was made</name>
<files>../../../../.planning/phases/03-master-capabilities/03-02-SUMMARY.md (main checkout, progressEdd branch — 4 levels up from the worktree root; NOT part of the agent branch's tree)</files>
<action>
Append the postscript below to the END of `../../../../.planning/phases/03-master-capabilities/03-02-SUMMARY.md` — the main checkout's `.planning` dir, reached from the worktree root exactly like the witness-data path (`../../../../00-supporting-files/…`). At plan time the file's last section is `## Next phase readiness`; append after it, separated by one blank line. Append-only: everything already in the file stays byte-identical (do not touch the frontmatter, the deviations, or any existing section).

```markdown

## Postscript (03-FX1): SCALE2-BYTE-STABLE-20-20 is stochastic

Phase-03 verification round 1 (`.planning/phases/03-master-capabilities/VERIFICATION.md`, 2026-11-25) re-probed the `--scale 2` byte-equality claim above with four fresh captures of the same deck: pairings run1≡run3 passed; run1≠run2, run2≠run3, run3≠run4 all failed — each on `18.png`, 46,732/11,059,200 subpixels (0.42%) in one contiguous region (rows 127–1325 × cols 696–2083 at 2560×1440), typical ±1-channel antialiasing deltas. The claim above — "byte-identical across two full browser-relaunched runs" — was true of the executor's lucky pair, not a robust property. Root cause: chromium rasterization nondeterminism on this machine (the same root cause as 03-01-SUMMARY's FLAKE OBSERVATION); pre-existing machinery, untouched by 03-02's commits.

Corrected doctrine (applied by 03-FX1 to `render/README.md`'s Determinism and Resolution sections; the exporter's own header — `render/export-slides.mjs` lines 30–32 — always carried it): PNG dimensions are deterministic at every scale (IHDR-checkable); byte-identity is high-probability on this toolchain, NOT guaranteed. Future gates over PNG captures: gate `--scale` re-captures on dimensions, treat a single-file byte-equality miss as a flake and retry once — only a repeat failure is a real regression. The `--pdf` half remains fully deterministic (a pure function of the PNG bytes — byte-identical across builds). The functionality itself is intact and verified: SCALE2-DIMS-OK (20 × 2560×1440, IHDR-checked), PDF qpdf-clean with 20 pages, DEFAULT-BYTE-STABLE-20-20.
```

No commit for this task: the file lives outside the agent branch's tree (main checkout, progressEdd branch), so it cannot ride PR #84 — the write itself is the deliverable, the same in-place write pattern the loop's executors use for the SUMMARY files. Leave the `.planning` bookkeeping (including any commit of it) to the orchestrator; do not run git in the main checkout.

This is Gap 2's .planning-side record ("record the stochastic caveat where SCALE2-BYTE-STABLE was claimed — 03-02-SUMMARY or the plan's successor"): this plan (the successor) and the postscript (the claim site) both carry it. Gap 1's claim site needs no edit — 03-01-SUMMARY's FLAKE OBSERVATION deviation already records the 40/40 flake with the "a later gate may need to re-run on a flake" guidance.
</action>
<verify>cd "$(git rev-parse --show-toplevel)" && S=../../../../.planning/phases/03-master-capabilities/03-02-SUMMARY.md && grep -n 'SCALE2-BYTE-STABLE-20-20 is stochastic' "$S" && grep -n 'not a robust property' "$S" && grep -n '46,732/11,059,200' "$S" && grep -n '18.png' "$S" && grep -n 'FLAKE OBSERVATION' "$S" && grep -n 'retry once' "$S" && grep -n 'high-probability' "$S" && grep -n 'status: complete' "$S" && [ "$(grep -c '^## ' "$S")" -eq 6 ] && awk '/^## Next phase readiness/{nr=NR} /^## Postscript/{pr=NR} END{exit !(nr>0 && pr>nr)}' "$S" && echo FX1-SUMMARY-CAVEAT-RECORDED</verify>
<acceptance_criteria>
- `03-02-SUMMARY.md` ends with the postscript: its header line contains `SCALE2-BYTE-STABLE-20-20 is stochastic`, and the awk ordering check confirms the `## Postscript` line sits after the `## Next phase readiness` line
- The postscript carries the round-1 evidence (`18.png`, `46,732/11,059,200`, the four-capture pairings), the verdict (`not a robust property`), the root-cause cross-reference (`FLAKE OBSERVATION`), and the corrected doctrine (`high-probability`, `retry once`, dimensions-gating)
- Pre-existing content intact: frontmatter still `status: complete`; the five original `## ` sections still present (6 total with the postscript); nothing above the postscript changed
- No agent-branch commit contains the `.planning` file (it is outside that branch's tree) — the deliverable is the on-disk write, grep-verifiable by the verify command
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Both task verify commands pass from the agent worktree root, ending `FX1-README-DOCTRINE-OK` and `FX1-SUMMARY-CAVEAT-RECORDED`
- [ ] render/README.md: the three overclaim strings gone from the whole shipped tree (README.md, render/, extract/, export/, scripts/, reference/ — the tree-wide grep in Task 1's verify); the exporter-header doctrine phrases present in the README and unchanged at render/export-slides.mjs:30–32
- [ ] No code changed: the fix commit touches exactly `render/README.md` — the capture recipe, the tests, `scripts/` machinery, and the four auditors' KEEP-IN-SYNC calibration are untouched by construction
- [ ] 03-02-SUMMARY.md: postscript appended after `## Next phase readiness`; everything above it byte-identical to before (frontmatter `status: complete`, all five original sections intact)
- [ ] Retry-once gate doctrine recorded in three places — this plan, the 03-02-SUMMARY postscript, and render/README.md: future byte-equality gates over PNG captures gate on dimensions first, treat a single-file byte miss as a flake, and retry once before calling a regression
- [ ] The fix commit rides PR #84 (branch `agent/03-master-capabilities/master` — no new branch, no new PR); `STATE.md`/`ROADMAP.md` untouched
