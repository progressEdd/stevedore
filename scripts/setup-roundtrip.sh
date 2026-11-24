#!/usr/bin/env bash
# scripts/setup-roundtrip.sh — one-time prep of the combined repo's toolchains.
# Idempotent — safe to re-run any time.
#   1. vendor/dom-to-pptx (html→pptx half): its own puppeteer toolchain
#      (pinned on the fork branch — vendored tool's internals untouched,
#      decision 10) + build.
#   2. vendor/PPTX2HTML devDeps: playwright — the driver for OUR export
#      tooling (decision 13; same driver as PPTX2HTML's playwright+pngjs
#      deterministic-PNG verify pattern). Bundled browsers are NEVER
#      downloaded (NixOS): nixpkgs chromium is passed at run time via
#      executablePath (STEVEDORE_CHROMIUM_PATH, set by the nix-shell wrapper).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/dom-to-pptx"
PPT="$ROOT/vendor/PPTX2HTML"
command -v bun >/dev/null || { echo "setup: bun not found (npm/npx are not installed on this machine)" >&2; exit 1; }
command -v nix >/dev/null || { echo "setup: nix not found (chromium comes from nixpkgs)" >&2; exit 1; }
nix shell nixpkgs#chromium --command chromium --version >/dev/null \
  || { echo "setup: chromium unavailable via 'nix shell nixpkgs#chromium'" >&2; exit 1; }
cd "$VENDOR"
PUPPETEER_SKIP_DOWNLOAD=1 bun install
bun run build   # the repo ships no dist/; the exporter CLI refuses to run without it
[ -n "$(ls -A dist 2>/dev/null)" ] || { echo "setup: bun run build produced no dist/ — inspect $VENDOR/dist" >&2; exit 1; }
cd "$PPT"
# devDeps (esbuild/playwright/pngjs) — playwright here is OUR exporter's driver
# (02-03, decision 13). The vendored package.json itself stays untouched.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install
[ -d node_modules/playwright ] || { echo "setup: playwright did not install under $PPT — vendor/PPTX2HTML devDependencies do not match phase-01 research (expected esbuild/playwright/pngjs); STOP and report instead of editing the vendored package.json" >&2; exit 1; }
echo "SETUP-OK"
