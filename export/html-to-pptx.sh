#!/usr/bin/env bash
# export/html-to-pptx.sh — the export capability's standalone entry (phase 03,
# decision 1): html → pptx via the vendored dom-to-pptx fork, without running
# the whole round-trip. Wraps vendor/dom-to-pptx/bin/cli-exporter.js with
# stevedore defaults (the invocation roundtrip.sh used to bury as stage 1);
# nix chromium via PUPPETEER_EXECUTABLE_PATH — this wrapper self-wraps in
# `nix shell nixpkgs#chromium`, exactly like roundtrip.sh's stage 1 did.
# Usage: export/html-to-pptx.sh <input.html> -o <output.pptx> [options]
# Run scripts/setup-roundtrip.sh once first (builds vendor/dom-to-pptx/dist).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/dom-to-pptx"

usage() {
  cat <<'EOF'
usage: export/html-to-pptx.sh <input.html> -o <output.pptx> [options]
  -s, --selector <css>   slide elements (default: section; .pp-slide for stevedore output)
      --title <text>     presentation title metadata (default: input basename)
      --width <in>       slide width in inches (default: 13.333)
      --height <in>      slide height in inches (default: 7.5)
  -h, --help             show this help
EOF
}

INPUT=""; OUT=""
SELECTOR="section"; TITLE=""; WIDTH="13.333"; HEIGHT="7.5"
while [ $# -gt 0 ]; do
  case "$1" in
    -o|-s|--selector|--title|--width|--height)
      [ $# -ge 2 ] || { echo "html-to-pptx: $1 requires a value" >&2; usage >&2; exit 2; } ;;
  esac
  case "$1" in
    -o) OUT="$2"; shift 2 ;;
    -s|--selector) SELECTOR="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    --height) HEIGHT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "html-to-pptx: unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) [ -z "$INPUT" ] || { echo "html-to-pptx: unexpected argument: $1" >&2; usage >&2; exit 2; }
       INPUT="$1"; shift ;;
  esac
done
[ -n "$INPUT" ] && [ -n "$OUT" ] || { usage >&2; exit 2; }
[ -f "$INPUT" ] || { echo "html-to-pptx: no such file: $INPUT" >&2; exit 2; }
[ -n "$(ls -A "$VENDOR/dist" 2>/dev/null)" ] || { echo "html-to-pptx: vendor/dom-to-pptx not built — run scripts/setup-roundtrip.sh first" >&2; exit 1; }
[ -z "$TITLE" ] && TITLE="$(basename "${INPUT%.*}")"

nix shell nixpkgs#chromium --command bash -c '
  cd "$1" && shift
  export PUPPETEER_EXECUTABLE_PATH="$(command -v chromium)"
  exec node bin/cli-exporter.js "$@"
' html-to-pptx "$VENDOR" "$INPUT" -o "$OUT" -s "$SELECTOR" --title "$TITLE" --width "$WIDTH" --height "$HEIGHT"
echo "html-to-pptx: wrote $OUT"
