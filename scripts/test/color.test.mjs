// Color engine tests — resolveColor over srgb/sys/scheme/prst bases and the
// transform chain math (adapted from PPTX2HTML, MIT).

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml } from '../src/util/xml.js';
import { loadTheme } from '../src/pptx/theme.js';
import { resolveColor } from '../src/pptx/color.js';
import { Diagnostics } from '../src/pptx/context.js';

const color = (xml) => parseXml(xml); // undeclared prefixes pass through canonical rewriting
const resolve = (xml, theme) => {
  const diag = new Diagnostics();
  const out = resolveColor(color(xml), { theme, diag });
  return { out, diag };
};

test('srgbClr FF0000 -> #ff0000', () => {
  const { out, diag } = resolve('<a:srgbClr val="FF0000"/>', loadTheme(null, null, null));
  assert.equal(out, '#ff0000');
  assert.equal(diag.items.length, 0);
});

test('schemeClr accent1 through a fake theme -> mapped hex', () => {
  const theme = loadTheme(parseXml(
    '<a:theme><a:themeElements><a:clrScheme>' +
    '<a:dk1><a:srgbClr val="123456"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:accent1><a:srgbClr val="4472C4"/></a:accent1>' +
    '</a:clrScheme></a:themeElements></a:theme>'), null, null);
  const { out } = resolve('<a:schemeClr val="accent1"/>', theme);
  assert.equal(out, '#4472c4');
});

test('clrMap direction: schemeClr tx1 with clrMap {tx1:"dk1"} resolves dk1', () => {
  const theme = loadTheme(parseXml(
    '<a:theme><a:themeElements><a:clrScheme>' +
    '<a:dk1><a:srgbClr val="123456"/></a:dk1>' +
    '</a:clrScheme></a:themeElements></a:theme>'), { tx1: 'dk1' }, null);
  const { out } = resolve('<a:schemeClr val="tx1"/>', theme);
  assert.equal(out, '#123456');
  // unmapped names still hit the scheme slots directly
  const { out: direct } = resolve('<a:schemeClr val="dk1"/>', theme);
  assert.equal(direct, '#123456');
});

test('lumMod 50000 on lt1 (white) halves lightness -> #808080', () => {
  const { out } = resolve('<a:schemeClr val="lt1"><a:lumMod val="50000"/></a:schemeClr>',
    loadTheme(null, null, null));
  assert.equal(out, '#808080');
});

test('tint 50000 on pure red -> #ff8080 (exact)', () => {
  const { out } = resolve('<a:srgbClr val="FF0000"><a:tint val="50000"/></a:srgbClr>',
    loadTheme(null, null, null));
  assert.equal(out, '#ff8080');
});

test('alpha 50000 -> rgba() with 0.5 alpha', () => {
  const { out } = resolve('<a:srgbClr val="FF0000"><a:alpha val="50000"/></a:srgbClr>',
    loadTheme(null, null, null));
  assert.equal(out, 'rgba(255,0,0,0.5)');
});

test('gray on red -> luma gray, each channel within ±2 of the formula value', () => {
  // gray: g = 0.21r + 0.72g + 0.07b — on red = 53.55 -> 0x363636
  // (plan's illustrative #b4b4b4 conflicts with its own displayed formula; the
  // formula is the contract — see SUMMARY deviations)
  const { out } = resolve('<a:srgbClr val="FF0000"><a:gray/></a:srgbClr>', loadTheme(null, null, null));
  assert.ok(out.startsWith('#'), 'gray keeps hex form: ' + out);
  const ch = [1, 3, 5].map(i => parseInt(out.slice(i, i + 2), 16));
  const expected = 0.21 * 255; // r=255, g=b=0
  for (const c of ch) assert.ok(Math.abs(c - expected) <= 2, `channel ${c} within ±2 of ${expected}`);
});

test('invalid srgb XYZ -> null + an approx diagnostic exists', () => {
  const { out, diag } = resolve('<a:srgbClr val="XYZ"/>', loadTheme(null, null, null));
  assert.equal(out, null);
  const item = diag.items.find(d => d.kind === 'approx');
  assert.ok(item, 'diagnostic recorded');
  assert.match(item.msg, /invalid color XYZ/);
});

test('unknown transform never throws: recorded as approx, chain continues', () => {
  const { out, diag } = resolve('<a:srgbClr val="FF0000"><a:satOff val="10000"/><a:tint val="50000"/></a:srgbClr>',
    loadTheme(null, null, null));
  assert.equal(out, '#ff8080');
  assert.ok(diag.items.some(d => d.msg === 'color transform satOff'));
});

test('loadTheme(null, …) returns the Office-default theme without throwing', () => {
  const theme = loadTheme(null, { tx1: 'dk1' }, null);
  assert.deepEqual(theme.clrMap, { tx1: 'dk1' }); // masterClrMap passed through as-is
  const diag = new Diagnostics();
  assert.equal(resolveColor(color('<a:schemeClr val="dk1"/>'), { theme, diag }), '#000000');
  assert.equal(resolveColor(color('<a:schemeClr val="lt1"/>'), { theme, diag }), '#ffffff');
  assert.equal(resolveColor(color('<a:schemeClr val="dk2"/>'), { theme, diag }), '#44546a');
  assert.equal(resolveColor(color('<a:schemeClr val="lt2"/>'), { theme, diag }), '#e7e6e6');
  assert.equal(resolveColor(color('<a:schemeClr val="accent1"/>'), { theme, diag }), '#4472c4');
  assert.equal(resolveColor(color('<a:schemeClr val="accent2"/>'), { theme, diag }), '#ed7d31');
  assert.equal(resolveColor(color('<a:schemeClr val="accent3"/>'), { theme, diag }), '#a5a5a5');
  assert.equal(resolveColor(color('<a:schemeClr val="accent4"/>'), { theme, diag }), '#ffc000');
  assert.equal(resolveColor(color('<a:schemeClr val="accent5"/>'), { theme, diag }), '#5b9bd5');
  assert.equal(resolveColor(color('<a:schemeClr val="accent6"/>'), { theme, diag }), '#70ad47');
  assert.equal(theme.fontScheme.major.latin, 'Calibri Light');
  assert.equal(theme.fontScheme.minor.latin, 'Calibri');
});

test('fontScheme parsing: latin typeface + script fonts', () => {
  const theme = loadTheme(parseXml(
    '<a:theme><a:themeElements><a:fontScheme>' +
    '<a:majorFont><a:latin typeface="Cambria"/><a:font script="Jpan" typeface="ＭＳ ゴシック"/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/></a:minorFont>' +
    '</a:fontScheme></a:themeElements></a:theme>'), null, null);
  assert.equal(theme.fontScheme.major.latin, 'Cambria');
  assert.equal(theme.fontScheme.major.scripts.Jpan, 'ＭＳ ゴシック');
  assert.equal(theme.fontScheme.minor.latin, 'Calibri');
});
