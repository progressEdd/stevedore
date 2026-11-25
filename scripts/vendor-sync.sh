#!/usr/bin/env bash
# scripts/vendor-sync.sh — mirror a fork checkout's tree into vendor/<name>.
# Usage: scripts/vendor-sync.sh <source-checkout-dir> <vendor-name>
# Excludes installs/build outputs and, for PPTX2HTML, the heavy samples/
# tree (pptx binaries — available in the fork on GitHub; keeps the
# subtree-distributed skill light). --delete mirror: upstream removals
# propagate. Commit the result on the stevedore branch.
set -euo pipefail
[ $# -eq 2 ] || { echo "usage: $0 <src-dir> <vendor-name>" >&2; exit 2; }
SRC="$(realpath "$1")"; NAME="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/$NAME"
EXCLUDES=(--exclude node_modules --exclude dist --exclude .git --exclude bun.lock --exclude bun.lockb)
[ "$NAME" = "PPTX2HTML" ] && EXCLUDES+=(--exclude samples)
mkdir -p "$DEST"
rsync -a --delete "${EXCLUDES[@]}" "$SRC"/ "$DEST"/
echo "SYNCED vendor/$NAME <- $SRC"
