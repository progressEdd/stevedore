# Vendored copy: PPTX2HTML

- Upstream: https://github.com/g21589/PPTX2HTML (MIT — LICENSE in this dir, carried verbatim)
- Fork (git-history home): https://github.com/progressEdd/PPTX2HTML
- Vendored from ref: c8a96eb (upstream master tip at pin time)
- Local deltas: none — reference copy; the stevedore converter is our own
  implementation (phase-01 criterion 3) and ports SOLUTIONS from here, never source
- Toolchain note: its devDeps (esbuild/playwright/pngjs) are installed — never
  committed — by scripts/setup-roundtrip.sh; our own scripts/export-slides.mjs
  reuses the playwright install (decision 13), always pointed at nixpkgs chromium
- Excluded from this copy: node_modules/, dist/, samples/ (pptx binaries — see the fork)
- Synced: 2026-11-23 via scripts/vendor-sync.sh
