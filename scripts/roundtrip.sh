#!/usr/bin/env bash
# scripts/roundtrip.sh — the whole round-trip from the combined repo (no /tmp
# tool cloning: tools are vendored; only outputs are scratch).
# Usage: scripts/roundtrip.sh <source.html> <outdir>
# Stages: html → pptx (export/html-to-pptx.sh → vendor/dom-to-pptx, nix
#         chromium) → html (extract/pptx-to-html.js — our converter)
#         → PNG exports of both sides (render/export-slides.mjs — the
#         deterministic exporter, plan 02-03)
#         → comparator (scripts/compare-decks.mjs).
# Run scripts/setup-roundtrip.sh once first.
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: $0 <source.html> <outdir>" >&2; exit 2; }
SRC="$(realpath "$1")"; OUT="$(realpath -m "$2")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/dom-to-pptx"
[ -n "$(ls -A "$VENDOR/dist" 2>/dev/null)" ] || { echo "roundtrip: vendor/dom-to-pptx not built — run scripts/setup-roundtrip.sh first" >&2; exit 1; }
mkdir -p "$OUT"
PPTX="$OUT/land-e-slides.pptx"; RT="$OUT/land-e-roundtrip.html"

echo "== html -> pptx (export/html-to-pptx.sh — vendor/dom-to-pptx, nix chromium) =="
# LAND.E is a Marp deck: 1280×720 px = 13.333×7.5 in, slides are <section>
# elements (no .slide class — pass -s section). If the exporter warns about
# non-slide sections matching, narrow to -s 'section[id]'; the pptx must have
# exactly 20 slides (verify: our converter's slide count in the next stage).
"$ROOT/export/html-to-pptx.sh" "$SRC" -o "$PPTX" -s section --title 'LAND.E' --width 13.333 --height 7.5

echo "== pptx -> html (extract/pptx-to-html.js — stevedore converter) =="
node "$ROOT/extract/pptx-to-html.js" "$PPTX" -o "$RT"

echo "== export PNGs (both sides, deterministic exporter) =="
nix shell nixpkgs#chromium --command bash -c \
  "STEVEDORE_CHROMIUM_PATH=\$(command -v chromium) node '$ROOT/render/export-slides.mjs' '$SRC' -o '$OUT/exports/reference'"
nix shell nixpkgs#chromium --command bash -c \
  "STEVEDORE_CHROMIUM_PATH=\$(command -v chromium) node '$ROOT/render/export-slides.mjs' '$RT' -o '$OUT/exports/roundtrip'"

echo "== compare =="
if node "$ROOT/scripts/compare-decks.mjs" "$SRC" "$RT"; then
  echo "ROUNDTRIP-OK"
else
  STATUS=$?
  echo "roundtrip: comparator FAILED (gates above) — artifacts kept in $OUT"
  exit $STATUS
fi
