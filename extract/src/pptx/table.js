// Table parsing (adapted from PPTX2HTML src/pptx/table.js + tablestyles.js,
// MIT) — an a:tbl graphicFrame into the structured Table: grid column widths,
// rows of cells carrying merge flags (gridSpan/rowSpan origin, hMerge/vMerge
// continuation), per-cell direct formatting (fill, six border slots, margins,
// anchor/vert), and the table-style reference resolved against
// ppt/tableStyles.xml (band/edge parts apply where direct formatting is
// absent — direct tcPr beats style part, style part beats nothing).
//
// Absent tableStyles.xml (pptxgenjs decks: common) → style: null, flags
// ignored, NO diagnostic — that is legitimate. Diagonal borders are captured
// but not rendered (approx diagnostic, once per slide).

import { resolveFill } from './fill.js';
import { buildTextBody } from './text.js';

const EMU_PER_PX = 9525;
const px = (emu) => Math.round(emu / EMU_PER_PX);

// a:tcPr border line elements -> the six side slots of the model
const BORDER_SLOTS = [
  ['l', 'a:lnL'], ['t', 'a:lnT'], ['r', 'a:lnR'], ['b', 'a:lnB'],
  ['tl2br', 'a:lnTlToBr'], ['tr2bl', 'a:lnTrToBl'],
];

// ---- borders ------------------------------------------------------------------

// a:lnL/… -> { w, color, dash } | null. Absent line, or a line whose fill is
// noFill/unresolvable, means "do not draw" — null, so render omits the
// declaration entirely (border-collapse must not invent lines).
function borderOf(lnNode, ctx) {
  if (!lnNode) return null;
  const fill = resolveFill(lnNode, ctx);
  if (!fill || fill.kind === 'none') return null;
  let color;
  if (fill.kind === 'solid') color = fill.color;
  else { // grad/patt/blip line fills approximated to one flat color
    color = fill.kind === 'grad' ? fill.stops[0]?.color ?? null
      : fill.kind === 'patt' ? fill.fg ?? null : null;
    if (color) ctx.diag.addOnce('approx', 'table border fill approximated (solid)', ctx.slideIndex ?? null);
  }
  if (!color) return null;
  return {
    w: Math.max(1, px(lnNode.num('w', 9525 * 0.75))), // hairline clamp, as lines
    color,
    dash: lnNode.find('a:prstDash')?.attr('val', 'solid') ?? 'solid',
  };
}

// the six border slots of one tcPr-ish node (a:tcPr, or a table-style part)
function bordersOf(container, ctx) {
  const borders = {};
  for (const [slot, name] of BORDER_SLOTS) borders[slot] = borderOf(container?.find(name), ctx);
  return borders;
}

// ---- cells ----------------------------------------------------------------------

// buildTextBody ctx for a table cell: no placeholder chain, no master/layout
// prompts — cell text inherits only its own lstStyle + pPr (+ rPr).
function cellTextCtx(ctx) {
  return {
    theme: ctx.theme ?? null, diag: ctx.diag, slideIndex: ctx.slideIndex ?? null,
    phChain: [null, null, null], ph: null,
    masterRoot: null, defaultTextStyle: null,
    pkg: ctx.pkg ?? null, partName: ctx.partName ?? null,
  };
}

function cellOf(tcNode, ctx) {
  const tcPr = tcNode.find('a:tcPr');
  const borders = bordersOf(tcPr, ctx);
  if (borders.tl2br || borders.tr2bl)
    ctx.diag.addOnce('approx', 'table diagonal borders not rendered', ctx.slideIndex ?? null);
  const txBody = tcNode.children.find(c => c.name === 'a:txBody') ?? null;
  return {
    gridSpan: tcNode.int('gridSpan', 1),
    rowSpan: tcNode.int('rowSpan', 1),
    hMerge: tcNode.bool('hMerge'), // continuation of a horizontal merge -> emits nothing
    vMerge: tcNode.bool('vMerge'), // continuation of a vertical merge -> emits nothing
    fill: tcPr ? resolveFill(tcPr, ctx) : null,
    borders,
    marL: px(tcPr?.num('marL', 91440)),
    marR: px(tcPr?.num('marR', 91440)),
    marT: px(tcPr?.num('marT', 45720)),
    marB: px(tcPr?.num('marB', 45720)),
    anchor: tcPr?.attr('anchor') ?? 't',
    vert: tcPr?.attr('vert') ?? 'horz', // captured raw; cell-level writing-mode is a later fidelity tier
    text: buildTextBody(txBody, cellTextCtx(ctx)),
  };
}

