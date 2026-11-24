---
issue: "#60"
wave: 5
depends_on: []
target: stevedore
fixes: 02-02
---

# Plan 02-FX1: Attribute-safe font stacks — style attributes no longer terminate mid-declaration

**Objective:** Close VERIFICATION.md gap 1 (post-verdict addendum, 2026-11-23): the converter emits `style="...font-family:"-apple-system", Calibri, sans-serif;..."` — the inner double quote (from `fontFamily` in `scripts/src/render/fonts.js:27`, interpolated at `scripts/src/render/text.js:125`) terminates the HTML attribute mid-declaration, so browsers parse only `font-size` (emitted first) and silently drop font-family, font-weight, font-style and color. Every styled span is hit; the committed canonical artifacts render titles as default serif (`tests/land-e-roundtrip.html` slide 9 is the canonical case; renders visible in `tests/exports/roundtrip/*.png`). The plan-level fix is decided by the gap text: escape or single-quote attribute values + a regression test with a quoted font stack + sweep the suite. Implementation choice within that decision: **single-quote the font name** (CSS-valid, attribute-safe, keeps the emitted HTML readable) and lock it with a document-wide sweep test. This is the converter half of the visual sign-off rejection; the exporter size half is 02-FX2, the artifact/breakdown half is 02-FX3.

**Standing facts:** same as 02-02 (bun not npm; the glob form `node --test scripts/test/*.test.mjs` — the directory form fails on this Node; example regen via `node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o …`; commits atomic with subject prefix `(02-FX1): …`; no `00-supporting-files/` content on stevedore). Verified at plan time: `fontFamily` is called only from `scripts/src/render/text.js:101`; every other emitted style value is a number/hex/keyword, so the quoted font name is the only attribute-breaking value today; `scripts/test/render-text.test.mjs` is the render-side test file (fixture runs support `{ t, sz, b, latin, color }` — `scripts/test/lib/deck.mjs:35` builds `<a:latin typeface="${run.latin}"/>`); the bug signature `font-family:"` appears throughout the committed `scripts/examples/land-e/deck.html` (the sweep's before/after counts come from there).

## Tasks

<task>
<name>Task 1: Single-quote emitted font stacks and lock it with regression tests</name>
<files>scripts/src/render/fonts.js, scripts/src/render/text.js, scripts/test/render-text.test.mjs</files>
<action>
**The edit — `scripts/src/render/fonts.js`, last line of `fontFamily` (currently line 27).** Current:

```js
  return `"${name}", ${fallback}, ${generic}`;
```

Fixed:

```js
  // (02-FX1) single-quoted name. A double-quoted family inside a style="…"
  // attribute terminated the attribute mid-declaration, so browsers applied
  // only font-size and silently dropped font-family/font-weight/font-style/
  // color (VERIFICATION gap 1). CSS single-quoted strings are valid
  // font-family names and carry no HTML-attribute meaning; embedded single
  // quotes are backslash-escaped per the CSS spec.
  return `'${name.replace(/'/g, "\\'")}', ${fallback}, ${generic}`;
```

(`name` is the resolved face; the `+mj/+mn` theme resolution above it is untouched. The fallback and generic families stay unquoted as today — identifier tokens, attribute-safe.)

**Comment touch-up — `scripts/src/render/text.js`, file header lines 8–9.** Replace the sentence "all font-family values are quoted." with:

```
// all font-family values are single-quoted (attribute-safe — 02-FX1).
```

**Regression tests — append to `scripts/test/render-text.test.mjs`** (imports and the `render` helper already exist at the top of that file):

```js
test('quoted font stack survives style-attribute emission — VERIFICATION gap 1 (02-FX1)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [
        { t: 'title', sz: 4000, b: true, latin: '-apple-system', color: '1F2328' },
      ] }] }],
    }],
  });
  const m = html.match(/<span style="([^"]*)"/);
  assert.ok(m, 'styled span present');
  const style = m[1];
  assert.ok(style.includes("font-family:'-apple-system'"), 'single-quoted stack inside the attribute');
  assert.ok(/font-weight:700/.test(style), 'font-weight survives (emitted after font-family)');
  assert.ok(/font-style:normal/.test(style), 'font-style survives');
  assert.ok(/color:#1f2328/.test(style), 'color survives');
  assert.ok(style.indexOf('font-family:') < style.indexOf('font-weight:700'),
    'declarations after font-family stay inside the same attribute');
});

