// 01-06 task 2: speaker notes, p14 sections, hidden-slide flags, document
// metadata — all four document-level leftovers in the single-file output.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { loadPresentation } from '../src/pptx/presentation.js';
import { OpcPackage } from '../src/opc/package.js';
import { Diagnostics } from '../src/pptx/context.js';
import { buildDeck } from './lib/deck.mjs';

// the plan fixture: 3 slides, slide 2 hidden, slide 1 carries a two-paragraph
// notesSlide, one section naming slides 1+2 ("Intro") and one naming slide 3
// ("End"); no docProps/core.xml -> title falls back to slide-1 title text
function fixture() {
  return buildDeck({
    masters: [{}],
    sections: [{ name: 'Intro', slides: [1, 2] }, { name: 'End', slides: [3] }],
    slides: [
      { texts: [{ text: 'Opening Title', title: true }], notes: ['First note.', 'Second <note>.'] },
      { texts: [{ text: 'Hidden middle' }], hidden: true },
      { texts: [{ text: 'Last slide' }] },
    ],
  });
}

function load(bytes) {
  const pkg = new OpcPackage(bytes);
  const diag = new Diagnostics();
  return { presentation: loadPresentation(pkg, diag), diag };
}

test('hidden slide: data-hidden="true" + hidden attr on its .pp-slide div; CSS rule present; only slide 2 flagged', () => {
  const { html } = convert(fixture());
  assert.match(html, /<div class="pp-slide" data-hidden="true" hidden data-slide-index="2"/,
    'slide 2 div carries both the flag and the HTML hidden attribute');
  assert.equal((html.match(/data-hidden/g) ?? []).length, 1, 'exactly one hidden slide');
  assert.ok(html.includes('.pp-slide[hidden]{display:none}'), 'BASE_CSS hides flagged slides');
  assert.doesNotMatch(html, /data-hidden="true" hidden data-slide-index="1"/);
  assert.doesNotMatch(html, /data-hidden="true" hidden data-slide-index="3"/);
});

test('speaker notes: hidden <aside class="pp-notes"> inside slide 1 with concatenated paragraphs, "<" escaped', () => {
  const { html } = convert(fixture());
  assert.ok(html.includes('<aside class="pp-notes" hidden>'), 'aside present');
  assert.ok(html.includes('First note.\nSecond &lt;note&gt;.'),
    'both paragraphs concatenated (paragraph break = newline), < escaped at render');
  assert.equal((html.match(/<aside class="pp-notes"/g) ?? []).length, 1, 'only the notes slide gets an aside');
  // the aside rides inside the slide div (before its close), not after it
  const aside = html.indexOf('<aside class="pp-notes"');
  const slide1 = html.indexOf('data-slide-index="1"');
  const slide2 = html.indexOf('data-slide-index="2"');
  assert.ok(aside > slide1 && aside < slide2, 'aside is inside the slide-1 div');
});

test('sections: pp-sections-json parses to [{Intro:[1,2]},{End:[3]}], exactly once per document', () => {
  const { html } = convert(fixture());
  const scripts = [...html.matchAll(/<script type="application\/json" class="pp-sections-json">([^<]*)<\/script>/g)];
  assert.equal(scripts.length, 1, 'present exactly once');
  assert.deepEqual(JSON.parse(scripts[0][1]), [
    { name: 'Intro', slides: [1, 2] },
    { name: 'End', slides: [3] },
  ]);
});

test('<title> falls back to slide-1 title text when dc:title absent; dc:title wins when present; "Deck" last', () => {
  assert.ok(convert(fixture()).html.includes('<title>Opening Title</title>'),
    'no core.xml -> first title-placeholder text of slide 1');
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Named Deck</dc:title></cp:coreProperties>';
  const named = convert(buildDeck({
    slides: [{ texts: [{ text: 'Opening Title', title: true }] }],
    extraParts: [{ name: 'docProps/core.xml', data: core }],
  }));
  assert.ok(named.html.includes('<title>Named Deck</title>'), 'dc:title wins over the placeholder fallback');
  const bare = convert(buildDeck({ slides: [{ texts: [{ text: 'no titles here' }] }] }));
  assert.ok(bare.html.includes('<title>Deck</title>'), 'final fallback is Deck');
});

test('model level: notes string on the slide, sections carry raw r:ids and resolved indices', () => {
  const { presentation } = load(fixture());
  assert.equal(presentation.slides[0].notes, 'First note.\nSecond <note>.');
  assert.equal(presentation.slides[1].notes, null); // hidden slide without notes
  assert.deepEqual(presentation.sections, [
    { name: 'Intro', slideIds: ['rSlide1', 'rSlide2'], slides: [1, 2] },
    { name: 'End', slideIds: ['rSlide3'], slides: [3] },
  ]);
});

test('no sections in the deck -> no pp-sections-json emitted (zero, not empty)', () => {
  const { html } = convert(buildDeck({ slides: [{ texts: [{ text: 'x' }] }] }));
  assert.equal((html.match(/pp-sections-json/g) ?? []).length, 0);
});
