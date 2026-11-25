# Usage — pptx-to-html CLI reference

All paths on this page are relative to the skill root (the repo root when
cloned standalone, or `.agents/skills/stevedore/` when installed via
`git subtree add` — prefix every path below with that in subtree installs).

## Command line

```
node extract/pptx-to-html.js <input.pptx> [options]
```

Verbatim `--help` output:

```
Usage: node extract/pptx-to-html.js <input.pptx> [options]

Options:
  -o, --output <path>  Output file (default: <input>.html). With --split: output directory
      --split          Emit one HTML file per slide + index.html into the output directory
      --slides <spec>  Convert a subset, e.g. "1,3-5" (1-based)
      --strict         Exit non-zero when ANY diagnostic was recorded
  -q, --quiet          Suppress the diagnostics listing on stderr
  -h, --help           Show this help
```

## Flags in detail

| Flag | Meaning |
|---|---|
| `-o, --output <path>` | Output file path. Default: input path with `.pptx` replaced by `.html`, next to the input. With `--split`, this is the output **directory** (default `<input>-split/`). |
| `--split` | Per-slide output mode: one `slide-NN.html` page per slide plus an `index.html` with links to every slide. |
| `--slides <spec>` | Convert a subset of slides, e.g. `--slides 1,3-5` converts slides 1, 3, 4, 5 (1-based, ranges inclusive). A bad spec (`--slides 5-3`, letters) is a usage error. |
| `--strict` | Exit non-zero when **any** diagnostic was recorded — not just error-kind ones. Use in CI to pin fidelity. |
| `-q, --quiet` | Suppress the diagnostics listing on stderr. Diagnostics are still collected and still affect the exit code. |
| `-h, --help` | Print usage and exit 0. |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success. Non-error diagnostics (approximations) may still have printed — the HTML is complete and usable. |
| 1 | Conversion produced an `error`-kind diagnostic (e.g. a slide failed to load), or `--strict` saw any diagnostic at all. |
| 2 | Usage or I/O failure: missing/unknown option, no input file, unreadable input (not a zip / not a pptx), unwritable output. |

## Diagnostics

Diagnostics print to **stderr**, one per line, prefixed `pptx-to-html:` and
with `slide N: ` when slide-scoped. They are the converter telling you exactly
where fidelity was reduced — read them before reporting to the user.

| Kind | Meaning | Action |
|---|---|---|
| `error` | A part failed to load (corrupt slide XML, unreadable media, missing master). The deck still converts; the failed feature is absent or placeholder. | Investigate if the missing content matters. |
| `approx` | Rendered, but knowingly simplified (e.g. chart from cached data). | Report to user; output is still complete. |
| `unsupported` | The feature exists in the deck but this converter does not render it yet; a placeholder is emitted. | Report to user; see reference/fidelity.md for tiers. |
| `missing` | A referenced part/relationship is absent from the package (tolerated — some exporters omit optional parts). | Usually safe to ignore. |

Exit code stays 0 across `approx`/`unsupported`/`missing` lines; only
`error` (or `--strict`) turns it non-zero.

## Requirements

Node ≥ 18, standard library only. No npm install, no package downloads, no
network access — the converter is fully self-contained.
