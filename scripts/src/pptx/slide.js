// Three-layer slide walker (adapted from PPTX2HTML src/pptx/slide.js, MIT).
// buildSlide resolves the slide's layout via the slide part's rels, resolves
// the layout's master likewise (falling back to presentation.masters[0]),
// then walks master spTree -> layout spTree -> slide spTree, tagging every
// produced element with its layer. Full fidelity — group child-coordinate
// math, placeholder inheritance, the fill engine — arrives in 01-03/01-04.
//
// Element contract (frozen): { layer, kind, id, name, ph, geom, text, image }
//   layer 'master'|'layout'|'slide'; kind 'sp'|'pic'|'grpSp'|'graphicFrame'|'cxnSp';
//   geom { x, y, w, h (px), rot (raw 60000ths deg) }; text concatenated a:t.

import { XNode } from '../util/xml.js';
import { parseTiming } from './timing.js';
import { parseTransition } from './transition.js';

const EMU_PER_PX = 9525;
const px = (emu) => Math.round(emu / EMU_PER_PX);

// canonical prefixes the parser understands — a mc:Choice requiring one of
// these namespaces contains markup we can walk; anything else falls back
const UNDERSTOOD_REQUIRES = ['a', 'p', 'r', 'c', 'cx', 'dgm', 'dsp', 'p14', 'p15', 'a14'];

// mc:AlternateContent -> prefer the first mc:Choice whose Requires names a
// namespace we understand, else mc:Fallback (helper adopted from upstream)
function chooseAlternate(ac) {
  for (const choice of ac.all('mc:Choice')) {
    const req = choice.attr('Requires');
    if (!req || UNDERSTOOD_REQUIRES.includes(req)) return choice;
  }
  return ac.find('mc:Fallback') ?? null;
}

