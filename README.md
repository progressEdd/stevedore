# stevedore — PowerPoint ⇄ HTML agent skills

A set of scripts (generated with the help of GLM 5.3) for converting between PowerPoint decks and HTML — restructured as shippEdd-style capability folders: one folder per consumer-invoked function, each self-contained (`SKILL.md` + `README.md` + its code). Shared verification machinery (comparator, auditors, round-trip) lives in top-level `scripts/`.

- **extract/** — `.pptx` → self-contained HTML. Our own zero-dependency Node engine (informed by the vendored PPTX2HTML reference).
- **export/** — HTML → `.pptx`, via the vendored dom-to-pptx fork (`export/html-to-pptx.sh`).
- **render/** — HTML deck → deterministic per-slide PNGs (`render/export-slides.mjs`), playwright on nix chromium.

## Convert a deck (extract)

Requires Node ≥ 18:

    node extract/pptx-to-html.js path/to/deck.pptx -o deck.html

Options: `--split` (per-slide folder + index.html), `--slides 1,3-5`, `--strict` (fail on any diagnostic), `-q`. Diagnostics print to stderr and list every approximated or deferred feature. See `reference/usage.md`.

## Turn HTML into a deck (export)

    export/html-to-pptx.sh path/to/deck.html -o deck.pptx

Defaults: slides selected by `section`, 13.333×7.5 in (16:9), title = input basename — pass `-s .pp-slide` for stevedore converter output. Prep once with `scripts/setup-roundtrip.sh` (builds the vendored tool; the wrapper self-wraps in `nix shell nixpkgs#chromium`).

## Render slides to PNG (render)

    nix shell nixpkgs#chromium --command env STEVEDORE_CHROMIUM_PATH=$(command -v chromium) \
      node render/export-slides.mjs path/to/deck.html -o outdir/

One PNG per slide (Marp `section` or `.pp-slide` auto-detected), captured by one deterministic tool — both sides of a round-trip comparison, apples to apples. Prep once with `scripts/setup-roundtrip.sh` (playwright install).

## Install into your repo (git subtree)

    git subtree add --prefix=.agents/skills/stevedore https://github.com/progressEdd/stevedore.git master --squash

The three capabilities land as sibling skills under `.agents/skills/stevedore/{extract,export,render}/`. Then convert with `node .agents/skills/stevedore/extract/pptx-to-html.js deck.pptx`.
Pull updates with `git subtree pull --prefix=.agents/skills/stevedore <url> master`.

## Layout

- `extract/` — the pptx→html capability: `pptx-to-html.js` (CLI), `src/` (converter library: `opc/` (zip+content-types+rels), `pptx/` (model builders), `geometry/`, `charts/`, `render/` (string emitters), `util/`), `test/` (`node --test` suites — fixtures are generated, not committed binaries), `package.json` (`"type": "module"` — load-bearing for the `.js` engine files), `SKILL.md` + `README.md`
- `export/` — the html→pptx capability: `html-to-pptx.sh` (wraps the vendored dom-to-pptx CLI), `SKILL.md` + `README.md`
- `render/` — the deck→PNG capability: `export-slides.mjs` — deterministic per-slide PNG export of any HTML deck (Marp `section` or `.pp-slide`), 1280×720; playwright-driven, pointed at nix chromium via `executablePath` — runs under `nix shell nixpkgs#chromium` with `STEVEDORE_CHROMIUM_PATH` set (see `scripts/setup-roundtrip.sh`); `test/`, `SKILL.md` + `README.md`
- `scripts/` — shared verification machinery: `compare-decks.mjs`, the four calibrated auditors `audit-{code-ink,font-metrics,gradient-paint,mono-width}.mjs` (they replicate render/export-slides.mjs's capture recipe — KEEP IN SYNC), `roundtrip.sh` (the full html → pptx → html → export → compare loop), `setup-roundtrip.sh`, `vendor-sync.sh`, `test/` (comparator tests + `lib/ink.mjs`)
- `vendor/dom-to-pptx/` — vendored fork copy of [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) (MIT; fork: progressEdd/dom-to-pptx) — the html→pptx half of the round-trip; prep once with `scripts/setup-roundtrip.sh`
- `vendor/PPTX2HTML/` — vendored reference copy of [PPTX2HTML](https://github.com/g21589/PPTX2HTML) (MIT; fork: progressEdd/PPTX2HTML) — solutions reference only, never shipped source
- `reference/` — skill reference docs (usage, fidelity, validation)

## Tests

From the skill root (Node ≥ 18; the directory form of `node --test` fails on current Node — use globs):

    node --test extract/test/*.test.mjs render/test/*.test.mjs scripts/test/*.test.mjs

The render browser test skips unless `STEVEDORE_CHROMIUM_PATH` is set (run the suite under `nix shell nixpkgs#chromium` to include it).

## Replicating the development repo

The repo used to develop this skill is **not this branch** — it's the `progressEdd` branch, which carries the full development setup: `.planning/` (the shippEdd workflow state — roadmap, phases, plans, summaries, verification), `.pi/agents/` (agent personas), and `00-supporting-files/` (test fixtures plus the canonical LAND.E round-trip artifact set — the real 20-slide worked example this skill's docs link to). To make your own copy of the development repo, fork this
repo on GitHub and check out that branch in your clone:

    git checkout progressEdd

The default branch (`master`) carries only the shipped skill.

## Credits

The scripts are  adapted from — and credited inline in the source next to — these MIT-licensed references:

- [PPTX2HTML](https://github.com/g21589/PPTX2HTML) (commit c8a96eb; fork: github.com/progressEdd/PPTX2HTML — each fix lives on its own branch there so upstream PRs stay one-click) —
  architecture mirror (opc/pptx/render), diagnostics design, color/geometry
  approaches.
- [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) (v2.1.2; fork: github.com/progressEdd/dom-to-pptx — each fix lives on its own branch there so upstream PRs stay one-click) —
  skill conventions (SKILL.md shape, reference docs), and its output decks
  are the primary compatibility target.

License: GPL-2.0-only (see LICENSE).
