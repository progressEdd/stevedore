import test from 'node:test';
import assert from 'node:assert/strict';
import { OpcPackage } from '../src/opc/package.js';
import { Diagnostics } from '../src/pptx/context.js';
import { loadPresentation } from '../src/pptx/presentation.js';
import { buildDeck } from './lib/deck.mjs';

function load(bytes) {
  const pkg = new OpcPackage(bytes);
  const diag = new Diagnostics();
  const presentation = loadPresentation(pkg, diag);
  return { pkg, diag, presentation };
}

const oneSlide = () => buildDeck({ slides: [{ texts: [{ text: 'hello' }] }] });

test('Diagnostics: four kinds, bad kind rejected, hasErrors, format()', () => {
  const d = new Diagnostics();
  for (const kind of ['unsupported', 'approx', 'error', 'missing']) d.add(kind, kind + ' msg');
  assert.equal(d.items.length, 4);
  assert.equal(d.hasErrors, true);
  assert.throws(() => d.add('fatal', 'nope'), /bad kind fatal/);
  const clean = new Diagnostics();
  clean.add('approx', 'only approximations');
  assert.equal(clean.hasErrors, false);
  const withSlide = new Diagnostics();
  withSlide.add('error', 'boom', 3);
  assert.deepEqual(withSlide.format(), ['slide 3: error: boom']);
  assert.deepEqual(clean.format(), ['approx: only approximations']);
});

test('slide count and order follow sldIdLst', () => {
  const { presentation } = load(buildDeck({
    slides: [{ texts: [{ text: 'A' }] }, { texts: [{ text: 'B' }] }, { texts: [{ text: 'C' }] }],
  }));
  assert.equal(presentation.slides.length, 3);
  assert.deepEqual(presentation.slides.map(s => s.partName),
    ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide3.xml']);
  assert.deepEqual(presentation.slides.map(s => s.index), [1, 2, 3]);
});

test('phantom content-type override (advertiseMissing) loads with zero errors thrown', () => {
  const { presentation, diag } = load(buildDeck({
    slides: [{ texts: [{ text: 'x' }] }],
    advertiseMissing: ['/ppt/slideLayouts/slideLayout99.xml'],
  }));
  assert.equal(presentation.slides.length, 1);
  assert.equal(diag.hasErrors, false);
  assert.equal(presentation.slides[0].broken, undefined);
});

test('malformed slide yields broken placeholder + error diag; other slides still load', () => {
  const { presentation, diag } = load(buildDeck({
    slides: [{ texts: [{ text: 'ok' }] }, { texts: [{ text: 'broken' }] }, { texts: [{ text: 'also ok' }] }],
    extraParts: [{ name: 'ppt/slides/slide2.xml', data: '<p:sld><broken' }],
  }));
  assert.equal(presentation.slides.length, 3);
  assert.equal(presentation.slides[1].broken, true);
  assert.equal(presentation.slides[1].index, 2); // numbering stays aligned
  assert.equal(presentation.slides[1].partName, 'ppt/slides/slide2.xml');
  const err = diag.items.find(d => d.kind === 'error');
  assert.ok(err, 'an error-kind diagnostic was recorded');
  assert.equal(err.slide, 2);
  assert.match(err.msg, /failed to load ppt\/slides\/slide2\.xml/);
  assert.equal(presentation.slides[0].broken, undefined);
  assert.equal(presentation.slides[2].broken, undefined);
});

test('slideSize px conversion: cx=12192000 EMU -> 1280 px', () => {
  const { presentation } = load(oneSlide());
  assert.deepEqual(presentation.slideSize, { cx: 12192000, cy: 6858000, pxW: 1280, pxH: 720 });
});

test('default 4:3 slide size when p:sldSz absent', () => {
  const presNoSz = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<p:sldIdLst><p:sldId id="256" r:id="rSlide1"/></p:sldIdLst></p:presentation>';
  const { presentation } = load(buildDeck({
    slides: [{ texts: [{ text: 'x' }] }],
    extraParts: [{ name: 'ppt/presentation.xml', data: presNoSz }],
  }));
  assert.deepEqual(presentation.slideSize, { cx: 9144000, cy: 6858000, pxW: 960, pxH: 720 });
});

test('masters captured with theme part and raw clrMap; presentation.theme = first master theme', () => {
  const { presentation, diag } = load(buildDeck({ slides: [{ texts: [{ text: 'x' }] }], masters: [{}] }));
  assert.equal(presentation.masters.length, 1);
  assert.equal(presentation.masters[0].partName, 'ppt/slideMasters/slideMaster1.xml');
  assert.equal(presentation.masters[0].theme, 'ppt/theme/theme1.xml');
  assert.equal(presentation.masters[0].clrMap.bg1, 'lt1');
  assert.equal(presentation.masters[0].clrMap.tx1, 'dk1');
  assert.equal(presentation.theme, 'ppt/theme/theme1.xml');
  assert.equal(diag.items.filter(d => d.kind === 'missing' && /no theme part/.test(d.msg)).length, 0);
});

test('no masters: empty array tolerated, missing theme diagnostic recorded', () => {
  const { presentation, diag } = load(oneSlide());
  assert.deepEqual(presentation.masters, []);
  assert.equal(presentation.theme, null);
  assert.ok(diag.items.some(d => d.kind === 'missing' && /no theme part/.test(d.msg)));
  assert.equal(diag.hasErrors, false);
});

test('hidden slides detected via p:sld@show="0"', () => {
  const { presentation } = load(buildDeck({
    slides: [{ texts: [{ text: 'visible' }] }, { texts: [{ text: 'hidden' }], hidden: true }],
  }));
  assert.equal(presentation.slides[0].hidden, false);
  assert.equal(presentation.slides[1].hidden, true);
});

test('title read from docProps/core.xml dc:title when present', () => {
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Q3 Review</dc:title></cp:coreProperties>';
  const { presentation } = load(buildDeck({
    slides: [{ texts: [{ text: 'x' }] }],
    extraParts: [{ name: 'docProps/core.xml', data: core }],
  }));
  assert.equal(presentation.title, 'Q3 Review');
});

test('title stays empty when docProps/core.xml absent', () => {
  const { presentation } = load(oneSlide());
  assert.equal(presentation.title, '');
});
