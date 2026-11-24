---
issue: "#71"
wave: 7
depends_on: ["02-FX6", "02-FX7"]
target: progressEdd
fixes: 02-06
---

# Plan 02-FX8: Regenerate the canonical artifacts with the metric- and z-order-fixed toolchain and re-evidence the breakdown

**Objective:** Close the artifact half of VERIFICATION.md addendum #4 gaps 6 and 7 (2026-11-24): the canonical artifact set committed by 02-06/FX3/FX5 (`tests/land-e-slides.pptx`, `tests/land-e-roundtrip.html`, `tests/exports/{reference,roundtrip}/01..20.png`) still carries both defects — the converter's integer-snapped run metrics (code text at 10px where the reference renders 9.57px — 02-FX6 fixes the parse on stevedore) and the exporter's inverted pseudo-element z-order (slide 17's gradient overlays under the photos — 02-FX7 fixes the fork on stevedore). This plan re-runs `scripts/roundtrip.sh` end-to-end from a stevedore checkout carrying FX1–FX7, recommits the artifact set, updates `DRIFT-BREAKDOWN.md` — **row 08 gains the fonts verdict, row 17 gains the gradients verdict** — and keeps every decision-8 defer verbatim (including the standing slides 7/19 bullet/callout defers, addendum #4 gaps 8–9, which get NO fix and NO row rewrite beyond their recorded defer text). Gates are recomputed vs FX5: the pptx is expected byte-identical on 19/20 slide XMLs with slide17.xml changed by the z-reorder; the HTML is expected to change **by design** (FX6's fractional `font-size:`/`letter-spacing:` values + FX7's slide-17 element order) — FX5's HTML byte-stability gate is replaced by a classified diff census; both gaps' closure is proven on the COMMITTED artifacts by the committed auditors (02-FX6's `audit-font-metrics.mjs`, 02-FX7's `audit-gradient-paint.mjs`); the code-ink gate (≥ 0.01, slides 08–11) is preserved. The PowerPoint human sign-off (decision 5) is re-requested; confirming it stays at ship time, outside this plan's contract.

**Standing facts:** this plan's target is **progressEdd**, not stevedore — you work in a progressEdd worktree; nothing here commits to stevedore. `$PROGRESS` = your progressEdd worktree root; `$STEVEDORE` = a stevedore checkout carrying ALL fix plans — FX1 (single-quote stacks), FX2 (vendored `fix/font-design-viewport`), FX4 (capture paint order in `scripts/export-slides.mjs`), **FX6** (true-px metrics in `scripts/src/pptx/text.js` + `scripts/audit-font-metrics.mjs`), **FX7** (vendored `fix/pseudo-z-index` + `scripts/audit-gradient-paint.mjs`) — the post-merge `stevedore` branch checkout if the phase flow has merged them, otherwise the phase's stevedore agent worktree; record which checkout + commit in the SUMMARY; task 1's precondition greps prove it before anything runs. `scripts/setup-roundtrip.sh` must have been run there (idempotent — it also rebuilds `vendor/dom-to-pptx/dist` from the synced source, required for FX7's fix to be live). Test data root: `00-supporting-files/data/land-e-tests/` (on progressEdd — your worktree has it directly); resolve deck paths with `realpath` into absolute form before use (worktree depths differ). LAND.E originals stay untouched (decision 3). `unzip`/`file` binaries are absent on this host (standing deviation: `7z x -so` for pptx XML, node IHDR parse for PNG dimensions). Determinism promise: HTML and pptx slide XML reproduce deterministically; PNGs are never gated on byte equality — a changed-PNG census is recorded instead. Commits atomic with subject prefix `(02-FX8): …`. Current committed artifact sizes (FX5-era, for comparison): pptx 6,951,111 B, round-trip HTML 10,864,059 B; current committed auditors' expected state: `audit-font-metrics.mjs` exits 1 on the committed pair (gap 6 open), `audit-gradient-paint.mjs` exits 1 on slide 17 (gap 7 open) — both must flip to 0 on the regenerated pair.

## Tasks

<task>
<name>Task 1: Canonical re-run on the FX6+FX7-fixed toolchain; gate both gaps closed; regenerate and commit the artifact set</name>
<files>00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx, 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html, 00-supporting-files/data/land-e-tests/tests/exports/reference/01.png..20.png, 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/01.png..20.png</files>
<action>
**Step 1 — set up and prove preconditions** (STOP and report if any fails — the plans have not landed where you are looking):

