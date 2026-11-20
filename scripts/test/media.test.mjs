// Media fidelity tests (adapted from PPTX2HTML, MIT) — picture crop via the
// object-position trick (exact math), nested group child-coordinate
// transforms through concatenated kx/ky, deferred EMF/WMF/TIFF media
// (diagnostic + truthful placeholder), SVG blips preferred over raster
// fallbacks, connectors as line geometry, OLE objects unsupported.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { buildDeck } from './lib/deck.mjs';

const render = (spec) => convert(buildDeck(spec));

// 1x1 transparent PNG (magic bytes real so mime sniffing is exercised)
const PNG_1PX = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000d49444154789c62000100000500010d0a2db40000000049454e44ae426082', 'hex');
const SVG_LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>';

const leaf = (x, y, cx, cy, label) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="40" name="${label}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
  `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
  `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${label}</a:t></a:r></a:p></p:txBody></p:sp>`;

const grp = (id, off, ext, chOff, chExt, rot, inner) =>
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="Group ${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm${rot ? ` rot="${rot}"` : ''}><a:off x="${off[0]}" y="${off[1]}"/><a:ext cx="${ext[0]}" cy="${ext[1]}"/>` +
  `<a:chOff x="${chOff[0]}" y="${chOff[1]}"/><a:chExt cx="${chExt[0]}" cy="${chExt[1]}"/></a:xfrm></p:grpSpPr>${inner}</p:grpSp>`;

test('crop: srcRect l=10000 t=0 r=10000 b=25000 -> object-position:12.5% 0%', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    ctDefaults: [{ ext: 'png', mime: 'image/png' }],
    extraParts: [{ name: 'ppt/media/pic1.png', data: PNG_1PX }],
    slides: [{
      rels: [{ id: 'rIdP1', target: '../media/pic1.png' }],
      pictures: [{ rel: 'rIdP1', srcRect: { l: 10000, t: 0, r: 10000, b: 25000 } }],
    }],
  });
  assert.ok(html.includes('object-position:12.5% 0%'), 'exact crop math (100/800 = 12.5%)');
  assert.ok(html.includes('object-fit:cover'), 'cover scales the crop window to the box');
  assert.equal(diagnostics.hasErrors, false);
});

test('nested groups: grandchild remapped through both levels, exact per the formula', () => {
  // outer: ext 200px, chExt 100px -> kx=ky=2, dx=dy=0
  // inner: off 10px, ext 50px, chExt 100px -> k=0.5, d=10; composed k=1, d=20
  // leaf: child coords 40px, size 10px -> final 20 + 40*1 = 60px, size 10px
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      shapes: grp(20, [0, 0], [1905000, 1905000], [0, 0], [952500, 952500], 0,
        grp(21, [95250, 95250], [476250, 476250], [0, 0], [952500, 952500], 0,
          leaf(381000, 381000, 95250, 95250, 'deep'))),
    }],
  });
  assert.ok(html.includes('left:60px;top:60px;width:10px;height:10px'),
    'grandchild x maps through both concatenated transforms: 60,60 / 10x10');
  assert.ok(!html.includes('class="pp-group"'), 'non-rotated groups emit no wrapper');
});

test('rotated group wraps its children in one rotating container div', () => {
  const { html } = render({
    masters: [{}],
    slides: [{
      rels: [],
      shapes: grp(22, [952500, 952500], [1905000, 952500], [952500, 952500], [1905000, 952500], 2700000,
        leaf(1143000, 1143000, 952500, 476250, 'r')),
    }],
  });
  assert.ok(html.includes('class="pp-group"'), 'one container for the group');
  assert.ok(html.includes('transform:rotate(45deg)'), '2700000 60000ths -> 45deg');
  assert.ok(html.includes('class="pp-el"'), 'children keep their computed boxes');
});

