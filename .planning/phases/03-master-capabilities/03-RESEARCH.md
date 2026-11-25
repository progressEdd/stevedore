# Phase 03-master-capabilities Research

**Researched:** 2026-11-24 — background run 1915099

## Question

The three questions parked on research by `03-CONTEXT.md` (step 4):

1. **PDF bundler mechanism** — the exact zero-dependency approach for building a whole-deck PDF from the deterministic PNGs: PNG IDAT passthrough into PDF image XObjects (FlateDecode + PNG predictors, the img2pdf approach) vs re-encoding; what Node's built-in zlib covers; the minimal PDF object set a hand-written writer needs; page-size math for 7.5in-height pages at the deck's aspect; PNG scaled to fit.
2. **Restructure path census** — the complete inventory for moving master's flat layout into capability folders (extract/ = pptx→html engine + CLI, export/ = html→pptx standalone entry over vendor/dom-to-pptx, render/ = deck→PNG/PDF; compare/audit/roundtrip + shared test machinery stay in top-level scripts/): every file that moves, and every reference to a moved path, so the planner can write exact move+rewire tasks with nothing missed.
3. **Resolution-scaling mechanics** — deviceScaleFactor interplay with Playwright element screenshots; whether the viewport needs to track the deck's natural size; byte-determinism at non-default scales; anything that breaks the committed 1280×720 comparison witness if left default-off.

