# stevedore

pptx ↔ HTML conversion skills — the inverse pair to [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx).

- `skills/` — agent skills (one `SKILL.md` folder each)
- `scripts/` — runnable scripts
- `src/` — the converter library (zero-dep, bare `node`)

In progress: a `.pptx` → HTML converter skill — hybrid layout (absolute boxes, semantic
markup inside), full-fidelity target with PPTX2HTML as reference. Consumed via
`git subtree add`; no npm packaging.

Credits: logic adapted from [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx)
and [PPTX2HTML](https://github.com/g21589/PPTX2HTML) (both MIT) is credited where used.
