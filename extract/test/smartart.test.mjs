// SmartArt tests (decision 21) — the pre-rendered dsp: drawing walks through
// the SAME slide element walker (walkSpTree, no duplicated dispatch): real
// shapes, real geometry SVG, real text, inside the frame box, zero
// diagnostics. A data part without the pre-rendered drawing degrades to the
// honest placeholder + exactly one `unsupported` diagnostic.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { buildDeck } from './lib/deck.mjs';

const render = (spec) => convert(buildDeck(spec));

const DGM_NS = 'xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"';
const DSP_NS = 'xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram"';
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const DATA_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData';
const DRAWING_REL = 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing';

// frame at 96,96 px, 480x288 — dgm:relIds@r:dm points at the data part
const SMARTART_FRAME =
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="32" name="Diagram 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
  `<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="2743200"/></p:xfrm>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">` +
  `<dgm:relIds ${DGM_NS} ${R_NS} r:dm="rIdDm" r:lo="rIdLo" r:qs="rIdQs" r:cs="rIdCs"/>` +
  `</a:graphicData></a:graphic></p:graphicFrame>`;

const slideRels = [
  { id: 'rIdDm', target: '../diagrams/data1.xml', type: DATA_REL },
];

const DATA_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<dgm:dataModel ${DGM_NS} ${A_NS}>
  <dgm:ptLst>
    <dgm:pt modelId="{1}" type="doc"><dgm:t><a:p><a:r><a:t>My Diagram</a:t></a:r></a:p></dgm:t></dgm:pt>
  </dgm:ptLst>
</dgm:dataModel>`;

// the pre-rendered drawing: one dsp:sp (roundRect, filled, with text) at
// page-absolute coordinates INSIDE the frame box (no scale-to-fit expected)
const DRAWING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<dsp:drawing ${DSP_NS} ${A_NS}>
  <dsp:spTree>
    <dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr>
    <dsp:grpSpPr/>
    <dsp:sp>
      <dsp:nvSpPr><dsp:cNvPr id="1" name="Node 1"/><dsp:cNvSpPr/></dsp:nvSpPr>
      <dsp:spPr>
        <a:xfrm><a:off x="1000000" y="1100000"/><a:ext cx="2000000" cy="1000000"/></a:xfrm>
        <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
        <a:solidFill><a:srgbClr val="4472C4"/></a:solidFill>
      </dsp:spPr>
      <dsp:txBody>
        <a:bodyPr/><a:lstStyle/>
        <a:p><a:r><a:rPr lang="en-US" sz="2400"/><a:t>Node One</a:t></a:r></a:p>
      </dsp:txBody>
    </dsp:sp>
  </dsp:spTree>
</dsp:drawing>`;

test('pre-rendered drawing: full shape rendering through the shared walker, zero diagnostics', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    extraParts: [
      { name: 'ppt/diagrams/data1.xml', data: DATA_XML },
      { name: 'ppt/diagrams/drawing1.xml', data: DRAWING_XML },
      {
        name: 'ppt/diagrams/_rels/data1.xml.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rIdDraw" Type="${DRAWING_REL}" Target="drawing1.xml"/>` +
          `</Relationships>`,
      },
    ],
    slides: [{ rels: slideRels, shapes: SMARTART_FRAME }],
  });
  assert.ok(html.includes('Node One'), 'drawing text rendered');
  assert.ok(html.includes('pp-geom'), 'shape geometry SVG rendered');
  assert.ok(/<path d="M/.test(html), 'real preset path geometry');
  assert.ok(html.includes('fill="#4472c4"'), 'shape fill through the paint engine');
  // inside the frame box: the frame .pp-el at 96,96 and the child relative to it
  const frameAt = html.indexOf('left:96px;top:96px');
  assert.ok(frameAt > 0, 'frame box positioned by its p:xfrm');
  const inside = html.slice(frameAt);
  assert.ok(inside.includes('left:9px'), 'child at frame-relative position (105px absolute - 96px frame)');
  assert.equal(diagnostics.items.length, 0, 'pre-rendered SmartArt is free fidelity — no diagnostics: '
    + JSON.stringify(diagnostics.items));
});

test('absent pre-rendered drawing: placeholder with title + exactly one unsupported diagnostic', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    extraParts: [
      { name: 'ppt/diagrams/data1.xml', data: DATA_XML },
      // NOTE: no ppt/diagrams/_rels/data1.xml.rels — no drawing relationship
    ],
    slides: [{ rels: slideRels, shapes: SMARTART_FRAME }],
  });
  assert.ok(html.includes('pp-smartart-approx'), 'placeholder div emitted');
  assert.ok(html.includes('layout engine deferred'), 'placeholder names the deferred engine');
  assert.ok(html.includes('My Diagram'), 'diagram title read from dgm:pt[@type=doc]');
  assert.ok(!html.includes('Node One'), 'no shapes without the drawing');
  const unsupported = diagnostics.items.filter(d => d.kind === 'unsupported');
  assert.equal(unsupported.length, 1, 'exactly one unsupported diagnostic');
  assert.match(unsupported[0].msg, /SmartArt layout engine deferred — pre-rendered drawing absent/);
  assert.equal(diagnostics.hasErrors, false);
});
