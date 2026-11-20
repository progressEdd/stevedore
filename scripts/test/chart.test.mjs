// Chart tests (decision 21 minimal render tier) — cached-values parsing only
// (no xlsx access, ever), clustered bars as plain rects in one inline SVG
// with the fixed palette, the hidden machine-readable data table, `approx`
// diagnostics for knowingly-simplified features (c:dLbls here), and chartEx
// parts degrading to an honest placeholder.

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { buildDeck } from './lib/deck.mjs';

const render = (spec) => convert(buildDeck(spec));

const C_NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"';
const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const strRef = (f, v) =>
  `<c:strRef><c:f>${f}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${v}</c:v></c:pt></c:strCache></c:strRef>`;
const catRef = () =>
  `<c:strRef><c:f>Sheet1!$A$2:$A$4</c:f><c:strCache><c:ptCount val="3"/>` +
  `<c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt><c:pt idx="2"><c:v>Q3</c:v></c:pt></c:strCache></c:strRef>`;
const numRef = (f, vals) =>
  `<c:numRef><c:f>${f}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${vals.length}"/>` +
  vals.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('') + `</c:numCache></c:numRef>`;

// barChart, 2 series x 3 cats, a c:dLbls block deliberately included (approx)
const CHART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace ${C_NS} ${A_NS} ${R_NS}>
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Quarterly Sales</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea><c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:ser><c:idx val="0"/><c:order val="0"/><c:tx>${strRef('Sheet1!$B$1', 'North')}</c:tx>
          <c:dLbls><c:showLegendKey val="0"/></c:dLbls>
          <c:cat>${catRef()}</c:cat><c:val>${numRef('Sheet1!$B$2:$B$4', [3, 7, 5])}</c:val></c:ser>
        <c:ser><c:idx val="1"/><c:order val="1"/><c:tx>${strRef('Sheet1!$C$1', 'South')}</c:tx>
          <c:cat>${catRef()}</c:cat><c:val>${numRef('Sheet1!$C$2:$C$4', [2, 4, 6])}</c:val></c:ser>
        <c:axId val="111"/><c:axId val="112"/>
      </c:barChart>
      <c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:delete val="0"/></c:catAx>
      <c:valAx><c:axId val="112"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:delete val="0"/><c:numFmt formatCode="General" sourceLinked="1"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/></c:legend>
    <c:externalData r:id="rIdXlsx"><c:autoUpdate val="0"/></c:externalData>
  </c:chart>
</c:chartSpace>`;

// chartEx part (treemap etc.) — extension namespace, no cached series model
const CHARTEX_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cx:chartSpace xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" ${A_NS}>
  <cx:chartData><cx:data id="0"/></cx:chartData>
</cx:chartSpace>`;

const chartFrame = (rid, extraNs) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="31" name="Chart 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
  `<p:xfrm><a:off x="914400" y="914400"/><a:ext cx="5486400" cy="3200400"/></p:xfrm>` +
  `<a:graphic><a:graphicData uri="${extraNs ? 'http://schemas.microsoft.com/office/drawing/2014/chartex' : 'http://schemas.openxmlformats.org/drawingml/2006/chart'}"${extraNs ? ` ${extraNs}` : ''}>` +
  `${extraNs ? `<cx:chartEx r:id="${rid}"/>` : `<c:chart ${C_NS} ${R_NS} r:id="${rid}"/>`}` +
  `</a:graphicData></a:graphic></p:graphicFrame>`;

test('bar chart: 2x3 cached values -> one inline SVG with 6 rects, palette colors, hidden data table', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    extraParts: [{ name: 'ppt/charts/chart1.xml', data: CHART_XML }],
    slides: [{
      rels: [{ id: 'rIdChart', target: '../charts/chart1.xml', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart' }],
      shapes: chartFrame('rIdChart'),
    }],
  });
  assert.ok(html.includes('<svg'), 'inline SVG emitted');
  assert.equal((html.match(/<svg/g) ?? []).length, 1, 'exactly one SVG (the chart)');
  assert.ok(html.includes('pp-chart-title'), 'title div present');
  assert.ok(html.includes('Quarterly Sales'), 'title text rendered');
  assert.equal((html.match(/<rect /g) ?? []).length, 6, '2 series x 3 categories = 6 rects');
  assert.ok(html.includes('#4472c4') && html.includes('#ed7d31'), 'fixed palette series colors');
  // hidden machine-readable data table carries every cached value + names
  assert.ok(html.includes('pp-chart-data'), 'hidden data div present');
  const data = html.slice(html.indexOf('pp-chart-data'));
  assert.ok(data.includes('hidden'), 'data table is hidden');
  for (const v of [3, 7, 5, 2, 4, 6]) assert.ok(data.includes(`<td>${v}</td>`), `value ${v} in the data table`);
  assert.ok(data.includes('North') && data.includes('South'), 'series names in the data table');
  assert.ok(data.includes('Q1') && data.includes('Q3'), 'categories in the data table');
  // deliberately included c:dLbls -> approx diagnostic naming the feature
  const approx = diagnostics.items.filter(d => d.kind === 'approx');
  assert.ok(approx.some(d => /data labels/.test(d.msg)), 'approx diagnostic for c:dLbls: ' + JSON.stringify(diagnostics.items));
  assert.ok(!diagnostics.items.some(d => /graphicFrame content \(later plan\)/.test(d.msg)),
    'the 01-02 generic graphicFrame diagnostic is gone for charts');
  assert.equal(diagnostics.hasErrors, false);
});

test('chartEx part: placeholder + approx diagnostics, no SVG bars', () => {
  const { html, diagnostics } = render({
    masters: [{}],
    extraParts: [{ name: 'ppt/charts/chartEx1.xml', data: CHARTEX_XML }],
    slides: [{
      rels: [{ id: 'rIdCx', target: '../charts/chartEx1.xml', type: 'http://schemas.microsoft.com/office/2014/relationships/chartEx' }],
      shapes: chartFrame('rIdCx', 'xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"'),
    }],
  });
  assert.ok(html.includes('pp-chart-approx'), 'placeholder div emitted');
  assert.ok(/approximated \(chartEx\)/.test(html), 'placeholder names chartEx as the approximation');
  assert.equal((html.match(/<rect /g) ?? []).length, 0, 'no bar rects for chartEx');
  assert.ok(diagnostics.items.some(d => d.kind === 'approx' && /chartEx/.test(d.msg)),
    'approx diagnostics carry chartEx: ' + JSON.stringify(diagnostics.items));
  assert.equal(diagnostics.hasErrors, false);
});

test('parse is cache-only: no xlsx/zip access in the charts module', async () => {
  const fs = await import('node:fs');
  const parse = fs.readFileSync('scripts/src/charts/parse.js', 'utf8');
  const chartsRender = fs.readFileSync('scripts/src/charts/render.js', 'utf8');
  for (const src of [parse, chartsRender]) {
    assert.ok(!/xlsx|\.zip|zip\.js|rels\(/i.test(src), 'no workbook or package access: charts read caches only');
  }
});
