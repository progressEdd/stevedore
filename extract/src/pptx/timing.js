// p:timing parser (adapted from PPTX2HTML scripts/src/pptx/timing.js, MIT) —
// parse yes, player no (decision 22): the animation/sequencing tree becomes
// a plain-JSON data structure embedded in the slide div, consumable by a
// future player runtime. Nothing is evaluated: no formula interpretation,
// no behavior semantics — the tree is data, not code.

const MAX_NODES = 20000; // runaway-tree cap: decks are finite, corrupt files are not

// one element -> { tag, attrs (all as strings), children } with two
// enrichments that make sequencing readable without interpreting it:
//   p:cTn  -> nodeType passthrough from @nodeType
//             (clickEffect / withEffect / afterEffect / mainSeq / tmSeq …)
//   p:spTgt -> spid as a number when /^\d+$/ (kept as-is otherwise)
function walk(node, state) {
  state.count++;
  if (state.count > MAX_NODES) { state.truncated = true; return null; }
  const out = { tag: node.name, attrs: { ...node.attrs }, children: [] };
  if (node.name === 'p:cTn') {
    const nodeType = node.attr('nodeType');
    if (nodeType !== null) out.nodeType = nodeType;
  }
  if (node.name === 'p:spTgt') {
    const spid = node.attr('spid');
    if (spid !== null) out.spid = /^\d+$/.test(spid) ? parseInt(spid, 10) : spid;
  }
  for (const child of node.children) {
    const walked = walk(child, state);
    if (!walked) break; // cap hit — keep whatever was walked so far
    out.children.push(walked);
  }
  return out;
}

// timingNode: the p:timing root element of a slide (or null when absent).
// Returns the JSON tree (pure data: strings/numbers/arrays/objects only —
// JSON.stringify round-trip guaranteed), `{ truncated: true, ...partial }`
// when the 20,000-node cap trips, or null when the slide has no p:timing.
// p:bldLst (build list) rides along as-is — a child like any other.
export function parseTiming(timingNode, ctx) {
  if (!timingNode) return null;
  const state = { count: 0, truncated: false };
  const root = walk(timingNode, state);
  if (state.truncated) {
    ctx.diag.add('approx', 'timing tree truncated', ctx.slideIndex ?? null);
    return { truncated: true, ...root };
  }
  return root;
}
