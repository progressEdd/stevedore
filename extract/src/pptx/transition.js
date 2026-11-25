// p:transition parser (adapted from PPTX2HTML scripts/src/transition.js,
// MIT) — the transition between this slide and the next, recorded as data
// (type + attrs + advance rules), never played (decision 22 static-first).

// the KNOWN transition child element names (exact upstream list) — anything
// else is still recorded in the JSON but flagged known:false and reported
// through one approx diagnostic: recorded, never interpreted
const KNOWN = new Set([
  'blinds', 'checker', 'circle', 'comb', 'cover', 'cut', 'diamond', 'dissolve',
  'fade', 'newsflash', 'plus', 'pull', 'push', 'random', 'randomBar', 'split',
  'strips', 'wedge', 'wheel', 'wipe', 'zoom', 'vortex', 'switch', 'flip',
  'ripple', 'honeycomb', 'prism', 'doors', 'window', 'ferris', 'gallery',
  'conveyor', 'pan', 'glitter', 'warp', 'flythrough', 'flash', 'shred',
  'reveal', 'curtains', 'wind', 'fracture', 'pageCurl', 'airplane', 'origami',
  'fallOver', 'morph',
]);

// cSldParentNode: the element that owns p:cSld — the p:sld root (the
// transition is its sibling). Returns null when the slide has none.
// Shape: { type, attrs, advClick, advTm, p14: { dur, extra }, known }
//   type     — the transition child element's local name ('fade'|'push'|…)
//   attrs    — the remaining p:transition attributes, as strings
//   advClick — advance-on-click flag (boolean) or null when absent
//   advTm    — auto-advance time in ms (number) or null when absent
//   p14      — { dur: number|null, extra: p14:* attrs }; PowerPoint 2010+
//              writes p14:dur for the real duration in ms
//   known    — type is in the KNOWN set
export function parseTransition(cSldParentNode, ctx) {
  const t = cSldParentNode?.find('p:transition');
  if (!t) return null;

  const attrs = {};
  const extra = {};
  let dur = null;
  for (const [k, v] of Object.entries(t.attrs)) {
    if (k === 'advClick' || k === 'advTm') continue; // lifted to their own fields
    if (k.startsWith('p14:')) {
      if (k === 'p14:dur') { const n = parseFloat(v); dur = Number.isNaN(n) ? null : n; }
      else extra[k] = v;
    } else attrs[k] = v;
  }
  const advClickRaw = t.attr('advClick');
  const advClick = advClickRaw === undefined || advClickRaw === null
    ? null : (advClickRaw === '1' || advClickRaw === 'true');
  const advTmRaw = t.attr('advTm');
  const advTmNum = advTmRaw === undefined || advTmRaw === null ? NaN : parseFloat(advTmRaw);
  const advTm = Number.isNaN(advTmNum) ? null : advTmNum;

  const child = t.children[0] ?? null; // <p:fade/>, <p:push dir="l"/>, …
  const type = child ? child.name.split(':').pop() : null;
  const known = type !== null && KNOWN.has(type);
  if (type !== null && !known)
    ctx.diag.addOnce('approx', `transition ${type} recorded but not interpreted`, ctx.slideIndex ?? null);

  return { type, attrs, advClick, advTm, p14: { dur, extra }, known };
}
