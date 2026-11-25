// Font resolution (adapted from PPTX2HTML, MIT) — theme-relative typeface
// references ('+mj-lt', '+mn-ea', …) resolve through the theme font scheme;
// concrete typefaces pass through. Always returns a quoted stack with a
// scheme fallback and a generic family so the browser never guesses
// (02-FX9: ui-monospace and real mono faces map to resolvable mono stacks —
// a proportional fallback must never shadow a mono class).

const SERIF_FACES = new Set(['Times New Roman', 'Georgia', 'Cambria', 'Garamond']);

// (02-FX9) Real monospace faces: these need a MONO fallback chain and the
// monospace generic — a proportional theme fallback (Calibri) shadows the
// generic wherever it is installed, re-breaking the family class there.
const MONO_FACES = new Set(['Consolas', 'Menlo', 'Courier New', 'Liberation Mono',
  'SFMono-Regular', 'SF Mono', 'Cascadia Mono', 'JetBrains Mono', 'Fira Mono',
  'DejaVu Sans Mono', 'Ubuntu Mono']);
// (02-FX9) ui-monospace resolves to NOTHING on some chromium builds (nix:
// probe "iiiwww" 45.3px = the sans-serif width; monospace 47.0, Consolas
// 57.8), so the old emission `'ui-monospace', <theme>, sans-serif` fell
// through the absent theme fallback onto generic sans-serif — code rendered
// proportionally (VERIFICATION addendum #5 gap 10). Keyword faces never
// resolve through the theme: emit the probe-verified real stack; keep the
// keyword first so hosts that DO resolve it keep their system mono.
const UI_MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, ' +
  "'Liberation Mono', monospace";

export function fontFamily(typeface, ctx) {
  let name = typeface;
  if (typeof name === 'string' && name.startsWith('+')) {
    // +mj/+mn select the scheme slot; -lt/-ea/-cs suffix selects the latin
    // typeface of that slot (script-tag fonts kept for 01-04's run engine)
    const scheme = name.startsWith('+mj') ? 'major' : 'minor';
    name = ctx?.theme?.fontScheme?.[scheme]?.latin ?? (scheme === 'major' ? 'Calibri Light' : 'Calibri');
  }
  // (02-FX9) CSS ui-* keyword faces map to real resolvable stacks — the
  // theme fallback is proportional and must not shadow a mono class.
  if (typeof name === 'string' && name.toLowerCase() === 'ui-monospace') return UI_MONO_STACK;
  const mono = MONO_FACES.has(name);
  // (02-FX9) mono faces fall back to real mono fonts, never the theme's
  // proportional minor face (it would shadow the monospace generic).
  const fallback = mono ? "'Liberation Mono', 'Courier New'"
    : (ctx?.theme?.fontScheme?.minor?.latin ?? 'sans-serif');
  const generic = SERIF_FACES.has(name) ? 'serif' : mono ? 'monospace' : 'sans-serif';
  // (02-FX1) single-quoted name. A double-quoted family inside a style="…"
  // attribute terminated the attribute mid-declaration, so browsers applied
  // only font-size and silently dropped font-family/font-weight/font-style/
  // color (VERIFICATION gap 1). CSS single-quoted strings are valid
  // font-family names and carry no HTML-attribute meaning; embedded single
  // quotes are backslash-escaped per the CSS spec.
  return `'${name.replace(/'/g, "\\'")}', ${fallback}, ${generic}`;
}
