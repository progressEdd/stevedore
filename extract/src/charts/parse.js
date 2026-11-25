// Chart parsing (structure follows PPTX2HTML src/pptx/chart/parse.js, MIT —
// ours keeps ONLY the cached series model: no charting library, no embedded
// workbook access, ever). Reads c:chartSpace cached data (c:strCache/c:numCache) into
// the minimal Chart model; every feature that exists in the part but is not
// carried into the minimal render is collected in `unsupported` and each
// entry also becomes an `approx` diagnostic (once per message per slide).
//
// cx:chartSpace (chartEx extensions: treemap/sunburst/funnel/…) → kind
// 'chartEx', everything else null-ish — placeholder territory.

import { parseXml } from '../util/xml.js';

// plot-area group elements -> group kind (3D variants flag an unsupported)
const GROUP_KINDS = [
  ['c:barChart', 'bar'], ['c:bar3DChart', 'bar3D'],
  ['c:lineChart', 'line'], ['c:line3DChart', 'line'],
  ['c:areaChart', 'area'], ['c:area3DChart', 'area'],
  ['c:pieChart', 'pie'], ['c:pie3DChart', 'pie'], ['c:ofPieChart', 'pie'],
  ['c:doughnutChart', 'doughnut'], ['c:scatterChart', 'scatter'],
  ['c:bubbleChart', 'bubble'], ['c:radarChart', 'radar'],
  ['c:stockChart', 'stock'],
  ['c:surfaceChart', 'surface'], ['c:surface3DChart', 'surface'],
];

const AXIS_ELEMENTS = ['c:catAx', 'c:valAx', 'c:dateAx', 'c:serAx'];

// concatenate every a:t under node (title text)
function textsOf(node, out = []) {
  if (!node) return out;
  if (node.name === 'a:t') out.push(node.textOf());
  for (const c of node.children) textsOf(c, out);
  return out;
}

// descendant search — feature elements (c:dLbls, c:trendline, …) live at any
// depth inside the plot area (per series, per group, per axis)
function findDeep(node, name) {
  if (!node) return null;
  if (node.name === name) return node;
  for (const c of node.children) {
    const found = findDeep(c, name);
    if (found) return found;
  }
  return null;
}

// c:cat / c:xVal (or c:val / c:yVal) cache points — the cache sits either
// directly (rare) or under c:strRef / c:numRef (the normal form)
function cachePoints(refParent) {
  if (!refParent) return [];
  const cache = refParent.find(['c:strCache', 'c:numCache'])
    ?? refParent.path('c:strRef/c:strCache')
    ?? refParent.path('c:numRef/c:numCache');
  if (!cache) return [];
  const pts = cache.all('c:pt').map(pt => {
    const v = pt.find('c:v')?.textOf() ?? '';
    const asNum = Number(v);
    return v !== '' && Number.isFinite(asNum) ? asNum : v;
  });
  return pts;
}

// c:val / c:yVal numbers (numCache only — values are numeric by contract)
function cacheNums(refParent) {
  return cachePoints(refParent)
    .map(v => (typeof v === 'number' ? v : Number(v)))
    .filter(Number.isFinite);
}

function seriesOf(serNode) {
  const name = serNode.find('c:tx')?.find('c:v')?.textOf()
    ?? serNode.path('c:tx/c:strRef/c:strCache/c:pt/c:v')?.textOf() ?? '';
  const cats = cachePoints(serNode.find(['c:cat', 'c:xVal']));
  const vals = cacheNums(serNode.find(['c:val', 'c:yVal']));
  return { name, cats, vals };
}

export function parseChart(chartPartXml, ctx) {
  const root = typeof chartPartXml === 'string' ? parseXml(chartPartXml) : chartPartXml;
  if (!root) return null;

  // chartEx extension namespace → placeholder model, no cached series to read
  if (root.name === 'cx:chartSpace') {
    const chart = {
      kind: 'chartEx', title: null, plotGroups: [], axes: [], legend: null,
      unsupported: ['chartEx'],
    };
    unsupportedDiag(chart, ctx);
    return chart;
  }
  if (root.name !== 'c:chartSpace') return null; // not a chart part — caller decides

  const { diag } = ctx;
  const chart = {
    kind: null, title: null,
    plotGroups: [],
    axes: [],
    legend: null,
    unsupported: [],
  };

  const chartEl = root.find('c:chart');
  if (!chartEl) return null;
  chart.title = textsOf(chartEl.find('c:title')).join('') || null;

  const plotArea = chartEl.find('c:plotArea');

  if (plotArea) {
    for (const [name, kind] of GROUP_KINDS) {
      for (const group of plotArea.all(name)) {
        chart.plotGroups.push({
          kind,
          barDir: group.find('c:barDir')?.attr('val', 'col') ?? 'col',
          grouping: group.find('c:grouping')?.attr('val', 'clustered') ?? 'clustered',
          series: group.all('c:ser').map(seriesOf),
        });
        if (name.includes('3D')) chart.unsupported.push('3D');
        if (name === 'c:ofPieChart') chart.unsupported.push('ofPie');
      }
    }
    for (const axis of AXIS_ELEMENTS.flatMap(a => plotArea.all(a))) {
      chart.axes.push({
        orient: axis.path('c:scaling/c:orientation')?.attr('val', 'minMax') ?? 'minMax',
        pos: axis.find('c:axPos')?.attr('val', 'l') ?? 'l',
        delete: axis.find('c:delete')?.attr('val', '0') === '1',
        title: textsOf(axis.find('c:title')).join('') || null,
        numFmt: axis.find('c:numFmt')?.attr('formatCode', '') ?? '',
      });
    }
    // secondary axes: more than one cat or val axis attached to the plot
    if ((plotArea.all('c:catAx').length > 1) || (plotArea.all('c:valAx').length > 1))
      chart.unsupported.push('secondary axes');
    // feature probes anywhere inside the plot area
    if (findDeep(plotArea, 'c:trendline')) chart.unsupported.push('trendlines');
    if (findDeep(plotArea, 'c:errBars')) chart.unsupported.push('error bars');
    if (findDeep(plotArea, 'c:dLbls')) chart.unsupported.push('data labels');
    if (findDeep(plotArea, 'c:multiLvlStrRef')) chart.unsupported.push('multi-level categories');
  }

  chart.legend = chartEl.find('c:legend')
    ? { pos: chartEl.path('c:legend/c:legendPos')?.attr('val', 'r') ?? 'r' }
    : null;

  // chart kind: combo when several plot groups share the plot area
  chart.kind = chart.plotGroups.length > 1 ? 'combo'
    : chart.plotGroups[0]?.kind ?? null;

  unsupportedDiag(chart, ctx);
  return chart;
}

// every unsupported feature is ALSO an approx diagnostic — the honesty rule
function unsupportedDiag(chart, ctx) {
  for (const feature of chart.unsupported)
    ctx?.diag?.addOnce('approx', `chart feature ${feature} rendered without fidelity`, ctx.slideIndex ?? null);
}

// NOTE: embedded workbook (c:externalData r:id) is deliberately NEVER opened
// — cached values are the design, exactly like upstream.
