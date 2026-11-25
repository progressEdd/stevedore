// Paint layer (adapted from PPTX2HTML src/render/paint.js, MIT) — converts
// structured Fills into SVG <defs> plus a paint attribute for the shape path,
// and line end decorations into <marker> defs. ids come from the caller so
// multiple shapes on one slide never collide.

const num = (v) => Number(v.toFixed(3));

// 'rgba(r,g,b,a)' -> { rgb: 'r,g,b', a } ; '#rrggbb' -> { rgb, a: 1 }
function splitAlpha(color) {
  const m = /rgba\(([^)]+)\)/.exec(color ?? '');
  if (!m) return { color, opacity: 1 };
  const [r, g, b, a] = m[1].split(',').map(s => s.trim());
  return { color: `rgb(${r},${g},${b})`, opacity: parseFloat(a) };
}

// linear gradient vector from DrawingML ang (stored in radians by fill.js):
// x2 = cos, y2 = sin, normalized back into the positive unit square
function linearVector(ang) {
  const dx = Math.cos(ang ?? 0), dy = Math.sin(ang ?? 0);
  let x1 = 0, y1 = 0, x2 = dx, y2 = dy;
  if (dx < 0) { x1 = 1; x2 = 1 + dx; }
  if (dy < 0) { y1 = 1; y2 = 1 + dy; }
  return { x1, y1, x2, y2 };
}

function stopsXml(stops, reverse) {
  const list = reverse ? [...stops].reverse() : stops;
  return list.map(s => {
    const { color, opacity } = splitAlpha(s.color);
    const op = opacity < 1 ? ` stop-opacity="${num(opacity)}"` : '';
    return `<stop offset="${num(s.pos ?? 0)}" stop-color="${color ?? 'black'}"${op}/>`;
  }).join('');
}

// the 10 most common a:pattFill prst ids as 8×8 tiles; fg draws, bg fills
const PATTERN_TILES = {
  ltHorz: (fg) => `<path d="M0,4 H8" stroke="${fg}" stroke-width="1" fill="none"/>`,
  dkHorz: (fg) => `<path d="M0,1.5 H8 M0,5.5 H8" stroke="${fg}" stroke-width="1.5" fill="none"/>`,
  ltVert: (fg) => `<path d="M4,0 V8" stroke="${fg}" stroke-width="1" fill="none"/>`,
  dkVert: (fg) => `<path d="M1.5,0 V8 M5.5,0 V8" stroke="${fg}" stroke-width="1.5" fill="none"/>`,
  ltUpDiag: (fg) => `<path d="M-1,9 L9,-1" stroke="${fg}" stroke-width="1" fill="none"/>`,
  dkUpDiag: (fg) => `<path d="M-1,9 L9,-1 M-1,4 L4,-1 M4,9 L9,4" stroke="${fg}" stroke-width="1.5" fill="none"/>`,
  ltDnDiag: (fg) => `<path d="M-1,-1 L9,9" stroke="${fg}" stroke-width="1" fill="none"/>`,
  dkDnDiag: (fg) => `<path d="M-1,-1 L9,9 M-1,4 L4,9 M4,-1 L9,4" stroke="${fg}" stroke-width="1.5" fill="none"/>`,
  cross: (fg) => `<path d="M0,4 H8 M4,0 V8" stroke="${fg}" stroke-width="1" fill="none"/>`,
  diagCross: (fg) => `<path d="M-1,9 L9,-1 M-1,-1 L9,9" stroke="${fg}" stroke-width="1" fill="none"/>`,
};

// arrowhead marker bodies in a 0..10 viewBox; refX at/near the line tip
const MARKER_PATHS = {
  triangle: (c) => `<path d="M0,0 L10,5 L0,10 Z" fill="${c}"/>`,
  stealth: (c) => `<path d="M0,0 L10,5 L0,10 L4.5,5 Z" fill="${c}"/>`,
  arrow: (c) => `<path d="M1,1 L9,5 L1,9" fill="none" stroke="${c}" stroke-width="1.3"/>`,
  diamond: (c) => `<path d="M0,5 L5,0 L10,5 L5,10 Z" fill="${c}"/>`,
  oval: (c) => `<circle cx="5" cy="5" r="4.5" fill="${c}"/>`,
};
const MARKER_MULT = { sm: 2, med: 3, lg: 4 }; // small/med/large × stroke width

