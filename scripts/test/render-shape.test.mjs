// Shape rendering tests (adapted from PPTX2HTML, MIT) — geometry SVG behind
// text, fills as <defs>, strokes with dash presets, marker arrowheads,
// flip transforms, rate-limited approximation diagnostics.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { buildDeck } from './lib/deck.mjs';
import { fontFamily } from '../src/render/fonts.js';
import { loadTheme } from '../src/pptx/theme.js';
import { Diagnostics } from '../src/pptx/context.js';

const render = (spec) => convert(buildDeck(spec));

test('roundRect + solidFill FF0000 + 2.25pt dashed line renders pp-geom svg', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{
      texts: [{
        text: 'box', geom: 'roundRect', fill: 'FF0000',
        line: { w: 28575, dash: 'dash', color: '000000' },
      }],
    }],
  });
  assert.ok(html.includes('<svg class="pp-geom"'), 'pp-geom svg emitted');
  assert.ok(html.includes('fill="#ff0000"'), 'solid fill color on the path');
  assert.ok(html.includes('stroke-dasharray="4,3"'), 'dash preset mapped to dasharray');
  assert.ok(html.includes('stroke-width="3"'), '28575 EMU -> 3px stroke');
  assert.ok(html.includes('stroke-linejoin="round"'), 'linejoin per template');
  // the svg sits before the semantic text inside the same .pp-el box
  const box = html.slice(html.indexOf('class="pp-el"'), html.indexOf('</div>'));
  assert.ok(box.indexOf('<svg class="pp-geom"') < box.indexOf('<p'), 'geometry behind text');
  assert.equal(diagnostics.hasErrors, false);
});

test('gradient-filled shape yields <linearGradient> in <defs> and url(#) fill', () => {
  const { html } = render({
    masters: [{}],
    slides: [{ texts: [{ text: 'g', geom: 'ellipse', grad: true }] }],
  });
  assert.ok(html.includes('<linearGradient'), 'linearGradient def emitted');
  assert.ok(/gradientUnits="objectBoundingBox"/.test(html), 'objectBoundingBox units');
  assert.ok(/fill="url\(#/.test(html), 'fill references the gradient');
  assert.ok(html.includes('stop-color="#4472c4"'), 'schemeClr stop through the theme');
});

test('gradient background renders as full-slide pp-bg svg with linearGradient', () => {
  const { html } = render({
    masters: [{}],
    slides: [{ bgGrad: true, texts: [{ text: 'x' }] }],
  });
  assert.ok(html.includes('<svg class="pp-bg"'), 'pp-bg svg emitted');
  assert.ok(html.includes('<linearGradient'), 'gradient def present');
  assert.ok(/fill="url\(#bg1-f\)"/.test(html), 'rect painted by the background gradient');
});

test('unknown preset teapot: bbox path AND exactly ONE approx diagnostic (addOnce)', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{ texts: [{ text: 'a', geom: 'teapot' }, { text: 'b', geom: 'teapot' }] }],
  });
  assert.ok((html.match(/M0,0 H960 V\d+ H0 Z/g) ?? []).length >= 2, 'bbox paths for both shapes');
  const teapotDiags = diagnostics.items.filter(d => d.msg === 'geometry preset teapot approximated');
  assert.equal(teapotDiags.length, 1, 'two teapots, ONE diagnostic — addOnce proven');
  assert.equal(teapotDiags[0].kind, 'approx');
  assert.equal(teapotDiags[0].slide, 1);
});

test('flipH wraps the path in scale(-1,1)', () => {
  const { html } = render({
    masters: [{}],
    slides: [{ texts: [{ text: 'f', flipH: true }] }],
  });
  assert.ok(/transform="translate\(\d+,0\) scale\(-1,1\)"/.test(html), 'flipH transform');
});

test('arrowheads: tailEnd triangle yields marker def + marker-end ref', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      texts: [{
        text: 'arrow', geom: 'rightArrow', fill: '4472C4',
        line: { color: '000000', w: 12700, tailEnd: { type: 'triangle', w: 'lg', len: 'lg' } },
      }],
    }],
  });
  assert.ok(html.includes('<marker '), 'marker def emitted');
  assert.ok(/marker-end="url\(#.*-m-e\)"/.test(html), 'marker-end reference');
  assert.ok(/orient="auto"/.test(html), 'auto orientation');
});

test('compound line renders as parallel strokes + one approx diagnostic', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{ texts: [{ text: 'c', line: { color: '000000', w: 28575, compound: 'dbl' } }] }],
  });
  assert.ok((html.match(/translate\(0,-1\)|translate\(0,1\)/g) ?? []).length >= 2, 'offset parallel strokes');
  assert.equal(diagnostics.items.filter(d => /compound line/.test(d.msg)).length, 1);
});

test('shape effects ignored with one approx diagnostic per slide', () => {
  const { diagnostics } = render({
    masters: [{}],
    slides: [{ texts: [{ text: 'a', effects: true }, { text: 'b', effects: true }] }],
  });
  const eff = diagnostics.items.filter(d => d.msg === 'shape effects ignored (a:effectLst)');
  assert.equal(eff.length, 1, 'rate-limited: two shadowed shapes, one diagnostic');
});

test('fontFamily resolves +mj-lt/+mn-lt through the theme with quoted names', () => {
  const ctx = { theme: loadTheme(null, null, null) };
  const major = fontFamily('+mj-lt', ctx);
  assert.ok(major.includes('"Calibri Light"'), 'major latin quoted: ' + major);
  assert.match(major, /, sans-serif$/);
  const minor = fontFamily('+mn-lt', ctx);
  assert.ok(minor.startsWith('"Calibri"'), 'minor latin quoted: ' + minor);
  assert.ok(fontFamily('+mn-ea', ctx).includes('"Calibri"'), 'ea suffix selects latin for now');
  const serif = fontFamily('Cambria', ctx);
  assert.ok(serif.endsWith(', serif'), 'serif fallback for serif faces: ' + serif);
});

test('Diagnostics.addOnce dedupes on (msg, slide) and still rejects bad kinds', () => {
  const d = new Diagnostics();
  d.addOnce('approx', 'same', 1);
  d.addOnce('approx', 'same', 1);
  d.addOnce('approx', 'same', 2);
  assert.equal(d.items.length, 2);
  assert.throws(() => d.addOnce('fatal', 'x'), /bad kind fatal/);
});

test('slide without background keeps rendering; no diagnostics flood', () => {
  const { html, diagnostics } = render({ slides: [{ texts: [{ text: 'plain' }] }] });
  assert.ok(html.includes('class="pp-el"'), 'boxes render');
  assert.ok(!html.includes('pp-bg'), 'no background svg');
  // no masters -> the loader's 'no theme part' missing diag is expected; the
  // render channel itself must stay free of approx/error noise
  assert.equal(diagnostics.items.filter(d => d.kind !== 'missing').length, 0,
    `unexpected diagnostics: ${diagnostics.format()}`);
});
