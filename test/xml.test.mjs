import test from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, escapeXml, XNode } from '../src/util/xml.js';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

test('nonstandard producer prefix still yields find("a:solidFill")', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!-- a comment that must be skipped -->
<p:sp xmlns:p="${P}" xmlns:zz="${A}">
  <p:txBody><zz:solidFill><zz:srgbClr val="FF0000"/></zz:solidFill></p:txBody>
</p:sp>`;
  const root = parseXml(xml);
  assert.ok(root instanceof XNode);
  assert.equal(root.name, 'p:sp');
  const fill = root.path('p:txBody/a:solidFill');
  assert.ok(fill, 'zz:solidFill must be findable as a:solidFill');
  assert.equal(fill.find('a:srgbClr').attr('val'), 'FF0000');
  assert.deepEqual(root.attrs, {}); // xmlns declarations dropped
});

test('strict (purl.oclc.org) URIs canonicalize to the same prefixes', () => {
  const xml = `<z:sp xmlns:z="http://purl.oclc.org/ooxml/drawingml/main"><z:ln w="12700"/><z:other/></z:sp>`;
  const root = parseXml(xml);
  assert.ok(root.find('a:ln'));
  assert.equal(root.find('a:ln').num('w'), 12700);
  assert.equal(root.all('a:ln').length, 1);
});

test('strict variant with default xmlns gets the canonical prefix', () => {
  const xml = `<presentation xmlns="http://purl.oclc.org/ooxml/presentationml/main"><sldSz cx="9144000" cy="5143500"/></presentation>`;
  const root = parseXml(xml);
  assert.equal(root.name, 'p:presentation');
  assert.ok(root.find('p:sldSz'));
});

test('relationship-prefixed attributes canonicalize: r:embed stays r:embed', () => {
  const xml = `<z:blip xmlns:z="${A}" xmlns:x="${R}" x:embed="rId2" cstate="print"/>`;
  const root = parseXml(xml);
  assert.equal(root.attr('r:embed'), 'rId2'); // x:embed under rels URI -> r:embed
  assert.equal(root.attr('cstate'), 'print'); // unprefixed attr keeps bare name
});

test('CDATA content is preserved as literal text', () => {
  const xml = `<a:t xmlns:a="${A}">before <![CDATA[a < b & c]]> after</a:t>`;
  const root = parseXml(xml);
  assert.equal(root.textOf(), 'before a < b & c after');
});

test('numeric and named entities decode in text and attribute values', () => {
  const root = parseXml(`<a:t xmlns:a="${A}">A&#65;B&#x42;&amp;&lt;</a:t>`);
  assert.equal(root.textOf(), 'AABB&<');
  const pic = parseXml(`<a:blip xmlns:a="${A}" descr="tom &amp; jerry &#38; co"/>`);
  assert.equal(pic.attr('descr'), 'tom & jerry & co');
});

test('<!ENTITY> is unsupported and throws', () => {
  assert.throws(() => parseXml('<!DOCTYPE x [<!ENTITY e "v">]><x/>'), /ENTITY/);
  assert.throws(() => parseXml('<x><!ENTITY e "v"></x>'), /ENTITY/);
});

test('DOCTYPE declarations are skipped', () => {
  const root = parseXml('<!DOCTYPE presentation PUBLIC "x" "y"><p:presentation xmlns:p="' + P + '"/>');
  assert.equal(root.name, 'p:presentation');
});

test('escapeXml covers the five XML specials', () => {
  assert.equal(escapeXml('<a>&"'), '&lt;a&gt;&amp;&quot;');
  assert.equal(escapeXml("'"), '&apos;');
  assert.equal(escapeXml(escapeXml('&')), '&amp;amp;');
});

test('XNode helpers: attr/num/int/bool fallbacks, all([]), path miss', () => {
  const root = parseXml(
    `<p:sp xmlns:p="${P}" xmlns:a="${A}" spid="7" w="12.5em" n="9" flag="1" off="0">` +
    `<a:off x="1"/><p:txBody/></p:sp>`);
  assert.equal(root.attr('spid'), '7');
  assert.equal(root.attr('missing', 'dflt'), 'dflt');
  assert.equal(root.num('w'), 12.5);
  assert.equal(root.num('missing', 5), 5);
  assert.equal(root.int('n'), 9);
  assert.equal(root.int('missing', 3), 3);
  assert.equal(root.int('w'), 12);
  assert.equal(root.bool('flag'), true);
  assert.equal(root.bool('off'), false);
  assert.equal(root.bool('missing', true), true);
  assert.equal(root.all(['a:off', 'p:txBody']).length, 2);
  assert.equal(root.path('p:nope/p:spTree'), null);
  assert.equal(root.find('nope:nothing'), null);
});

test('mismatched closing tags throw', () => {
  assert.throws(() => parseXml('<a:x xmlns:a="' + A + '"></a:y>'), /mismatched closing tag/);
});