```bash
PROGRESS="$PWD"        # your progressEdd worktree root (adjust if you run from a subdir)
TESTS="$PROGRESS/00-supporting-files/data/land-e-tests"
grep -q '(02-FX6)' "$STEVEDORE/scripts/src/pptx/text.js" \
  && test -f "$STEVEDORE/scripts/audit-font-metrics.mjs" \
  && grep -q 'fix/pseudo-z-index' "$STEVEDORE/vendor/dom-to-pptx/VENDORED.md" \
  && grep -q 'pseudoSortKey' "$STEVEDORE/vendor/dom-to-pptx/src/utils.js" \
  && test -f "$STEVEDORE/scripts/audit-gradient-paint.mjs" \
  && grep -q '(02-FX4)' "$STEVEDORE/scripts/export-slides.mjs" \
  && grep -q "font-family:'-apple-system'" "$STEVEDORE/scripts/src/render/fonts.js" \
  && grep -q 'font-design-viewport' "$STEVEDORE/vendor/dom-to-pptx/VENDORED.md" \
  && test -f "$STEVEDORE/scripts/audit-code-ink.mjs" \
  || { echo "stevedore checkout does not carry FX1+FX2+FX4+FX6+FX7 — STOP"; exit 1; }
SRC="$(realpath "$TESTS/reference/slides.html")"
RT_HTML_OLD="$(realpath "$TESTS/tests/land-e-roundtrip.html")"
```

Record in the SUMMARY: the `$STEVEDORE` checkout + commit, and the FX6/FX7 commit short-hashes (`git -C "$STEVEDORE" log --oneline | grep '02-FX'`).

**Step 2 — the canonical run** (from `$STEVEDORE`; outputs to scratch):

```bash
cd "$STEVEDORE"
scripts/setup-roundtrip.sh                       # idempotent (rebuilds vendor/dom-to-pptx/dist)
F="${TMPDIR:-/tmp}/stevedore-fx8"
rm -rf "$F"
scripts/roundtrip.sh "$SRC" "$F"
ls "$F/exports/reference" | wc -l                # 20
ls "$F/exports/roundtrip" | wc -l                # 20
node scripts/compare-decks.mjs "$SRC" "$F/land-e-roundtrip.html"
```

The comparator must print **PASS** with `media survival: 15/15`. If it fails: STOP, record the failure, and report to the orchestrator — do not commit a downgraded bar.

**Step 3 — pptx census** (FX6 changes nothing in the pptx — parse-side; FX7 reorders slide 17):

```bash
T="${TMPDIR:-/tmp}/stevedore-fx8"; mkdir -p "$T"
for n in $(seq 1 20); do
  7z x -so "$F/land-e-slides.pptx" ppt/slides/slide$n.xml > "$T/fx8-slide$n.xml" 2>/dev/null
  7z x -so "$TESTS/tests/land-e-slides.pptx" ppt/slides/slide$n.xml > "$T/old-slide$n.xml" 2>/dev/null
  cmp -s "$T/fx8-slide$n.xml" "$T/old-slide$n.xml" || echo "slide$n.xml CHANGED"
done | tee "$T/fx8-pptx-census.log"
```

Expected: exactly `slide17.xml CHANGED`; the other 19 byte-identical. More changes than that: verify each is reorder-class (pic count + media parts unchanged) and record; a lost/added media part → STOP and report.

**Step 4 — HTML classified diff census** (the fix's designed footprint — replaces FX5's byte-stability gate):

```bash
node -e '
const fs = require("fs");
const [oldPath, newPath] = process.argv.slice(1);
const split = (p) => {
  const html = fs.readFileSync(p, "utf8");
  const marks = [...html.matchAll(/<div class="pp-slide" data-slide-index="(\d+)"/g)];
  const out = {};
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index;
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length;
    out[marks[i][1]] = html.slice(start, end).split("\n");
  }
  return out;
};
const A = split(oldPath), B = split(newPath);
const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])];
let bad = 0, metric = 0, s17 = 0;
for (const k of keys) {
  const a = A[k] ?? [], b = B[k] ?? [];
  if (a.join("\n") === b.join("\n")) continue;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    if (k === "17") { s17++; continue; }
    if (/font-size:|letter-spacing:/.test(a[i] ?? "") || /font-size:|letter-spacing:/.test(b[i] ?? "")) metric++;
    else { bad++; console.log("UNCLASSIFIED slide", k, "line", i + 1, ":", (b[i] ?? a[i] ?? "").slice(0, 120)); }
  }
}
console.log(JSON.stringify({ metricLines: metric, slide17Lines: s17, unclassified: bad }));
process.exit(bad ? 1 : 0);
' "$RT_HTML_OLD" "$F/land-e-roundtrip.html" | tee "$T/fx8-html-census.json"
test "$(grep -c 'font-size:[0-9]*\.[0-9]px' "$RT_HTML_OLD")" -eq 0   # old: integer-snapped only
grep -o 'font-size:[0-9]*\.[0-9]px' "$F/land-e-roundtrip.html" | sort -u | head   # new: fractional values — record
```

