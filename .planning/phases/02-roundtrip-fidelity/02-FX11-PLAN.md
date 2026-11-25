---
issue: "#73"
wave: 8
depends_on: ["02-FX9", "02-FX10"]
target: progressEdd
fixes: 02-06
---

# Plan 02-FX11: Regenerate the canonical artifacts with the mono-family-fixed toolchain and re-evidence the breakdown

**Objective:** Close the artifact halves of VERIFICATION.md addendum #5 gaps 10 and 11 (2026-11-24): the canonical artifact set committed by 02-06/FX3/FX5/FX8 (`tests/land-e-slides.pptx`, `tests/land-e-roundtrip.html`, `tests/exports/{reference,roundtrip}/01..20.png`) still carries the proportional code-family defect — the pptx's `latin typeface="ui-monospace"` and the HTML's `'ui-monospace', Calibri, sans-serif` stacks (02-FX9 fixes both halves on stevedore: the converter's real mono stacks + the exporter fork `fix/real-mono-typeface`; this plan regenerates what they produce). For gap 11, this plan carries 02-FX10's outcome onto the record: either its fix's regenerated artifacts (branch A) or its accepted-gap defer (branch B — the STOP-RULE record from 02-FX10-SUMMARY.md lands in row 17 verbatim, no fix to regenerate). This plan re-runs `scripts/roundtrip.sh` end-to-end from a stevedore checkout carrying FX1–FX10, recommits the artifact set, updates `DRIFT-BREAKDOWN.md` — **row 08 gains the mono-family verdict (gap 10 closure), row 17 gains either the 02-FX10 fix verdict or the accepted-gap defer (gap 11 closure-as-recorded)** — and keeps every decision-8 defer verbatim (including the standing slides 7/19 bullet/callout defers, addendum #5 gaps 8–9, which get NO fix and NO row rewrite beyond their recorded defer text). Gates are recomputed vs FX8: the pptx is expected to change on the code-carrying slides only (typeface swap, 08–11 expected), the HTML on font-family stack lines only (classified diff census, `unclassified: 0`), and gap 10's closure is proven on the COMMITTED pair by the committed auditors (`audit-mono-width.mjs` exit 0 + pptx typeface ground truth), with the FX4/FX6/FX7 gates preserved (ink ≥ 0.01 on 08–11, font-metrics exit 0 on 8+17, gradient-paint exit 0 on 17). The PowerPoint human sign-off (decision 5) is re-requested; confirming it stays at ship time, outside this plan's contract.

**Standing facts:** this plan's target is **progressEdd**, not stevedore — you work in a progressEdd worktree; nothing here commits to stevedore. `$PROGRESS` = your progressEdd worktree root; `$STEVEDORE` = a stevedore checkout carrying ALL fix plans — FX1 (single-quote stacks), FX2 (`fix/font-design-viewport`), FX4 (capture paint order), FX6 (true-px metrics + `audit-font-metrics.mjs`), FX7 (`fix/pseudo-z-index` + `audit-gradient-paint.mjs`), **FX9** (real mono stacks in `scripts/src/render/fonts.js` + vendored `fix/real-mono-typeface` + `scripts/audit-mono-width.mjs`), **FX10** (its fix — branch A — or its accepted-gap record — branch B) — the post-merge `stevedore` branch checkout if the phase flow has merged them, otherwise the phase's stevedore agent worktree; record which checkout + commit in the SUMMARY; task 1's precondition greps prove it before anything runs. `$REPO` = the MAIN stevedore checkout carrying `.planning/` (worktrees do NOT carry it — FX6/FX7-recorded; the phase worktree layout puts it at `../../../../` from the progressEdd worktree root — verify `.planning/ROADMAP.md` resolves before using it). `scripts/setup-roundtrip.sh` must have been run on `$STEVEDORE` (idempotent — it also rebuilds `vendor/dom-to-pptx/dist`, required for FX9's fork fix to be live). Test data root: `00-supporting-files/data/land-e-tests/` (on progressEdd — your worktree has it directly); resolve deck paths with `realpath` into absolute form before use. LAND.E originals stay untouched (decision 3). `unzip`/`file` are absent on this host (standing deviation: `7z x -so` for pptx XML, node IHDR parse for PNG dimensions). Determinism promise: HTML and pptx slide XML reproduce deterministically; PNGs are never gated on byte equality — a changed-PNG census is recorded instead. Commits atomic with subject prefix `(02-FX11): …`. Current committed artifact sizes (FX8-era, for comparison): pptx **6,951,113** B, round-trip HTML **10,865,633** B. Code-carrying slides: 08–11 (every `font-family:'ui-monospace'` span in the committed HTML lives in slides 8–11 — FX9-plan-time grep).

