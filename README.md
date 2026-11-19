# stevedore — `.pptx` → HTML agent skill

An agent skill that converts PowerPoint decks to native HTML/CSS — our own zero-dependency
Node implementation (no `npm install`, bare `node`), the inverse of
[dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx).

## Install (git subtree)

    git subtree add --prefix=.agents/skills/stevedore https://github.com/progressEdd/stevedore.git stevedore --squash

## Run

    node .agents/skills/stevedore/scripts/pptx-to-html.js deck.pptx -o deck.html

- `scripts/pptx-to-html.js` — the CLI
- `scripts/src/` — the converter library (zero-dep: `node:` built-ins only)
- `scripts/test/` — test suite (`node --test scripts/test/`)

Reverse direction (`skills/html-to-pptx/`) is reserved for a later phase.

Credits: logic adapted from [PPTX2HTML](https://github.com/g21589/PPTX2HTML) (`c8a96eb`) and
[dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) (`v2.1.2`) — both MIT — is credited
where used.