Gate: `unclassified: 0` (every changed line outside slide 17 is a `font-size:`/`letter-spacing:` value line; slide 17's churn is FX7's reorder). Any UNCLASSIFIED line → STOP and report — a change outside the two fixes' footprint is a new finding.

**Step 5 — gap-closure proofs + ink gate on the FRESH outputs** (the auditors run from `$STEVEDORE`):

```bash
cd "$STEVEDORE"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-font-metrics.mjs "$SRC" "$F/land-e-roundtrip.html" 8 | tee "$T/fx8-close-8.json"; echo "exit=$? (must be 0)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-font-metrics.mjs "$SRC" "$F/land-e-roundtrip.html" 17 | tee "$T/fx8-close-17.json"; echo "exit=$? (must be 0)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-paint.mjs "$F/land-e-roundtrip.html" 17 | tee "$T/fx8-close-gradient.json"; echo "exit=$? (must be 0)"
for n in 8 9 10 11; do
  nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
    node scripts/audit-code-ink.mjs "$F/land-e-roundtrip.html" $n | tee "$T/fx8-ink-$n.json"
done
```

Gates: font-metrics exit 0 on slides 8 AND 17 (computed metrics within tolerance — gap 6 closed); gradient-paint exit 0 (every gradient painted — gap 7 closed); every ink fraction ≥ 0.01 (FX4's bar preserved — code text got 4.5% smaller, ink stays well above the bar; record all four). Any exit 1 → STOP and report: a fix did not survive the canonical pipeline.

**Step 6 — PNG inventory + changed-PNG census** (node IHDR — `file` is absent):

```bash
node -e '
const { readFileSync, readdirSync } = require("fs");
for (const d of ["exports/reference", "exports/roundtrip"]) {
  const dir = process.argv[1] + "/" + d;
  for (const f of readdirSync(dir)) {
    const b = readFileSync(dir + "/" + f);
    if (b.readUInt32BE(12) !== 0x49484452 || b.readUInt32BE(16) !== 1280 || b.readUInt32BE(20) !== 720)
      throw new Error(d + "/" + f + " not 1280x720");
  }
}
console.log("FX8-PNG-DIMS-OK");
' "$F"
for side in reference roundtrip; do
  for n in $(seq -w 1 20); do
    if cmp -s "$F/exports/$side/$n.png" "$TESTS/tests/exports/$side/$n.png"; then echo "$side/$n.png identical"; else echo "$side/$n.png CHANGED"; fi
  done
done | tee "$T/fx8-png-census.log"
```

Expected: reference side all-identical (FX6/FX7 are no-ops on Marp markup); round-trip 08–11 CHANGED (code text at true sizes) + 17 CHANGED (gradients now paint) — record exactly which (determinism evidence).

**Step 7 — commit the artifacts on progressEdd** (from your progressEdd worktree root):

```bash
TESTS=00-supporting-files/data/land-e-tests
cp "$F/land-e-slides.pptx"      "$TESTS/tests/"
cp "$F/land-e-roundtrip.html"   "$TESTS/tests/"
cp "$F/exports/reference/"*.png "$TESTS/tests/exports/reference/"
cp "$F/exports/roundtrip/"*.png "$TESTS/tests/exports/roundtrip/"
git add "$TESTS/tests"
git commit -m "fix(02-FX8): canonical artifacts regenerated — true-px metrics (02-FX6) + pseudo-z-order (02-FX7)"
```

Record in the SUMMARY: new pptx/HTML byte sizes (vs 6,951,111 / 10,864,059), the comparator's full table (mean/min/survival — task 2's header numbers), the pptx census, the HTML diff census, the two auditors' before→after tables, the four ink fractions, and the PNG census.
</action>
<verify>node "$STEVEDORE/scripts/compare-decks.mjs" "$PROGRESS/00-supporting-files/data/land-e-tests/reference/slides.html" "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" && test "$(ls "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/reference" | wc -l)" -eq 20 && test "$(ls "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/roundtrip" | wc -l)" -eq 20 && cd "$STEVEDORE" && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-font-metrics.mjs "$PROGRESS/00-supporting-files/data/land-e-tests/reference/slides.html" "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" 8 && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-font-metrics.mjs "$PROGRESS/00-supporting-files/data/land-e-tests/reference/slides.html" "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" 17 && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-gradient-paint.mjs "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" 17 && for n in 8 9 10 11; do node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!(j.fraction>=0.01))process.exit(1)" "${TMPDIR:-/tmp}/stevedore-fx8/fx8-ink-$n.json" || exit 1; done && echo FX8-ARTIFACTS-OK</verify>
<acceptance_criteria>
- Canonical comparator on the COMMITTED pair: `PASS`, `media survival: 15/15` (new mean/min recorded verbatim in the SUMMARY)
- Committed `tests/land-e-slides.pptx`: 19/20 slide XMLs byte-identical to the FX5 canonical, slide17.xml changed (reorder-class — recorded); committed `tests/land-e-roundtrip.html`: diff census `unclassified: 0` (font-metric value lines + slide-17 block only), fractional `font-size:` values now present
- `tests/exports/reference/` and `tests/exports/roundtrip/` each contain exactly `01.png`..`20.png`, all 1280×720; changed-PNG census recorded (round-trip 08–11 + 17 expected CHANGED)
- Both gap-closure auditors exit 0 on the COMMITTED pair (font-metrics slides 8 + 17; gradient-paint slide 17); ink fractions ≥ 0.01 on round-trip 08–11
- Nothing committed outside `00-supporting-files/data/land-e-tests/`
</acceptance_criteria>
</task>

