---
status: complete
duration: 90min
key-files:
  created: []
  modified:
    - scripts/src/pptx/slide.js
    - scripts/src/render/slide.js
    - scripts/test/media.test.mjs
    - vendor/dom-to-pptx/src/image-processor.js
    - vendor/dom-to-pptx/src/index.js
    - vendor/dom-to-pptx/src/utils.js
    - vendor/dom-to-pptx/VENDORED.md
requirements-completed:
  - "T1: re-run from reference/slides.html in place + full gap census (staging verdict, survival line, pptx-side SURVIVES/MISSING, per-slide imgs/vids, PNG export check) + three-bucket triage — recorded below"
  - "T2: converter renders pptx video parts — a:videoFile r:link resolves to image.videoPart (missing-rel diagnostic), render emits <video class=\"pp-video\" controls> with data-URI mp4 source + poster; media.test.mjs covers model + render; suite 148/148"
  - "T3: exporter-side fixes on fork branches, vendor-synced — fix/media-byte-embed (byte-exact img/video embedding) + fix/gradient-svg-stop (malformed gradient guard), both pushed, merged to stevedore-combined, vendored; final re-run media survival 15/15 PASS; defer list recorded"
key-decisions:
  - "Task 1's re-run REFUTED the strong staging hypothesis: with refs resolving, the exporter logged no image-load failures and the pptx ballooned 148KB→28.7MB with rasterized photos — but everything was html2canvas-re-encoded (0/15 byte-exact) and videos were absent entirely. The gap was exporter-side byte handling, exactly bucket (ii)"
  - "One fork fix (fix/media-byte-embed) closed all 15: <img> passes the browser-fetched ORIGINAL bytes to pptxgenjs addImage({data}) with object-fit as geometry (getObjectFitRect), <video> becomes addMedia({type:'video',data}) — repro-verified byte-exact for png/svg/mp4, then full-deck verified 15/15"
  - "Slide 5's dropped <h1> is NOT an exporter defect: the deck's own CSS hides it (section.tweet-slide :is(h1){display:none}) and Marp's own reference pptx omits it too — the comparator counts hidden source words. Slide 20's 'dropped snippet' is presenter-note content (bespoke-marp-note div, outside sections), never slide markup. Slide 9's 'dark theme' attribution was inaccurate — it renders light and its diff tints are carried (FDECEE/EBF7EE fills). No fix warranted for any of the three; recorded as findings"
  - "fix/gradient-svg-stop: generateGradientSVG's greedy regex smeared multi-background strings into stop-color=\"linear-gradient(to top\"; fixed with balanced-paren first-gradient extraction + serializable-color stop validation + <2-stops bail — verified on the exact slide-17 string, image-17-2.svg now clean"
deviations:
  - "Fixture path depth (same as 02-01…02-04): this phase's worktree nests at 02-worktrees/agent/02-roundtrip-fidelity/stevedore, so the plan's ../../00-supporting-files/… is really ../../../../00-supporting-files/… — same files, pure path arithmetic"
  - "unzip is not installed on this machine: the pptx-side census used python3's zipfile for extraction (same md5 byte-exact comparison the plan's snippet performs)"
  - "Task 1 commits nothing by its own contract (files: none) so no gh-mirror flip fired for T1; T3's flip fired after task 3's first atomic commit (media-byte-embed vendor sync) — the later gradient vendor commit shares T3's line"
  - "Model side, finishImage's mimeOf call is guarded for poster-less video pics (image.partName undefined would throw inside pkg.mimeOf) — one-line null-safety around the plan's snippet, which itself assumes a resolvable poster"
  - "Fork-side vitest: 2 node-exporter tests fail for environmental reasons (puppeteer wants a downloadable Chrome; NixOS provides chromium only via executablePath) — verified identical on pristine v2.1.2 via stash-run, so pre-existing, not a regression; 112 others pass"
  - "bun install mutates the fork checkout (package.json workspaces key, bin mode bits, bun.lock) — reverted before each vendor-sync so only real deltas sync"
---

# Plan 02-05 Summary: Re-run from reference/slides.html and close the media/fidelity gaps on both halves of the loop

The loop now round-trips byte-exactly: every one of the 15 source media files survives into the round-trip HTML verbatim (`media survival: 15/15`, comparator PASS), the three mp4 videos on slides 2/13/18 embed as real pptx video parts and render as playable `<video>` elements with data-URI sources, and all 20+20 per-slide PNG exports are non-blank on media slides.

## Task 1 census (the gap record that drove tasks 2–3)

**Step 1 — re-run** (from `reference/slides.html` in place, no staging):

```
scripts/setup-roundtrip.sh   # idempotent, SETUP-OK
RT="${TMPDIR:-/tmp}/stevedore-rt2"; rm -rf "$RT"
scripts/roundtrip.sh ../../../../00-supporting-files/data/land-e-tests/reference/slides.html "$RT"
→ exit=1 (survival gate FAIL — census below is the point)
```

