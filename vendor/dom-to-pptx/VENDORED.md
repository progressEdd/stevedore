# Vendored copy: dom-to-pptx

- Upstream: https://github.com/atharva9167j/dom-to-pptx (MIT — LICENSE in this dir, carried verbatim)
- Fork (git-history home): https://github.com/progressEdd/dom-to-pptx
- Vendored from branch: pin/puppeteer-23.11.1 (off upstream tag v2.1.2)
- Local deltas vs upstream v2.1.2: puppeteer pinned to 23.11.1 in package.json
  (v2.1.2's sync ensureBrowser check is broken by puppeteer 25; the pin lives on
  its own fork branch so an upstream PR stays one-click)
- Excluded from this copy: node_modules/, dist/ (built by scripts/setup-roundtrip.sh), lockfiles
- Synced: 2026-11-23 via scripts/vendor-sync.sh