<task>
<name>Task 2: Re-evidence the breakdown — row 08 fonts verdict, row 17 gradients verdict, defers verbatim; visual gate; sign-off re-request</name>
<files>00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md</files>
<action>
**Step 1 — header.** Update the generation line: stevedore @ `<FX8 run's commit>` (checkout record from task 1); the exporter branch list gains `fix/pseudo-z-index`; the comparator line gets the NEW mean/min/survival from task 1. Extend the fix-round sentence to (keep the existing entries verbatim, append the three new ones):

```markdown
Fix round (VERIFICATION gaps 1–3 + addendum-#3 gap 4 + addendum-#4 gaps 6–7): 02-FX1 converter attribute-safe font stacks ·
02-FX2 exporter capture viewport (`fix/font-design-viewport`) · 02-FX3 regeneration + re-check ·
02-FX4 capture-safe paint order (`scripts/export-slides.mjs` — code runs now paint in the PNGs) · 02-FX5 this regeneration + re-check ·
02-FX6 converter true-px run metrics (fractional sz / letter-spacing preserved — code text at 9.57px, not the integer-snapped 10px) ·
02-FX7 exporter pseudo-element z-order (`fix/pseudo-z-index` — slide-17 gradient overlays paint above their content) ·
02-FX8 this regeneration + re-check.
```

**Step 2 — row 08 gains the fonts verdict.** Root-cause cell appends: `+ converter snapped run sizes to integer px (9.57px code runs emitted as 10px — 02-FX6)`. Status cell: after the existing fixed chain, insert `+ 02-FX6 <fx6-short-hash> (true-px run metrics — computed font-size/letter-spacing match the reference within tolerance, auditor-witnessed)`, KEEP the per-line defer verbatim — `per-line positioned text boxes deferred — structural to the html→pptx text model (decision 8)` — re-measure Δluma from the NEW pair, keep the word count (316/316).

