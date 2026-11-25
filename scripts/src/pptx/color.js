// Color engine (adapted from PPTX2HTML src/pptx/color.js, MIT) — resolves
// any DrawingML color element to a CSS color string:
//   '#rrggbb'                fully opaque
//   'rgba(r,g,b,a)'          when an a:alpha transform dropped alpha < 100%
//   null                     noFill / absent / unresolvable (caller decides)
// ctx = { theme, diag } — theme is the loadTheme() result, diag the channel.
//
// Handles a:srgbClr, a:sysClr, a:schemeClr (through the master's p:clrMap),
// and a:prstClr, then applies every transform child in document order.

// ---- base conversions (displayed once, reused everywhere) ----

function hexToRgb(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

function rgbToHex([r, g, b]) {
  return [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

// standard CSS Color 4 round-trippable conversion; h in [0,360), s,l in [0,1]
function rgbToHsl([r, g, b]) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb([h, s, l]) { // inverse of rgbToHsl
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hn = (((h % 360) + 360) % 360) / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, hn + 1 / 3);
    g = hueToRgb(p, q, hn);
    b = hueToRgb(p, q, hn - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

// ---- named colors ----

// a:sysClr names that carry a fixed color (others are unresolvable)
const SYS_COLORS = { window: 'FFFFFF', windowText: '000000' };

// a:prstClr — the ~15 common Office preset colors (+ numeric variants)
const PRST_COLORS = {
  black: '000000', white: 'FFFFFF', gray: '808080', lightGray: 'D3D3D3', darkGray: '404040',
  red: 'FF0000', darkRed: '8B0000', green: '008000', darkGreen: '006400', lightGreen: '90EE90',
  blue: '0000FF', darkBlue: '00008B', lightBlue: 'ADD8E6', yellow: 'FFFF00', darkYellow: '808000',
  cyan: '00FFFF', darkCyan: '008B8B', magenta: 'FF00FF', darkMagenta: '8B008B',
  orange: 'FFA500', brown: 'A52A2A', purple: '800080', pink: 'FFC0CB',
};

// resolve the base [r,g,b] a color element denotes, before transforms
function baseColor(node, ctx) {
  switch (node?.name) {
    case 'a:srgbClr': {
      const val = node.attr('val', '');
      if (!/^[0-9a-fA-F]{6}$/.test(val)) {
        ctx.diag.add('approx', 'invalid color ' + val);
        return null;
      }
      return hexToRgb(val.toUpperCase());
    }
    case 'a:sysClr': {
      const last = node.attr('lastClr');
      if (last && /^[0-9a-fA-F]{6}$/.test(last)) return hexToRgb(last.toUpperCase());
      const name = node.attr('val', '');
      const hex = SYS_COLORS[name];
      if (!hex) { ctx.diag.add('approx', 'unresolved sysClr ' + name); return null; }
      return hexToRgb(hex);
    }
    case 'a:schemeClr': {
      const val = node.attr('val', '');
      const scheme = ctx.theme?.clrScheme ?? {};
      const map = ctx.theme?.clrMap ?? {};
      // clrMap direction: a scheme name that equals a clrMap *value* like
      // 'tx1' resolves through the map to the scheme slot 'dk1'
      const slot = map[val] ? scheme[map[val]] : scheme[val];
      if (!slot || !slot.node) { ctx.diag.add('approx', 'unresolved schemeClr ' + val); return null; }
      return baseColor(slot.node, ctx);
    }
    case 'a:prstClr': {
      const hex = PRST_COLORS[node.attr('val', '')];
      if (!hex) { ctx.diag.add('approx', 'unresolved prstClr ' + node.attr('val', '')); return null; }
      return hexToRgb(hex);
    }
    default:
      return null;
  }
}

export function resolveColor(node, ctx) {
  const rgb = baseColor(node, ctx);
  if (!rgb) return null;
  let [r, g, b] = rgb;
  let alpha = 1;
  for (const t of node?.children ?? []) {
    const local = t.name.includes(':') ? t.name.slice(t.name.indexOf(':') + 1) : t.name;
    const v = t.num('val', 0); // per-mille of 100% unless noted
    switch (local) {
      case 'lumMod': {
        const [h, s, l] = rgbToHsl([r, g, b]);
        [r, g, b] = hslToRgb([h, s, l * (v / 100000)]);
        break;
      }
      case 'lumOff': {
        const [h, s, l] = rgbToHsl([r, g, b]);
        [r, g, b] = hslToRgb([h, s, l + (v / 100000)]);
        break;
      }
      case 'tint': // blend toward white, per channel
        r = r * (v / 100000) + 255 * (1 - v / 100000);
        g = g * (v / 100000) + 255 * (1 - v / 100000);
        b = b * (v / 100000) + 255 * (1 - v / 100000);
        break;
      case 'shade': // c' = c * v
        r = r * (v / 100000);
        g = g * (v / 100000);
        b = b * (v / 100000);
        break;
      case 'satMod': {
        const [h, s, l] = rgbToHsl([r, g, b]);
        [r, g, b] = hslToRgb([h, s * (v / 100000), l]);
        break;
      }
      case 'hueMod': { // val is 60000ths of a degree: v/1000 gives degrees
        const [h, s, l] = rgbToHsl([r, g, b]);
        [r, g, b] = hslToRgb([(h + (v / 1000)) % 360, s, l]);
        break;
      }
      case 'alpha':
        alpha = v / 100000;
        break;
      case 'gray': {
        const y = 0.21 * r + 0.72 * g + 0.07 * b;
        r = g = b = y;
        break;
      }
      case 'inv':
        r = 255 - r; g = 255 - g; b = 255 - b;
        break;
      case 'gamma':
        r = 255 * Math.pow(r / 255, 2.2);
        g = 255 * Math.pow(g / 255, 2.2);
        b = 255 * Math.pow(b / 255, 2.2);
        break;
      case 'invGamma':
        r = 255 * Math.pow(r / 255, 1 / 2.2);
        g = 255 * Math.pow(g / 255, 1 / 2.2);
        b = 255 * Math.pow(b / 255, 1 / 2.2);
        break;
      default:
        ctx.diag.add('approx', 'color transform ' + local);
        continue; // unlisted transforms never throw — keep going
    }
  }
  const hex = rgbToHex([r, g, b]);
  return alpha < 1
    ? `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha})`
    : '#' + hex;
}
