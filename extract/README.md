# extract — .pptx → HTML

The pptx-to-html converter: our own zero-dependency Node engine (informed by
the vendored PPTX2HTML reference — solutions ported, never source). Hybrid
layout (absolute positioning, semantic markup), data-URI images, diagnostics
for anything approximated.

## Usage

    node extract/pptx-to-html.js <input.pptx> -o <output.html> [options]

Options: `--split` (per-slide folder + index.html), `--slides 1,3-5`,
`--strict` (fail on any diagnostic), `-q`. Requires Node ≥ 18, standard
library only — no installs, no network. Full CLI reference:
`reference/usage.md`; fidelity tiers: `reference/fidelity.md`;
post-conversion checklist: `reference/validation.md`.

A real worked example (20-slide LAND.E deck + its converted HTML + the full
round-trip artifact set) lives on the development repo's `progressEdd`
branch: `00-supporting-files/data/land-e-tests/`.

## Layout

- `pptx-to-html.js` — the CLI; `src/` — the engine (`opc/`, `pptx/`,
  `geometry/`, `charts/`, `render/`, `util/`)
- `test/` — `node --test` suites; fixtures are generated, not committed
  binaries (run from the skill root: `node --test extract/test/*.test.mjs`)
- `package.json` — `{"type": "module"}`: the engine's `.js` files are ESM
  (load-bearing — without it every import crashes as CJS)
