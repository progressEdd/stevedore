// Table tests (adapted from PPTX2HTML, MIT) — a:tbl graphicFrames as semantic
// <table>/<tr>/<td>: merged cells via colspan on the origin with continuation
// cells emitting nothing, direct per-cell borders beating table-style parts,
// banding/edge fills from an injected ppt/tableStyles.xml, and the legit
// absence of tableStyles.xml (pptxgenjs) costing nothing — no diagnostic.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { buildDeck } from './lib/deck.mjs';

const render = (spec) => convert(buildDeck(spec));

const TABLE_STYLE_ID = '{5940675A-B579-460E-94D1-54222C63F5DA}';

// one 3x3 table: gridSpan=2 at row0col0 (+hMerge continuation), vMerge
// continuation at row1col1, a red a:lnL on row1col0, firstRow=1 + bandRow=1
// referencing a tableStyleId present in the injected tableStyles.xml
const TABLE_XML =
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="30" name="Table 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
  `<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="5486400" cy="1371600"/></p:xfrm>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
  `<a:tbl><a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${TABLE_STYLE_ID}</a:tableStyleId></a:tblPr>` +
  `<a:tblGrid><a:gridCol w="1828800"/><a:gridCol w="1828800"/><a:gridCol w="1828800"/></a:tblGrid>` +
  `<a:tr h="457200">` +
  `<a:tc gridSpan="2"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2800"/><a:t>Header A</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>` +
  `<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr/></a:tc>` +
  `</a:tr>` +
  `<a:tr h="457200">` +
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>B1</a:t></a:r></a:p></a:txBody>` +
  `<a:tcPr><a:lnL w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:prstDash val="solid"/></a:lnL></a:tcPr></a:tc>` +
  `<a:tc vMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr/></a:tc>` +
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>C1</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>` +
  `</a:tr>` +
  `<a:tr h="457200">` +
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>D2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>` +
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>E2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>` +
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2000"/><a:t>F2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>` +
  `</a:tr>` +
  `</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;

// tableStyles.xml: wholeTbl grey borders, firstRow accent1 fill, band1H/band2H
const TABLE_STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${TABLE_STYLE_ID}">` +
  `<a:tblStyle styleId="${TABLE_STYLE_ID}" styleName="Test Style 1">` +
  `<a:wholeTbl><a:tcPr>` +
  `<a:lnL w="12700"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnL>` +
  `<a:lnR w="12700"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnR>` +
  `<a:lnT w="12700"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnT>` +
  `<a:lnB w="12700"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:lnB>` +
  `</a:tcPr></a:wholeTbl>` +
  `<a:firstRow><a:fill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fill></a:firstRow>` +
  `<a:band1H><a:fill><a:solidFill><a:srgbClr val="E8E8FF"/></a:solidFill></a:fill></a:band1H>` +
  `<a:band2H><a:fill><a:solidFill><a:srgbClr val="F0F0F0"/></a:solidFill></a:fill></a:band2H>` +
  `</a:tblStyle></a:tblStyleLst>`;

const tableDeck = (withStyles) => ({
  masters: [{}],
  ...(withStyles ? { extraParts: [{ name: 'ppt/tableStyles.xml', data: TABLE_STYLES_XML }] } : {}),
  slides: [{ rels: [], shapes: TABLE_XML }],
});

test('table: semantic <table> with colgroup, spans, per-cell borders, banding, run text', () => {
  const { html, diagnostics } = render(tableDeck(true));
  assert.ok(html.includes('<table'), 'semantic <table> emitted');
  assert.ok(html.includes('border-collapse:collapse'), 'collapse style present');
  assert.ok(html.includes('table-layout:fixed'), 'fixed layout present');
  assert.ok(html.includes('<colgroup>'), 'colgroup present');
  assert.equal((html.match(/<col /g) ?? []).length, 3, 'one <col> per grid column');
  assert.ok(html.includes('colspan="2"'), 'gridSpan=2 renders as colspan');
  assert.equal((html.match(/<td/g) ?? []).length, 6,
    'continuation cells emit no <td>: 1 (row0) + 2 (row1) + 3 (row2)');
  assert.ok(html.includes('border-left:2px solid #ff0000'),
    'direct red a:lnL renders as a CSS left border (19050 EMU -> 2px)');
  assert.ok(html.includes('border-left:1px solid #bfbfbf'),
    'wholeTbl style-part border on a cell without direct lnL');
  assert.ok(html.includes('background:#4472c4'),
    'firstRow flag applies the style part fill (accent1) to the header row');
  assert.ok(html.includes('background:#e8e8ff'), 'band1H fill on the first body row');
  assert.ok(html.includes('background:#f0f0f0'), 'band2H fill on the second body row');
  assert.ok(html.includes('<span style='), 'cell text goes through the run engine');
  assert.ok(html.includes('Header A') && html.includes('F2'), 'cell texts rendered');
  assert.ok(!diagnostics.items.some(d => /graphicFrame/i.test(d.msg)),
    'no 01-02 graphicFrame-later-plan diagnostic for tables');
  assert.equal(diagnostics.hasErrors, false);
});

test('table: absent tableStyles.xml is legitimate — style null, flags ignored, no diagnostic', () => {
  const { html, diagnostics } = render(tableDeck(false));
  assert.ok(html.includes('<table'), 'the table still renders');
  assert.ok(html.includes('colspan="2"'), 'spans still render');
  assert.ok(html.includes('border-left:2px solid #ff0000'), 'direct formatting unaffected');
  assert.ok(!html.includes('background:#4472c4') && !html.includes('background:#e8e8ff'),
    'no style-part fills without tableStyles.xml');
  assert.equal(diagnostics.items.length, 0, 'zero diagnostics — absence is not an event');
});