**Step 3 — row 17 gains the gradients verdict.** Root-cause cell appends: `+ exporter sorted ::before/::after overlays by a hardcoded level instead of the pseudo's own z-index — the z:2 half-panel gradients exported under the z:1 images (02-FX7)`. Status cell becomes: `fixed — fix/media-byte-embed + fix/gradient-svg-stop + 02-FX7 fix/pseudo-z-index (gradient overlays paint above their content — PNG-witnessed, auditor meanDelta recorded; visual pass ✓; blend-mode approximated by plain alpha — the exporter's native model, cosmetic); 7/7 imgs, Δluma <new>` — re-measure Δluma from the NEW pair (same method as 02-06: per-pixel luma difference over the same-tool 1280×720 pair; if the method record is unavailable, compute mean |luma(ref)−luma(rt)| with `node --input-type=module` loading both PNGs via `scripts/test/lib/ink.mjs`'s `loadPng`).

Every pointer uses the REAL landed short hashes (from the SUMMARY's checkout record — never a placeholder).

**Step 4 — defers stay verbatim everywhere (the non-negotiable).** Rows 07 and 19 and every other defer-carrying row are UNTOUCHED: video poster capture (rows 02/13/18 + media notes ¶), slide-05 h1 (row 05), per-line positioned text boxes (row 08, carried by "as 08" in 10/11), callout approximation (row 07), bullet marker/indent styling (row 07, addendum-#3 gap 5), "GLM Coding Plan" heading wrap (row 15), literal-glyph bullets (row 19), presenter notes (row 20), `<p:bg>` nicety (tail list). Addendum #4 gaps 8–9 (slides 7/19) are standing decision-8 defers — they get NO new text beyond what rows 07/19 already carry. The sign-off line stays verbatim: `**user sign-off re-requested post-fix (side-by-side + pptx path)**`.

**Step 5 — the visual gate (this plan's non-negotiable).** For each of 08 and 17 open the pair side by side — `tests/exports/reference/NN.png` vs `tests/exports/roundtrip/NN.png` (the breakdown's inline images render them adjacent) — and judge with eyes: slide 08's code text now matching the reference's size/density (per-line layout defer acknowledged — line positioning is approximate); slide 17's half-panel gradient tints, gradient pills and center divider visible on BOTH sides. Record a per-slide verdict table in the SUMMARY (`slide | PASS/FAIL | one-line observation`). **Any FAIL → STOP: make no further breakdown edits, commit nothing, and report the failing slide(s) to the orchestrator** — a visual fail after 02-FX6/02-FX7 means a fix did not close its gap; that is a new finding, not a doc edit.

Commit: `fix(02-FX8): drift breakdown — fonts row 08 + gradients row 17 re-evidenced post FX6/FX7`.
</action>
<verify>D="$PROGRESS/00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md"; N=$(grep -c '^| [0-9][0-9] ' "$D"); S=$(grep -cE '^\| [0-9][0-9] .*(fixed|deferred|Verified)' "$D"); L=$(grep -c 'tests/exports/reference/' "$D"); test "$N" -eq 20 && test "$N" -eq "$S" && test "$L" -ge 20 && grep -q '02-FX6' "$D" && grep -q '02-FX7' "$D" && grep -q 'fix/pseudo-z-index' "$D" && grep -q 'per-line positioned text boxes deferred' "$D" && grep -q 'poster capture deferred' "$D" && grep -q 'literal-glyph' "$D" && grep -q 'callout approximation deferred' "$D" && grep -q 'GLM Coding Plan' "$D" && grep -q 'bullet marker/indent styling deferred' "$D" && grep -q 'user sign-off re-requested post-fix (side-by-side + pptx path)' "$D" && echo FX8-BREAKDOWN-OK</verify>
<acceptance_criteria>
- All 20 rows still carry a disposition; every decision-8 defer intact and unchanged in meaning (video posters, 05 h1, per-line layout, callouts, literal-glyph bullets, slide-07 bullet markers/indent, slide-15 heading wrap, presenter notes, `<p:bg>`)
- Row 08 cites the real 02-FX6 short-hash with the true-px verdict and re-measured Δluma; row 17 cites `02-FX7 fix/pseudo-z-index` with the gradients verdict and re-measured Δluma; rows 07/19 carry no new fix claims
- Header records the new stevedore commit, the five-branch exporter list (incl. `fix/pseudo-z-index`), and the new comparator numbers
- SUMMARY contains the per-slide visual verdict table (2 rows, both PASS — or the plan stopped and reported at the first FAIL) and preserves the verbatim sign-off re-request line
- progressEdd diff confined to `00-supporting-files/data/land-e-tests/`
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Canonical comparator PASS, survival 15/15, 20+20 committed PNGs (1280×720); pptx census (19 identical + slide17 reorder) and HTML diff census (`unclassified: 0`) recorded
- [ ] Both gap closures proven on the COMMITTED pair: audit-font-metrics exits 0 (slides 8 + 17), audit-gradient-paint exits 0 (slide 17); ink ≥ 0.01 on round-trip 08–11
- [ ] DRIFT-BREAKDOWN.md: 20 rows, all statused, rows 08/17 re-evidenced with real FX6/FX7 pointers, every decision-8 defer verbatim (incl. slides 7/19), sign-off line intact
- [ ] Visual gate passed on the 08 and 17 pairs (verdict table in the SUMMARY); LAND.E originals untouched; progressEdd diff confined to `00-supporting-files/data/land-e-tests/`
