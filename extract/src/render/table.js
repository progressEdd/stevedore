// Table rendering (adapted from PPTX2HTML, MIT) — the parsed Table into a
// semantic <table> (decision 15): real <tr>/<td> with colspan/rowspan;
// continuation cells (hMerge/vMerge) emit NOTHING — the span origin carries
// the attributes. Absent borders mean "do not draw": the declaration is
// OMITTED so border-collapse cannot invent lines. Direct cell formatting
// beats the table-style part (band/edge fills), which beats nothing.
// Gradient/pattern fills embed an svgPaint mini-SVG as a base64 data URI.

import { svgPaint } from './paint.js';
import { renderText } from './text.js';

// a:prstDash val -> CSS border-style
const BORDER_DASH = {
  solid: 'solid', dot: 'dotted', sysDot: 'dotted', dash: 'dashed', sysDash: 'dashed',
  lgDash: 'dashed', lgDashDot: 'dashed', lgDashDotDot: 'dashed',
  dashDot: 'dashed', dashDotDot: 'dashed',
};

// a:tcPr@anchor -> CSS vertical-align
const ANCHOR = { t: 'top', ctr: 'middle', b: 'bottom' };

// one side -> `border-left:2px dashed #f00`, or null when "do not draw"
function borderDecl(prop, b) {
  if (!b) return null;
  return `${prop}:${b.w}px ${BORDER_DASH[b.dash] ?? 'solid'} ${b.color}`;
}

// Fill -> CSS declarations. Solid stays a plain background color; grad/patt
// (and blip) embed the svgPaint output as a standalone mini-SVG data URI —
// self-contained background-image, no external <defs> coupling.
function fillDecls(fill, rctx) {
  if (!fill || fill.kind === 'none') return [];
  if (fill.kind === 'solid') return fill.color ? [`background:${fill.color}`] : [];
  const paint = svgPaint(fill, 'pp-tbl-f', rctx); // ids inside the data URI are self-contained
  if (!paint) return [];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" preserveAspectRatio="none">` +
    (paint.defs ? `<defs>${paint.defs}</defs>` : '') +
    `<rect x="0" y="0" width="8" height="8" fill="${paint.attr}"/></svg>`;
  return [`background-image:url(data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')})`];
}

// the style part a grid cell falls into: edge parts for flagged edges, band
// parts for the body, else null. col is the cell's starting grid column.
function stylePartFor(table, r, col) {
  const { styleRef, style } = table;
  if (!styleRef || !style) return null;
  const lastRowIdx = table.rows.length - 1;
  const lastColIdx = table.cols.length - 1;
  if (styleRef.firstRow && r === 0) return style.firstRow ?? null;
  if (styleRef.lastRow && r === lastRowIdx) return style.lastRow ?? null;
  if (styleRef.firstCol && col === 0) return style.firstCol ?? null;
  if (styleRef.lastCol && col === lastColIdx) return style.lastCol ?? null;
  const rowOffset = styleRef.firstRow ? 1 : 0;
  const colOffset = styleRef.firstCol ? 1 : 0;
  if (styleRef.bandRow) {
    const band = (r - rowOffset) % 2 === 0 ? style.band1H : style.band2H; // first body row carries band1H
    if (band) return band;
  }
  if (styleRef.bandCol) {
    const band = (col - colOffset) % 2 === 0 ? style.band1V : style.band2V; // first body col carries band1V
    if (band) return band;
  }
  return null;
}

// effective side border: direct tcPr beats style part beats wholeTbl beats none
function borderAt(cell, part, whole, side) {
  return cell.borders[side] ?? part?.borders[side] ?? whole?.borders[side] ?? null;
}

export function renderTable(table, rctx, opts = {}) {
  if (!table) return '';
  const W = table.cols.reduce((a, b) => a + b, 0);
  const whole = table.style?.wholeTbl ?? null;

  const trs = table.rows.map((row, r) => {
    const tds = [];
    let col = 0; // running grid column of the next cell
    for (const cell of row.cells) {
      if (cell.hMerge || cell.vMerge) { col += cell.gridSpan; continue; } // continuation: nothing
      const part = stylePartFor(table, r, col);
      const fill = cell.fill ?? part?.fill ?? whole?.fill ?? null;
      const style = [];
      const sides = [
        ['border-left', borderAt(cell, part, whole, 'l')],
        ['border-top', borderAt(cell, part, whole, 't')],
        ['border-right', borderAt(cell, part, whole, 'r')],
        ['border-bottom', borderAt(cell, part, whole, 'b')],
      ];
      for (const [prop, b] of sides) {
        const d = borderDecl(prop, b);
        if (d) style.push(d);
      }
      style.push(`padding:${cell.marT}px ${cell.marR}px ${cell.marB}px ${cell.marL}px`);
      style.push(...fillDecls(fill, rctx));
      style.push(`vertical-align:${ANCHOR[cell.anchor] ?? 'top'}`);
      style.push('text-align:inherit');
      const span = `${cell.gridSpan > 1 ? ` colspan="${cell.gridSpan}"` : ''}${cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''}`;
      tds.push(`    <td${span} style="${style.join(';')}">${renderText(cell.text, null, rctx, { titleLevel: 0 })}</td>`);
      col += cell.gridSpan;
    }
    return `  <tr style="height:${row.hPx}px">\n${tds.join('\n')}\n  </tr>`;
  });

  return `<table class="pp-tbl" style="border-collapse:collapse;width:${W}px;table-layout:fixed">\n` +
    `  <colgroup>${table.cols.map(w => `<col style="width:${w}px">`).join('')}</colgroup>\n` +
    `${trs.join('\n')}\n</table>`;
}