## Tasks

<task>
<name>Task 1: Canonical re-run on the FX9(+FX10)-fixed toolchain; gate gap 10 closed on both halves; regenerate and commit the artifact set</name>
<files>00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx, 00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html, 00-supporting-files/data/land-e-tests/tests/exports/reference/01.png..20.png, 00-supporting-files/data/land-e-tests/tests/exports/roundtrip/01.png..20.png</files>
<action>
**Step 1 — set up and prove preconditions** (STOP and report if any fails — the plans have not landed where you are looking):

```bash
PROGRESS="$PWD"        # your progressEdd worktree root (adjust if you run from a subdir)
TESTS="$PROGRESS/00-supporting-files/data/land-e-tests"
REPO="$PROGRESS/../../../../"   # main stevedore checkout carrying .planning (verify below)
test -f "$REPO/.planning/ROADMAP.md" || { echo "REPO path wrong — locate the main checkout carrying .planning"; exit 1; }
grep -q 'UI_MONO_STACK' "$STEVEDORE/scripts/src/render/fonts.js" \
  && grep -q 'fix/real-mono-typeface' "$STEVEDORE/vendor/dom-to-pptx/VENDORED.md" \
  && grep -q 'resolveRealTypeface' "$STEVEDORE/vendor/dom-to-pptx/src/utils.js" \
  && test -f "$STEVEDORE/scripts/audit-mono-width.mjs" \
  && grep -q '(02-FX4)' "$STEVEDORE/scripts/export-slides.mjs" \
  && grep -q '(02-FX6)' "$STEVEDORE/scripts/src/pptx/text.js" \
  && test -f "$STEVEDORE/scripts/audit-font-metrics.mjs" \
  && test -f "$STEVEDORE/scripts/audit-gradient-paint.mjs" \
  && test -f "$STEVEDORE/scripts/audit-code-ink.mjs" \
  || { echo "stevedore checkout does not carry FX1+FX2+FX4+FX6+FX7+FX9 — STOP"; exit 1; }
# 02-FX10's outcome — its fix marker (branch A: export-slides.mjs / render/slide.js / VENDORED.md / audit-gradient-matrix.mjs)
# or its accepted-gap record (branch B):
grep -rq '(02-FX10)' "$STEVEDORE/scripts" "$STEVEDORE/vendor/dom-to-pptx/VENDORED.md" 2>/dev/null \
  || grep -q 'accepted gap' "$REPO/.planning/phases/02-roundtrip-fidelity/02-FX10-SUMMARY.md" \
  || { echo "02-FX10 neither fixed nor recorded — STOP"; exit 1; }
SRC="$(realpath "$TESTS/reference/slides.html")"
RT_HTML_OLD="$(realpath "$TESTS/tests/land-e-roundtrip.html")"
```

Record in the SUMMARY: the `$STEVEDORE` checkout + commit and the FX9/FX10 commit short-hashes (`git -C "$STEVEDORE" log --oneline | grep '02-FX'`), and which FX10 branch landed (fix vs accepted gap).

**Step 2 — the canonical run** (from `$STEVEDORE`; outputs to scratch):