test('no emitted attribute carries a raw double-quoted family — document sweep (02-FX1)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [
        { t: 'code', sz: 1100, latin: 'ui-monospace', color: '4B5563' },
        { t: ' plain', sz: 1100, latin: '-apple-system' },
      ] }] }],
    }],
  });
  assert.ok(!/font-family:"/.test(html), 'attribute-breaking signature: font-family:"');
  assert.ok(html.includes("font-family:'ui-monospace'"), 'monospace stack single-quoted');
  assert.ok(html.includes("font-family:'-apple-system'"), 'sans stack single-quoted');
});
```

(The first test mirrors the canonical repro — a quoted stack plus weight/color emitted after it, exactly the declarations the browser dropped.)

Commit: `fix(02-FX1): single-quoted font stacks — style attributes no longer terminate mid-declaration`.
</action>
<verify>node --test scripts/test/render-text.test.mjs</verify>
<acceptance_criteria>
- `scripts/src/render/fonts.js` contains `return `'${name.replace(/'/g, "\\'")}', ${fallback}, ${generic}`;` verbatim, and no longer contains `` `"${name}" `` anywhere
- `scripts/test/render-text.test.mjs` contains both new tests; the suite passes with the `font-family:'-apple-system'` and `color:#1f2328` assertions green
- `git diff scripts/src/render/text.js` shows only the header-comment sentence change
- `git diff scripts/src/render/fonts.js` touches only the return line + its comment block
</acceptance_criteria>
</task>

<task>
<name>Task 2: Sweep the suite and regenerate the example deck with intact style attributes</name>
<files>scripts/examples/land-e/deck.html</files>
<action>
**Step 1 — capture the pre-fix count, then regenerate** (the committed example deck carries the bug signature throughout — it was produced by the unquoted emitter):

```bash
OLD=$(grep -o 'font-family:"' scripts/examples/land-e/deck.html | wc -l)   # record in SUMMARY (expect hundreds)
node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o scripts/examples/land-e/deck.html
node scripts/pptx-to-html.js scripts/examples/land-e/deck.pptx -o /tmp/fx1-check.html
cmp /tmp/fx1-check.html scripts/examples/land-e/deck.html && echo REGEN-STABLE
NEW=$(grep -o 'font-family:"' scripts/examples/land-e/deck.html | wc -l)   # expect 0
echo "broken spans: old=$OLD new=$NEW"
```

**Step 2 — full suite sweep.** Run `node --test scripts/test/*.test.mjs`. For each failure: if the assertion encoded the double-quoted emission (e.g. a literal `font-family:"…" expectation), update it to the single-quoted form with an inline comment `// (02-FX1) attribute-safe single-quoted stacks`; if the failure is a genuine regression of the fix, fix the fix, not the test. Only touch tests that actually fail — at plan time no test asserts the double-quoted form (render-text.test.mjs:158 asserts only the `font-family:` prefix), so an empty sweep is the expected outcome.

Commit: `fix(02-FX1): sweep + example deck regenerated with intact style attributes`.
</action>
<verify>node --test scripts/test/*.test.mjs && cmp /tmp/fx1-check.html scripts/examples/land-e/deck.html && test "$(grep -c 'font-family:"' scripts/examples/land-e/deck.html)" -eq 0 && echo FX1-OK</verify>
<acceptance_criteria>
- Full glob-form suite passes (0 fail)
- Regenerated `scripts/examples/land-e/deck.html` is byte-stable (`cmp` identical)
- `grep -c 'font-family:"'` on the regenerated deck.html is 0; the pre-fix count (old=…) is recorded in the SUMMARY
- Every touched test carries the `// (02-FX1)` comment
</acceptance_criteria>
</task>

## Verification

Before declaring this plan complete:

- [ ] `node --test scripts/test/*.test.mjs` — full suite green
- [ ] Regenerated example deck: byte-stable, zero `font-family:"` occurrences, weight/style/color declarations now survive inside every `style` attribute
- [ ] No `00-supporting-files/` content touched on stevedore (purity)
- [ ] SUMMARY records old/new broken-span counts and the canonical repro (slide 9 title span)
