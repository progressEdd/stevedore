// Font resolution (adapted from PPTX2HTML, MIT) — theme-relative typeface
// references ('+mj-lt', '+mn-ea', …) resolve through the theme font scheme;
// concrete typefaces pass through. Always returns a quoted stack with a
// scheme fallback and a generic family so the browser never guesses.

const SERIF_FACES = new Set(['Times New Roman', 'Georgia', 'Cambria', 'Garamond']);

export function fontFamily(typeface, ctx) {
  let name = typeface;
  if (typeof name === 'string' && name.startsWith('+')) {
    // +mj/+mn select the scheme slot; -lt/-ea/-cs suffix selects the latin
    // typeface of that slot (script-tag fonts kept for 01-04's run engine)
    const scheme = name.startsWith('+mj') ? 'major' : 'minor';
    name = ctx?.theme?.fontScheme?.[scheme]?.latin ?? (scheme === 'major' ? 'Calibri Light' : 'Calibri');
  }
  const fallback = ctx?.theme?.fontScheme?.minor?.latin ?? 'sans-serif';
  const generic = SERIF_FACES.has(name) ? 'serif' : 'sans-serif';
  // (02-FX1) single-quoted name. A double-quoted family inside a style="…"
  // attribute terminated the attribute mid-declaration, so browsers applied
  // only font-size and silently dropped font-family/font-weight/font-style/
  // color (VERIFICATION gap 1). CSS single-quoted strings are valid
  // font-family names and carry no HTML-attribute meaning; embedded single
  // quotes are backslash-escaped per the CSS spec.
  return `'${name.replace(/'/g, "\\'")}', ${fallback}, ${generic}`;
}
