// Chart rendering (decision 21: "charts parsed → minimal render +
// diagnostics") — our own minimal SVG from the cached model, no charting
// library: clustered/stacked bars (col or bar direction), lines, areas with
// 30% alpha, pies/doughnuts from value shares, scatter plotted by rank
// (approx). Radar/stock/surface/bubble/combo/chartEx render a styled
// placeholder. A hidden machine-readable data table keeps the output honest
// while visuals stay minimal. Palette: the six Office accents.

import { escapeXml } from '../util/xml.js';

const PALETTE = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'];
const colorOf = (i) => PALETTE[i % PALETTE.length];
const num = (v) => Number(v.toFixed(2));

const PLACEHOLDER_KINDS = new Set(['radar', 'stock', 'surface', 'bubble', 'combo', 'chartEx', null]);

// value range across a group's series (bars/lines share one value scale)
function rangeOf(series) {
  let lo = 0, hi = 0;
  for (const s of series) for (const v of s.vals) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) hi = lo + 1; // flat data — any nonzero span
  return { lo, hi };
}

// ---- bars ---------------------------------------------------------------------

function barSvg(group, W, H) {
  const stacked = group.grouping === 'stacked' || group.grouping === 'percentStacked';
  const horizontal = group.barDir === 'bar';
  const n = Math.max(1, group.series[0]?.cats.length || group.series[0]?.vals.length || 1);
  const m = Math.max(1, group.series.length);
  const { lo, hi } = rangeOf(group.series); // lo ≤ 0 ≤ hi by construction
  const out = [];
  if (stacked) {
    for (let i = 0; i < n; i++) {
      let acc = 0; // positive stack only (negatives rare in cached decks; clamped)
      for (let j = 0; j < m; j++) {
        const v = Math.max(0, group.series[j].vals[i] ?? 0);
        const v0 = acc, v1 = acc + v; acc = v1;
        const frac0 = (v0 - lo) / (hi - lo), frac1 = (v1 - lo) / (hi - lo);
        const [a, b] = [Math.min(frac0, frac1), Math.max(frac0, frac1)];
        if (horizontal)
          out.push(`<rect x="${num(a * W)}" y="${num((i + 0.1) * H / n)}" width="${num((b - a) * W)}" height="${num(0.8 * H / n)}" fill="${colorOf(j)}"/>`);
        else
          out.push(`<rect x="${num((i + 0.1) * W / n)}" y="${num((1 - b) * H)}" width="${num(0.8 * W / n)}" height="${num((b - a) * H)}" fill="${colorOf(j)}"/>`);
      }
    }
  } else {
    const span = hi - lo;
    const zeroPos = -lo / span; // where 0 sits along the value axis
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const v = group.series[j].vals[i] ?? 0;
        const vPos = (v - lo) / span;
        const a = Math.min(zeroPos, vPos), b = Math.max(zeroPos, vPos); // negatives hang below
        const gw = horizontal ? H / n : W / n; // group slot per category
        const slot = gw / m;
        if (horizontal)
          out.push(`<rect x="${num(a * W)}" y="${num(i * gw + j * slot + 0.1 * slot)}" width="${num((b - a) * W)}" height="${num(0.8 * slot)}" fill="${colorOf(j)}"/>`);
        else
          out.push(`<rect x="${num(i * gw + j * slot + 0.1 * slot)}" y="${num((1 - b) * H)}" width="${num(0.8 * slot)}" height="${num((b - a) * H)}" fill="${colorOf(j)}"/>`);
      }
    }
  }
  return out;
}

// ---- lines / areas --------------------------------------------------------------

function linePath(vals, W, H, lo, hi) {
  const n = vals.length;
  return vals.map((v, i) => {
    const x = n > 1 ? i * W / (n - 1) : W / 2;
    const y = (1 - (v - lo) / (hi - lo)) * H;
    return `${i === 0 ? 'M' : ' L'}${num(x)},${num(y)}`;
  }).join('');
}

function lineAreaSvg(group, W, H, area) {
  const { lo, hi } = rangeOf(group.series);
  return group.series.map((s, j) => {
    const d = linePath(s.vals, W, H, lo, hi);
    if (!area) return `<path d="${d}" fill="none" stroke="${colorOf(j)}" stroke-width="2"/>`;
    const closed = `${d} L${num(W)},${num(H)} L0,${num(H)} Z`;
    return `<path d="${closed}" fill="${colorOf(j)}" fill-opacity="0.3"/>` +
      `<path d="${d}" fill="none" stroke="${colorOf(j)}" stroke-width="2"/>`;
  });
}

// ---- pies / doughnuts --------------------------------------------------------------

