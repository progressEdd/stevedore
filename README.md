# stevedore — `.pptx` → HTML agent skill

Converts PowerPoint decks to self-contained HTML with a zero-dependency
Node CLI — the inverse of dom-to-pptx. The reverse direction (`html-to-pptx`)
is reserved for a later phase.

## Convert a deck (zero dependencies)

Requires Node ≥ 18. No npm install — ever:

    node scripts/pptx-to-html.js path/to/deck.pptx -o deck.html

Options: `--split` (per-slide folder + index.html), `--slides 1,3-5`,
`--strict` (fail on any diagnostic), `-q`. Diagnostics print to stderr and
list every approximated or deferred feature. See `reference/usage.md`.

## Install into your repo (git subtree)

    git subtree add --prefix=.agents/skills/stevedore https://github.com/progressEdd/stevedore.git stevedore --squash

Then convert with `node .agents/skills/stevedore/scripts/pptx-to-html.js deck.pptx`.
Pull updates with `git subtree pull --prefix=.agents/skills/stevedore <url> stevedore`.

## Layout

- `SKILL.md` — the agent skill (this repo/branch IS the skill folder)
- `scripts/pptx-to-html.js` — the CLI
- `scripts/export-slides.mjs` — deterministic per-slide PNG export of any HTML deck (Marp `section` or `.pp-slide`), 1280×720; playwright-driven (decision 13), pointed at nix chromium via `executablePath` — runs under `nix shell nixpkgs#chromium` with `STEVEDORE_CHROMIUM_PATH` set (see `scripts/setup-roundtrip.sh`)
- `scripts/src/` — converter library: `opc/` (zip+content-types+rels), `pptx/` (model builders), `geometry/`, `charts/`, `render/` (string emitters), `util/`
- `scripts/test/` — `node --test` suites; fixtures are generated, not committed binaries
- `scripts/examples/` — worked example: real 20-slide deck + its converted HTML
- `vendor/dom-to-pptx/` — vendored fork copy of [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) (MIT; fork: progressEdd/dom-to-pptx) — the html→pptx half of the round-trip; prep once with `scripts/setup-roundtrip.sh`
- `vendor/PPTX2HTML/` — vendored reference copy of [PPTX2HTML](https://github.com/g21589/PPTX2HTML) (MIT; fork: progressEdd/PPTX2HTML) — solutions reference only, never shipped source
- `reference/` — skill reference docs (usage, fidelity, validation)

## Credits

This is our own implementation. Logic in specific spots is adapted from —
and credited inline in the source next to — these MIT-licensed references:

- [PPTX2HTML](https://github.com/g21589/PPTX2HTML) (commit c8a96eb; fork: github.com/progressEdd/PPTX2HTML — each fix lives on its own branch there so upstream PRs stay one-click) —
  architecture mirror (opc/pptx/render), diagnostics design, color/geometry
  approaches.
- [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) (v2.1.2; fork: github.com/progressEdd/dom-to-pptx — each fix lives on its own branch there so upstream PRs stay one-click) —
  skill conventions (SKILL.md shape, reference docs), and its output decks
  are the primary compatibility target.

License: GPL-2.0-only (see LICENSE).
