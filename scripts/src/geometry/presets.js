// Preset geometry path builders (adapted from PPTX2HTML src/pptx/geometry,
// MIT). Each builder receives { w, h, adj } — px size plus raw avLst
// adjustments keyed 'adj', 'adj1'… (per-100000 numbers) — and returns SVG
// path data in a 0..w / 0..h viewport. Common presets are exact formula /
// point-list builders derived from the standard DrawingML definitions;
// shapes with visible sub-structure (donut, blockArc, noSmoking, sun, …)
// emit multiple subpaths and rely on the render layer's fill-rule="evenodd".
// The trickiest five (pie, chord, arc, circularArrow, blockArc) compute from
// their adj angles with exact trig — formulas displayed inline below.

// number formatting: 2 decimals, trailing zeros dropped (16.667 -> 16.67)
const n = (v) => Number((Math.abs(v) < 1e-4 ? 0 : v).toFixed(2));

const poly = (pts) => `M${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' L')} Z`;

// DrawingML angles: 0° at 3 o'clock, increasing clockwise on screen (y-down),
// so plain cos/sin with the y-down viewport matches exactly.
const pt = (cx, cy, rx, ry, deg) => {
  const r = (deg * Math.PI) / 180;
  return [cx + rx * Math.cos(r), cy + ry * Math.sin(r)];
};
const ellipseSub = (cx, cy, rx, ry) =>
  `M${n(cx)},${n(cy - ry)} A${n(rx)},${n(ry)} 0 1 1 ${n(cx)},${n(cy + ry)} A${n(rx)},${n(ry)} 0 1 1 ${n(cx)},${n(cy - ry)} Z`;

const ss = (w, h) => Math.min(w, h); // "shorter side" of the DrawingML formulas

function roundRectPath(w, h, r) {
  const rr = Math.min(r, ss(w, h) / 2);
  return `M${n(rr)},0 H${n(w - rr)} A${n(rr)},${n(rr)} 0 0 1 ${n(w)},${n(rr)} V${n(h - rr)}` +
    ` A${n(rr)},${n(rr)} 0 0 1 ${n(w - rr)},${n(h)} H${n(rr)} A${n(rr)},${n(rr)} 0 0 1 0,${n(h - rr)}` +
    ` V${n(rr)} A${n(rr)},${n(rr)} 0 0 1 ${n(rr)},0 Z`;
}

// n-point star: outer vertices on the box ellipse, inner vertices at
// ρ = 2·adj/100000 of it (star5's 19098 -> 0.382, the exact regular-star ratio)
function star(npts, adjDefault) {
  return ({ w, h, adj = adjDefault }) => {
    const ρ = Math.min(2 * (adj / 100000), 0.95);
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const pts = [];
    for (let i = 0; i < 2 * npts; i++) {
      const a = -90 + (i * 180) / npts;
      pts.push(i % 2 === 0 ? pt(cx, cy, rx, ry, a) : pt(cx, cy, rx * ρ, ry * ρ, a));
    }
    return poly(pts);
  };
}

function arrow({ w, h, adj1 = 50000, adj2 = 50000 }) { // rightArrow base geometry
  const L = Math.min(ss(w, h) * (adj1 / 100000), w / 2); // head length
  const hh = (h * adj2) / 200000;                        // head half-height
  const y1 = h / 2 - hh, y2 = h / 2 + hh, x2 = w - L;
  return [[0, y1], [x2, y1], [x2, 0], [w, h / 2], [x2, h], [x2, y2], [0, y2]];
}

// wedge callout tail: apex from adj1/adj2 (per-100000 of w/h), half-attach on
// the bottom edge, wedged into the bottom edge run of an outline
function tailOf(w, h, adj1, adj2) {
  const tx = (w * (adj1 ?? -20833)) / 100000, ty = (h * (adj2 ?? 62500)) / 100000;
  const half = Math.min(ss(w, h) * 0.12, w / 4);
  const clamp = (v) => Math.max(1, Math.min(w - 1, v));
  return { tx, ty, a: clamp(tx - half), b: clamp(tx + half) }; // ordered: a <= b
}

