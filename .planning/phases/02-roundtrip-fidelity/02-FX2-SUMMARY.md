---
status: complete  # complete | blocked — a blocked run still writes this record in full
duration: 25min
key-files:
  created:
    - vendor/dom-to-pptx/src/__tests__/capture-viewport.test.js
  modified:
    - vendor/dom-to-pptx/src/utils.js
    - vendor/dom-to-pptx/src/node-exporter.js
    - vendor/dom-to-pptx/bin/cli-exporter.js
    - vendor/dom-to-pptx/VENDORED.md
requirements-completed:
  - VERIFICATION-gap-2
key-decisions:
  - "Design rect for SVG-wrapped (Marp bespoke) decks comes from the svg viewBox/foreignObject, not getBoundingClientRect — the on-screen rect tracks the viewport, the viewBox is the design truth"
  - "Faithful export target = design-px × 0.75 at layout scale 1.0 (capture viewport = design rect); the plan's ≈3000/≈825 figures were estimates — the deck's actual design sizes are 37.7px title / 9.57px code → sz 2827 / 718 exactly"
deviations:
  - "Verify band [2850,3150] missed by 0.8%: max sz = 2827. The band derived from VERIFICATION.md's ~40px title estimate; the deck's measured design title is 37.7px (computed style + PNG ink), so 2827 IS the true size (0% off the real reference; plan's own ±5% bar met). Old 1414/359 gone."
  - "designRect extraction in node-exporter extended beyond the plan's getBoundingClientRect: svg viewBox → foreignObject size → bounding-rect fallback (getBoundingClientRect is viewport-derived for Marp SVG decks — task-1 probe refuted the plan's fixed-rect assumption). resolveCaptureViewport helper itself is verbatim."
  - "Plan's unconditional page.reload() after setViewport regressed inline setContent exports (fork's own vitest caught it: reload drops setContent content). Minimum repair: reload only for file/URL navigations; inline pages get the resize alone."
  - "unzip absent on this host — 7z x -so used for all pptx XML extraction (same check)."
  - "Test-data relative path from the agent worktree is ../../../../00-supporting-files/... (plan's ../../ assumes the phase's non-agent worktree shape)."
---

# Plan 02-FX2 Summary: Exporter writes true font sizes — capture viewport matches the deck's design size

dom-to-pptx now captures at the deck's own design viewport (svg viewBox 1280×720 for LAND.E) instead of the CLI's slideWidth×192 default, so slide 9's exported run sizes land at the true design sizes (sz 2827/718 vs the broken 1414/359) and the full round-trip still PASSES the comparator.

## Accomplishments