test('EMF-marked part: unsupported diagnostic + truthful deferred placeholder', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    ctDefaults: [{ ext: 'emf', mime: 'image/x-emf' }],
    extraParts: [{ name: 'ppt/media/old.emf', data: Buffer.alloc(16) }],
    slides: [{
      rels: [{ id: 'rIdEmf', target: '../media/old.emf' }],
      pictures: [{ rel: 'rIdEmf' }],
    }],
  });
  const diag = diagnostics.items.find(d => d.kind === 'unsupported' && /old\.emf.*EMF\/WMF\/TIFF/.test(d.msg));
  assert.ok(diag, 'unsupported diagnostic names the part: ' + JSON.stringify(diagnostics.items));
  assert.ok(html.includes('[image: EMF/WMF/TIFF deferred]'), 'placeholder marks the gap');
  assert.ok(html.includes('border:2px dashed'), 'dashed border keeps the layout position truthful');
});

test('asvg blip: SVG part preferred over the raster fallback', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    extraParts: [
      { name: 'ppt/media/pic1.png', data: PNG_1PX },
      { name: 'ppt/media/logo.svg', data: SVG_LOGO },
    ],
    slides: [{
      rels: [
        { id: 'rIdPng', target: '../media/pic1.png' },
        { id: 'rIdSvg', target: '../media/logo.svg' },
      ],
      pictures: [{ rel: 'rIdPng', svgRel: 'rIdSvg' }],
    }],
  });
  const m = /class="pp-img" src="data:([^;]+);base64,([^"]+)"/.exec(html);
  assert.ok(m, 'img emitted with a data URI');
  assert.equal(m[1], 'image/svg+xml', 'the SVG part won over the PNG');
  assert.ok(Buffer.from(m[2], 'base64').toString('utf8').includes('<svg'), 'SVG content round-trips');
  assert.equal(diagnostics.hasErrors, false);
});

test('connectors reach the shape path: line geometry, arrowheads included', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{
      rels: [],
      shapes:
        `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="50" name="Straight Connector"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
        `<p:spPr><a:xfrm><a:off x="952500" y="952500"/><a:ext cx="952500" cy="381000"/></a:xfrm>` +
        `<a:prstGeom prst="line"><a:avLst/></a:prstGeom>` +
        `<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill>` +
        `<a:tailEnd type="triangle"/></a:ln></p:spPr>` +
        `<p:style><a:lnRef idx=\"1\"><a:schemeClr val=\"accent1\"/></a:lnRef><a:fillRef idx=\"3\"><a:schemeClr val=\"accent1\"/></a:fillRef></p:style>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:cxnSp>` +
        // no prstGeom at all — the walker's line default kicks in
        `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="51" name="Bare Connector"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
        `<p:spPr><a:xfrm><a:off x="952500" y="1905000"/><a:ext cx="952500" cy="381000"/></a:xfrm>` +
        `<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:cxnSp>`,
    }],
  });
  assert.ok(html.includes('M0,40 L100,0'), 'line preset path 952500x381000 EMU -> 100x40 px');
  assert.equal((html.match(/M0,40 L100,0/g) ?? []).length, 2, 'both connectors render the line path');
  assert.ok(/marker-end="url\(#/.test(html), 'arrowheads via 01-03 svgMarkers');
  assert.ok(!diagnostics.items.some(d => /connector/i.test(d.msg)), 'no placeholder diagnostic for connectors');
});

test('OLE object graphicFrame: unsupported diagnostic, no render', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    slides: [{
      rels: [],
      shapes:
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="30" name="Object 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
        `<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="914400"/></p:xfrm>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">` +
        `<p:oleObj spid="_x0000_s1026" name="Object 1" r:id="rIdOle"><p:embed/></p:oleObj>` +
        `</a:graphicData></a:graphic></p:graphicFrame>`,
    }],
  });
  const diag = diagnostics.items.find(d => d.kind === 'unsupported' && /OLE\/ActiveX/.test(d.msg));
  assert.ok(diag, 'unsupported diagnostic for OLE');
  assert.ok(!html.includes('Object 1'), 'no content rendered for the OLE frame');
});
