// SmartArt (decision 21): the layout engine is deferred to a later phase —
// the cheap full-fidelity path is the `dsp:` drawing PowerPoint pre-renders
// alongside the diagram data part. buildSmartArt resolves frame → data part
// → data-part rels → drawing part, then walks the drawing's dsp:spTree with
// the SAME element walker as slides (dsp shells renamed to their p:
// equivalents — the payload inside is plain DrawingML). No pre-rendered
// drawing (rare, non-PowerPoint producers) → title placeholder + one
// `unsupported` diagnostic. PPTX2HTML src/pptx/smartart/engine.js is the
// reference for the LATER layout engine, not for now.

import { XNode, parseXml } from '../util/xml.js';
import { walkSpTree } from './slide.js';

const EMU_PER_PX = 9525;
const px = (emu) => Math.round(emu / EMU_PER_PX);

// diagram-drawing relationship type (Microsoft extension namespace)
const DIAGRAM_DRAWING_REL = 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing';

// deep-clone an spTree renaming dsp: shells to their p: equivalents so the
// shared slide walker dispatches them (dsp:sp carries dsp:nvSpPr/dsp:spPr/
// dsp:txBody shells around plain a: content — structurally identical)
function translateDsp(node) {
  const name = node.name.startsWith('dsp:') ? 'p:' + node.name.slice(4) : node.name;
  const clone = new XNode(name);
  clone.attrs = { ...node.attrs };
  clone.text = node.text;
  for (const c of node.children) clone.children.push(translateDsp(c));
  return clone;
}

// ---- the diagram title (placeholder fallback) -----------------------------------

function collectText(node, out) {
  if (node.name === 'a:t') out.push(node.textOf());
  for (const c of node.children) collectText(c, out);
  return out;
}

// dgm:pt[@type='doc']/dgm:t text — the diagram's title
export function smartArtTitle(dataXml) {
  const root = typeof dataXml === 'string' ? parseXml(dataXml) : dataXml;
  if (!root || typeof root !== 'object') return null;
  const doc = (function findDoc(n) {
    if (n.name === 'dgm:pt' && n.attr('type', '') === 'doc') return n;
    for (const c of n.children) {
      const found = findDoc(c);
      if (found) return found;
    }
    return null;
  })(root);
  if (!doc) return null;
  const text = collectText(doc.find('dgm:t') ?? doc, []).join('');
  return text || null;
}

// ---- fit into the frame box --------------------------------------------------------

// Drawing spTree coordinates are page-absolute in most decks, so children
// render inside the frame box by simple offset (render side). Any child
// falling outside the box by >10% triggers one proportional scale-to-fit.
function fitToFrame(elements, graphicFrameNode, ctx) {
  if (!elements.length) return;
  const xfrm = graphicFrameNode.path('p:xfrm');
  const off = xfrm?.find('a:off'), ext = xfrm?.find('a:ext');
  const f = {
    x: px(off?.int('x', 0) ?? 0), y: px(off?.int('y', 0) ?? 0),
    w: px(ext?.int('cx', 0) ?? 0), h: px(ext?.int('cy', 0) ?? 0),
  };
  if (f.w <= 0 || f.h <= 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const g = el.geom ?? { x: 0, y: 0, w: 0, h: 0 };
    minX = Math.min(minX, g.x); minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w); maxY = Math.max(maxY, g.y + g.h);
  }
  const outside =
    f.x - minX > 0.1 * f.w || maxX - (f.x + f.w) > 0.1 * f.w ||
    f.y - minY > 0.1 * f.h || maxY - (f.y + f.h) > 0.1 * f.h;
  if (!outside) return;
  const bw = maxX - minX, bh = maxY - minY;
  const k = Math.min(f.w / (bw || 1), f.h / (bh || 1));
  for (const el of elements) {
    el.geom = {
      ...el.geom,
      x: f.x + Math.round((el.geom.x - minX) * k),
      y: f.y + Math.round((el.geom.y - minY) * k),
      w: Math.max(1, Math.round(el.geom.w * k)),
      h: Math.max(1, Math.round(el.geom.h * k)),
    };
  }
  ctx.diag.addOnce('approx', 'SmartArt drawing scaled to fit its frame', ctx.slideIndex ?? null);
}

// ---- the builder --------------------------------------------------------------------

// buildSmartArt(graphicFrameNode, ctx) -> { elements, title, approximated }.
// ctx = { pkg, diag, slideIndex, partName (the slide) , theme }.
export function buildSmartArt(graphicFrameNode, ctx) {
  const { pkg, diag } = ctx;
  const out = { elements: [], title: null, approximated: false };

  // 1. frame rels -> the diagram DATA part (dgm:relIds@r:dm is the precise
  //    selector; the type-suffix rel is the fallback)
  const graphicData = graphicFrameNode?.path('a:graphic/a:graphicData');
  const dmRid = graphicData?.find('dgm:relIds')?.attr('r:dm');
  const rel = dmRid
    ? pkg.rels(ctx.partName).find(r => r.id === dmRid)
    : pkg.relBy('diagramData', ctx.partName);
  const noData = () => {
    diag.add('missing', 'SmartArt diagram data part not found', ctx.slideIndex ?? null);
    out.approximated = true;
    return out;
  };
  if (!rel || rel.external) return noData();
  const dataName = pkg.resolvePartName(ctx.partName, rel.target);
  if (!pkg.has(dataName)) return noData();

  // 2. the DATA part's own rels -> the pre-rendered DRAWING part
  const drawRel = pkg.rels(dataName).find(r => r.type === DIAGRAM_DRAWING_REL);
  const drawingName = drawRel && !drawRel.external
    ? pkg.resolvePartName(dataName, drawRel.target)
    : null;

  if (drawingName && pkg.has(drawingName)) {
    // 3. same walker, ctx switched to the drawing part for r:embed resolution
    try {
      const drawingRoot = pkg.xml(drawingName);
      const spTree = drawingRoot.find('dsp:spTree')
        ?? drawingRoot.path('dsp:drawing/dsp:spTree');
      if (spTree) {
        out.elements = walkSpTree(translateDsp(spTree), { ...ctx, partName: drawingName }, 'slide');
      } else {
        out.approximated = true;
      }
    } catch (err) {
      diag.add('error', `failed to load SmartArt drawing ${drawingName}: ${err.message}`, ctx.slideIndex ?? null);
      out.approximated = true;
    }
  } else {
    // 4. no pre-rendered drawing — placeholder + one unsupported diagnostic
    try { out.title = smartArtTitle(pkg.xml(dataName)); } catch { /* title is best-effort */ }
    out.approximated = true;
    diag.add('unsupported', 'SmartArt layout engine deferred — pre-rendered drawing absent', ctx.slideIndex ?? null);
  }

  // 5. truth-check the drawing's coordinates against the frame box
  fitToFrame(out.elements, graphicFrameNode, ctx);
  return out;
}