- Diagnosis proven with A/B data (see below): the defect was the exporter's layout scale dividing by the slide's on-screen rect, which for a Marp bespoke SVG deck equals the viewport (svg viewBox stretches to the window), while computed font px are viewport-independent design values. At the 2560×1440 CLI default the layout scale was 0.5 → every sz halved.
- Fork branch `fix/font-design-viewport` (off upstream v2.1.2, upstream-PR-ready): `resolveCaptureViewport` pure helper in src/utils.js (verbatim per plan), capture-viewport resolution in src/node-exporter.js, CLI no longer defaults the viewport to slideWidth×192 (explicit --bw/--bh still wins). Vitest: new capture-viewport tests 3/3; full suite 13 files / 117 passed + 1 pre-existing skip on the merged branch.
- Pushed and merged into `stevedore-combined` (fix/font-design-viewport → e5cbae6; combined → 481e934), vendor-synced; VENDORED.md carries the fork-branch entry.
- Fresh scratch round-trip: comparator PASS (mean 0.988, media survival 15/15), slide9.xml max sz = 2827 with sz="1414"/sz="359" absent; stevedore suite 150/150 green; stevedore diff confined to vendor/dom-to-pptx/**.

## Diagnosis record (task 1)

A/B sz histograms (slide9.xml, LAND.E reference, pin/puppeteer-23.11.1 build, nix chromium):

- A — shipped config (default viewport 2560×1440): `465× sz="359", 4× sz="370", 2× sz="1414"` (reproduces the committed ground truth exactly)
- B — `--bw 1280 --bh 720`: `465× sz="718", 4× sz="739", 2× sz="2827"` (exactly 2× A)
- Patched default (fix/font-design-viewport, no --bw/--bh): equals B — `465× sz="718", 4× sz="739", 2× sz="2827"`, 20 slides

Probe dumps (both viewports):

- 2560×1440: rootFontSize 16px, sectionFontSize 29px, h1FontSize 46.4px, sectionRect 2560×1440
- 1280×720: rootFontSize 16px, sectionFontSize 29px, h1FontSize 46.4px, sectionRect 1280×720
- Slide 9 specifically (side-diff): section font 29px, h2 title 37.7px, code run 9.57px at BOTH viewports; svg `viewBox="0 0 1280 720"`, foreignObject 1280×720, svg screen rect = viewport

Verdict: hypothesis confirmed in effect (wrong capture viewport → wrong sz; B moves every value 2×) but refuted in mechanism — the deck's computed font px are viewport-INDEPENDENT (design-space values inside the SVG foreignObject); what tracks the viewport is the svg's on-screen geometry, which feeds the exporter's layout scale (`scale = PPTX_IN / (rectPx/96)`; 0.5 at 2560×1440, 1.0 at 1280×720). B's values are exactly design-px × 0.75 — they do not land at the plan's estimated ≈825/≈3000 because those estimates (~11px/~40px) were high; the deck's true design sizes are 9.57px/37.7px (also confirmed by ink-band measurement of the committed reference 09.png). Task 2's fix was therefore aimed at what the data indicted (see deviations: viewBox-aware design rect).

## Task commits

1. **A/B the capture viewport and confirm (or refute) the size-capture diagnosis** — no commit (diagnosis-only task; scratch clone under $TMPDIR; findings above)
2. **Fix the capture viewport on a fork branch, vendor-sync, prove slide 9 at true size** — `8d8dd44` fix(02-FX2): vendor sync — dom-to-pptx stevedore-combined (+fix/font-design-viewport)

Fork-side commits (progressEdd/dom-to-pptx): `bacb451` fix: capture at the deck's design viewport…; `e5cbae6` fix: preserve inline setContent exports…; merged via `94217c0`/`481e934` into stevedore-combined.

## Files created/modified

- `vendor/dom-to-pptx/src/utils.js` — `resolveCaptureViewport(explicit, designRect)` pure helper (plan-verbatim)
- `vendor/dom-to-pptx/src/node-exporter.js` — after navigation: resolve pinned viewport / design rect (svg viewBox → foreignObject → bounding rect) / capture viewport; setViewport + reload at design size (inline setContent pages resize-only)
- `vendor/dom-to-pptx/bin/cli-exporter.js` — viewport left unset unless --bw/--bh given (slide inch dimensions untouched)
- `vendor/dom-to-pptx/src/__tests__/capture-viewport.test.js` — 3 vitest cases for the helper (plan-verbatim)
- `vendor/dom-to-pptx/VENDORED.md` — fix/font-design-viewport entry + Synced line updated

## Decisions & deviations

See frontmatter deviations — the four substantive ones: (1) sz band 2827 vs [2850,3150] (estimate-derived band; 2827 is the measured-true value, old values gone); (2) viewBox-aware design-rect extraction (getBoundingClientRect is viewport-derived for Marp SVG decks — probe-refuted plan assumption); (3) reload only for navigated pages (plan's unconditional reload broke inline setContent exports — caught by the fork's own suite, repaired and re-verified 117-green); (4) 7z instead of unzip (host lacks unzip). Also: the full vitest suite on the bare fix branch (v2.1.2 base, unpinned puppeteer) fails its 2 browser-launch tests on this NixOS host — pre-existing, environment-caused, green on the merged stevedore-combined (pinned puppeteer + nix chromium) which is the shipped configuration.

Observation for 02-FX3 (not this plan's surface): the roundtrip PNG capture of slide 9 drops the code-panel ink (element screenshot paints only the title + panel chrome; a clip-screenshot at the same box shows the code text). Pre-existing — the committed pre-FX2 roundtrip 09.png shows the identical gap — and out of scope here ("converter behavior is not touched here"; formal visual gate is 02-FX3's). PNG-pair verdict for this plan: title visibly matches (same x-start 38, extent 35px both sides, width 202→211px ≈ +4.5% from converter font-stack advance widths; the broken state was ~50%); code text is at true size in the pptx/DOM (sz 718 / font-size:10px vs design 9.57px) but its PNG ink gap is FX3's to close.

## Next phase readiness

- 02-FX3 (visual gate) has a concrete first lead: the element-screenshot ink loss on roundtrip slide 9 (repro: `page.screenshot({clip})` shows ink, element `.screenshot()` does not — likely a stacking/overflow interaction with the flatten CSS or pp-el layout).
- The sz ground truth for slide 9 is now 718/739/2827 (use these, not the old 1414/359 or the ≈825/≈3000 estimates, when tightening budgets).
- Comparator remains PASS end-to-end with the new viewport behavior (mean 0.988, min 0.769 on slide 5 — pre-existing drift, untouched).