// cloud bump outline: ten outward arcs walked clockwise around an inner
// ellipse (sweep 1 bulges outward when traversing clockwise), returning the
// walk open so callers can continue into a tail or close it
function cloudBumps(w, h) {
  const cx = w / 2, cy = h * 0.45, rx = w * 0.38, ry = h * 0.38;
  const bump = ss(w, h) * 0.16;
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = k * 36, b = (k + 1) * 36;
    const p = pt(cx, cy, rx, ry, a), q = pt(cx, cy, rx, ry, b);
    d += `${k === 0 ? `M${n(p[0])},${n(p[1])}` : ''} A${n(bump)},${n(bump)} 0 0 1 ${n(q[0])},${n(q[1])}`;
  }
  return d;
}

export const PRESETS = {
  rect: ({ w, h }) => `M0,0 H${w} V${h} H0 Z`,
  roundRect: ({ w, h, adj = 16667 }) => roundRectPath(w, h, ss(w, h) * (adj / 100000)),
  ellipse: ({ w, h }) => ellipseSub(w / 2, h / 2, w / 2, h / 2),
  line: ({ w, h }) => `M0,${h} L${w},0`,

  triangle: ({ w, h }) => poly([[w / 2, 0], [w, h], [0, h]]),
  rtTriangle: ({ w, h }) => poly([[0, 0], [0, h], [w, h]]),
  diamond: ({ w, h }) => poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
  parallelogram: ({ w, h, adj = 25000 }) => {
    const k = ss(w, h) * (adj / 100000);
    return poly([[k, 0], [w, 0], [w - k, h], [0, h]]);
  },
  trapezoid: ({ w, h, adj = 25000 }) => {
    const k = ss(w, h) * (adj / 100000) / 2;
    return poly([[k, 0], [w - k, 0], [w, h], [0, h]]);
  },
  chevron: ({ w, h, adj = 50000 }) => {
    const k = ss(w, h) * (adj / 100000);
    return poly([[0, 0], [w - k, 0], [w, h / 2], [w - k, h], [0, h], [k, h / 2]]);
  },
  homePlate: ({ w, h, adj = 50000 }) => {
    const k = ss(w, h) * (adj / 100000) / 2;
    return poly([[0, 0], [w - k, 0], [w, h / 2], [w - k, h], [0, h]]);
  },
  pentagon: ({ w, h }) => poly([0, 72, 144, 216, 288].map(a => pt(w / 2, h / 2, w / 2, h / 2, a - 90))),
  hexagon: ({ w, h, adj = 25000 }) => {
    const k = ss(w, h) * (adj / 100000);
    return poly([[0, h / 2], [k, 0], [w - k, 0], [w, h / 2], [w - k, h], [k, h]]);
  },
  octagon: ({ w, h, adj = 25000 }) => {
    const k = ss(w, h) * (adj / 100000);
    return poly([[k, 0], [w - k, 0], [w, k], [w, h - k], [w - k, h], [k, h], [0, h - k], [0, k]]);
  },

  rightArrow: ({ w, h, adj1 = 50000, adj2 = 50000 }) => poly(arrow({ w, h, adj1, adj2 })),
  leftArrow: ({ w, h, adj1 = 50000, adj2 = 50000 }) => poly(arrow({ w, h, adj1, adj2 }).map(([x, y]) => [w - x, y])),
  upArrow: ({ w, h, adj1 = 50000, adj2 = 50000 }) =>
    poly(arrow({ w: h, h: w, adj1, adj2 }).map(([x, y]) => [y, h - x])),
  downArrow: ({ w, h, adj1 = 50000, adj2 = 50000 }) =>
    poly(arrow({ w: h, h: w, adj1, adj2 }).map(([x, y]) => [w - y, x])),

  star4: star(4, 25000),
  star5: star(5, 19098),
  star6: star(6, 37500),
  star8: star(8, 37500),
  star12: star(12, 37500),
  star24: star(24, 37500),
  star32: star(32, 37500),

  round1Rect: ({ w, h, adj = 16667 }) => {
    const r = Math.min(ss(w, h) * (adj / 100000), ss(w, h) / 2);
    return `M${n(r)},0 H${n(w)} V${n(h)} H0 V${n(r)} A${n(r)},${n(r)} 0 0 1 ${n(r)},0 Z`;
  },
  round2SameRect: ({ w, h, adj = 16667 }) => {
    const r = Math.min(ss(w, h) * (adj / 100000), ss(w, h) / 2);
    return `M${n(r)},0 H${n(w - r)} A${n(r)},${n(r)} 0 0 1 ${n(w)},${n(r)} V${n(h)} H0 V${n(r)}` +
      ` A${n(r)},${n(r)} 0 0 1 ${n(r)},0 Z`;
  },
  snip1Rect: ({ w, h, adj = 16667 }) => {
    const k = ss(w, h) * (adj / 100000);
    return `M${n(k)},0 H${n(w)} V${n(h)} H0 V${n(k)} Z`;
  },
  snipRoundRect: ({ w, h, adj1 = 16667, adj2 = 16667 }) => {
    const k = ss(w, h) * (adj1 / 100000), r = Math.min(ss(w, h) * (adj2 / 100000), ss(w, h) / 2);
    return `M${n(k)},0 H${n(w - r)} A${n(r)},${n(r)} 0 0 1 ${n(w)},${n(r)} V${n(h)} H0 V${n(k)} Z`;
  },

  // ---- exact-trig arc family (angles are 60000ths of a degree in avLst) ----
  pie: ({ w, h, adj1 = 0, adj2 = 16200000 }) => {
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const a1 = adj1 / 60000, a2 = adj2 / 60000, span = ((a2 - a1) % 360 + 360) % 360;
    const p1 = pt(cx, cy, rx, ry, a1), p2 = pt(cx, cy, rx, ry, a2);
    return `M${n(cx)},${n(cy)} L${n(p1[0])},${n(p1[1])} A${n(rx)},${n(ry)} 0 ${span > 180 ? 1 : 0} 1 ${n(p2[0])},${n(p2[1])} Z`;
  },
  chord: ({ w, h, adj1 = 0, adj2 = 2700000 }) => {
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const a1 = adj1 / 60000, a2 = adj2 / 60000, span = ((a2 - a1) % 360 + 360) % 360;
    const p1 = pt(cx, cy, rx, ry, a1), p2 = pt(cx, cy, rx, ry, a2);
    return `M${n(p1[0])},${n(p1[1])} A${n(rx)},${n(ry)} 0 ${span > 180 ? 1 : 0} 1 ${n(p2[0])},${n(p2[1])} Z`;
  },
  arc: ({ w, h, adj1 = 16200000, adj2 = 0 }) => {
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const a1 = adj1 / 60000, a2 = adj2 / 60000, span = ((a2 - a1) % 360 + 360) % 360;
    const p1 = pt(cx, cy, rx, ry, a1), p2 = pt(cx, cy, rx, ry, a2);
    return `M${n(p1[0])},${n(p1[1])} A${n(rx)},${n(ry)} 0 ${span > 180 ? 1 : 0} 1 ${n(p2[0])},${n(p2[1])}`; // open — stroked only
  },
  blockArc: ({ w, h, adj1 = 10800000, adj2 = 0, adj3 = 25000 }) => {
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const ir = Math.max(0.05, Math.min(1 - 2 * (adj3 / 100000), 0.95));
    const a1 = adj1 / 60000, a2 = adj2 / 60000, span = ((a2 - a1) % 360 + 360) % 360;
    const o1 = pt(cx, cy, rx, ry, a1), o2 = pt(cx, cy, rx, ry, a2);
    const i1 = pt(cx, cy, rx * ir, ry * ir, a1), i2 = pt(cx, cy, rx * ir, ry * ir, a2);
    return `M${n(o1[0])},${n(o1[1])} A${n(rx)},${n(ry)} 0 ${span > 180 ? 1 : 0} 1 ${n(o2[0])},${n(o2[1])}` +
      ` L${n(i2[0])},${n(i2[1])} A${n(rx * ir)},${n(ry * ir)} 0 ${span > 180 ? 1 : 0} 0 ${n(i1[0])},${n(i1[1])} Z`;
  },
  donut: ({ w, h, adj = 25000 }) => {
    const ir = Math.max(0.05, Math.min(1 - (adj / 100000) * 2, 0.9));
    return ellipseSub(w / 2, h / 2, w / 2, h / 2) + ' ' +
      ellipseSub(w / 2, h / 2, (w / 2) * ir, (h / 2) * ir);
  },
  noSmoking: ({ w, h, adj = 18750 }) => {
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const ir = 1 - (adj / 100000) * 2;
    const lo = 0.08, hi = ir - 0.04, half = 6; // slash spans the hole only — no XOR rim artifacts
    const slash = poly([
      pt(cx, cy, rx * lo, ry * lo, 225 + half), pt(cx, cy, rx * hi, ry * hi, 225 + half),
      pt(cx, cy, rx * hi, ry * hi, 45 - half), pt(cx, cy, rx * lo, ry * lo, 45 - half),
    ]);
    return ellipseSub(cx, cy, rx, ry) + ' ' + ellipseSub(cx, cy, rx * ir, ry * ir) + ' ' + slash;
  },

  plus: ({ w, h, adj = 25000 }) => {
    const t = ss(w, h) * (adj / 100000);
    return poly([
      [w / 2 - t / 2, 0], [w / 2 + t / 2, 0], [w / 2 + t / 2, h / 2 - t / 2], [w, h / 2 - t / 2],
      [w, h / 2 + t / 2], [w / 2 + t / 2, h / 2 + t / 2], [w / 2 + t / 2, h], [w / 2 - t / 2, h],
      [w / 2 - t / 2, h / 2 + t / 2], [0, h / 2 + t / 2], [0, h / 2 - t / 2], [w / 2 - t / 2, h / 2 - t / 2],
    ]);
  },
  minus: ({ w, h, adj = 25000 }) => {
    const t = ss(w, h) * (adj / 100000);
    return poly([[0, h / 2 - t / 2], [w, h / 2 - t / 2], [w, h / 2 + t / 2], [0, h / 2 + t / 2]]);
  },
  multiply: ({ w, h, adj = 25000 }) => { // two crossing bars (tiny evenodd notch at the crossing)
    const t = (ss(w, h) * (adj / 100000)) / 2;
    const L = Math.hypot(w, h);
    const bar = (x1, y1, x2, y2) => {
      const dx = (x2 - x1) / L, dy = (y2 - y1) / L, nx = (-dy * t), ny = (dx * t);
      return poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
    };
    return bar(0, 0, w, h) + ' ' + bar(w, 0, 0, h);
  },

  can: ({ w, h, adj = 25000 }) => {
    const rx = (w / 2) * (1 - (adj / 100000) * 0.5), ry = Math.min(h * (adj / 200000) + h * 0.25, h / 2);
    return `M0,${n(ry)} A${n(rx)},${n(ry)} 0 0 1 ${n(w)},${n(ry)} V${n(h - ry)} A${n(rx)},${n(ry)} 0 0 1 0,${n(h - ry)} Z`;
  },
  cube: ({ w, h, adj = 25000 }) => {
    const d = ss(w, h) * (adj / 100000);
    return poly([[0, h], [0, d], [d, 0], [w, 0], [w, h - d], [w - d, h]]);
  },
  flowChartProcess: ({ w, h }) => `M0,0 H${w} V${h} H0 Z`,

  // ---- callouts: tail apex from adj1/adj2, wedged into the bottom edge ----
  wedgeRectCallout: ({ w, h, adj1, adj2 }) => {
    const t = tailOf(w, h, adj1, adj2);
    return `M0,0 H${n(w)} V${n(h)} H${n(t.b)} L${n(t.tx)},${n(t.ty)} L${n(t.a)},${n(h)} H0 Z`;
  },
  wedgeRoundRectCallout: ({ w, h, adj1, adj2, adj3 = 16667 }) => {
    const r = Math.min(ss(w, h) * (adj3 / 100000), ss(w, h) / 2);
    const t = tailOf(w, h, adj1, adj2);
    return `M${n(r)},0 H${n(w - r)} A${n(r)},${n(r)} 0 0 1 ${n(w)},${n(r)} V${n(h - r)}` +
      ` A${n(r)},${n(r)} 0 0 1 ${n(w - r)},${n(h)} H${n(t.b)} L${n(t.tx)},${n(t.ty)} L${n(t.a)},${n(h)}` +
      ` H${n(r)} A${n(r)},${n(r)} 0 0 1 0,${n(h - r)} V${n(r)} A${n(r)},${n(r)} 0 0 1 ${n(r)},0 Z`;
  },
  cloudCallout: ({ w, h, adj1, adj2 }) => {
    const t = tailOf(w, h, adj1, adj2);
    return cloudBumps(w, h) + ` L${n(t.tx)},${n(t.ty)} L${n(t.b)},${n(h)} L${n(w * 0.75)},${n(h)} Z`;
  },

  bentArrow: ({ w, h, adj1 = 50000, adj2 = 25000 }) => {
    const t = ss(w, h) * (adj2 / 100000);        // arm thickness
    const L = Math.min(ss(w, h) * (adj1 / 100000), w / 2); // head length
    const hd = t * 0.75;                          // head half-height (> t/2)
    return poly([
      [0, h], [0, 0], [w - L, 0], [w - L, t / 2 - hd], [w, t / 2],
      [w - L, t / 2 + hd], [w - L, t], [t, t], [t, h],
    ]);
  },
  circularArrow: ({ w, h, adj1 = 125000, adj2 = 1142319, adj3 = 20457681, adj4 = 10800000, adj5 = 125000 }) => {
    // thick arc swept clockwise from θ1 with arrowhead at θ2; exact trig
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const thick = Math.min(((adj1 + adj5) / 2 / 100000) * ss(w, h) / 2, ss(w, h) / 4);
    const irx = rx - thick, iry = ry - thick;
    const a1 = ((adj3 / 60000) % 360 + 360) % 360; // start angle
    const a2 = ((adj4 / 60000 + 30) % 360 + 360) % 360; // end angle (past the head barbs)
    const span = ((a2 - a1) % 360 + 360) % 360;
    const barb = a2 - 25; // barb angle — the arrowhead's trailing corner
    const i1 = pt(cx, cy, irx, iry, a1), i2 = pt(cx, cy, irx, iry, barb);
    const o2 = pt(cx, cy, rx, ry, barb), o3 = pt(cx, cy, rx, ry, a2);
    const mid = pt(cx, cy, (rx + irx) / 2, (ry + iry) / 2, barb);
    const tlen = ss(w, h) * 0.22;
    const tRad = (barb * Math.PI) / 180;
    const tip = [mid[0] - Math.sin(tRad) * tlen * (rx / ss(w, h)), mid[1] + Math.cos(tRad) * tlen * (ry / ss(w, h))];
    return `M${n(i1[0])},${n(i1[1])} A${n(irx)},${n(iry)} 0 ${span > 180 ? 1 : 0} 1 ${n(i2[0])},${n(i2[1])}` +
      ` L${n(o2[0])},${n(o2[1])} L${n(tip[0])},${n(tip[1])} L${n(o3[0])},${n(o3[1])}` +
      ` A${n(rx)},${n(ry)} 0 ${span > 180 ? 1 : 0} 0 ${pt(cx, cy, rx, ry, a1).map(v => n(v)).join(',')}` +
      ` L${n(i1[0])},${n(i1[1])} Z`;
  },
  curvedRightArrow: ({ w, h, adj1 = 50000, adj2 = 50000 }) => {
    // rainbow band over the top, arrowhead at the right end pointing along the tangent
    const cx = w / 2, cy = h * 0.75, rx = w / 2, ry = h * 0.75;
    const irx = rx - ss(w, h) * (adj2 / 100000) / 2, iry = ry - ss(w, h) * (adj2 / 100000) / 2;
    const hd = ss(w, h) * 0.07, L = ss(w, h) * (adj1 / 100000) / 2;
    const pi = pt(cx, cy, irx, iry, 180), i350 = pt(cx, cy, irx, iry, 350), i0 = pt(cx, cy, irx, iry, 0);
    const o0 = pt(cx, cy, rx, ry, 0), o350 = pt(cx, cy, rx, ry, 350);
    return `M${n(pi[0])},${n(pi[1])} A${n(irx)},${n(iry)} 0 0 1 ${n(i350[0])},${n(i350[1])}` +
      ` L${n(i0[0])},${n(i0[1])} L${n(o0[0])},${n(o0[1])}` +
      ` L${n(w - hd)},${n(cy + hd)} L${n(w)},${n(cy + L)} L${n(w + hd)},${n(cy + hd)}` +
      ` L${n(o350[0])},${n(o350[1])} A${n(rx)},${n(ry)} 0 0 0 ${n(pi[0])},${n(pi[1])} Z`;
  },
  notchedRightArrow: ({ w, h, adj1 = 50000, adj2 = 50000, adj3 = 25000 }) => {
    const L = Math.min(ss(w, h) * (adj1 / 100000), w / 2);
    const hh = (h * adj2) / 200000;
    const notch = ss(w, h) * (adj3 / 100000);
    const y1 = h / 2 - hh, y2 = h / 2 + hh, x2 = w - L;
    return poly([[0, y1], [x2, y1], [x2, 0], [w, h / 2], [x2, h], [x2, y2], [0, y2], [notch, h / 2]]);
  },

  smileyFace: ({ w, h }) => { // face ring; eyes/mouth XOR to holes and strokes
    const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
    const eye = (ex) => ellipseSub(ex, h * 0.42, ss(w, h) * 0.055, ss(w, h) * 0.055);
    const mrx = rx * 0.55, mry = ry * 0.55, mrx2 = mrx * 0.8, mry2 = mry * 0.8;
    const m1 = pt(cx, cy, mrx, mry, 25), m2 = pt(cx, cy, mrx, mry, 155);
    const m3 = pt(cx, cy, mrx2, mry2, 155), m4 = pt(cx, cy, mrx2, mry2, 25);
    return ellipseSub(cx, cy, rx, ry) + ' ' + eye(w * 0.37) + ' ' + eye(w * 0.63) + ' ' +
      `M${n(m1[0])},${n(m1[1])} A${n(mrx)},${n(mry)} 0 0 1 ${n(m2[0])},${n(m2[1])}` +
      ` L${n(m3[0])},${n(m3[1])} A${n(mrx2)},${n(mry2)} 0 0 0 ${n(m4[0])},${n(m4[1])} Z`;
  },
  heart: ({ w, h }) =>
    `M${n(w / 2)},${n(h)} C${n(w / 2)},${n(h * 0.72)} 0,${n(h * 0.62)} 0,${n(h * 0.3)}` +
    ` C0,${n(h * 0.04)} ${n(w * 0.22)},0 ${n(w / 2)},${n(h * 0.18)}` +
    ` C${n(w * 0.78)},0 ${n(w)},${n(h * 0.04)} ${n(w)},${n(h * 0.3)}` +
    ` C${n(w)},${n(h * 0.62)} ${n(w / 2)},${n(h * 0.72)} ${n(w / 2)},${n(h)} Z`,
  lightningBolt: ({ w, h }) => poly([
    [w * 0.58, 0], [w * 0.15, h * 0.48], [w * 0.36, h * 0.48], [w * 0.25, h],
    [w * 0.85, h * 0.44], [w * 0.55, h * 0.44], [w * 0.7, 0],
  ]),
  sun: ({ w, h, adj = 25000 }) => {
    const cx = w / 2, cy = h / 2;
    let d = ellipseSub(cx, cy, (w / 2) * (1 - adj / 50000) * 0.8, (h / 2) * (1 - adj / 50000) * 0.8);
    for (let k = 0; k < 8; k++) { // eight disjoint ray quads beyond the disc
      const a = k * 45;
      d += ' ' + poly([
        pt(cx, cy, w * 0.3, h * 0.3, a - 11), pt(cx, cy, w * 0.3, h * 0.3, a + 11),
        pt(cx, cy, w / 2, h / 2, a + 11), pt(cx, cy, w / 2, h / 2, a - 11),
      ]);
    }
    return d;
  },
  moon: ({ w, h }) => { // crescent opening right: outer arc left, smaller inner arc back
    const x = w * 0.6;
    return `M${n(x)},0 A${n(x)},${n(h / 2)} 0 1 0 ${n(x)},${n(h)} A${n(w * 0.35)},${n(h / 2)} 0 1 1 ${n(x)},0 Z`;
  },
  cloud: ({ w, h }) => cloudBumps(w, h) + ' Z',
};
