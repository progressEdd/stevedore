---
status: complete
duration: 20min
key-files:
  created:
    - scripts/vendor-sync.sh
    - scripts/setup-roundtrip.sh
    - scripts/roundtrip.sh
    - vendor/dom-to-pptx/ (full tree off pin/puppeteer-23.11.1 + VENDORED.md)
    - vendor/PPTX2HTML/ (full tree at c8a96eb + VENDORED.md)
  modified:
    - README.md
    - .gitignore
requirements-completed:
  - SC1 (roadmap: combined repo — forks, vendored toolchains, one setup script, round-trip runs from stevedore with no /tmp tool cloning)
key-decisions:
  - "Forks landed directly under the progressEdd org on plain `gh repo fork` — no --org retry needed; pin branch lives at progressEdd/dom-to-pptx pin/puppeteer-23.11.1 (16a156d)"
  - "Pin branch diff vs v2.1.2 kept to exactly one line (puppeteer ^25.1.0 → 23.11.1): bun add's spurious `workspaces` field was stripped and the just-pushed branch amended+force-pushed so it stays a one-click upstream-PR candidate"
  - "Upstream-committed lockfiles (vendor/dom-to-pptx/pnpm-lock.yaml 116 KB, vendor/PPTX2HTML/package-lock.json 16 KB) vendored verbatim as upstream source; read the purity checklist's 'no lockfiles tracked' as targeting generated lockfiles (bun.lock/bun.lockb, gitignored) — task-level exclusion spec followed exactly"
  - "Install side effects (workspaces re-injection + bin/ exec-bit flips from the first `bun install`, before the lockfile exists) restored with git checkout -- before committing; node_modules/dist stay untracked and persist across the restore"
deviations:
  - "Scratch clone needed repo-local git identity (progressEdd <60864477+progressEdd@users.noreply.github.com>, copied from the worktree) — commit to the fork branch failed until set"
  - "Test-data path is ../../../../00-supporting-files/... not ../../... — this phase's worktrees nest one level deeper (02-worktrees/agent/02-roundtrip-fidelity/stevedore) than the plan's 2-level assumption; same file, main checkout on progressEdd (verified)"
  - "Upstream lockfiles vendored verbatim (see key-decisions) — surface for the gate if 'no lockfiles tracked' was meant literally"
  - "Mirror progress calls run from the main checkout (script + .planning live there, not in the worktree); all three reported success (issue #53 T1/T2/T3)"
---

# Plan 02-01 Summary: Fork both upstreams under progressEdd and assemble the combined repo in stevedore

Both forks exist under the progressEdd org, the puppeteer pin has a durable branch home, both codebases are vendored MIT-attributed, and `scripts/roundtrip.sh` ran the full loop from the stevedore worktree to a comparator PASS (mean 0.988) — no /tmp tool cloning anywhere.

## Accomplishments

- `progressEdd/dom-to-pptx` and `progressEdd/PPTX2HTML` forks created; pin branch `pin/puppeteer-23.11.1` pushed (16a156d) with a clean one-file/one-line diff vs upstream v2.1.2
- Both codebases vendored under `vendor/` with VENDORED.md provenance (upstream URL, fork URL, ref/branch, exclusions); PPTX2HTML vendored at exactly c8a96eb (confirmed, no sha deviation)
- `scripts/vendor-sync.sh` gives later plans a durable re-mirror path after every fork-branch fix
- `scripts/setup-roundtrip.sh` idempotent (SETUP-OK on 1st, 2nd, and 3rd runs); builds vendor/dom-to-pptx dist/, installs PPTX2HTML devDeps (esbuild@0.25.10, playwright@1.63.0, pngjs@7.0.0 — exactly phase-01 research; no bundled browsers downloaded)
- `scripts/roundtrip.sh` end-to-end green: html → pptx (nix chromium, 20 slides) → html → comparator PASS → ROUNDTRIP-OK
- `node --test scripts/test/*.test.mjs`: 139 pass, 0 fail (nothing in scripts/src touched)
- Purity: `git ls-files 00-supporting-files/` empty; no node_modules/, no dist/, 0 node_modules entries tracked

## Task commits

1. **Task 1: forks + pin branch** — none (GitHub repos + scratch clone only; per task's files contract nothing lands in this repo)
2. **Task 2: vendor both codebases + sync script** — `9ab4bd0` feat(02-01): vendor dom-to-pptx (pin/puppeteer-23.11.1) + PPTX2HTML (c8a96eb), MIT-attributed
3. **Task 3: setup + roundtrip scripts, README, .gitignore** — `4105287` feat(02-01): round-trip runs from stevedore — setup-roundtrip.sh + roundtrip.sh, no /tmp tool cloning

## Files created/modified

- `scripts/vendor-sync.sh` — rsync mirror of a fork checkout into vendor/<name> (excludes installs/build outputs; samples/ for PPTX2HTML)
- `scripts/setup-roundtrip.sh` — one-time (idempotent) toolchain prep: dom-to-pptx install+build on its pinned puppeteer, PPTX2HTML devDeps install (our playwright driver, decision 13)
- `scripts/roundtrip.sh` — the loop: html → pptx (nix chromium) → html (stevedore converter) → comparator; 02-03 inserts PNG export before compare
- `vendor/dom-to-pptx/**`, `vendor/PPTX2HTML/**` — vendored trees + VENDORED.md provenance
- `README.md` — Layout documents vendor/, Credits name both fork URLs
- `.gitignore` — node_modules/, bun.lock, bun.lockb, vendor/dom-to-pptx/dist/ (unanchored patterns cover vendor/PPTX2HTML installs)

## Decisions & deviations

See frontmatter key-decisions/deviations. Notable: the pin branch was amended+force-pushed once (my own branch, seconds after first push) to strip bun's spurious `workspaces` field — the final diff vs v2.1.2 is exactly the one-line puppeteer pin. First-run `bun install` (before its lockfile exists) re-injects that field and flips bin/ exec bits in vendor/dom-to-pptx; I restored the committed state before committing — later idempotent runs are no-ops.

## First-run findings (for plans 02-04/02-05 — first run ever with resolvable media refs)

- Comparator verdict: **PASS** — mean jaccard 0.988, min 0.769; 20/20 slides both sides; all gates passed
- Slide 5 is the only sub-1.000 slide: 13 source words vs 10 converted (jaccard 0.769) — a word-loss signal for 02-04/02-05 to chase
- Images: source 12 → converted 52 (433% of source) — the exporter materializes many more image parts than the source references (informational; comparator's image count does not gate)
- Exporter behavior: "dom-to-pptx library not detected on page. Injecting local bundle..." (expected for our standalone html); viewport 2560×1440 (2× device scale), dims 13.333"×7.5"; `-s section` matched cleanly — no non-slide-section warnings, no narrowing to `section[id]` needed; exactly 20 slides as required
- Artifacts (scratch, kept): land-e-slides.pptx 28.2 MB, land-e-roundtrip.html 38.6 MB in /tmp/stevedore-rt-verify — media-heavy deck round-trips end to end with no exporter crash on loaded media

## Next phase readiness

- 02-02..02-06 build directly on this: forks are the fix homes, `scripts/vendor-sync.sh` re-mirrors after each fork-branch fix, `scripts/roundtrip.sh` is the reproducible harness
- 02-03's `scripts/export-slides.mjs` has its driver in place: playwright@1.63.0 under vendor/PPTX2HTML/node_modules (installed, untracked), pattern = `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` + `STEVEDORE_CHROMIUM_PATH`/nix chromium via executablePath
- Fidelity leads for 02-04/02-05: slide-5 word gap; image-part inflation (12 → 52)
