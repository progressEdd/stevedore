// Geometry engine (adapted from PPTX2HTML src/pptx/geometry, MIT) —
// shapePath(spPr, ctx, size) turns a shape's a:prstGeom / a:custGeom into SVG
// path data in a 0..w / 0..h viewport. Unknown presets degrade to their
// bounding box with approximated=true (the call site emits the diagnostic);
// flipH/flipV on a:xfrm are NOT applied here — the render layer scales.

import { PRESETS } from './presets.js';

const n = (v) => Number((Math.abs(v) < 1e-4 ? 0 : v).toFixed(2));
const px = (emu) => n(emu / 9525); // EMU -> px

// a:avLst -> { adj, adj1, adj2, … } numbers (gd fmla "val N")
function adjustments(prstGeom) {
  const out = {};
  for (const gd of prstGeom?.path('a:avLst')?.all('a:gd') ?? []) {
    const m = /val\s+(-?\d+(?:\.\d+)?)/.exec(gd.attr('fmla', ''));
    if (m) out[gd.attr('name', 'adj')] = parseFloat(m[1]);
  }
  return out;
}

// custGeom coordinate: numeric EMU; formula references (gdLst guide names)
// are ignored — we substitute 0 and flag the whole path approximated
function custCoord(node, attr, state) {
  const raw = node.attr(attr, '0');
  const v = parseFloat(raw);
  if (Number.isNaN(v)) { state.approximated = true; return 0; }
  return px(v);
}

function custPath(custGeom, size) {
  const pathLst = custGeom.path('a:pathLst');
  if (!pathLst) return null;
  const state = { approximated: false };
  // guide-defined paths: coordinates may reference a:gdLst formulas we ignore
  if ((custGeom.find('a:gdLst')?.children ?? []).length) state.approximated = true;
  const parts = [];
  let cur = [0, 0];
  for (const path of pathLst.all('a:path')) { // one subpath per a:path
    for (const el of path.children) {
    switch (el.name) {
      case 'a:moveTo': case 'a:lnTo': {
        const p = el.find('a:pt');
        cur = [custCoord(p, 'x', state), custCoord(p, 'y', state)];
        parts.push(`${el.name === 'a:moveTo' ? 'M' : 'L'}${n(cur[0])},${n(cur[1])}`);
        break;
      }
      case 'a:cubicBezTo': case 'a:quadBezTo': {
        const pts = el.all('a:pt').map(p => `${n(custCoord(p, 'x', state))},${n(custCoord(p, 'y', state))}`);
        if (pts.length >= (el.name === 'a:cubicBezTo' ? 3 : 2)) {
          parts.push(`${el.name === 'a:cubicBezTo' ? 'C' : 'Q'}${pts.join(' ')}`);
          cur = pts[pts.length - 1].split(',').map(Number);
        }
        break;
      }
      case 'a:arcTo': { // straight line to the arc endpoint (approximation)
        const wR = px(el.num('wR', 0)), hR = px(el.num('hR', 0));
        const st = (el.num('stAng', 0) / 60000) * Math.PI / 180;
        const sw = (el.num('swAng', 0) / 60000) * Math.PI / 180;
        // ECMA: endpoint = current + wR·(cos(st+sw) − cos(st)), hR·(sin(st+sw) − sin(st))
        const end = [cur[0] + wR * (Math.cos(st + sw) - Math.cos(st)), cur[1] + hR * (Math.sin(st + sw) - Math.sin(st))];
        parts.push(`L${n(end[0])},${n(end[1])}`);
        cur = end;
        state.approximated = true;
        break;
      }
      case 'a:close':
        parts.push('Z');
        break;
      default: break; // a:gdLst and unknown children ignored
    }
    }
  }
  return { path: parts.join(' '), approximated: state.approximated };
}

export function shapePath(spPr, ctx, size) {
  if (!spPr) return null;
  const { w, h } = size;

  const prstGeom = spPr.find('a:prstGeom');
  if (prstGeom) {
    const prst = prstGeom.attr('prst', 'rect');
    const builder = PRESETS[prst];
    if (builder) {
      try {
        return { path: builder({ w, h, ...adjustments(prstGeom) }), approximated: false };
      } catch {
        ctx?.diag?.add('approx', `geometry preset ${prst} approximated`);
        return { path: `M0,0 H${w} V${h} H0 Z`, approximated: true };
      }
    }
    return { path: `M0,0 H${w} V${h} H0 Z`, approximated: true }; // bbox fallback
  }

  const custGeom = spPr.find('a:custGeom');
  if (custGeom) {
    const built = custPath(custGeom, size);
    return built ?? null; // custGeom with no pathLst -> null (plain box)
  }
  return null; // no geometry element at all -> plain div, no svg
}
