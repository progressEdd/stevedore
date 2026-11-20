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
  return `"${name}", ${fallback}, ${generic}`;
}
