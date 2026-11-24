// Semantic text render tests (adapted from PPTX2HTML, MIT) — bulleted char
// lists as real <ul> with the char in an aria-hidden span, auto numbers as
// <ol>, fields resolve to the live slide index, the 18-variant underline map,
// autofit fontScale at emit time, javascript: links never reach href, and
// vertical text maps to writing-mode.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { buildDeck } from './lib/deck.mjs';

const render = (spec, opts) => convert(buildDeck(spec), opts);

const BU = '<a:pPr marL="228600" indent="-228600">';

test('char bullets: <ul> + list-style-type:none + the bullet char, hanging indent', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [
        { pPr: `${BU}<a:buChar char="•"/></a:pPr>`, runs: [{ t: 'first' }] },
        { pPr: `${BU}<a:buChar char="•"/></a:pPr>`, runs: [{ t: 'second' }] },
      ] }],
    }],
  });
  assert.ok(html.includes('<ul>'), 'real <ul> container');
  assert.ok(html.includes('list-style-type:none'), 'native markers off for char bullets');
  assert.ok(html.includes('<span aria-hidden="true">• </span>'), 'the bullet char itself, aria-hidden');
  assert.ok(/padding-left:24px/.test(html), 'marL -> 24px block indent');
  assert.ok(/text-indent:-24px/.test(html), 'signed hanging indent -24px');
  assert.ok(/<li[^>]*>.*first/.test(html.replace(/\n/g, '')), 'items are semantic <li>');
  assert.ok(html.includes('</ul>'), 'list closes');
});

test('auto bullets: <ol> with decimal type attr and native numbering', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [
        { pPr: '<a:pPr marL="228600"><a:buAutoNum type="arabicPeriod"/></a:pPr>', runs: [{ t: 'one' }] },
        { pPr: '<a:pPr marL="228600"><a:buAutoNum type="romanUcPeriod"/></a:pPr>', runs: [{ t: 'two' }] },
      ] }],
    }],
  });
  assert.ok(html.includes('<ol'), 'auto bullets render as <ol');
  assert.ok(html.includes('<ol type="1"'), 'arabicPeriod -> type 1');
  assert.ok(html.includes('<ol type="I"'), 'romanUcPeriod -> type I');
  assert.ok(!html.includes('list-style-type:none;'), 'auto items keep native markers');
});

test('slidenum field on slide 3 of 5 renders the live index 3', () => {
  const slides = [1, 2, 3, 4, 5].map(n => n === 3
    ? { rels: [], texts: [{ paragraphs: [{ runs: [{ t: 'Page ' }, { field: 'slidenum', t: '9' }] }] }] }
    : { rels: [], texts: [{ paragraphs: [{ runs: [{ t: `s${n}` }] }] }] });
  const { html } = render({ masters: [{}], slides });
  assert.ok(html.includes('Page 3'), 'field resolves to slideIndex 3, not the stored "9"');
  assert.ok(!html.includes('Page 9'), 'stored fallback text not used');
});

test('underline wavyHeavy renders wavy + 2px thickness; dbl gets the border-bottom fallback', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [
        { t: 'wavy', u: 'wavyHeavy', sz: 2400 },
        { t: 'dbl', u: 'dbl', sz: 2400 },
      ] }] }],
    }],
  });
  assert.ok(/text-decoration:underline wavy/.test(html), 'wavy underline');
  assert.ok(html.includes('text-decoration-thickness:2px'), 'heavy variant thickness');
  assert.ok(html.includes('border-bottom:3px double currentColor'), 'dbl -> border-bottom fallback');
  assert.ok(html.includes('display:inline-block'), 'inline-block so the border hugs the run');
});

test('autofit fontScale 0.75 scales a 32px run to font-size:24px', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{
        bodyPr: '<a:normAutofit fontScale="75000"/>',
        paragraphs: [{ runs: [{ t: 'shrunk', sz: 2400 }] }],
      }],
    }],
  });
  assert.ok(html.includes('font-size:24px'), '32px * 0.75 at emit time');
});

