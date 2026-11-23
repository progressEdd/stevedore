# Vendored copy: dom-to-pptx

- Upstream: https://github.com/atharva9167j/dom-to-pptx (MIT — LICENSE in this dir, carried verbatim)
- Fork (git-history home): https://github.com/progressEdd/dom-to-pptx
- Integration branch vendored: stevedore-combined (off pin/puppeteer-23.11.1)
- Fork branches merged in:
  - pin/puppeteer-23.11.1 — off upstream tag v2.1.2; puppeteer pinned to
    23.11.1 in package.json (v2.1.2's sync ensureBrowser check is broken by
    puppeteer 25; the pin lives on its own fork branch so an upstream PR
    stays one-click)
  - fix/media-byte-embed — off v2.1.2; `<img>` embeds the browser-fetched
    ORIGINAL bytes via pptxgenjs `addImage({data})` (object-fit/position
    become geometry via `getObjectFitRect`, rounded corners keep the canvas
    fallback), `<video>` becomes a real media object via
    `addMedia({type:'video', data})` (mp4 part byte-exact, poster auto).
    Closes byte-exact media survival: raster, svg and mp4 all round-trip
    verbatim (plan 02-05, decision 9).
- Local deltas vs upstream v2.1.2: the union of the branches above
- Excluded from this copy: node_modules/, dist/ (built by scripts/setup-roundtrip.sh), lockfiles
- Synced: 2026-11-23 via scripts/vendor-sync.sh
