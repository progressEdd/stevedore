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

function shapeElement(node, layer, ctx, kind) {
  const nv = nvOf(node);
  const cnvPr = nv ? nv.find('p:cNvPr') : null;
  const phNode = nv ? nv.path('p:nvPr/p:ph') : null;
  let image = null;
  if (kind === 'pic') {
    const embed = node.path('p:blipFill/a:blip')?.attr('r:embed');
    if (embed) {
      const rel = ctx.pkg.rels(ctx.partName).find(r => r.id === embed);
      if (rel && !rel.external) image = { partName: ctx.pkg.resolvePartName(ctx.partName, rel.target) };
      else ctx.diag.add('missing', `image rel ${embed} not found`, ctx.slideIndex);
    }
  }
  return {
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
}

function frameElement(node, layer, ctx) {
  const nv = nvOf(node);
  const cnvPr = nv ? nv.find('p:cNvPr') : null;
  const graphicData = node.path('a:graphic/a:graphicData');
  let frameKind = null;
  if (graphicData) {
    if (graphicData.find('a:tbl')) frameKind = 'table';
    else if (graphicData.find(['c:chart', 'cx:chartEx'])) frameKind = 'chart';
    else if (graphicData.find(['dgm:relIds', 'dsp:dataModelExt'])) frameKind = 'smartArt';
  }
  // only complain when it actually carries content we defer to later plans
  if (frameKind) ctx.diag.add('unsupported', 'graphicFrame content (later plan)', ctx.slideIndex);
  return {
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
  };
}

function groupElements(node, layer, ctx) {
  const geom = geomOf(node, 'p:grpSpPr/a:xfrm', ctx); // the group's own a:off/a:ext
  const out = [];
  for (const child of node.children) {
    for (const el of buildElement(child, layer, ctx)) {
      // offset children by the group's own a:off — full child-coordinate
      // math (a:chOff/a:chExt scaling) arrives in 01-04
      el.geom = { ...el.geom, x: el.geom.x + geom.x, y: el.geom.y + geom.y };
      if (el.parentGeom == null) el.parentGeom = geom; // immediate parent group
      out.push(el);
    }
  }
  return out;
}

function buildElement(node, layer, ctx) {
  if (node.name === 'mc:AlternateContent') {
    const chosen = chooseAlternate(node);
    return chosen ? chosen.children.flatMap(c => buildElement(c, layer, ctx)) : [];
  }
  switch (node.name) {
    case 'p:sp': return [shapeElement(node, layer, ctx, 'sp')];
    case 'p:cxnSp': return [shapeElement(node, layer, ctx, 'cxnSp')]; // line geometry, treated like sp
    case 'p:pic': return [shapeElement(node, layer, ctx, 'pic')];
    case 'p:graphicFrame': return [frameElement(node, layer, ctx)];
    case 'p:grpSp': return groupElements(node, layer, ctx);
    default: return []; // nvGrpSpPr / grpSpPr wrappers and unknown tags
  }
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
  const walk = (spTree, layer) => {
    if (!spTree) return;
    for (const node of spTree.children) elements.push(...buildElement(node, layer, ctx));
  };

  // master spTree, then layout spTree, then slide spTree — skipping per
  // showMasterSp: the slide's "0" hides both underlayers; the layout's "0"
  // hides the master layer only.
  const slideHidesLayers = sldRoot.attr('showMasterSp') === '0';
  if (!slideHidesLayers) {
    const layoutHidesMaster = layoutRoot && layoutRoot.attr('showMasterSp') === '0';
    if (masterRoot && !layoutHidesMaster) walk(masterRoot.path('p:cSld/p:spTree'), 'master');
    if (layoutRoot) walk(layoutRoot.path('p:cSld/p:spTree'), 'layout');
  }
  walk(sldRoot.path('p:cSld/p:spTree'), 'slide');

  return { background, elements, notes: null };
}
