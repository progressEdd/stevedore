// Fill resolution (adapted from PPTX2HTML src/pptx/fill.js, MIT) — turns any
// DrawingML fill property element into a structured Fill the render layer
// converts to SVG defs / CSS. ctx = { theme, diag, pkg, partName } (pkg +
// partName only needed for blipFill rel resolution).
//
// Fill kinds:
//   { kind: 'none' }
//   { kind: 'solid', color }
//   { kind: 'grad', stops: [{ pos, color }], linear: { ang (rad) } | path: { type, ... }, flip?, tileRect? }
//   { kind: 'patt', prst, fg, bg }
//   { kind: 'blip', partName, stretch | tile }
//   { kind: 'grp' }            — inherits the group's fill; render emits an approx diagnostic
//   null                       — no fill element; the caller decides inheritance

import { resolveColor } from './color.js';

const FILL_ELEMENTS = ['a:noFill', 'a:solidFill', 'a:gradFill', 'a:pattFill', 'a:blipFill', 'a:grpFill'];
const local = (name) => (name.includes(':') ? name.slice(name.indexOf(':') + 1) : name);

function gradFill(node, ctx) {
  const out = { kind: 'grad', stops: [] };
  for (const gs of node.all('a:gsLst').flatMap(l => l.all('a:gs'))) {
    const color = resolveColor(gs.children[0] ?? null, ctx); // a:gs holds exactly one color child
    out.stops.push({ pos: gs.num('pos', 0) / 100000, color });
  }
  const lin = node.find('a:lin');
  if (lin) out.linear = { ang: (lin.num('ang', 0) / 60000) * Math.PI / 180, scaled: lin.bool('scaled'), flip: !!lin.num('flip', 0) || lin.attr('flip') === '1' };
  const pathEl = node.find('a:path');
  if (pathEl) {
    const fillToRect = pathEl.find('a:fillToRect');
    out.path = {
      type: pathEl.attr('path', 'shape'),
      ...(fillToRect ? { fillToRect: { l: fillToRect.num('l', 0), t: fillToRect.num('t', 0), r: fillToRect.num('r', 0), b: fillToRect.num('b', 0) } } : {}),
      flip: pathEl.attr('flip') === '1',
    };
  }
  const tileRect = node.find('a:tileRect');
  if (tileRect) out.tileRect = { l: tileRect.num('l', 0), t: tileRect.num('t', 0), r: tileRect.num('r', 0), b: tileRect.num('b', 0) };
  return out;
}

function pattFill(node, ctx) {
  return {
    kind: 'patt',
    prst: node.attr('prst', ''),
    fg: resolveColor(node.path('a:fgClr')?.children[0] ?? null, ctx),
    bg: resolveColor(node.path('a:bgClr')?.children[0] ?? null, ctx),
  };
}

function blipFill(node, ctx) {
  const embed = node.path('a:blip')?.attr('r:embed');
  if (!embed || !ctx.pkg || !ctx.partName) {
    ctx.diag.add('missing', 'blipFill without resolvable r:embed');
    return null;
  }
  const rel = ctx.pkg.rels(ctx.partName).find(r => r.id === embed);
  if (!rel || rel.external) { ctx.diag.add('missing', `image rel ${embed} not found`); return null; }
  const tile = node.find('a:tile');
  return {
    kind: 'blip',
    partName: ctx.pkg.resolvePartName(ctx.partName, rel.target),
    ...(node.find('a:stretch') ? { stretch: true } : {}),
    ...(tile ? { tile: { tx: tile.num('tx', 0) / 100000, ty: tile.num('ty', 0) / 100000, sx: tile.num('sx', 100000) / 100000, sy: tile.num('sy', 100000) / 100000 } } : {}),
  };
}

// resolveFill(parentNode, ctx, propName = 'a:solidFill') — looks INSIDE
// parentNode for the fill elements. propName (string or array) names fill
// elements to prefer first; then any fill element found in document order
// wins (OOXML emits exactly one fill per property, in any sibling order).
export function resolveFill(parentNode, ctx, propName = 'a:solidFill') {
  if (!parentNode) return null;
  const preferred = Array.isArray(propName) ? propName : [propName];
  const present = parentNode.children.filter(c => FILL_ELEMENTS.includes(c.name));
  if (!present.length) return null;
  const chosen = present.find(c => preferred.includes(c.name)) ?? present[0];
  try {
    switch (chosen.name) {
      case 'a:noFill': return { kind: 'none' };
      case 'a:solidFill': {
        const color = resolveColor(chosen.children.find(c => c.name.startsWith('a:')), ctx);
        return color ? { kind: 'solid', color } : null;
      }
      case 'a:gradFill': return gradFill(chosen, ctx);
      case 'a:pattFill': return pattFill(chosen, ctx);
      case 'a:blipFill': return blipFill(chosen, ctx);
      case 'a:grpFill': return { kind: 'grp' };
      default: return null;
    }
  } catch (err) {
    ctx.diag.add('approx', `unparseable fill (${err.message})`);
    return null;
  }
}

// a:prstDash@val -> SVG stroke-dasharray in stroke-width units
export const DASH_MAP = {
  solid: '', dot: '1,3', sysDot: '1,3', dash: '4,3', sysDash: '3,2',
  lgDash: '8,3', lgDashDot: '8,3,1,3', lgDashDotDot: '8,3,1,3,1,3',
  dashDot: '4,3,1,3', dashDotDot: '4,3,1,3,1,3',
};

// resolveLine(spPr, ctx) -> Line | null — { w (px), fill, dash, cap, headEnd,
// tailEnd, compound }. Arrow heads are kept structurally; svgMarkers (render)
// turns them into <marker> defs.
export function resolveLine(spPr, ctx) {
  const ln = spPr?.find('a:ln');
  if (!ln) return null;
  const w = Math.round(ln.num('w', 9525 * 0.75) / 9525);
  const line = {
    w: Math.max(w, 1), // zero-width strokes render nothing; clamp to hairline
    fill: resolveFill(ln, ctx),
    dash: ln.find('a:prstDash')?.attr('val', 'solid') ?? 'solid',
    cap: ln.attr('cap', 'flat'),
    headEnd: null,
    tailEnd: null,
    compound: ln.attr('cmpd', 'sng'),
  };
  for (const [slot, name] of [['headEnd', 'a:headEnd'], ['tailEnd', 'a:tailEnd']]) {
    const end = ln.find(name);
    if (end && end.attr('type', 'none') !== 'none')
      line[slot] = { type: end.attr('type'), w: end.attr('w', 'med'), len: end.attr('len', 'med') };
  }
  return line;
}