function geomOf(node, xfrmPath, ctx) {
  const xfrm = node.path(xfrmPath);
  if (!xfrm) {
    // PowerPoint tolerates shapes without xfrm; so do we
    ctx.diag.add('missing', 'shape without xfrm', ctx.slideIndex);
    return { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  }
  const off = xfrm.find('a:off');
  const ext = xfrm.find('a:ext');
  return {
    x: px(off ? off.int('x', 0) : 0),
    y: px(off ? off.int('y', 0) : 0),
    w: px(ext ? ext.int('cx', 0) : 0),
    h: px(ext ? ext.int('cy', 0) : 0),
    rot: xfrm.num('rot', 0), // 60000ths of a degree, kept raw
  };
}

// concatenate all a:t under the txBody (paragraph breaks become '\n');
// run/paragraph structure arrives in 01-04
function collectRuns(node, out) {
  if (node.name === 'a:t') out.push(node.textOf());
  for (const c of node.children) collectRuns(c, out);
}
function textOfBody(el) {
  const txBody = el.children.find(c => c.name === 'p:txBody' || c.name === 'a:txBody');
  if (!txBody) return '';
  return txBody.all('a:p').map(p => {
    const runs = [];
    collectRuns(p, runs);
    return runs.join('');
  }).join('\n');
}

function nvOf(node) { // the p:nv*Pr child (nvSpPr / nvPicPr / nvCxnSpPr / nvGrpSpPr / nvGraphicFramePr)
  return node.children.find(c => c.name.startsWith('p:nv')) ?? null;
}
// notes extraction (01-06): the slide part's rels -> notesSlide type ->
// part; the notes BODY placeholder(s)' a:t concatenated (paragraph breaks
// become '\n', multiple body shapes join likewise), trimmed. Absent
// notesSlide -> null; sldImg/sldNum placeholders never contribute text.
function notesOf(ctx) {
  const rel = ctx.pkg.relBy('notesSlide', ctx.partName);
  if (!rel || rel.external) return null;
  const name = ctx.pkg.resolvePartName(ctx.partName, rel.target);
  if (!ctx.pkg.has(name)) {
    ctx.diag.add('missing', `notesSlide part ${name} not in package`, ctx.slideIndex);
    return null;
  }
  try {
    const texts = (ctx.pkg.xml(name).path('p:cSld/p:spTree')?.all('p:sp') ?? [])
      .filter(sp => sp.path('p:nvSpPr/p:nvPr/p:ph')?.attr('type') === 'body')
      .map(textOfBody)
      .filter(t => t !== '');
    const joined = texts.join('\n').trim();
    return joined === '' ? null : joined;
  } catch (err) {
    ctx.diag.add('error', `failed to load notes ${name}: ${err.message}`, ctx.slideIndex);
    return null;
  }
}

// find the asvg:svgBlip r:embed anywhere under a:blip's extLst (the ext is
// uri-gated, but any asvg:svgBlip descendant is the SVG part reference)
function findSvgEmbed(node) {
  for (const c of node.children) {
    if (c.name === 'asvg:svgBlip') return c.attr('r:embed');
    const found = findSvgEmbed(c);
    if (found) return found;
  }
  return null;
}

// decision 21 deferred tier — placeholder + diagnostic, positions stay truthful
const DEFERRED_IMAGE_MIMES = new Set(['image/x-emf', 'image/x-wmf', 'image/tiff']);

function finishImage(image, node, ctx) {
  // srcRect l/t/r/b: 0..100000 -> per-mille ints (0..1000), default 0
  const s = node.path('p:blipFill/a:srcRect');
  image.srcRect = s
    ? { l: Math.round(s.num('l', 0) / 100), t: Math.round(s.num('t', 0) / 100),
        r: Math.round(s.num('r', 0) / 100), b: Math.round(s.num('b', 0) / 100) }
    : { l: 0, t: 0, r: 0, b: 0 };
  const mime = image.partName ? ctx.pkg.mimeOf(image.partName) : null;
  if (image.partName && DEFERRED_IMAGE_MIMES.has(mime)) {
    ctx.diag.add('unsupported', `image part ${image.partName} (EMF/WMF/TIFF) conversion deferred to a later phase`, ctx.slideIndex);
    image.unsupported = true;
  }
  return image;
}

function imageOf(node, ctx) {
  const blip = node.path('p:blipFill/a:blip');
  const image = {};
  // (02-05) a:videoFile r:link — the pic is a video; blip stays as poster
  const videoFile = node.path('p:nvPicPr/p:nvPr/a:videoFile');
  if (videoFile) {
    const rid = videoFile.attr('r:link');
    const rel = rid && ctx.pkg?.rels(ctx.partName)?.find(r => r.id === rid);
    if (rel && !rel.external)
      image.videoPart = ctx.pkg.resolvePartName(ctx.partName, rel.target);
    else if (rid)
      ctx.diag.add('missing', `video rel ${rid} not found`, ctx.slideIndex);
  }
  // prefer the SVG part over the raster fallback (a:extLst//asvg:svgBlip)
  const embeds = [blip && findSvgEmbed(blip), blip?.attr('r:embed')].filter(Boolean);
  for (const rid of embeds) {
    const rel = ctx.pkg.rels(ctx.partName).find(r => r.id === rid);
    if (rel && !rel.external)
      return finishImage({ ...image, partName: ctx.pkg.resolvePartName(ctx.partName, rel.target) }, node, ctx);
  }
  if (embeds.length) ctx.diag.add('missing', `image rel ${embeds[0]} not found`, ctx.slideIndex);
  return image.videoPart ? finishImage(image, node, ctx) : null; // poster-less video still renders
}

function shapeElement(node, layer, ctx, kind, tf) {
  const nv = nvOf(node);
  const cnvPr = nv ? nv.find('p:cNvPr') : null;
  const phNode = nv ? nv.path('p:nvPr/p:ph') : null;
  let image = null;
  if (kind === 'pic') image = imageOf(node, ctx);
  if (kind === 'cxnSp') {
    // connectors default to line geometry when the producer omitted prstGeom
    const spPr = node.find('p:spPr');
    if (spPr && !spPr.find('a:prstGeom') && !spPr.find('a:custGeom')) {
      const g = new XNode('a:prstGeom');
      g.attrs = { prst: 'line' };
      g.children.push(new XNode('a:avLst'));
      spPr.children.push(g);
    }
  }
  const el = {
    layer,
    kind,
    id: cnvPr ? cnvPr.int('id', 0) : 0,
    name: cnvPr ? cnvPr.attr('name', '') : '',
    ph: phNode ? { type: phNode.attr('type', 'body'), idx: phNode.attr('idx', '') } : null,
    geom: geomOf(node, 'p:spPr/a:xfrm', ctx),
    text: textOfBody(node),
    image,
    node, // raw element kept for the 01-03 styling engine (fills/geometry/lines)
  };
  return withTf(el, tf);
}

// affine remap for group children: x' = dx + kx*x, w' = kx*w (in px)
function withTf(el, tf) {
  if (!tf) return el;
  el.geom = { ...el.geom,
    x: Math.round(tf.dx + tf.kx * el.geom.x),
    y: Math.round(tf.dy + tf.ky * el.geom.y),
    w: Math.round(tf.kx * el.geom.w),
    h: Math.round(tf.ky * el.geom.h) };
  return el;
}

function frameElement(node, layer, ctx, tf) {
  const nv = nvOf(node);
  const cnvPr = nv ? nv.find('p:cNvPr') : null;
  const graphicData = node.path('a:graphic/a:graphicData');
  let frameKind = null;
  if (graphicData) {
    const uri = graphicData.attr('uri', '');
    if (graphicData.find('a:tbl')) frameKind = 'table';
    else if (graphicData.find(['c:chart', 'cx:chartEx'])) frameKind = 'chart';
    else if (graphicData.find(['dgm:relIds', 'dsp:dataModelExt'])) frameKind = 'smartArt';
    else if (graphicData.find('p:oleObj') || /ole/i.test(uri)) frameKind = 'oleObject';
    else if (/ink/i.test(uri) || graphicData.find('p:ink')) frameKind = 'ink';
  }
  // graphicFrame diagnostics: only content this converter genuinely defers
  // (OLE/ActiveX, ink) — tables, charts and SmartArt all render in 01-05
  if (frameKind === 'oleObject' || frameKind === 'ink')
    ctx.diag.add('unsupported', `${frameKind === 'ink' ? 'ink' : 'OLE/ActiveX object'} not rendered`, ctx.slideIndex);
  let chartPartName = null;
  if (frameKind === 'chart') {
    // the chart (or chartEx) part behind this frame — resolved here where
    // ctx.partName is the slide; render loads + parses + renders it
    const rid = graphicData?.find(['c:chart', 'cx:chartEx'])?.attr('r:id');
    const rel = rid ? ctx.pkg.rels(ctx.partName).find(r => r.id === rid) : null;
    if (rel && !rel.external)
      chartPartName = ctx.pkg.resolvePartName(ctx.partName, rel.target);
    else
      ctx.diag.add('missing', `chart rel ${rid ?? '?'} not found`, ctx.slideIndex);
  }
  const el = {
    layer,
    kind: 'graphicFrame',
    frameKind,
    id: cnvPr ? cnvPr.int('id', 0) : 0,
    name: cnvPr ? cnvPr.attr('name', '') : '',
    ph: null,
    geom: geomOf(node, 'p:xfrm', ctx),
    text: '',
    image: null,
    node,
    chartPartName,
  };
  return withTf(el, tf);
}

let groupSeq = 0; // per-package group id counter (render groups runs by it)

// p:grpSpPr/a:xfrm as an affine child-space -> slide-space map (px first):
//   childX' = gx + (childX - cx) * (gw / cw)   =>   dx + kx * childX
// chExt 0 guards to identity scale (kx = 1). Adapted from upstream.
function groupTransform(node, ctx) {
  const xfrm = node.path('p:grpSpPr/a:xfrm');
  const pxOf = (el, k) => px(el ? el.int(k, 0) : 0);
  const off = xfrm?.find('a:off'), ext = xfrm?.find('a:ext');
  const chOff = xfrm?.find('a:chOff'), chExt = xfrm?.find('a:chExt');
  const gw = pxOf(ext, 'cx'), gh = pxOf(ext, 'cy');
  const cw = pxOf(chExt, 'cx'), ch = pxOf(chExt, 'cy');
  const kx = cw > 0 ? gw / cw : 1;
  const ky = ch > 0 ? gh / ch : 1;
  return {
    kx, ky,
    dx: pxOf(off, 'x') - pxOf(chOff, 'x') * kx,
    dy: pxOf(off, 'y') - pxOf(chOff, 'y') * ky,
    rot: xfrm?.num('rot', 0) ?? 0,
  };
}

// concatenate an inner group transform under an outer one: outer(inner(x))
const composeTf = (outer, inner) => !outer ? inner : {
  kx: outer.kx * inner.kx,
  ky: outer.ky * inner.ky,
  dx: outer.dx + outer.kx * inner.dx,
  dy: outer.dy + outer.ky * inner.dy,
  rot: inner.rot,
};

function groupElements(node, layer, ctx, tf) {
  const t = groupTransform(node, ctx);
  const composed = composeTf(tf, t);
  const groupId = ++groupSeq;
  const out = [];
  for (const child of node.children) {
    for (const el of buildElement(child, layer, ctx, composed)) {
      if (el.groupId == null) { el.groupId = groupId; el.groupRot = t.rot; } // innermost wins
      out.push(el);
    }
  }
  return out;
}

function buildElement(node, layer, ctx, tf = null) {
  if (node.name === 'mc:AlternateContent') {
    const chosen = chooseAlternate(node);
    return chosen ? chosen.children.flatMap(c => buildElement(c, layer, ctx, tf)) : [];
  }
  switch (node.name) {
    case 'p:sp': return [shapeElement(node, layer, ctx, 'sp', tf)];
    case 'p:cxnSp': return [shapeElement(node, layer, ctx, 'cxnSp', tf)]; // line geometry, treated like sp
    case 'p:pic': return [shapeElement(node, layer, ctx, 'pic', tf)];
    case 'p:graphicFrame': return [frameElement(node, layer, ctx, tf)];
    case 'p:grpSp': return groupElements(node, layer, ctx, tf);
    default: return []; // nvGrpSpPr / grpSpPr wrappers and unknown tags
  }
}

// walkSpTree(spTreeNode, ctx, layer) — the one element walker (01-05: shared
// with the SmartArt pre-rendered-drawing path). Iterates an spTree's child
// elements through the per-element dispatch above; ctx.partName decides
// whose rels resolve r:embed (a diagram drawing carries its own).
export function walkSpTree(spTreeNode, ctx, layer) {
  if (!spTreeNode) return [];
  const out = [];
  for (const node of spTreeNode.children) out.push(...buildElement(node, layer, ctx));
  return out;
}

export function buildSlide(sldRoot, ctx) {
  const { pkg, diag } = ctx;

  // Background — minimal for this plan: solid srgbClr hex only; the full
  // fill engine (scheme colors, gradients, pictures) arrives in 01-03.
  let background = null;
  const bg = sldRoot.path('p:cSld/p:bg');
  if (bg) {
    // minimal solid-hex capture only — the 01-03 render layer resolves the
    // full p:bgPr fill (solid/grad/patt/blip) through the fill engine; bgRef
    // style references arrive with shape styles in 01-04
    const hex = bg.path('p:bgPr/a:solidFill/a:srgbClr')?.attr('val');
    if (hex) background = { solid: '#' + hex };
  }

  // Resolve the slide's layout via the slide part's rels; the layout's
  // master likewise; fall back to presentation.masters[0] (empty tolerated).
  let layoutName = null, layoutRoot = null;
  const layoutRel = pkg.relBy('slideLayout', ctx.partName);
  if (layoutRel && !layoutRel.external) {
    const name = pkg.resolvePartName(ctx.partName, layoutRel.target);
    if (pkg.has(name)) {
      try {
        layoutRoot = pkg.xml(name);
        layoutName = name;
      } catch (err) {
        diag.add('error', `failed to load layout ${name}: ${err.message}`, ctx.slideIndex);
      }
    } else {
      diag.add('missing', `layout part ${name} not in package`, ctx.slideIndex);
    }
  }
  let masterName = null, masterRoot = null;
  if (layoutName) {
    const mRel = pkg.relBy('slideMaster', layoutName);
    if (mRel && !mRel.external) masterName = pkg.resolvePartName(layoutName, mRel.target);
  }
  if (!masterName && ctx.presentation.masters[0]) masterName = ctx.presentation.masters[0].partName;
  if (masterName && pkg.has(masterName)) {
    try { masterRoot = pkg.xml(masterName); } catch { masterRoot = null; }
  }
  ctx.layout = layoutRoot ? { partName: layoutName, root: layoutRoot } : null;
  ctx.master = masterRoot ? { partName: masterName, root: masterRoot } : null;

  const elements = [];
  // master spTree, then layout spTree, then slide spTree — skipping per
  // showMasterSp: the slide's "0" hides both underlayers; the layout's "0"
  // hides the master layer only.
  const slideHidesLayers = sldRoot.attr('showMasterSp') === '0';
  if (!slideHidesLayers) {
    const layoutHidesMaster = layoutRoot && layoutRoot.attr('showMasterSp') === '0';
    if (masterRoot && !layoutHidesMaster) elements.push(...walkSpTree(masterRoot.path('p:cSld/p:spTree'), ctx, 'master'));
    if (layoutRoot) elements.push(...walkSpTree(layoutRoot.path('p:cSld/p:spTree'), ctx, 'layout'));
  }
  elements.push(...walkSpTree(sldRoot.path('p:cSld/p:spTree'), ctx, 'slide'));

  // chain inputs for the 01-04 text engine: the resolved layout/master roots
  // (already parsed, cached in the package) + presentation p:defaultTextStyle
  let defaultTextStyle = null;
  try { defaultTextStyle = pkg.xml(pkg.mainPart()).find('p:defaultTextStyle') ?? null; } catch { /* tolerated */ }

  // 01-06 decision 22: timing + transition parse to plain JSON embedded per
  // slide — data for a future player, never a runtime (parse yes, player no)
  return {
    background, elements,
    notes: notesOf(ctx),
    timing: parseTiming(sldRoot.find('p:timing'), ctx),
    transition: parseTransition(sldRoot, ctx),
    layoutRoot, masterRoot, defaultTextStyle,
  };
}