test('javascript: hyperlink never reaches href; https does with target=_blank', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{
      rels: [
        { id: 'rIdEvil', target: 'javascript:alert(1)', external: true },
        { id: 'rIdGood', target: 'https://example.com/x', external: true },
      ],
      texts: [{ paragraphs: [{ runs: [
        { t: 'evil', linkId: 'rIdEvil', color: '0000FF' },
        { t: 'good', linkId: 'rIdGood', color: '0000FF' },
      ] }] }],
    }],
  });
  assert.ok(!html.includes('javascript:'), 'scheme never emitted');
  assert.equal((html.match(/<a href=/g) ?? []).length, 1, 'exactly one anchor — the whitelisted link');
  assert.ok(html.includes('<a href="https://example.com/x" target="_blank" rel="noopener">'), 'whitelisted link is an anchor');
  assert.ok(diagnostics.items.some(d => d.kind === 'approx' && /scheme not allowed/.test(d.msg)), 'approx diagnostic');
});

test('vertical eaVert maps to writing-mode:vertical-rl; wordArtVert degrades with diagnostic', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [
        { bodyPrAttrs: 'vert="eaVert"', paragraphs: [{ runs: [{ t: 'vtext' }] }] },
        { bodyPrAttrs: 'vert="wordArtVert"', paragraphs: [{ runs: [{ t: 'wa' }] }] },
      ],
    }],
  });
  assert.ok(html.includes('writing-mode:vertical-rl'), 'eaVert -> vertical-rl');
  assert.ok(diagnostics.items.some(d => d.kind === 'approx' && /wordArtVert/.test(d.msg)), 'wordArtVert approximated');
});

test('titles render as <h1>/<h2> via titleLevel; blank paragraphs survive as <p><br></p>', () => {
  const { html } = render({
    masters: [{}],
    layouts: [{ shapes: '' }],
    slides: [{
      rels: [],
      texts: [
        { title: true, paragraphs: [{ runs: [{ t: 'Big Title' }] }] },
        { ph: '<p:ph type="subTitle" idx="1"/>', paragraphs: [{ runs: [{ t: 'Sub' }] }] },
        { paragraphs: [{ pPr: '', runs: [] }, { pPr: '', runs: [{ t: 'after blank' }] }] },
      ],
    }],
  });
  assert.match(html.replace(/\n/g, ''), /<h1[^>]*>Big Title<\/h1>/);
  assert.match(html.replace(/\n/g, ''), /<h2[^>]*>Sub<\/h2>/);
  assert.ok(html.includes('<p style="margin:0"><br></p>'), 'blank line preserved');
});

test('styled run carries every property inline, self-contained (no classes)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [{
        t: 'full', sz: 1800, b: true, i: true, u: 'sng', cap: 'small',
        baseline: 30000, spc: 300, color: 'FF0000', latin: 'Calibri', strike: 'sngStrike',
      }] }] }],
    }],
  });
  const span = html.slice(html.indexOf('<span'), html.indexOf('</span>'));
  for (const frag of ['font-size:24px', 'font-family:', 'font-weight:700', 'font-style:italic',
    'color:#ff0000', 'text-decoration:underline line-through', 'font-variant:small-caps',
    'letter-spacing:3px', 'vertical-align:30%', 'top:-12px'])
    assert.ok(span.includes(frag), `${frag} in span: ${span}`);
});

test('run properties merge through the chain into render: layout bullet, slide run style', () => {
  const { html } = render({
    masters: [{}],
    layouts: [{
      shapes: `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/><p:nvPr>` +
        `<p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/>` +
        `<a:p><a:pPr marL="228600" indent="-228600"><a:buChar char="•"/></a:pPr></a:p></p:txBody></p:sp>`,
    }],
    slides: [{
      rels: [],
      texts: [{ ph: '<p:ph type="body" idx="1"/>', paragraphs: [{ runs: [{ t: 'merged', sz: 2400 }] }] }],
    }],
  });
  assert.ok(html.includes('<ul>'), 'layout-level bullet produced a real list');
  assert.ok(html.includes('<span aria-hidden="true">• </span>'), 'layout-level bullet char');
  assert.ok(html.includes('font-size:32px'), 'slide-level run size on the same paragraph');
});

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