All code findings are from the **master branch checked out at `02-worktrees/master/`** (the main checkout is on progressEdd and holds no `scripts/`). Empirical probes were run live (playwright 1.63.0 + nixpkgs chromium, replicating `02-worktrees/master/scripts/export-slides.mjs`'s exact launch flags/flatten CSS) and a proof-of-concept PDF bundler was written and validated with qpdf 12.4.2 + poppler; probe code lived in `/tmp/stevedore-research/` (not committed — key numbers below).

## Findings

### Q1 — PDF bundler mechanism

**The PNGs are already in the passthrough-friendly profile — verified on the actual artifacts.** Every committed witness PNG (`00-supporting-files/data/land-e-tests/tests/exports/reference/01..20.png`, `…/roundtrip/01..20.png`) parses as **color type 2 (truecolor RGB, no alpha), bit depth 8, compression 0, interlace 0**, 1280×720. Live captures at `deviceScaleFactor: 2` (probes B/C2/C3/D2/F2, below) are **also color type 2** — Chromium/Playwright 1.63.0 emits opaque RGB PNGs at every scale probed. A sample file has 8 IDAT chunks (concatenation required).

**Passthrough mechanism (the img2pdf approach) — proven end-to-end by a PoC.** A PNG's IDAT payloads concatenated form a zlib (RFC 1950) stream containing PNG-filtered scanlines (each row prefixed with one filter-type byte). PDF `FlateDecode` streams are zlib streams, and PDF's PNG predictors (`/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns <width> >>`, PDF 32000-1 §7.4.4.3) are byte-compatible with PNG's per-row filtering. Therefore the IDAT bytes can be **copied verbatim** as the PDF image stream — no inflate, no re-filter, no re-encode. PoC validation (`/tmp/stevedore-research/pdf-bundler-poc.mjs` bundling the 20 committed reference PNGs):

- `qpdf --check` (qpdf 12.4.2): *"No syntax or stream encoding errors found"*; 20 pages, correct MediaBox.
- **Decisive cross-validation:** `qpdf --show-object=3 --filtered-stream-data` (qpdf's own zlib+predictor decode of the embedded image) is **byte-identical** (2,764,800 bytes = 1280×720×3) to an independent Node-side inflate+unfilter of the source PNG's IDAT — two independent decoders, same pixels.
- Rendering the PDF at 96 dpi with poppler `pdftoppm` yields exactly 1280×720 px from the 960×540 pt page (and 960×720 from a 720×540 pt page) — page math confirmed; the ~1.4% render-pixel diff vs the source PNG is poppler's image interpolation at raster time (viewer-side, true of any image-bearing PDF; the embedded data is byte-exact).
- 20-slide PDF = 4,977,192 bytes ≈ sum of the PNGs' IDAT payloads (+~2 KB scaffolding) — zero re-encoding overhead.
- Built twice → **byte-identical output** (pure function: no timestamps, no /Info dict, no object-stream/xref-stream fanciness).

**Minimal PDF object set (all a hand-written writer needs — exactly as PoC'd):**

| Object | Body |
|---|---|
| Catalog | `<< /Type /Catalog /Pages 2 0 R >>` |
| Pages tree | `<< /Type /Pages /Kids [5 0 R 8 0 R …] /Count N >>` |
| Page | `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 W H] /Resources << /XObject << /Im0 3 0 R >> >> /Contents 4 0 R >>` |
| Image XObject | `<< /Type /XObject /Subtype /Image /Width w /Height h /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns w >> /Length L >>` + `stream …IDAT bytes… endstream` |
| Content stream | `q W 0 0 H 0 0 cm /Im0 Do Q` (unit-square image scaled to the page box) |
| xref + trailer | classic `xref\n0 N+1` table, `trailer << /Size N+1 /Root 1 0 R >>`, `startxref`, `%%EOF`; header `%PDF-1.4` + binary comment line |

**What Node's built-in zlib covers:** for pure passthrough — **nothing is needed** (chunk parsing is 8-byte signature + length/type/data/CRC walks; IDAT concat is a Buffer.concat). If a fallback re-encode path is ever wanted (RGBA/palette/16-bit PNGs — the cases img2pdf refuses), `node:zlib`'s `inflateSync`/`deflateSync` (zlib format = FlateDecode/IDAT format) plus ~40 lines of PNG filter/unfilter code covers it, still zero-dep. The repo already ships both zlib flavors: `02-worktrees/master/scripts/src/util/zip.js:1` uses `deflateRawSync`/`inflateRawSync` (raw RFC 1951 — note: PDF FlateDecode needs the *zlib-wrapped* variants, `deflateSync`/`inflateSync`).

**Page-size math (1 pt = 1/72 in; 7.5 in = 540 pt):**

- 16:9 → width 540 × 16/9 = **960 × 540 pt** (= 13.333 × 7.5 in, PowerPoint "Widescreen"; LAND.E: 1280/720 → 960 pt exactly).
- 4:3 → 540 × 4/3 = **720 × 540 pt** (= 10 × 7.5 in, PowerPoint "Standard").
- General: `pagePtW = 540 × (pngW / pngH)`; aspect flows from the deck (`p:sldSz` → `pxW/pxH` via `02-worktrees/master/scripts/src/pptx/presentation.js:11,49` — `px = Math.round(emu / 9525)`; 13.333 in ⇒ 1280 px, 10 in ⇒ 960 px).
- "PNG scaled to fit": the content stream's `cm` matrix fills the page box with the image; since PNG aspect = page aspect (both derive from the deck), it is an exact fill — requested resolution changes sharpness only, matching CONTEXT decision 4.

**Feasibility constraints to code defensively:** reject (or fall back on) color types ≠ 2 (6 = RGBA, 3 = palette, 0/4 = gray/gray+alpha), bit depth ≠ 8, interlace ≠ 0 — with a clear diagnostic, house style. Chromium's `--force-color-profile=srgb` launch flag (already in `export-slides.mjs:64`) means `/DeviceRGB` needs no color-profile plumbing.

### Q2 — Restructure path census

Master's current flat layout (all under `02-worktrees/master/`): root `README.md`, `SKILL.md`, `LICENSE`, `reference/{usage,fidelity,validation}.md`, `vendor/{dom-to-pptx,PPTX2HTML}`, and one `scripts/` holding everything else (43 files). Census below; line numbers are `02-worktrees/master/`-relative.

**Files that MOVE:**

- **extract/** — `scripts/pptx-to-html.js` (CLI), `scripts/src/**` (33 files: `index.js`, `opc/package.js`, `pptx/{color,context,fill,presentation,slide,smartart,symbols,table,text,theme,timing,transition}.js`, `geometry/{geometry,presets}.js`, `charts/{parse,render}.js`, `render/{context,document,fonts,paint,shape,slide,table,text}.js`, `util/{mime,xml,zip}.js`, `src/.gitkeep`), the 17 engine tests `scripts/test/{chart,color,document,e2e,geometry,media,opc,presentation,render-shape,render-text,smartart,split,table,text,timing,xml,zip}.test.mjs`, and their fixture builder `scripts/test/lib/deck.mjs` (imported by exactly those 17). `scripts/examples/land-e/{deck.pptx,deck.html,README.md}` is the converter's worked example — extract-scoped or skill-level, planner's call (see unknowns). The CLI's `import … from './src/index.js'` (`pptx-to-html.js:14`) stays valid if src/ moves with it at the same relative depth.
- **render/** — `scripts/export-slides.mjs` (+ the new PDF bundler and resolution options). Its render tests: `scripts/test/{export,export-ink}.test.mjs`.
- **export/** — **no existing file moves**; a NEW standalone entry wrapping the vendor invocation currently buried in `scripts/roundtrip.sh:22-26` (`vendor/dom-to-pptx/bin/cli-exporter.js` with `-s section --title … --width 13.333 --height 7.5`, `PUPPETEER_EXECUTABLE_PATH` pointing at nix chromium, `dist/` built by `setup-roundtrip.sh`).
- **Stays top-level scripts/** (per CONTEXT decision 1): `compare-decks.mjs`, `audit-code-ink.mjs`, `audit-font-metrics.mjs`, `audit-gradient-paint.mjs`, `audit-mono-width.mjs`, `roundtrip.sh`, `setup-roundtrip.sh`, `vendor-sync.sh`, `compare.test.mjs`, and the shared test machinery `test/lib/ink.mjs` (used by both `export-ink.test.mjs` — render — and top-level `audit-code-ink.mjs:21` — genuinely cross-capability). `vendor/`, `reference/`, `LICENSE` stay top-level (CONTEXT).

**Every reference to a moved path (the rewire list):**

| Where | What | Kind |
|---|---|---|
| `README.md:3` | `scripts/roundtrip.sh`, `scripts/setup-roundtrip.sh` in intro | doc |
| `README.md:9` | `node scripts/pptx-to-html.js …` convert command | doc |
| `README.md:17` | subtree install: `node .agents/skills/stevedore/scripts/pptx-to-html.js deck.pptx` (+ pull cmd :18) | doc — the subtree-install surface |
| `README.md:23-28` | Layout list: `scripts/pptx-to-html.js`, `scripts/export-slides.mjs`, `scripts/src/`, `scripts/test/`, `scripts/examples/`, `setup-roundtrip.sh` ×2 | doc |
| `SKILL.md:26,:35` | WORKFLOW code blocks `node scripts/pptx-to-html.js …` | doc |
| `SKILL.md` supporting-files table | `examples/land-e/` — **already wrong today** (actual path is `scripts/examples/land-e/`); fix during restructure | doc (pre-existing bug) |
| `reference/usage.md:10,:16` | `node scripts/pptx-to-html.js …` | doc |
| `reference/validation.md:5,:15` | "skill root as cwd (adjust the `scripts/` prefix…)" + command | doc |
| `scripts/examples/land-e/README.md:5` | reproduce command: `node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o …` | doc |
| `scripts/roundtrip.sh:28` | `node "$ROOT/scripts/pptx-to-html.js"` → extract | script |
| `scripts/roundtrip.sh:32,:34` | `'$ROOT/scripts/export-slides.mjs'` ×2 → render | script |
| `scripts/roundtrip.sh:2-8` | header comments naming scripts/* stages (stage 1 may swap to the new export/ entry) | comment |
| `scripts/export-slides.mjs:8,:14,:16,:48,:56,:62` | header usage + error strings naming `scripts/export-slides.mjs` / `scripts/setup-roundtrip.sh` | text |
| `scripts/pptx-to-html.js:13` | USAGE string `node scripts/pptx-to-html.js` | text |
| `scripts/export-slides.mjs:58` | `resolve(here, '../vendor/PPTX2HTML/package.json')` — depth-2 relative; **stays valid** if render/ sits one level under root (as planned) | code (no-op) |
| `scripts/test/export.test.mjs:29,:35` | spawns **cwd-relative** `'scripts/export-slides.mjs'` | test — breaks unless run from skill root with new path |
| `scripts/test/chart.test.mjs:113-114` | `fs.readFileSync('scripts/src/charts/{parse,render}.js')` — cwd-relative, reads source as text | test |
| `scripts/test/compare.test.mjs:143,:154` | spawns cwd-relative `'scripts/compare-decks.mjs'` — **stays** (compare doesn't move) | test (no-op) |
| `scripts/test/export-ink.test.mjs:16,:52` | `ROOT = new URL('../..')` + `join(ROOT, 'scripts/export-slides.mjs')` — import.meta.url-anchored; string must change wherever the file lands | test |
| `scripts/test/e2e.test.mjs:15-16` | `scriptsDir = '../'` + `cli = 'pptx-to-html.js'` sibling — works if the test moves with the CLI under extract/ | test (no-op if co-moved) |
| `scripts/test/lib/ink.mjs:10` | `VENDOR_PKG = '../../../vendor/PPTX2HTML/package.json'` — depth-3; valid at any same-depth location (e.g. stays `scripts/test/lib/`), breaks if depth changes | code |
| `scripts/test/*.test.mjs` (17 engine tests) | `../src/…` imports — valid if test/ co-moves with src/ under extract/ at the same depth | code (no-op if co-moved) |
| `scripts/test/export-ink.test.mjs:14` | `import { inkFraction, loadPng } from './lib/ink.mjs'` — breaks if ink.mjs stays top-level while this test moves to render/ (becomes `../../scripts/test/lib/ink.mjs`) | test |
| `scripts/package.json` | `"type": "module"` — **load-bearing**: `pptx-to-html.js` and all `src/**/*.js` are ESM `.js` files parsed as ESM only because of the nearest package.json; there is **no root package.json on master**. After the move, extract/ (or the root) needs a package.json with `"type": "module"` or every `.js` import crashes as CJS | config — silent breakage |
| `.gitignore` | `!scripts/test/lib/` exception (un-ignores the Python-template `lib/` rule) — any moved `lib/` dir (e.g. `extract/test/lib/`) is silently ignored without a new exception | config — silent file loss |
| `scripts/audit-font-metrics.mjs:5` | "same flatten CSS, launch flags and 1280×720 viewport as scripts/export-slides.mjs — **KEEP IN SYNC**" — the four auditors replicate the exporter's capture recipe; path text + recipe both need tracking | comment + coupling |
| `.gitkeep` ×3 | `scripts/.gitkeep` (moot — scripts/ stays populated), `scripts/src/.gitkeep`, `scripts/test/.gitkeep` move with their dirs | cosmetic |
| `SKILL.md` frontmatter | name `pptx-to-html` — extract/SKILL.md keeps it; render/ and export/ need their own SKILL.md+README per the shippEdd capability model; the current root SKILL.md is extract-only | structure |
| Out-of-tree (progressEdd branch, **not** rewired by the master restructure but goes stale): `00-supporting-files/data/land-e-tests/DRIFT-BREAKDOWN.md:4,:6,:10,:66` cite `scripts/roundtrip.sh`/`scripts/export-slides.mjs` pinned at commit `ff893ab` — historical record; leave or annotate, planner's call | doc (other branch) |

No references to moved paths exist inside `vendor/` (the vendored tools are self-contained; `roundtrip.sh`/`setup-roundtrip.sh` reach into them by their own paths, which don't move). `vendor-sync.sh` and `setup-roundtrip.sh` compute `ROOT` from their own location and only touch `vendor/` — both stay valid where they are (usage-text self-references only).

### Q3 — Resolution-scaling mechanics

**How the pinned Playwright actually works** (verified in the installed `playwright-core@1.63.0` bundle — the same pin as `vendor/PPTX2HTML/package.json:53`): `elementHandle.screenshot()` scrolls the element into view, takes its CSS-px bounding box, converts it with `helper.enclosingIntRect` (**floor x/y, ceil w/h**), and sends CDP `Page.captureScreenshot` with that clip at `clip.scale = 1` (default screenshot `scale: "device"`), `captureBeyondViewport: !fitsViewport`. Rasterization happens at the context's emulated `deviceScaleFactor`. Output pixels = **ceil'd CSS rect × DSF**.

**Does 2× DSF double an element capture's dimensions? Yes — exactly, including fractional cases** (live probes, all `colortype=2`, all byte-stable across browser relaunches):

| Probe | Config | Output PNG |
|---|---|---|
| A | LAND.E reference (Marp, 1280×720), viewport 1280×720, dsf=1 | 1280×720; byte-stable ×2 runs |
| A2 | same vs committed witness `reference/01.png` | **byte-identical** — witness reproduced today |
| B | LAND.E reference, viewport 1280×720, dsf=2 | 2560×1440 (exact ×2) |
| B2 | LAND.E reference, viewport 2560×1440, dsf=2 | **5120×2880** — viewport compounds with DSF on Marp decks |
| C/C2 | fixed-px `.pp-slide` 960×720 (4:3) in default 1280×720 viewport, dsf=1 / 2 | 960×720 / 1920×1440 (exact ×2) |
| C3 | same deck, viewport tracks deck (960×720), dsf=2 | 1920×1440, **bytes identical to C2** |
| C4 | C2 vs C3 | identical bytes — viewport does not affect fixed-px capture |
| D/D2 | fractional element 960.5×719.5, dsf=1 / 2 | 961×720 / **1922×1440** (ceil-then-double) |
| E | 1920×1080 `.pp-slide` overflowing default viewport | full 1920×1080 captured (captureBeyondViewport) |
| F/F2 | marpit-shaped 4:3 (960×720) in default 1280×720 viewport, dsf=1 / 2 | 960×720 (letterboxed, scale=1) / 1920×1440 |
| G | marpit-shaped ultrawide (1920×720) in default 1280×720 viewport | **1280×480 — shrunk below natural size** |

**Does the viewport need to track the deck's natural size? Depends on the deck shape — and the exporter handles both shapes today:**

- **Converter decks (`.pp-slide`)**: slides are fixed CSS-px boxes (`src/render/document.js:71-77` — `:root { --pp-w/--pp-h }` from `presentation.slideSize.pxW/pxH`, `presentation.js:11,49`), and the exporter's flatten CSS pins `transform:none` so the fit-scaler never shrinks them (`export-slides.mjs:84-101`). Viewport is irrelevant to capture size (probes C4, E) — **DSF alone is the resolution knob**.
- **Marp decks (`section`)**: the section's *rendered* rect is viewport-derived — `svg[data-marpit-svg]{height:100vh;width:100vw}` wraps fixed-size sections via viewBox + `preserveAspectRatio` meet, so the capture rect = natural size × min(vw/W, vh/H) (probes F, G, B2). The default 1280×720 viewport happens to equal LAND.E's natural size (hence today's 1280×720 exports), but **a non-16:9 Marp deck in the default viewport letterboxes (F) or shrinks (G)**, and a larger viewport *grows* the capture multiplicatively with DSF (B2). For "any deck at any requested resolution," the exporter should size the viewport to the deck's natural CSS size (readable pre-capture from the first element's bounding box, or the marpit viewBox) and use DSF as the scale factor. The `--width/--height` flags already exist (`export-slides.mjs:40-41`, defaults 1280/720) — they currently set only the viewport.

**Byte-determinism at non-default scales:** yes, empirically — every probe above was byte-stable across full browser relaunches at dsf 1 and 2 and multiple viewports, on this machine/toolchain (nixpkgs chromium + playwright 1.63.0 + the fixed launch flags). This extends the phase-02 doctrine (`02-03-SUMMARY.md`: fixed tool+viewport+flags ⇒ deterministic-in-tooling; in-practice byte-identical — proven again by A2 reproducing the committed witness today, and by FX3's "all 20 reference PNGs byte-identical to the previous commit") to non-default DSF. Not promised across chromium/playwright version changes; the exporter's own header (`export-slides.mjs:11-12`) says never gate on byte equality.

**Witness-breakage vectors (what "default-off" must actually mean):** the committed 20+20 PNGs regenerate byte-identically only if the default capture recipe stays *exactly* today's: viewport 1280×720, `deviceScaleFactor: 1` (`export-slides.mjs:71-74`), the four launch flags (`:63-65`), the flatten CSS incl. the 02-FX4 `.pp-text{position:relative}` rule (`:84-101`), `networkidle` + `document.fonts.ready` waits, `locator(selector).all()` DOM order, and `pad2()` naming (`:108`). Concretely: (a) don't auto-size the viewport to the deck by default (LAND.E is 1280×720 on both sides so it would survive, but it's a behavior change — keep the literal default); (b) keep new flags (`--scale`/DSF, `--pdf`) strictly opt-in with today's values as defaults; (c) if the exporter's shared capture recipe changes at all, mirror it in the four auditors (`audit-font-metrics.mjs:5` "KEEP IN SYNC" — all four replicate the flatten CSS, launch flags, and 1280×720 viewport); (d) keep default output naming `NN.png` untouched so `roundtrip.sh:32-34` and the witness tree stay aligned.

## Recommendation

For **Q1**: build the PDF bundler as pure IDAT passthrough — parse PNG chunks, concatenate IDAT, embed verbatim with `/Filter /FlateDecode` + `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns w >>`, `/ColorSpace /DeviceRGB /BitsPerComponent 8`, page = `540pt × aspect` (960×540 for 16:9, 720×540 for 4:3), content `q W 0 0 H 0 0 cm /Im0 Do Q`, no /Info/timestamps (deterministic by construction, matching the PNGs' byte-stability). Validate IHDR (color type 2, depth 8, non-interlaced) and fail with a clear diagnostic otherwise — the PoC's exact object templates above are copy-ready. For **Q2**: execute the census table as move+rewire tasks in one phase (clean break per CONTEXT decision 3), treating the two silent breakages as first-class tasks — the ESM `package.json` ("type": "module") for the moved `.js` files, and the `.gitignore` `lib/` exception for any moved `test/lib/` — plus the cwd-relative test spawns (a grep for `scripts/` alone won't surface those distinctions). For **Q3**: implement resolution as `deviceScaleFactor` on the existing context (keep `--width/--height` as viewport control), auto-tracking the viewport to the deck's natural CSS size *only when a non-default scale is requested*, defaults untouched per the witness vectors above.

## Risks / unknowns

- **RGBA at unprobed scales/paths:** color type 2 verified at dsf 1 and 2 for both deck shapes, but not e.g. `omitBackground` decks or other element types; the bundler must still validate IHDR and reject/fallback rather than assume (cheap: one byte check).
- **Fractional slide sizes** round via ceil-then-×DSF (probe D: 960.5 → 961/1922) — our converter always emits integer px (`Math.round(emu/9525)`), Marp sections are integer, so this only bites third-party decks; a 1-px aspect mismatch against the 540pt page stretches by <0.1% (or letterbox — planner picks the fit rule for mismatched aspects).
- **Examples placement and test-suite split are planner decisions** the census deliberately leaves open: `scripts/examples/` (extract-scoped demo vs skill-level) and whether `test/lib/deck.mjs` moves with extract or joins the shared machinery — both import graphs are mapped above either way.
- **SKILL.md examples-path bug is pre-existing** (`examples/land-e/` vs actual `scripts/examples/land-e/`) — fix opportunistically in the restructure, but note it's not caused by the move.
- **Auditor sync coupling** (`audit-font-metrics.mjs:5`): any change to the exporter's launch flags/flatten CSS/viewport — even default-preserving refactors that touch those lines — must be mirrored in all four auditors or their calibrated thresholds drift.
- **Cross-version determinism** remains unpromised (chromium/playwright upgrades can change rasterization; the witness is regenerable but not portable across tool versions) — consistent with the phase-02 doctrine; nothing new to mitigate, just don't gate PDF/PNG equality across environments.
- **Out-of-tree references on the progressEdd branch** (`DRIFT-BREAKDOWN.md`, `.planning/` history) cite the old paths pinned to old commits; leaving them is defensible (historical record) but the planner should state that choice explicitly rather than discover it later.

## Addendum — how Marp/Marpit works (Q4)

**Researched:** addendum run (no run id given in the dispatch; date not independently verifiable in-repo — appended after the 2026-11-24 base research and after `03-01-PLAN.md`/`03-02-PLAN.md` were drafted). Trigger: user question "how does Marp work?" (pointing at github.com/marp-team/marpit) ahead of approving plan 03-02, whose Task 2 rests on three assumptions about the Marp deck shape.

**Method note — sources.** This agent's toolset has no shell/network (read/grep/find/ls/write only), and no Marpit copy exists anywhere on disk (checked: the repo tree incl. `vendor/`, `/tmp`, `~/.local/share/bun/install/global/node_modules`, `~/.bun/install/cache`, and `/tmp/stevedore-research/node_modules` → only `playwright`/`playwright-core`), so the Marpit repo could be neither cloned nor fetched. The primary source is therefore the reference deck itself — which embeds actual shipped Marp-team code: the bespoke viewer bundle from **`@marp-team/marp-cli@4.3.1`** (license comment, `slides.html:25915`), Marp Core's browser script (`slides.html:25912`), and the generated Marpit scaffold + theme CSS (`slides.html:1-11`) — cross-checked with the deck's markdown source (`reference/slides.md`), the exporter that captures this exact shape today (`02-worktrees/master/scripts/export-slides.mjs`; 03-01 will move it to `render/export-slides.mjs` unchanged), and Q3's probes (still on disk: `/tmp/stevedore-research/{probe.mjs,report.json,fixture-marp43.html}`). Every claim below is sourced to one of these; Marpit-repo claims not derivable from them are marked **[training-data assumption]**.

### Question

1. How does Marpit actually render a deck — markdown → `<section>` slides, the `svg[data-marpit-svg]` wrapper, and what sets the viewBox (theme `@size` vs the `size` directive; defaults — is 1280×720 the 16:9 default? what does 4:3 produce?) — and why do sections end up viewport-scaled (preserveAspectRatio; the bespoke viewer vs plain Marpit output)?
2. Where in Marp's HTML output is a deck's natural slide size authoritatively encoded (viewBox? section width/height style? theme CSS custom properties like `--marpit-*`?) — and is it uniform across all slides?
3. What variations in Marp output could bite the exporter: different sizes, plain Marpit output without the bespoke viewer, multiple/differing viewBoxes, padding/overflow quirks, inline vs external themes — anything invalidating plan assumptions (a) each slide is a `<section>` wrapped in `<svg data-marpit-svg viewBox>`; (b) that svg is viewport-sized so a section's rendered rect = natural × min(vw/W, vh/H); (c) "viewport = viewBox size + deviceScaleFactor" is the right capture mechanism.
4. Verdict on assumption (c) for plan 03-02, with any concrete correction.

### Findings

#### Q1 — how Marpit renders a deck

**Markdown → sections.** `reference/slides.md` is plain Markdown with frontmatter `marp: true`, `html: true`, `style: |` (a long custom-CSS block) — `slides.md:2-4`. Marp splits it into **20 slides via 19 `---` horizontal rules** (`slides.md:649,655,673,…,870`), each becoming a `<section id="1"…id="20">` in document order (`slides.html:11,1301,2595,…,24623`). Per-slide class directives `<!-- _class: fill-media -->` etc. (`slides.md:657,667,682,…`) land on the section as a real `class` attribute **plus** duplicated `data-class` (and the frontmatter `style:` CSS lands both in the head `<style>` and duplicated per-section as `data-style` + a `--style:` inline custom property — e.g. `slides.html:1301` vs the same tag's continuation at `slides.html:1944`: `" lang="en-US" class="fill-media" style="--class:fill-media;--style:section.fill-media {`). Inert for capture, but it explains the file's shape: each section's opening tag carries ~640 lines of attribute value, hence a 25,916-line HTML for 20 slides. `html: true` is why sections contain raw HTML (`div.media-wrap`, `pre>code` diff panels, `video`) — sourced throughout the section bodies.

**The svg wrapper.** Every slide is wrapped as `svg[data-marpit-svg] > foreignObject > section` — exactly: `</foreignObject></svg><svg data-marpit-svg="" viewBox="0 0 1280 720"><foreignObject width="1280" height="720"><section id="N" …>` (20/20 identical, `slides.html:11` and every slide boundary). The wrapper svg has **no width/height attributes and no preserveAspectRatio attribute** (grep: `preserveAspectRatio` matches nothing in the markup) → SVG's default `xMidYMid meet` applies (the deck's own embedded polyfill code defaults to `xMinYMid meet` and the research fixture set `xMidYMid meet` explicitly, corroborating that the attribute's absence means meet).

**Head structure.** Two `<style>` blocks (`slides.html:1-11`): #1 is the bespoke viewer's CSS (`body[data-bespoke-view=…] …` — on-screen controls, view transitions, presenter/overview, and the slide show/hide rules); #2 is the Marpit scaffold + theme CSS, with every `section` selector **scoped by the viewer postprocessor** to `div#\:\$p > svg > foreignObject > …`. Body: `<div class="bespoke-marp-osc">…6 control buttons…</div>`, the wrapper `<div id=":$p">` holding all 20 svgs, optional presenter-note divs as **siblings after the wrapper** (`<div class="bespoke-marp-note" data-index="13">…`, `slides.html:25913` — outside the svgs, invisible to the exporter's `section` selector), then two scripts: Marp Core's browser script injected inside the *last* slide's foreignObject (`slides.html:25912`) and the bespoke viewer (`slides.html:25915-25916`). The wrapper id `:$p` is hardcoded in the bundled viewer (`document.getElementById(":$p")` in the script text) — constant for marp-cli 4.3.1 outputs; stevedore never references it (its selectors are `svg[data-marpit-svg]` and `section`).

**What sets the viewBox.** The theme declares named sizes in metadata, embedded verbatim in the generated CSS comment (`slides.html:2-9`): `@theme default`, `@author Yuki Hattori`, `@auto-scaling true`, **`@size 16:9 1280px 720px`**, **`@size 4:3 960px 720px`**. LAND.E's markdown has no `theme:`/`size:` directive (frontmatter is only `marp/html/style`, `slides.md:1-4`), and all 20 viewBoxes are `0 0 1280 720` — so the **default is the theme's 16:9 = 1280×720** (sourced both ways: declaration + emitted markup). A `size` directive (frontmatter `size: 4:3` or a `<!-- size: 4:3 -->` comment) selects one of the theme-declared sizes **[training-data assumption on the directive syntax]**; 4:3 then produces `viewBox="0 0 960 720"` per the declared `@size 4:3 960px 720px` (consistent with Q3's 4:3 probes and the 720×540 pt page math). Custom themes can declare arbitrary additional `@size <name> <W>px <H>px` entries **[training-data assumption — generalizes the observed syntax]**. The chosen size lands in four agreeing places (see Q2).

**Why sections end up viewport-scaled.** The svg carries a fixed viewBox but gets its *element size from CSS*, and the CSS sizes it to the viewport:

- **Bespoke output (the shape we actually handle):** the viewer script runs on load and stamps the DOM — `e.parent.classList.add("bespoke-marp-parent")` on `div#:$p`, `e.slides.forEach(e=>e.classList.add("bespoke-marp-slide"))` on every svg, `data-bespoke-view=""` on `<body>` (all quoted from the embedded script, `slides.html:25916`). The viewer CSS then does: `body,html{height:100%;margin:0}`, `body{background:#000;overflow:hidden}`, `body[data-bespoke-view=""] .bespoke-marp-parent{inset:0;position:absolute}`, `body[data-bespoke-view=""] svg.bespoke-marp-slide{height:100%;left:0;position:absolute;top:0;width:100%}` (`slides.html:1`). Net effect: **each svg element is exactly the viewport rect** (100%×100% of an inset:0 parent). Marpit's own scaffold rule `svg[data-marpit-svg]{display:block;height:100vh;width:100vw}` exists in this deck **only under `@media print`** (`slides.html:1`) — on screen the bespoke 100%×100% rules do the sizing; numerically identical to 100vw/100vh.
- With viewBox + default meet, the 1280×720 user units map uniformly into the viewport rect: **scale = min(vw/W, vh/H), centered** — the section (fixed `width:1280px;height:720px` CSS inside the foreignObject) renders at natural × that scale. This is assumption (b), confirmed by construction and by probes: B2 (viewport 2560×1440, dsf 2 → 5120×2880 = 2×natural × 2), F (960×720 deck in 1280×720 → 960×720, scale pinned to 1), G (1920×720 in 1280×720 → 1280×480, scale 2/3).
- **Plain Marpit output (no bespoke viewer):** same `svg > foreignObject > section` wrapper and same viewBox encoding, but the scaffold's `svg[data-marpit-svg]{height:100vh;width:100vw}` rule is the *screen* sizing, all slides are visible (nothing hidden), no osc/notes/viewer script **[training-data assumption — corroborated by (i) the print rule's presence in this deck, (ii) the research fixture `/tmp/stevedore-research/fixture-marp43.html`, which replicates that shape and reproduced the same min() behavior in probes F/G]**.
- The bespoke viewer also **hides inactive slides**: `svg.bespoke-marp-slide{content-visibility:hidden;interactivity:inert;opacity:0;pointer-events:none;z-index:-1}` with only `.bespoke-marp-active` visible (`slides.html:1`). The exporter neutralizes exactly this with its flatten CSS — `svg[data-marpit-svg]{position:static!important;opacity:1!important;content-visibility:visible!important;z-index:auto!important;pointer-events:auto!important}` + `.bespoke-marp-osc{display:none!important}` (`02-worktrees/master/scripts/export-slides.mjs:85-95`; the block's comment names "The Marp bespoke viewer hides inactive slides" explicitly). After flattening, the svgs stack statically (still viewport-sized: height/width 100% resolve against the absolutely-positioned parent) and slides beyond the first are captured via CDP `captureBeyondViewport` (Q3) despite `body{overflow:hidden}` — empirically fine, witness reproduced byte-identically (probe A2). On plain Marpit output the flatten rules are no-ops.

#### Q2 — where the natural slide size is authoritatively encoded

Four encodings, all agreeing, all deck-global — sourced from `slides.html`:

| Encoding | Where | Value (LAND.E) |
|---|---|---|
| svg `viewBox` attribute | each `svg[data-marpit-svg]` (20/20) | `0 0 1280 720` |
| `foreignObject` width/height attributes | each wrapper (20/20) | `1280` / `720` |
| scaffold/theme CSS section rule | `slides.html:1`: `div#\:\$p > svg > foreignObject > section{width:1280px;height:720px;box-sizing:border-box;overflow:hidden;position:relative;scroll-snap-align:center center;…}` | 1280×720 px |
| `@page` print size | `slides.html:1`: `@page {size:1280px 720px;margin:0}` | 1280×720 px |

There are **no `--marpit-*` size custom properties**: the only Marpit custom property in the deck is `--marpit-root-font-size` (font-size base for auto-scaling — `--base-size-16:calc(var(--marpit-root-font-size, 1rem) * 1)`, `slides.html:1`) alongside viewer vars (`--marp-bespoke-transition-*`). Slide dimensions are not exposed as CSS custom properties at all.

**Uniformity:** yes — 20/20 slides carry identical viewBox/foreignObject/section-size. Size is deck-global in Marpit: one size per document; per-slide size changes are not a Marpit feature **[training-data assumption; empirically 20/20 identical here]**. The plan's first-svg read (`document.querySelector('svg[data-marpit-svg]')`) is therefore sound for genuine Marpit output; only hand-edited decks could violate it (the plan documents the null-fallback). Best single source: the **viewBox** (what plan 03-02's Edit 6 reads); `foreignObject` attributes are a belt-and-braces cross-check (same numbers, also plain attributes). Reading computed section CSS would be the fragile option — the scoping prefix (`div#:$p > svg > foreignObject >`) is a template-specific artifact.

#### Q3 — variations in Marp output that could bite the exporter

1. **Different sizes (4:3, custom):** handled. The size flows identically into viewBox/foreignObject/section CSS/@page (Q2), so the auto-tracking read picks up any declared size; the PDF page math already covers 4:3 (720×540 pt) and arbitrary aspects (`540 × W/H`).
2. **Plain Marpit output without the bespoke viewer:** same wrapper shape and size encodings; svg sized 100vw/100vh on screen **[training-data assumption, corroborated — see Q1]**; all sections visible. The exporter works as-is (flatten = no-op). The inverse dependency is worth knowing: on **bespoke** decks the capture presumes the viewer script has run (it sets the classes/`data-bespoke-view` the flatten CSS and screen sizing key off) — guaranteed in our pipeline by `goto(…, networkidle)` with synchronous classic scripts, and empirically proven (A2). If a bespoke deck were ever captured with JS disabled, geometry would change (svgs fall back to replaced-element default sizing). Not our pipeline; noted for completeness.
3. **Multiple/differing viewBoxes:** not produced by Marpit (deck-global size, Q2). First-svg read is first-wins — fine; exotic/hand-edited decks hit the documented null-fallback.
4. **Padding/overflow:** the scaffold pins `section{…box-sizing:border-box;overflow:hidden;position:relative;…}` (`slides.html:1`) — element capture includes padding and clips overflow, exactly like the converter's `.pp-slide`. A `paginate: true` deck adds a page-number overlay via `section::after{content:attr(data-marpit-pagination)…}` (scaffold rule, `slides.html:1`) — it renders inside the section (bottom-right) and is captured, which matches Marp's own semantics. LAND.E doesn't paginate (no `data-marpit-pagination` attributes on any section — grep).
5. **Inline vs external themes:** marp-cli bakes everything inline — the default theme and the `style:` frontmatter CSS both live in the head `<style>` (`slides.html:10` contains the custom `section.fill-media` rules, scoped; the per-section `data-style`/`--style:` duplicates are inert). Custom themes via `--theme-set` land the same way **[training-data assumption]**. Nothing external to fetch; the rendered DOM is self-contained, so theme provenance is irrelevant to capture.
6. **Fragments:** the bespoke viewer hides not-yet-revealed fragments — `[data-bespoke-marp-fragment=inactive]{visibility:hidden}` (`slides.html:1`) — and initializes every slide at fragment 0 (script logic, `slides.html:25916`). A fragmented deck therefore captures each slide in its **first fragment state**. LAND.E has none (no `data-marpit-fragment` attributes outside the script itself — grep). Semantic variation, not a geometric one.
7. **Auto-scaling (`@auto-scaling true`):** Marp Core's browser script defines `marp-auto-scaling` custom elements that wrap fit-marked content (`<!-- fit -->` headings, code blocks) in shadow-DOM `svg > foreignObject > span` and scale it with ResizeObservers + rAF (script text, `slides.html:25912`). LAND.E uses none (no `data-auto-scaling`/`marp-auto-scaling` in any section — grep). For decks that do, scaling is size-deterministic but settles asynchronously — see Risks.
8. **Letterbox color:** the viewer sets `body{background:#000}` (`slides.html:1`) — letterbox bars live outside the section's clip, so element captures never include them; at a tracked viewport the bars are zero-width anyway.
9. **Marp's own print path (context, not a hazard):** `@page{size:1280px 720px;margin:0}` + `@media print{…svg[data-marpit-svg]{display:block;height:100vh;width:100vw}}` + per-section `page-break-before:always` (`slides.html:1`) — that is how `marp --pdf` sizes pages via chromium print. Stevedore's bundler instead fixes 540 pt height × aspect (CONTEXT decision 4) — same aspect, different page unit; no conflict.
10. **The "23 data-marpit-svg" count, decomposed:** the file contains the string 23 times — **20 slide-wrapper svg elements** (one per slide) + 1 print-CSS selector (line 1) + 1 `svg[data-marpit-svg] > …` scaffold selector deep inside line 10 (that line is 57.2 KB — beyond the read tool's per-line limit, so the rule's exact body isn't extractable here) + 1 in Marp Core's script (`querySelectorAll("svg[data-marpit-svg]")`, line 25912). 20 slides, 20 wrapper svgs — the plan's own standing-facts wording ("20 `<section>` slides, each wrapped in …") is the accurate one.

#### Q4 — verdict on assumption (c) for plan 03-02

**Confirmed: "viewport = viewBox size + deviceScaleFactor" is the correct general capture mechanism for Marp decks.** The geometry is now fully sourced (Q1/Q2):

- The **viewBox is the authoritative natural-size read**, and plan 03-02 Task 2's Edit 6 regex `^[\d.]+ [\d.]+ (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)$` matches the actual emitted format `0 0 1280 720` (sourced, 20/20). Marpit always emits `0 0 W H` origin **[training-data assumption — evidenced 20/20 here]**.
- Setting the viewport to exactly W×H makes the meet-scale exactly `min(1,1) = 1` → every section renders at its natural CSS size → element capture = ceil(rect) × dsf = **natural × dsf**, at any aspect or size. The full family of failure modes *without* tracking is empirical: **shrink** when the natural size exceeds the viewport in any dimension (probe G: 1920×720 → 1280×480 at scale 1 — also the default-mode hazard, below); **compounding** when the viewport exceeds natural at dsf > 1 (probe B2: 5120×2880); **benign letterbox** when aspects differ but scale stays 1 (probe F: 4:3 in a 16:9 viewport still captures 960×720 = natural, because min(1280/960, 720/720) = 1).
- **deviceScaleFactor is exactly multiplicative** (probes B, C2, D2 — including ceil-then-double on fractional rects), emits color type 2, and is byte-stable across relaunches (`/tmp/stevedore-research/report.json`).

**Concrete notes for the plan — none block approval; all are wording/doc-level or minor hardening** (the choice stays with the planner):

1. **Comment precision (Edit 6):** the inserted comment says the svg is "100vw/100vh". For bespoke decks the literal screen sizing is `height:100%;width:100%` of an `inset:0` parent (the 100vw/100vh rule is print-only there — Q1). Numerically identical, but the comment could mislead a future maintainer debugging bespoke decks. Cosmetic.
2. **Default-scale doc line (Edit 9):** at scale 1 the auto-tracking deliberately does not engage (witness stability — correct). Worth one explicit README sentence: *at default scale, a Marp deck whose natural size exceeds 1280×720 in either dimension captures shrunk* (probe G generalized — e.g. a 4K 16:9 deck in the 1280×720 viewport exports 1280×720 at ⅓ scale); decks ≤ 1280×720 (including 4:3) capture at natural size by the min() rule. LAND.E sits exactly at the boundary, which is why the witness works.
3. **First-svg-wins** is correct for Marpit's deck-global size (Q2); the `.pp-slide` fallback (offsetWidth/Height) covers the converter shape; custom selectors document the null path. As designed.
4. **Fractional viewBox → `Math.round` → integer `setViewportSize`:** a non-integer theme size would make the meet-scale ≠ exactly 1 and can cost a ceil-pixel. Marpit's declared sizes are integer px (both theme-declared sizes here are) — edge case only.
5. **Sequence detail, unprobed in exactly the plan's order:** Edit 6 calls `page.setViewportSize` *after* load (read the natural size from the live DOM), whereas probes C3/C4 fixed the viewport at context creation. For Marp decks the resize is a pure-CSS reflow (no viewport-dependent JS except the auto-scaling observers, unused in LAND.E), and the plan's `--scale 2` verification gate (20 × 2560×1440) will catch any surprise. Low risk.
6. **PDF geometry:** 7.5 in-height pages at aspect width are aspect-faithful to Marp's own `@page` approach (1280×720 px ↔ 960×540 pt) — no correction needed.

**Assumptions (a) and (b), explicitly:** (a) confirmed 20/20 — with one caveat: Marpit can render *without* the svg wrapper when its inline-SVG mode is disabled (sections directly in the document at fixed CSS px) **[training-data assumption]**; the exporter's viewBox probe then returns null and the capture still works at natural size via captureBeyondViewport with dsf still multiplying — the mechanism degrades gracefully. (b) confirmed exactly — rendered rect = natural × min(vw/W, vh/H), by the sourced CSS chain and probes B2/F/G; the only precision is *which* CSS provides the viewport-sized svg (bespoke 100%×100% vs plain 100vw/100vh — Q1).

### Recommendation

Plan 03-02's Task 2 viewport auto-tracking design is sound as drafted: approve assumption (c) as-is. Optional, non-blocking polish for the planner to weigh: (i) reword Edit 6's comment to "viewport-sized svg (bespoke: 100%×100% of an inset:0 parent; plain Marpit: 100vw/100vh)" per note 1; (ii) add the one default-scale shrink caveat sentence to `render/README.md` per note 2. Neither affects the witness gate, the `--scale`/`--pdf` semantics, or the PDF geometry. The decision is the user's in the orchestrator session.

### Risks / unknowns

- **Marpit repo not consulted directly** (no shell/network in this agent; no on-disk copy — method note). The marked **[training-data assumption]** claims that a networked fetch of github.com/marp-team/marpit would confirm or correct: the `size`/`_class` directive syntax, the plain-output screen rule (`svg[data-marpit-svg]{height:100vh;width:100vw}`), the inline-SVG-off shape, deck-global size semantics, custom `@size` generality, and that marp-cli bundles marp-core/marpit. Every one of them is corroborated by the deck, its embedded scripts, or the probes — but "corroborated" is not "repo-sourced".
- **Marpit/marp-core versions unpinned:** the deck pins marp-cli 4.3.1 (bespoke.js license URL, `slides.html:25915`) but the marpit/marp-core versions bundled within it are not identifiable from the deck. All behavior claims above are pinned to *the code actually embedded in slides.html* — which is the ground truth stevedore must handle regardless.
- **Auto-scaling decks at non-default scale are unprobed:** LAND.E contains no `marp-auto-scaling` elements, so byte-stability of dsf≠1 captures for fit-content decks (ResizeObserver/rAF settle vs the exporter's networkidle+fonts.ready waits) is a hypothesis, not a probe result.
- **Fragments capture first-state-only** on bespoke decks (sourced CSS) — correct-by-viewer semantics, but a semantic surprise if fragmented decks ever enter the comparison set; LAND.E has none.
- **Line 10 of slides.html (57.2 KB) is unreadable by this agent's line-based tools** — the exact body of the one `svg[data-marpit-svg] > …` scaffold rule living there is unverified (its existence and selector prefix are grepped facts). It does not affect any conclusion above (screen sizing is fully accounted for by the bespoke rules), but it's an honest extraction gap.