function arcSlice(cx, cy, r, rIn, a0, a1) {
  const p = (r, a) => `${num(cx + r * Math.cos(a))},${num(cy + r * Math.sin(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const outer = `A${num(r)},${num(r)} 0 ${large} 1 ${p(r, a1)}`;
  if (rIn <= 0) return `M${num(cx)},${num(cy)} L${p(r, a0)} ${outer} Z`;
  return `M${p(rIn, a0)} L${p(r, a0)} ${outer} L${p(rIn, a1)} ` +
    `A${num(rIn)},${num(rIn)} 0 ${large} 0 ${p(rIn, a0)} Z`;
}

function pieSvg(group, W, H, holeRatio) {
  const vals = group.series[0]?.vals ?? [];
  const total = vals.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return [];
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2, rIn = r * holeRatio;
  const out = [];
  let a = -Math.PI / 2; // 12 o'clock, clockwise
  vals.forEach((v, j) => {
    const share = Math.max(0, v) / total;
    const a1 = a + share * 2 * Math.PI;
    out.push(`<path d="${arcSlice(cx, cy, r, rIn, a, a1)}" fill="${colorOf(j)}" stroke="#ffffff" stroke-width="1"/>`);
    a = a1;
  });
  return out;
}

// ---- scatter --------------------------------------------------------------------

function scatterSvg(group, W, H, rctx) {
  rctx.diag.addOnce('approx', 'scatter plotted by rank', rctx.slideIndex ?? null);
  const { lo, hi } = rangeOf(group.series);
  const out = [];
  group.series.forEach((s, j) => {
    const n = s.vals.length;
    s.vals.forEach((v, i) => {
      const x = (i + 0.5) * W / n; // x by rank, not by x-value
      const y = (1 - (v - lo) / (hi - lo)) * H;
      out.push(`<circle cx="${num(x)}" cy="${num(y)}" r="3" fill="${colorOf(j)}"/>`);
    });
  });
  return out;
}

// ---- hidden data table --------------------------------------------------------------

function dataTable(chart) {
  const groups = chart.plotGroups.length ? chart.plotGroups : [];
  const series = groups.flatMap(g => g.series);
  const rows = [];
  if (!series.length) {
    rows.push(`    <tr><td>no cached chart data</td></tr>`);
    return `<div class="pp-chart-data" hidden>\n  <table>\n${rows.join('\n')}\n  </table>\n</div>`;
  }
  rows.push(`    <tr><td></td>${series.map((s, j) => `<th>${escapeXml(s.name || `series ${j + 1}`)}</th>`).join('')}</tr>`);
  const n = Math.max(...series.map(s => Math.max(s.cats.length, s.vals.length)));
  for (let i = 0; i < n; i++) {
    const cat = series[0].cats[i] ?? series[0].vals[i] ?? '';
    rows.push(`    <tr><th>${escapeXml(String(cat))}</th>${series.map(s => `<td>${escapeXml(String(s.vals[i] ?? ''))}</td>`).join('')}</tr>`);
  }
  return `<div class="pp-chart-data" hidden>\n  <table>\n${rows.join('\n')}\n  </table>\n</div>`;
}

// ---- the renderer ------------------------------------------------------------------

export function renderChart(chart, rctx, opts = {}) {
  if (!chart) return '';
  const W = opts.w ?? 400, H = opts.h ?? 300;
  const title = chart.title
    ? `<div class="pp-chart-title" style="font-weight:700;text-align:center;flex:none">${escapeXml(chart.title)}</div>`
    : '';

  let body;
  if (PLACEHOLDER_KINDS.has(chart.kind)) {
    // radar/stock/surface/bubble/combo/chartEx — honest placeholder
    rctx.diag.addOnce('approx', `chart kind ${chart.kind ?? 'unknown'} rendered as placeholder`, rctx.slideIndex ?? null);
    body = `<div class="pp-chart pp-chart-approx" style="flex:1;min-height:0;border:1px dashed #999;display:flex;align-items:center;justify-content:center;color:#666">` +
      `${escapeXml(chart.title || 'Chart')} — approximated (${escapeXml(chart.unsupported.join(', ') || chart.kind)})</div>`;
    return `<div class="pp-chart" style="display:flex;flex-direction:column;width:100%;height:100%">\n${title}\n${body}\n</div>\n${dataTable(chart)}`;
  }

  let shapes = [];
  for (const group of chart.plotGroups) {
    if (group.kind === 'bar' || group.kind === 'bar3D') shapes.push(...barSvg(group, W, H));
    else if (group.kind === 'line') shapes.push(...lineAreaSvg(group, W, H, false));
    else if (group.kind === 'area') shapes.push(...lineAreaSvg(group, W, H, true));
    else if (group.kind === 'pie') shapes.push(...pieSvg(group, W, H, 0));
    else if (group.kind === 'doughnut') shapes.push(...pieSvg(group, W, H, 0.5));
    else if (group.kind === 'scatter') shapes.push(...scatterSvg(group, W, H, rctx));
  }
  const svg = `<svg class="pp-chart-svg" viewBox="0 0 ${W} ${H}" style="flex:1;min-height:0;width:100%" preserveAspectRatio="none">\n${shapes.map(s => `  ${s}`).join('\n')}\n</svg>`;
  return `<div class="pp-chart" style="display:flex;flex-direction:column;width:100%;height:100%">\n${title}\n${svg}\n</div>\n${dataTable(chart)}`;
}
