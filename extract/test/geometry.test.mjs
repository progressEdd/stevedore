// Geometry engine tests — preset builders, bbox fallback for unknown
// presets, custGeom walking with EMU scaling (adapted from PPTX2HTML, MIT).

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '../src/util/xml.js';
import { PRESETS } from '../src/geometry/presets.js';
import { shapePath } from '../src/geometry/geometry.js';
import { Diagnostics } from '../src/pptx/context.js';

const spPr = (xml) => parseXml(`<a:spPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${xml}</a:spPr>`);
const run = (xml, w, h) => shapePath(spPr(xml), { diag: new Diagnostics() }, { w, h });

test('rect at 100x50 -> exact bbox path', () => {
  const out = run('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>', 100, 50);
  assert.equal(out.path, 'M0,0 H100 V50 H0 Z');
  assert.equal(out.approximated, false);
});

test('ellipse path has two A commands with radii 50 and 25', () => {
  const out = run('<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>', 100, 50);
  const arcs = out.path.match(/A50,25 /g) ?? [];
  assert.equal(arcs.length, 2);
});

test('roundRect default adj at 200x100 -> corner radius ~16.67 (min side / 6)', () => {
  const out = run('<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>', 200, 100);
  const m = /A(16\.\d+),/.exec(out.path);
  assert.ok(m, 'first arc radius found: ' + out.path);
  const r = parseFloat(m[1]);
  assert.ok(Math.abs(r - 16.67) <= 0.5, `radius ${r} within ±0.5 of 16.67`);
});

test('roundRect honors avLst adj override', () => {
  const out = run('<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 50000"/></a:avLst></a:prstGeom>', 200, 100);
  const m = /A(50),/.exec(out.path);
  assert.ok(m, 'half-the-short-side radius 50: ' + out.path);
});

test('unknown preset teapot -> bbox path + approximated', () => {
  const out = run('<a:prstGeom prst="teapot"><a:avLst/></a:prstGeom>', 80, 40);
  assert.equal(out.path, 'M0,0 H80 V40 H0 Z');
  assert.equal(out.approximated, true);
});

test('custGeom triangle (moveTo/lnTo×2/close) scales EMU to px', () => {
  const out = run(
    '<a:custGeom><a:avLst/><a:gdLst/><a:pathLst>' +
    '<a:path w="952500" h="476250"><a:moveTo><a:pt x="0" y="0"/></a:moveTo>' +
    '<a:lnTo><a:pt x="952500" y="0"/></a:lnTo><a:lnTo><a:pt x="0" y="476250"/></a:lnTo>' +
    '<a:close/></a:path></a:pathLst></a:custGeom>', 100, 50);
  assert.equal(out.path, 'M0,0 L100,0 L0,50 Z');
  assert.equal(out.approximated, false);
});

test('custGeom cubic/quad beziers and arcTo (arcTo approximates to a line)', () => {
  const out = run(
    '<a:custGeom><a:pathLst><a:path w="952500" h="952500">' +
    '<a:moveTo><a:pt x="0" y="0"/></a:moveTo>' +
    '<a:cubicBezTo><a:pt x="95250" y="0"/><a:pt x="190500" y="0"/><a:pt x="285750" y="95250"/></a:cubicBezTo>' +
    '<a:quadBezTo><a:pt x="381000" y="190500"/><a:pt x="476250" y="285750"/></a:quadBezTo>' +
    '<a:arcTo wR="47625" hR="47625" stAng="0" swAng="5400000"/>' +
    '<a:close/></a:path></a:pathLst></a:custGeom>', 100, 100);
  assert.match(out.path, /^M0,0 C10,0 20,0 30,10/);
  assert.match(out.path, /Q40,20 50,30/);
  assert.match(out.path, /L45,35/); // cur(50,30) + 5·(cos90−cos0), 5·(sin90−sin0) = (45,35)
  assert.equal(out.approximated, true);
});

test('custGeom with gdLst guide formulas -> approximated, coords degrade to 0', () => {
  const out = run(
    '<a:custGeom><a:gdLst><a:gd name="guide1" fmla="*/ w 1 4"/></a:gdLst>' +
    '<a:pathLst><a:path w="952500" h="952500"><a:moveTo><a:pt x="guide1" y="0"/></a:moveTo>' +
    '<a:lnTo><a:pt x="952500" y="952500"/></a:lnTo><a:close/></a:path></a:pathLst></a:custGeom>', 100, 100);
  assert.equal(out.approximated, true);
  assert.match(out.path, /^M0,0 L100,100 Z$/);
});

test('no geometry element -> null (plain div, no svg)', () => {
  assert.equal(run('', 100, 50), null);
});

test('every PRESETS key builds at two sizes without throwing, none null', () => {
  const keys = Object.keys(PRESETS);
  assert.ok(keys.length >= 40, `at least 40 presets, got ${keys.length}`);
  for (const key of keys) {
    assert.notEqual(PRESETS[key], null, key);
    for (const [w, h] of [[100, 100], [200, 90]]) {
      const d = PRESETS[key]({ w, h });
      assert.equal(typeof d, 'string', key);
      assert.match(d, /^M/, `${key} starts a path at ${w}x${h}`);
      assert.ok(d.length > 5, `${key} has path data`);
    }
  }
});

test('arc-family presets compute adj angles with exact trig (pie 0°..270°)', () => {
  const out = run('<a:prstGeom prst="pie"><a:avLst><a:gd name="adj1" fmla="val 0"/><a:gd name="adj2" fmla="val 16200000"/></a:avLst></a:prstGeom>', 100, 100);
  assert.match(out.path, /^M50,50 L100,50/); // center, then 3-o'clock point (0°)
  // DrawingML angles run clockwise on screen: 270° = 12 o'clock = (50,0);
  // 270° span > 180° -> large-arc 1, sweep 1
  assert.match(out.path, /1 1 50,0/);
});

test('PRESETS exposure: representative keys exist', () => {
  for (const key of ['line', 'triangle', 'hexagon', 'rightArrow', 'donut', 'noSmoking',
    'wedgeRoundRectCallout', 'cloudCallout', 'bentArrow', 'circularArrow', 'curvedRightArrow',
    'smileyFace', 'heart', 'lightningBolt', 'sun', 'moon', 'cloud', 'blockArc']) {
    assert.ok(PRESETS[key], key);
  }
});
