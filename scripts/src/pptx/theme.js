// Theme model (adapted from PPTX2HTML src/pptx/theme.js, MIT) — parses the
// first master's theme part into the Theme shape every later engine consumes:
//
// {
//   clrScheme: { dk1, lt1, dk2, lt2, accent1..accent6, hlink, folHlink }, // each slot -> { node } —
//              the raw color element (a:srgbClr/a:sysClr child) kept for the color engine
//   fontScheme: { major: { latin, scripts }, minor: { latin, scripts } },
//   fmtScheme: null, // style-matrix parsed lazily in 01-04 when shape style refs are consumed
//   clrMap: masterClrMap, // p:clrMap attrs { tx:'tx1', bg:'bg1', ... } from the slide master
// }
//
// No theme part at all (loader tolerates its absence) -> loadTheme(null, …)
// returns the Office-default theme so color resolution never throws.

import { XNode } from '../util/xml.js';

// Office theme defaults (the "Office" built-in theme PowerPoint writes)
const DEFAULT_CLRS = {
  dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6',
  accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5',
  accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47',
  hlink: '0563C1', folHlink: '954F72',
};
const DEFAULT_FONTS = { major: 'Calibri Light', minor: 'Calibri' };

const SCHEME_SLOTS = [...Object.keys(DEFAULT_CLRS)];

// synthetic a:srgbClr node so the default theme resolves through the very
// same color engine as a parsed theme (no special-cased hex path)
function slotFromHex(hex) {
  const node = new XNode('a:srgbClr');
  node.attrs = { val: hex };
  return { node };
}

// a:clrScheme children are slot wrappers (a:dk1, a:accent1, …) each holding
// exactly one color element; the slot keeps that color element raw.
function parseClrScheme(clrScheme) {
  const out = {};
  if (clrScheme) {
    for (const child of clrScheme.children) {
      const local = child.name.includes(':') ? child.name.slice(child.name.indexOf(':') + 1) : child.name;
      if (SCHEME_SLOTS.includes(local)) out[local] = { node: child.children[0] ?? null };
    }
  }
  for (const slot of SCHEME_SLOTS) if (!out[slot]) out[slot] = slotFromHex(DEFAULT_CLRS[slot]);
  return out;
}

// a:majorFont / a:minorFont: a:latin@typeface plus every a:font@script/typeface
function parseFontSlot(fontNode, fallbackLatin) {
  if (!fontNode) return { latin: fallbackLatin, scripts: {} };
  const latin = fontNode.find('a:latin')?.attr('typeface') || fallbackLatin;
  const scripts = {};
  for (const f of fontNode.all('a:font')) {
    const script = f.attr('script');
    if (script) scripts[script] = f.attr('typeface', '');
  }
  return { latin, scripts };
}

export function loadTheme(themeXmlRoot, masterClrMap, diag) {
  if (!themeXmlRoot) {
    return {
      clrScheme: Object.fromEntries(SCHEME_SLOTS.map(s => [s, slotFromHex(DEFAULT_CLRS[s])])),
      fontScheme: {
        major: { latin: DEFAULT_FONTS.major, scripts: {} },
        minor: { latin: DEFAULT_FONTS.minor, scripts: {} },
      },
      fmtScheme: null,
      clrMap: masterClrMap,
    };
  }
  const elements = themeXmlRoot.path('a:themeElements');
  const fontScheme = elements?.find('a:fontScheme') ?? null;
  return {
    clrScheme: parseClrScheme(elements?.find('a:clrScheme') ?? null),
    fontScheme: {
      major: parseFontSlot(fontScheme?.find('a:majorFont'), DEFAULT_FONTS.major),
      minor: parseFontSlot(fontScheme?.find('a:minorFont'), DEFAULT_FONTS.minor),
    },
    fmtScheme: null, // parsed lazily in 01-04
    clrMap: masterClrMap,
  };
}