```bash
cd "$STEVEDORE"
scripts/setup-roundtrip.sh                       # idempotent (rebuilds vendor/dom-to-pptx/dist)
F="${TMPDIR:-/tmp}/stevedore-fx11"
rm -rf "$F"
scripts/roundtrip.sh "$SRC" "$F"
ls "$F/exports/reference" | wc -l                # 20
ls "$F/exports/roundtrip" | wc -l                # 20
node scripts/compare-decks.mjs "$SRC" "$F/land-e-roundtrip.html"
```

The comparator must print **PASS** with `media survival: 15/15`. If it fails: STOP, record the failure, and report to the orchestrator — do not commit a downgraded bar.

**Step 3 — pptx census + typeface ground truth** (FX9's designed footprint; FX10 adds its own only on fork/markup branches):

```bash
T="${TMPDIR:-/tmp}/stevedore-fx11"; mkdir -p "$T"
for n in $(seq 1 20); do
  7z x -so "$F/land-e-slides.pptx" ppt/slides/slide$n.xml > "$T/fx11-slide$n.xml" 2>/dev/null
  7z x -so "$TESTS/tests/land-e-slides.pptx" ppt/slides/slide$n.xml > "$T/old-slide$n.xml" 2>/dev/null
  cmp -s "$T/fx11-slide$n.xml" "$T/old-slide$n.xml" || echo "slide$n.xml CHANGED"
done | tee "$T/fx11-pptx-census.log"
for n in $(grep -o 'slide[0-9]*' "$T/fx11-pptx-census.log" | grep -o '[0-9]*' | sort -un); do
  grep -q 'typeface="Consolas"' "$T/fx11-slide$n.xml" && ! grep -q 'typeface="ui-monospace"' "$T/fx11-slide$n.xml" \
    && echo "slide$n: typeface-class" \
    || { echo "slide$n: UNCLASSIFIED — verify against 02-FX10-SUMMARY.md's recorded pptx footprint; anything else → STOP and report"; exit 1; }
done | tee "$T/fx11-pptx-class.log"
# gap 10's pptx acceptance, on the fresh output:
grep -q 'typeface="Consolas"' "$T/fx11-slide8.xml" && echo CONSOLAS-PRESENT
! grep -q 'typeface="ui-monospace"' "$T/fx11-slide8.xml" && echo KEYWORD-GONE
```

Expected: the changed set is the typeface-class slides (08–11 expected; an extra change is legal ONLY if it matches 02-FX10-SUMMARY.md's recorded pptx footprint on its fork/markup branches — the classification loop above hard-fails otherwise). On FX10 branch B (accepted gap) nothing but the typeface-class set may change.

**Step 4 — HTML classified diff census** (the fix's designed footprint — FX8's census form, classification regex swapped to font-family):

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
let bad = 0, stack = 0, other = 0;
for (const k of keys) {
  const a = A[k] ?? [], b = B[k] ?? [];
  if (a.join("\n") === b.join("\n")) continue;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    if (/font-family:/.test(a[i] ?? "") || /font-family:/.test(b[i] ?? "")) stack++;
    else { other++; console.log("UNCLASSIFIED slide", k, "line", i + 1, ":", (b[i] ?? a[i] ?? "").slice(0, 120)); }
  }
}
console.log(JSON.stringify({ fontStackLines: stack, otherLines: other }));
process.exit(other ? 1 : 0);
' "$RT_HTML_OLD" "$F/land-e-roundtrip.html" | tee "$T/fx11-html-census.json"
grep -c "font-family:'ui-monospace'" "$RT_HTML_OLD"    # old: > 0 — record
test "$(grep -c "font-family:'ui-monospace'" "$F/land-e-roundtrip.html")" -eq 0
grep -c "font-family:'Consolas', 'Liberation Mono', 'Courier New', monospace" "$F/land-e-roundtrip.html"   # > 0 — record
```

Gate: `otherLines: 0` (every changed line is a font-family stack line; if FX10's markup branch landed, its recorded footprint lines are additionally allowed — match them against 02-FX10-SUMMARY.md). Any UNCLASSIFIED line → STOP and report.

**Step 5 — gap-closure proofs + preserved gates on the FRESH outputs** (the auditors run from `$STEVEDORE`):

```bash
cd "$STEVEDORE"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-mono-width.mjs "$F/land-e-roundtrip.html" 8 | tee "$T/fx11-close-8.json"; echo "exit=$? (must be 0 — gap 10, HTML half)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-mono-width.mjs "$SRC" 8 | tee "$T/fx11-ref-8.json"; echo "exit=$? (must be 0 — reference sanity)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-font-metrics.mjs "$SRC" "$F/land-e-roundtrip.html" 8 | tee "$T/fx11-fm-8.json"; echo "exit=$? (must be 0 — FX6 preserved)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-font-metrics.mjs "$SRC" "$F/land-e-roundtrip.html" 17 | tee "$T/fx11-fm-17.json"; echo "exit=$? (must be 0 — FX6 preserved)"
nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-paint.mjs "$F/land-e-roundtrip.html" 17 | tee "$T/fx11-grad-17.json"; echo "exit=$? (must be 0 — FX7 preserved)"
for n in 8 9 10 11; do
  nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
    node scripts/audit-code-ink.mjs "$F/land-e-roundtrip.html" $n "$F/ink-audit" | tee "$T/fx11-ink-$n.json"
done
# FX10 branch A only — its closure gate (skip on branch B):
test -f scripts/audit-gradient-matrix.mjs && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
  node scripts/audit-gradient-matrix.mjs "$F/land-e-roundtrip.html" 17 "$F/exports/reference/17.png" "$F/exports/roundtrip/17.png" > "$T/fx11-matrix.json"
```

Gates: mono-width exit 0 on the fresh round-trip slide 8 AND the reference (the metric's sanity); font-metrics exit 0 on slides 8 AND 17 (the stack swap must not disturb the metric gates — fontFamily is recorded, never gated); gradient-paint exit 0; every ink fraction ≥ 0.01 (mono text at 9.57px — the reference's own mono code measures 0.028–0.041); branch A: the matrix's previously-indicted fields read clean (compare with 02-FX10-SUMMARY.md's before-table). Any failure → STOP and report: a fix did not survive the canonical pipeline.

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
console.log("FX11-PNG-DIMS-OK");
' "$F"
for side in reference roundtrip; do
  for n in $(seq -w 1 20); do
    if cmp -s "$F/exports/$side/$n.png" "$TESTS/tests/exports/$side/$n.png"; then echo "$side/$n.png identical"; else echo "$side/$n.png CHANGED"; fi
  done
done | tee "$T/fx11-png-census.log"
```

Expected: reference side all-identical (FX9 is a pptx/HTML emission fix — the reference deck never passes through the converter; `.pp-img` flatten rules never match Marp markup); round-trip 08–11 CHANGED (code text now monospace) + FX10's recorded footprint on branch A (img-under-fill slides; 17 expected) — record exactly which (determinism evidence).

**Step 7 — commit the artifacts on progressEdd** (from your progressEdd worktree root):

```bash
TESTS=00-supporting-files/data/land-e-tests
cp "$F/land-e-slides.pptx"      "$TESTS/tests/"
cp "$F/land-e-roundtrip.html"   "$TESTS/tests/"
cp "$F/exports/reference/"*.png "$TESTS/tests/exports/reference/"
cp "$F/exports/roundtrip/"*.png "$TESTS/tests/exports/roundtrip/"
git add "$TESTS/tests"
git commit -m "fix(02-FX11): canonical artifacts regenerated — real mono stacks (02-FX9) + fix/real-mono-typeface[ + 02-FX10's fix]"
```

(On FX10 branch B, the commit message's tail becomes `— real mono stacks (02-FX9); gap 11 recorded as accepted gap (02-FX10)`.) Record in the SUMMARY: new pptx/HTML byte sizes (vs 6,951,113 / 10,865,633), the comparator's full table (mean/min/survival — task 2's header numbers), the pptx census + classification, the HTML diff census, the auditors' tables, the four ink fractions, and the PNG census.
</action>
<verify>node "$STEVEDORE/scripts/compare-decks.mjs" "$PROGRESS/00-supporting-files/data/land-e-tests/reference/slides.html" "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" && test "$(ls "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/reference" | wc -l)" -eq 20 && test "$(ls "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/roundtrip" | wc -l)" -eq 20 && 7z x -so "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx" ppt/slides/slide8.xml 2>/dev/null | grep -q 'typeface="Consolas"' && ! 7z x -so "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-slides.pptx" ppt/slides/slide8.xml 2>/dev/null | grep -q 'typeface="ui-monospace"' && cd "$STEVEDORE" && nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node scripts/audit-mono-width.mjs "$PROGRESS/00-supporting-files/data/land-e-tests/tests/land-e-roundtrip.html" 8 && for n in 8 9 10 11; do node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));if(!(j.fraction>=0.01))process.exit(1)" "${TMPDIR:-/tmp}/stevedore-fx11/fx11-ink-$n.json" || exit 1; done && echo FX11-ARTIFACTS-OK</verify>
<acceptance_criteria>
- Canonical comparator on the COMMITTED pair: `PASS`, `media survival: 15/15` (new mean/min recorded verbatim in the SUMMARY)
- Committed `tests/land-e-slides.pptx`: slide8.xml carries `typeface="Consolas"` with `typeface="ui-monospace"` absent; the changed-slide census is typeface-class (08–11 expected) plus at most 02-FX10's recorded footprint — every change classified, none unexplained
- Committed `tests/land-e-roundtrip.html`: diff census `otherLines: 0` (font-family stack lines only + FX10's recorded markup footprint if branch A); the old `'ui-monospace', Calibri, sans-serif` stack count is 0; the Consolas mono stack is present
- `tests/exports/reference/` and `tests/exports/roundtrip/` each contain exactly `01.png`..`20.png`, all 1280×720; changed-PNG census recorded (round-trip 08–11 expected CHANGED; reference side all-identical)
- Gap-closure on the COMMITTED pair: `audit-mono-width.mjs` exit 0 (round-trip slide 8 + reference sanity); FX6 font-metrics exit 0 (slides 8 + 17); FX7 gradient-paint exit 0 (slide 17); ink ≥ 0.01 on round-trip 08–11; FX10 branch A: its matrix gate clean
- Nothing committed outside `00-supporting-files/data/land-e-tests/`
</acceptance_criteria>
</task>

<task>
<name>Task 2: Re-evidence the breakdown — mono row 08, gradients row 17 (fix verdict or accepted-gap defer), defers verbatim; visual gate; sign-off re-request</name>
<files>00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md</files>
<action>
**Step 1 — header.** Update the generation line: stevedore @ `<FX11 run's commit>` (checkout record from task 1); the exporter branch list gains `fix/real-mono-typeface`; the comparator line gets the NEW mean/min/survival from task 1. Extend the fix-round sentence (keep the existing entries verbatim, append the new round):

```markdown
Fix round (VERIFICATION gaps 1–3 + addendum-#3 gap 4 + addendum-#4 gaps 6–7 + addendum-#5 gaps 10–11): 02-FX1 …
02-FX8 this regeneration + re-check · 02-FX9 real mono font stacks (converter ui-monospace keyword → probe-verified
mono stack; exporter `fix/real-mono-typeface` → typeface="Consolas" — code resolves monospace in chromium AND
PowerPoint) · 02-FX10 gradient diagnosis round 3 (<its fix, branch A> / <accepted gap per the hard STOP RULE, branch B>
— as its SUMMARY records) · 02-FX11 this regeneration + re-check.
```

**Step 2 — row 08 gains the mono-family verdict (gap 10).** Root-cause cell appends (in the font/size cause chain, before the layout-cause semicolon — FX8's placement convention): `+ the code font FAMILY resolved proportionally — ui-monospace resolves to nothing on nix chromium and PowerPoint substitutes keyword typefaces the same way (02-FX9)`. Status cell: after the existing 02-FX6 clause, insert `+ 02-FX9 <fx9-short-hash> (real mono stacks — code spans resolve monospace, width-probe-witnessed; pptx code runs carry typeface="Consolas" — same fix on the PowerPoint side; carried by 09–11's code spans as well)`. KEEP the per-line defer verbatim — `per-line positioned text boxes deferred — structural to the html→pptx text model (decision 8)` — re-measure Δluma from the NEW pair, keep the word count (316/316).

**Step 3 — row 17 gains 02-FX10's outcome (gap 11).** Two forms — apply the one that matches 02-FX10-SUMMARY.md's recorded branch:

- **Branch A (fix landed):** root-cause cell appends the indicted cause as its SUMMARY records it; status cell appends `+ 02-FX10 <fx10-short-hash> (<its fix — one line, matrix-witnessed: <indicted probe> → clean>)`; re-measure Δluma from the NEW pair; keep `7/7 imgs`.
- **Branch B (accepted gap, STOP RULE):** root-cause cell unchanged (no new cause — the matrix refuted every suspect); status cell appends the defer verbatim from 02-FX10-SUMMARY.md's item-3 record: `; gradient visibility at exported strength — accepted gap (02-FX10 matrix: all gradient SVGs decode with ink, stacking correct, nothing covers them; the exported single-gradient/no-blend overlay class paints at ≈half the reference's full effect — FX7's calibration; decision 8, addendum #5 gap 11; no fourth round per the hard STOP RULE)`. Re-measure Δluma and record it as the accepted state. Also append to the tail paragraph's "Other recorded defers" list: `, gradient visibility at exported strength (17 — accepted gap, 02-FX10 matrix, addendum #5 gap 11)`.

**Step 4 — defers stay verbatim everywhere (the non-negotiable).** Rows 07 and 19 and every other defer-carrying row are UNTOUCHED: video poster capture (rows 02/13/18 + media notes ¶), slide-05 h1 (row 05), per-line positioned text boxes (row 08, carried by "as 08" in 10/11), callout approximation (row 07), bullet marker/indent styling (row 07, addendum-#3 gap 5), "GLM Coding Plan" heading wrap (row 15), literal-glyph bullets (row 19), presenter notes (row 20), `<p:bg>` nicety (tail list). Addendum #5 gaps 8–9 (slides 7/19) are standing decision-8 defers — they get NO new text beyond what rows 07/19 already carry. The sign-off line stays verbatim: `**user sign-off re-requested post-fix (side-by-side + pptx path)**`.

**Step 5 — Δluma re-measurement for rows 08/17** (same method as the standing record — per-pixel mean luma difference over the same-tool 1280×720 pair):

```bash
cd "$STEVEDORE"
for n in 08 17; do
  node --input-type=module -e '
    const { loadPng } = await import(process.argv[3] + "/scripts/test/lib/ink.mjs");
    const [ref, rt] = [loadPng(process.argv[1]), loadPng(process.argv[2])];
    let sum = 0, n = 0;
    for (let i = 0; i < ref.data.length; i += 4) {
      const la = 0.2126 * ref.data[i] + 0.7152 * ref.data[i + 1] + 0.0722 * ref.data[i + 2];
      const lb = 0.2126 * rt.data[i] + 0.7152 * rt.data[i + 1] + 0.0722 * rt.data[i + 2];
      sum += Math.abs(la - lb); n++;
    }
    console.log("dLuma", (sum / n).toFixed(2));
  ' "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/reference/$n.png" \
    "$PROGRESS/00-supporting-files/data/land-e-tests/tests/exports/roundtrip/$n.png" "$PWD"
done
```

(FX8 recorded 5.98 for row 08 and 7.02 for row 17 — record the new values; the code slides are expected to drift toward the reference now that both sides render mono.)

**Step 6 — the visual gate (this plan's non-negotiable).** For slide 08 open the pair side by side — `tests/exports/reference/08.png` vs `tests/exports/roundtrip/08.png` (the breakdown's inline images render them adjacent) — and judge: the code text must render MONOSPACE on BOTH sides (equal glyph rhythm, matching line lengths — the per-line layout defer acknowledged: line positioning is approximate). If FX10 branch A landed, do the same for slide 17 (the half-panel gradient tints, gradient pills and center divider visible on BOTH sides). If FX10 branch B landed, record slide 17's verdict as `deferred (accepted gap)` — the standing FX7-calibration state, not a PASS/FAIL. Executor models that cannot render images judge quantitatively per the 02-06/FX8-recorded precedent (auditor A/B probes, region RGB means, ink totals, Δluma trends) and record which method they used. **Any FAIL → STOP: make no further breakdown edits, commit nothing, and report the failing slide to the orchestrator** — a visual fail after 02-FX9 means the fix did not close its gap; that is a new finding, not a doc edit.

Commit: `fix(02-FX11): drift breakdown — mono row 08 + gradients row 17 re-evidenced post FX9/FX10`.
</action>
<verify>D="$PROGRESS/00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md"; N=$(grep -c '^| [0-9][0-9] ' "$D"); S=$(grep -cE '^\| [0-9][0-9] .*(fixed|deferred|Verified)' "$D"); L=$(grep -c 'tests/exports/reference/' "$D"); test "$N" -eq 20 && test "$N" -eq "$S" && test "$L" -ge 20 && grep -q '02-FX9' "$D" && grep -q '02-FX10' "$D" && grep -q 'fix/real-mono-typeface' "$D" && grep -q 'per-line positioned text boxes deferred' "$D" && grep -q 'poster capture deferred' "$D" && grep -q 'literal-glyph' "$D" && grep -q 'callout approximation deferred' "$D" && grep -q 'GLM Coding Plan' "$D" && grep -q 'bullet marker/indent styling deferred' "$D" && grep -q 'user sign-off re-requested post-fix (side-by-side + pptx path)' "$D" && (grep -q 'accepted gap' "$D" || grep -q 'matrix-witnessed' "$D") && echo FX11-BREAKDOWN-OK</verify>
<acceptance_criteria>
- All 20 rows still carry a disposition; every decision-8 defer intact and unchanged in meaning (video posters, 05 h1, per-line layout, callouts, literal-glyph bullets, slide-07 bullet markers/indent, slide-15 heading wrap, presenter notes, `<p:bg>`)
- Row 08 cites the real 02-FX9 short-hash with the mono-family verdict and re-measured Δluma; row 17 carries EITHER the 02-FX10 fix verdict (real short-hash, matrix-witnessed, re-measured Δluma) OR the accepted-gap defer verbatim from 02-FX10-SUMMARY.md (branch B, including the no-fourth-round line); rows 07/19 carry no new fix claims
- Header records the new stevedore commit, the six-branch exporter list (incl. `fix/real-mono-typeface`), and the new comparator numbers; the fix-round sentence includes FX9/FX10/FX11
- SUMMARY contains the per-slide visual verdict table (08 + 17-if-fixed, all PASS — or the plan stopped and reported at the first FAIL; 17-branch-B recorded as deferred) and preserves the verbatim sign-off re-request line
- progressEdd diff confined to `00-supporting-files/data/land-e-tests/`
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] Canonical comparator PASS, survival 15/15, 20+20 committed PNGs (1280×720); pptx census (typeface-class + FX10's recorded footprint only) and HTML diff census (`otherLines: 0`) recorded
- [ ] Gap 10 closed on the COMMITTED pair: pptx slide-8 `typeface="Consolas"` (keyword absent), `audit-mono-width.mjs` exit 0 on the round-trip HTML + reference sanity; FX4/FX6/FX7 gates preserved (ink ≥ 0.01, font-metrics 8+17, gradient-paint 17)
- [ ] DRIFT-BREAKDOWN.md: 20 rows, all statused, row 08 re-evidenced with the real FX9 pointer, row 17 carrying FX10's outcome (fix verdict or accepted-gap defer verbatim), every decision-8 defer verbatim (incl. slides 7/19), sign-off line intact
- [ ] Visual gate passed on the 08 pair (+ 17 if fixed; 17-branch-B recorded as deferred); LAND.E originals untouched; progressEdd diff confined to `00-supporting-files/data/land-e-tests/`
