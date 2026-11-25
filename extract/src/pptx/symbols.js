// Symbol-font glyph mapping (adapted from PPTX2HTML, MIT). Wingdings and
// Symbol store their glyphs at private-use code points (0xF020-0xF0FF, the
// F0xx range PowerPoint writes) or at the same slot without the F0 prefix;
// browsers ship neither font, so the most common ~40 codes map to real
// Unicode equivalents. Everything unmapped passes through unchanged with one
// rate-limited 'approx' diagnostic — converters degrade per glyph, never fail.

// Wingdings slots (key: code point after F0-normalization)
const WINGDINGS = {
  0x4A: '☺', 0x4B: '☻', 0x4C: '♥', 0x4D: '♦', 0x4E: '♣', 0x4F: '♠',
  0x50: '■', 0x51: '□',
  0x6C: '●', // the classic Wingdings bullet "l"
  0x6E: '■', 0x6F: '□',
  0x75: '◆', 0x76: '❖',
  0xA7: '▪', // small square bullet "§"
  0xD8: '↑', 0xD9: '↓', 0xDA: '→', 0xDB: '←', // arrows è é ê ë
  0xFB: '✗', 0xFC: '✓', 0xFD: '☑', 0xFE: '☒',
};

// Symbol font slots (Adobe Symbol encoding): math, Greek, bullets, arrows
const SYMBOL_FONT = {
  0x61: 'α', 0x62: 'β', 0x64: 'δ', 0x67: 'γ', 0x6A: 'φ',
  0x6C: 'λ', 0x6D: 'μ', 0x70: 'π', 0x71: 'θ', 0x73: 'σ', 0x77: 'ω',
  0xA5: '∞', 0xB1: '±', 0xB4: '×', 0xB7: '•', 0xB8: '÷', // 0xB7: THE Symbol bullet
  0xAC: '←', 0xAD: '↑', 0xAE: '→', 0xAF: '↓',
  0xD6: '√',
};

// Webdings is left empty for now: its slots are all idiosyncratic pictures
// with no confident Unicode equivalents — unmapped codes degrade through the
// diagnostic path instead of rendering wrong glyphs.
const FONT_TABLES = { wingdings: WINGDINGS, symbol: SYMBOL_FONT, webdings: {} };

export const SYMBOL_FONTS = ['Wingdings', 'Symbol', 'Webdings'];

export function isSymbolFont(typeface) {
  return typeface != null && FONT_TABLES[String(typeface).toLowerCase()] !== undefined;
}

/**
 * Map one code point of a symbol-font run to Unicode.
 * @param {string} typeface  the run's (or bullet's) typeface
 * @param {number} charCode  code point as stored in a:t
 * @param {object} [diag]    Diagnostics — when given, unmapped codes addOnce
 * @param {number} [slide]   slide index for the diagnostic
 * @returns {string} replacement char, or the original when unmapped/unknown font
 */
export function mapSymbol(typeface, charCode, diag = null, slide = null) {
  const table = FONT_TABLES[String(typeface ?? '').toLowerCase()] ?? null;
  if (!table) return String.fromCodePoint(charCode);
  const slot = charCode >= 0xF000 && charCode <= 0xF0FF ? charCode - 0xF000 : charCode;
  const mapped = table[slot];
  if (mapped !== undefined) return mapped;
  if (diag) diag.addOnce('approx', 'symbol glyph unmapped', slide);
  return String.fromCodePoint(charCode);
}
