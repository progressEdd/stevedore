// Shape rendering (adapted from PPTX2HTML src/render/shape.js, MIT) —
// every non-text-only sp/cxnSp/graphicFrame gets an inline SVG inside its
// .pp-el box, BEHIND the semantic text: preset/cust geometry as one path,
// fills/patterns/images as <defs>, arrows as <marker>s. Approximations
// (unknown presets, compound lines, ignored effects) funnel through
// diagnostics — rate-limited per slide via diag.addOnce.

import { shapePath } from '../geometry/geometry.js';
import { resolveFill, resolveLine, DASH_MAP } from '../pptx/fill.js';
import { svgPaint, svgMarkers } from './paint.js';

export function geometrySvg(element, rctx, idPrefix) {
  const node = element?.node;
  if (!node) return '';
  const spPr = node.path('p:spPr') ?? node.path('p:grpSpPr');
  const geom = element.geom ?? { w: 0, h: 0 };
  const { w, h } = geom;
  const fctx = { theme: rctx.theme, diag: rctx.diag, pkg: rctx.pkg, partName: rctx.partName };

  const built = shapePath(spPr, { diag: rctx.diag }, { w, h });
  const fill = spPr ? resolveFill(spPr, fctx) : null;
  const line = spPr ? resolveLine(spPr, fctx) : null;
  if (!built && !fill && !line) return ''; // nothing resolvable — plain box

  if (built?.approximated) {
    const prst = spPr?.find('a:prstGeom')?.attr('prst');
    rctx.diag.addOnce('approx', `geometry preset ${prst ?? 'custom'} approximated`, rctx.slideIndex ?? null);
  }

  // shadows/effects ignored — one diagnostic per slide, not per shape
  if (spPr?.find('a:effectLst')?.children.length)
    rctx.diag.addOnce('approx', 'shape effects ignored (a:effectLst)', rctx.slideIndex ?? null);

  const defs = [];
  const fillPaint = fill ? svgPaint(fill, `${idPrefix}-f`, rctx) : null;
  if (fillPaint?.defs) defs.push(fillPaint.defs);
  const fillAttr = fillPaint ? fillPaint.attr : 'none';

  // flipH/flipV on a:xfrm mirror the path inside its own viewport
  const xfrm = spPr?.find('a:xfrm');
  let transform = '';
  if (xfrm?.attr('flipH') === '1') transform += `translate(${w},0) scale(-1,1)`;
  if (xfrm?.attr('flipV') === '1') transform += `${transform ? ' ' : ''}translate(0,${h}) scale(1,-1)`;

  // stroke: the line's own fill (solid color, or gradient via defs)
  const strokePaint = line?.fill ? svgPaint(line.fill, `${idPrefix}-lf`, rctx) : null;
  if (strokePaint?.defs) defs.push(strokePaint.defs);
  const stroke = line ? (strokePaint ? strokePaint.attr : 'none') : 'none';

  let markers = null;
  if (line) {
    const markerColor = line.fill?.kind === 'solid' ? line.fill.color : 'black';
    markers = svgMarkers(line, `${idPrefix}-m`, markerColor);
    if (markers?.defs) defs.push(markers.defs);
  }

  const dash = line && DASH_MAP[line.dash] ? ` stroke-dasharray="${DASH_MAP[line.dash]}"` : '';
  const cap = line ? ` stroke-linecap="${line.cap}"` : '';
  const strokeAttrs = line
    ? ` stroke="${stroke}" stroke-width="${line.w}"${dash}${cap} stroke-linejoin="round"` +
      (markers ? ` marker-start="${markers.start}" marker-end="${markers.end}"` : '')
    : '';

  // compound lines (dbl/thickThin/thinThick/tri): parallel strokes at ±w/3 —
  // true compound geometry is out of scope
  let extra = '';
  if (line && line.compound && line.compound !== 'sng') {
    const off = line.w / 3;
    const offsets = line.compound === 'dbl' ? [-off, off] : [-off, 0, off];
    for (const dy of offsets)
      extra += `\n  <path d="${built?.path ?? ''}" transform="translate(0,${Number(dy.toFixed(2))})" fill="none"${strokeAttrs}/>`;
    rctx.diag.addOnce('approx', `compound line (${line.compound}) rendered as parallel strokes`, rctx.slideIndex ?? null);
  }

  const transformAttr = transform ? ` transform="${transform}"` : '';
  return `<svg class="pp-geom" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;overflow:visible">` +
    (defs.length ? `\n  <defs>${defs.join('')}</defs>` : '') +
    `\n  <path d="${built?.path ?? `M0,0 H${w} V${h} H0 Z`}" fill="${fillAttr}" fill-rule="evenodd"${transformAttr}${strokeAttrs}/>` +
    extra +
    `\n</svg>`;
}