export function svgPaint(fill, id, rctx) {
  if (!fill) return null;
  switch (fill.kind) {
    case 'none':
      return { defs: '', attr: 'none' };
    case 'solid':
      return { defs: '', attr: fill.color ?? 'none' };
    case 'grad': {
      if (fill.tileRect) rctx.diag.addOnce('approx', 'gradient tileRect ignored', rctx.slideIndex ?? null);
      let attrs, tag;
      if (fill.linear) {
        const v = linearVector(fill.linear.ang);
        tag = 'linearGradient';
        attrs = `x1="${num(v.x1)}" y1="${num(v.y1)}" x2="${num(v.x2)}" y2="${num(v.y2)}"`;
      } else if (fill.path?.type === 'circle' || fill.path?.type === 'shape') {
        tag = 'radialGradient';
        attrs = 'cx="0.5" cy="0.5" r="0.5"';
      } else { // path 'rect' -> linear on the matching fillToRect axis
        const fr = fill.path?.fillToRect ?? {};
        const horiz = Math.abs(fr.l ?? 0) + Math.abs(fr.r ?? 0) > 0;
        tag = 'linearGradient';
        attrs = horiz
          ? 'x1="0" y1="0" x2="1" y2="0"'
          : 'x1="0" y1="0" x2="0" y2="1"';
      }
      const defs = `<${tag} id="${id}" gradientUnits="objectBoundingBox" ${attrs}>` +
        stopsXml(fill.stops, fill.linear?.flip || fill.path?.flip) + `</${tag}>`;
      return { defs, attr: `url(#${id})` };
    }
    case 'patt': {
      const fg = fill.fg ?? 'black', bg = fill.bg;
      const tile = PATTERN_TILES[fill.prst];
      if (!tile) rctx.diag.addOnce('approx', `pattern ${fill.prst} rendered as diagonal lines`, rctx.slideIndex ?? null);
      const shape = tile ? tile(fg) : `<path d="M-1,9 L9,-1" stroke="${fg}" stroke-width="1" fill="none"/>`;
      const defs = `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">` +
        (bg ? `<rect width="8" height="8" fill="${bg}"/>` : '') + shape + '</pattern>';
      return { defs, attr: `url(#${id})` };
    }
    case 'blip': {
      const href = rctx.url(fill.partName);
      if (fill.tile) {
        const tw = Math.max(8, Math.round(100 * (fill.tile.sx ?? 1)));
        const th = Math.max(8, Math.round(100 * (fill.tile.sy ?? 1)));
        const defs = `<pattern id="${id}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse">` +
          `<image href="${href}" x="${Math.round(fill.tile.tx * tw)}" y="${Math.round(fill.tile.ty * th)}" ` +
          `width="${tw}" height="${th}" preserveAspectRatio="none"/></pattern>`;
        return { defs, attr: `url(#${id})` };
      }
      // stretched: one 1×1 objectBoundingBox tile carrying the whole image
      const defs = `<pattern id="${id}" width="1" height="1" patternUnits="objectBoundingBox">` +
        `<image href="${href}" width="1" height="1" preserveAspectRatio="none"/></pattern>`;
      return { defs, attr: `url(#${id})` };
    }
    case 'grp':
      rctx.diag.addOnce('approx', 'group fill not inherited (grpFill)', rctx.slideIndex ?? null);
      return { defs: '', attr: 'none' };
    default:
      return null;
  }
}

export function svgMarkers(line, id, strokeColor = 'black') {
  if (!line || (!line.headEnd && !line.tailEnd)) return null;
  const mult = (size) => MARKER_MULT[size] ?? 3;
  const defs = [];
  const start = line.headEnd ? `url(#${id}-s)` : '';
  const end = line.tailEnd ? `url(#${id}-e)` : '';
  if (line.headEnd) {
    const m = mult(line.headEnd.w), l = mult(line.headEnd.len);
    const body = MARKER_PATHS[line.headEnd.type] ?? MARKER_PATHS.triangle;
    defs.push(`<marker id="${id}-s" viewBox="0 0 10 10" markerWidth="${num(m * 1.2)}" markerHeight="${num(l * 1.1)}" ` +
      `refX="9" refY="5" orient="auto-start-reverse" markerUnits="strokeWidth">${body(strokeColor)}</marker>`);
  }
  if (line.tailEnd) {
    const m = mult(line.tailEnd.w), l = mult(line.tailEnd.len);
    const body = MARKER_PATHS[line.tailEnd.type] ?? MARKER_PATHS.triangle;
    defs.push(`<marker id="${id}-e" viewBox="0 0 10 10" markerWidth="${num(m * 1.2)}" markerHeight="${num(l * 1.1)}" ` +
      `refX="9" refY="5" orient="auto" markerUnits="strokeWidth">${body(strokeColor)}</marker>`);
  }
  return { defs: defs.join(''), start, end };
}