**(a) Staging verdict:** the exporter logged **no image-load failures** — with refs resolving in place, the browser loaded all 15 (pptx grew from 148 KB/28 gradient parts to 28.7 MB/40 parts, carrying rasterized photos on slides 3/4/5/6/14/15/16/17). So the original run's empty media slides WERE a staging artifact for *loading* — but byte-survival did NOT collapse to a pass: everything was html2canvas-re-encoded and the videos were still entirely absent. Strong form of decision 6's hypothesis refuted; the real gap was exporter-side byte handling.

**(b) Survival + comparator (pre-fix):**

```
mean 0.988   min 0.769 (slide 5: 13→10 words)
images: source 12   converted 52  (433% of source)
media survival: 0/15 — missing: Im-Troy-Mcclure.mp4, 20260427235754.png,
  20260427093122.png, 20260427231910.png, 20260427231840.png,
  structured-outputs.png, spongebob-patrick.mp4, Evolution.png, zai-logo.svg,
  pi-logo-loop-true-vector.svg, gsd-logo-2000.svg, 3-paths.png,
  copilot-agent-dropdown.png, terminal.svg, yu-gi-oh-yugi-muto.mp4
```

**(c) pptx-side media census (pre-fix):** 0/21 files SURVIVES byte-exactly (the 15 referenced + 6 unreferenced dir-mates); the pptx's 40 parts are all re-encodings (gradient strips 577–742 B; rasterized photos 19 KB–9.3 MB); **no mp4 parts at all**.

**(d) Per-slide media presence in round-trip HTML (pre-fix):** imgs 0 on slides 2/13/18 (videos absent); 1 on 3/4/6/14/16; 3 on 5/15; 7 on 17; 2 on 8/9/10/11 (gradient pairs); vids 0 everywhere.

**(e) PNG export check (pre-fix):** 20 exports; media slides 3/4/5/6/14/15/16/17 non-blank (19 KB–679 KB); **slides 2/13/18 blank (4254 B each)**.

**Step 3 — triage:**
- **(i) converter-side (in pptx, not rendered by us): EMPTY** — everything in the pptx rendered (52 imgs). The anticipated video-part gap stayed latent (no mp4s in the pptx yet) — task 2 built the support anyway, per plan.
- **(ii) exporter-side media: ALL 15** — 12 raster/svg present only as re-encodings (byte gate fails), 3 mp4s absent entirely → task 3.
- **(iii) formatting-only:** slide 5 `<h1>` dropped (13→10 words), slide 20 snippet text dropped, slide 9 "dark theme", slide 17 malformed gradient SVG; slide 19 literal bullets verified OK on re-run (• glyphs present, 17/17 words) — removed from the worklist.

## Final state (post tasks 2–3, scratch re-run from the vendored copy)

```
media survival: 15/15 (all source media present)   PASS   ROUNDTRIP-OK
grep -c 'data:video/mp4' land-e-roundtrip.html → 3
slides 2/13/18: 1 <video> + 1 data:video/mp4 each
pptx: 50 media parts / 8.1 MB — 15/15 source files byte-exact (md5-verified)
exports: reference 20 + roundtrip 20; 02.png 27413 B, 13.png 26374 B,
18.png 25000 B (were 4254 B blanks); photos 171–730 KB
per-slide imgs/vids: 2/13/18 vids 2; 3/4/6/14/16 imgs 1; 5/15 imgs 3; 17 imgs 7
node --test scripts/test/*.test.mjs → 148/148 pass
```

## Accomplishments