// ---- table styles ---------------------------------------------------------------

// a:tblStyle part elements -> model keys
const STYLE_PARTS = ['wholeTbl', 'band1H', 'band2H', 'band1V', 'band2V', 'firstRow', 'lastRow', 'firstCol', 'lastCol'];

// one part -> { fill, borders }. The part's fill sits directly under the part
// element, inside an <a:fill> wrapper, or inside its a:tcPr (producers differ);
// borders always live in the part's a:tcPr ln* children.
function stylePartOf(partEl, fctx) {
  if (!partEl) return null;
  const fill = resolveFill(partEl, fctx)
    ?? resolveFill(partEl.find('a:fill'), fctx)
    ?? resolveFill(partEl.find('a:tcPr'), fctx);
  return { fill, borders: bordersOf(partEl.find('a:tcPr'), fctx) };
}

// ppt/tableStyles.xml -> Map<styleId, { wholeTbl, band1H, … }>. Absent file →
// empty map, no diagnostic (legitimate: pptxgenjs writes no styles part).
// NOTE: theme is passed beyond the plan's (pkg, diag) sketch — schemeClr
// resolution (the norm inside tableStyles.xml) requires the theme model.
export function loadTableStyles(pkg, diag, theme = null) {
  const out = new Map();
  if (!pkg.has('ppt/tableStyles.xml')) return out;
  let root = null;
  try {
    root = pkg.xml('ppt/tableStyles.xml');
  } catch (err) {
    diag.add('error', `failed to load ppt/tableStyles.xml: ${err.message}`);
    return out;
  }
  const fctx = { theme, diag };
  for (const styleEl of root.all('a:tblStyle')) {
    const id = styleEl.attr('styleId', '');
    if (!id) continue;
    const parts = {};
    for (const part of STYLE_PARTS) parts[part] = stylePartOf(styleEl.find(`a:${part}`), fctx);
    out.set(id, parts);
  }
  return out;
}

// one tableStyles parse per package (render may hit many tables per deck)
const tableStyleCache = new WeakMap();
function tableStylesOf(ctx) {
  if (!tableStyleCache.has(ctx.pkg))
    tableStyleCache.set(ctx.pkg, loadTableStyles(ctx.pkg, ctx.diag, ctx.theme));
  return tableStyleCache.get(ctx.pkg);
}

// ---- the table -------------------------------------------------------------------

// buildTable(graphicFrameNode, ctx) -> Table | null. null (no diagnostic) when
// the frame is not a table — the caller decides what other kinds mean.
// ctx = { pkg, diag, theme, slideIndex, partName } (render-side assembly).
export function buildTable(graphicFrameNode, ctx) {
  const tbl = graphicFrameNode?.path('a:graphic/a:graphicData')?.find('a:tbl') ?? null;
  if (!tbl) return null;

  const cols = tbl.all('a:tblGrid').flatMap(grid => grid.all('a:gridCol')).map(c => px(c.int('w', 0)));
  const rows = tbl.all('a:tr').map(tr => ({
    hPx: px(tr.int('h', 0)),
    cells: tr.all('a:tc').map(tc => cellOf(tc, ctx)),
  }));

  const tblPr = tbl.find('a:tblPr');
  const styleRef = tblPr
    ? {
        id: tblPr.find('a:tableStyleId')?.textOf().trim() || null,
        firstRow: tblPr.bool('firstRow'),
        lastRow: tblPr.bool('lastRow'),
        firstCol: tblPr.bool('firstCol'),
        lastCol: tblPr.bool('lastCol'),
        bandRow: tblPr.bool('bandRow'),
        bandCol: tblPr.bool('bandCol'),
      }
    : null;
  const style = styleRef?.id ? tableStylesOf(ctx).get(styleRef.id) ?? null : null;

  return { cols, rows, styleRef, style };
}