- Converter (`scripts/src/pptx/slide.js`): `p:pic` with `p:nvPicPr/p:nvPr/a:videoFile r:link` resolves the rel into `image.videoPart` (missing-rel diagnostic on unresolvable rIds); the blip stays the poster; poster-less videos still render
- Converter (`scripts/src/render/slide.js`): `videoPart` emits `<video class="pp-video" controls poster=… style="width:100%;height:100%;object-fit:contain"><source src="data:video/mp4;base64,…" type="video/mp4">` — the bytes land base64, exactly what the survival gate scans for
- Fork `fix/media-byte-embed` (off v2.1.2, pushed, merged to stevedore-combined): `fetchOriginalDataUrl` hands pptxgenjs the browser-fetched original bytes; object-fit/position become geometry (`getObjectFitRect`, same math the canvas path used); rounded corners and fetch failures keep the canvas fallback; new `<video>` branch emits `addMedia({type:'video', data})`; render loop + queue filter handle 'media' items. Byte-exact repro (png 73 B, svg 11036 B, mp4 138528 B → identical md5s in ppt/media), then full-deck 15/15
- Fork `fix/gradient-svg-stop` (off v2.1.2, pushed, merged): balanced-paren first-gradient extraction + serializable-color stop validation + <2-stops bail; slide 17's `image-17-2.svg` no longer carries `stop-color="linear-gradient(to top"`
- Both vendor-synced into `vendor/dom-to-pptx` with VENDORED.md listing branches + deltas; `git ls-remote` shows `fix/media-byte-embed`, `fix/gradient-svg-stop`, `stevedore-combined`, `pin/puppeteer-23.11.1`
- Investigated the three "dropped formatting" items to ground truth (see decisions): none is an exporter defect — slide 5's h1 is display:none by the deck's own CSS (Marp's reference pptx omits it too), slide 20's snippet is presenter-note content, slide 9 renders light with its tints carried; dark slides 5/17 ride their #000 backgrounds through as full-slide rect fills (present in pptx and round-trip HTML)

## Task commits

1. **Re-run + gap census** — no commit (verify-only task; census recorded here per the plan's files contract)
2. **Converter renders video parts** — `ca7f75c` feat(02-05): converter renders pptx video parts as <video> with poster (data-URI source)
3. **Exporter fixes, vendored** — `94e2f67` chore(02-05): vendor sync — dom-to-pptx stevedore-combined (fix/media-byte-embed); `b607347` chore(02-05): vendor sync — dom-to-pptx stevedore-combined (+ fix/gradient-svg-stop)

## Files created/modified

- `scripts/src/pptx/slide.js` — a:videoFile r:link → image.videoPart (poster stays blip; poster-less null-safety)
- `scripts/src/render/slide.js` — `<video class="pp-video">` emission in the el.image branch
- `scripts/test/media.test.mjs` — video pic fixture: model asserts videoPart + poster part names, render asserts `<video class="pp-video" controls`, `data:video/mp4;base64` source, poster, sniffed type
- `vendor/dom-to-pptx/src/image-processor.js` — fetchOriginalDataUrl + getObjectFitRect (vendored from fix/media-byte-embed)
- `vendor/dom-to-pptx/src/index.js` — img byte-exact fast path, video → media branch, addMedia in render loop (vendored)
- `vendor/dom-to-pptx/src/utils.js` — generateGradientSVG guard (vendored from fix/gradient-svg-stop)
- `vendor/dom-to-pptx/VENDORED.md` — branch list + deltas + date

## Defer list (decision 8 — hands off to plan 02-06; no gate was loosened)

- slide 5 `<h1>` "How it Started": hidden by the deck's own CSS (`section.tweet-slide :is(h1,marp-h1){display:none}`); Marp's reference pptx omits it too — round-trip is faithful; the 0.769 jaccard is the comparator counting hidden source words — deferred to a comparator-visibility decision (visibility-aware word counting), not an exporter fix
- slide 20 literal snippet: presenter-note content (`div.bespoke-marp-note[data-index=13]`), outside every `<section>` — out of the loop's scope by construction; nothing to fix
- `<p:bg>` structural nicety: dark section backgrounds (slides 5/17) ride as full-slide `#000` rect shapes through both halves; a true `<p:bg>` element would be cosmetic polish needing an upstream-design decision (element-walk vs slide-background model) — deferred
- slide 9 "dark theme": closed as verified-OK — research's attribution was inaccurate; slide 9 renders light and its diff tints (FDECEE/EBF7EE) are carried as fills
- pptxgenjs SVG note: SVGs embed byte-exactly but pptxgenjs pairs each with a rasterized PNG preview part (its own compatibility design) — additive only, survival unaffected; flagged for awareness

**Survival OPEN ITEM: none** — 15/15 achieved; nothing silently absorbed.

## Decisions & deviations

Decisions: plan code applied as written for task 2 (model snippet inserted before poster resolution, render snippet in the el.image branch, fixture follows the existing pattern — the video pic is raw-XML via the suite's established `shapes` seam so deck.mjs stays untouched, keeping the task's file list exact); task 3 followed the per-fix procedure verbatim (branch off v2.1.2 → repro verify → push → merge --no-ff into stevedore-combined off the pin → push → vendor-sync → VENDORED.md → re-run and measure after every merge — both merges re-measured 15/15).

Deviations: the six frontmatter items — path depth (standing, all plans), python3-zipfile census (unzip absent), T1/T3 mirror-flip timing, the poster-less mimeOf guard, the fork's environmental vitest failures, and bun's checkout noise reverted before syncing. No code deviations from the plan's snippets.

## Next phase readiness

- The bar is met end-to-end: survival 15/15, videos render on 2/13/18, 20+20 PNGs, suite green — plan 02-06's committed-pair regeneration can now produce a post-fix pair that passes the survival gate from a clean re-run
- Fork branches are upstream-PR-ready (each off v2.1.2, no pin stacked in); stevedore-combined carries pin + both fixes for the skill's vendored half
- The defer list above is 02-06's input: comparator visibility accounting is the only substantive follow-up (slide 5's 0.769 is the sole sub-1.000 jaccard and it is a comparator artifact, not a conversion loss)
