// Text body model with the full placeholder inheritance chain (adapted from
// PPTX2HTML src/pptx/text.js, MIT — their header documents a 7-level chain;
// we implement it structurally). buildTextBody walks every a:p/a:r of a
// txBody and merges paragraph + run properties down the chain, most general
// to most specific:
//
//   [ presentation p:defaultTextStyle (a:lvlNpPr per paragraph lvl),
//     master a:txStyles (titleStyle | bodyStyle, per lvl — ph shapes only),
//     master placeholder's txBody a:lstStyle + paragraphs' a:pPr,
//     layout placeholder's txBody a:lstStyle + paragraphs' a:pPr,
//     shape's own a:lstStyle,
//     paragraph a:pPr,
//     run a:rPr ]
//
// Merge rule: first defined value from the most specific level wins — which
// is also how a:buNone at a specific level overrides an inherited buChar.
// Colors resolve through resolveColor AFTER the merge (theme transforms need
// the final context); theme font refs ('+mj-lt' …) stay raw for render-time
// fontFamily resolution. Autofit fontScale is kept raw — render applies it.
//
// ctx = { theme, diag, slideIndex,
//         phChain: [slideSpNode|null, layoutSpNode|null, masterSpNode|null],
//         ph,                 // this shape's placeholder { type, idx } | null
//         masterRoot,         // slide master XNode (for a:txStyles), nullable
//         defaultTextStyle,   // presentation p:defaultTextStyle XNode, nullable
//         pkg, partName }     // slide part access, for link/bullet-blip rels

import { resolveColor } from './color.js';
import { resolveFill } from './fill.js';
import { isSymbolFont, mapSymbol } from './symbols.js';

const EMU_PER_PX = 9525;
const px = (emu) => Math.round(emu / EMU_PER_PX);
const HUNDREDTHS_PT_TO_PX = 96 / 72 / 100;

// mergeProps(levels) — levels ordered most-general → most-specific, each a
// props object holding ONLY its defined keys. The most specific defined
// value wins per property; more general levels fill the gaps.
export function mergeProps(levels) {
  const out = {};
  for (let i = levels.length - 1; i >= 0; i--) {
    for (const [k, v] of Object.entries(levels[i] ?? {})) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

const txBodyOf = (spNode) =>
  (spNode?.children ?? []).find(c => c.name === 'p:txBody' || c.name === 'a:txBody') ?? null;

// matchPlaceholder(spTree, ph) — find the sp in a layer's spTree standing in
// for this placeholder: ph.type equal, or both idx values equal when the
// type is body/null. The rule the phChain assembly walks layer by layer.
export function matchPlaceholder(spTree, ph) {
  if (!spTree || !ph) return null;
  for (const sp of spTree.children) {
    if (!sp.name.startsWith('p:')) continue;
    const phNode = sp.children.find(c => c.name.startsWith('p:nv'))?.path('p:nvPr/p:ph') ?? null;
    if (!phNode) continue;
    const type = phNode.attr('type', 'body');
    const idx = phNode.attr('idx', '');
    if (type === ph.type) return sp;
    const bodyish = (t) => t === 'body' || t == null || t === '';
    if (bodyish(type) && bodyish(ph.type) && idx !== '' && idx === ph.idx) return sp;
  }
  return null;
}

// ---- a:bodyPr -------------------------------------------------------------

function bodyPrOf(txBodyNode) {
  const bp = txBodyNode?.find('a:bodyPr') ?? null;
  const int = (k, d) => px(bp ? bp.int(k, d) : d); // default insets: 0.1"/0.05"
  const norm = bp?.find('a:normAutofit');
  const autofit = norm
    ? { fontScale: norm.num('fontScale', 100000) / 100000,
        lnSpcReduction: norm.num('lnSpcReduction', 100000) / 100000 }
    : { fontScale: 1, lnSpcReduction: 1, ...(bp?.find('a:spAutoFit') ? { spAutoFit: true } : {}) };
  return {
    anchor: bp?.attr('anchor') ?? 't',
    insets: { l: int('lIns', 91440), t: int('tIns', 45720), r: int('rIns', 91440), b: int('bIns', 45720) },
    wrap: bp?.attr('wrap') ?? 'square',
    autofit,
    vert: bp?.attr('vert') ?? 'horz', // kept raw; render maps to writing-mode
    cols: bp?.find('a:cols')?.int('num', 1) ?? 1,
  };
}

// ---- paragraph property levels ---------------------------------------------

// bullet size from a:buSzPts (hundredths of a point → px) / a:buSzPct (raw → pct)
function bulletSize(pPrNode) {
  const pts = pPrNode.find('a:buSzPts');
  if (pts) return { size: Math.round(pts.num('val', 0) * HUNDREDTHS_PT_TO_PX * 100) / 100 };
  const pct = pPrNode.find('a:buSzPct');
  if (pct) return { sizePct: pct.num('val', 100000) / 100000 };
  return {};
}

function bulletOf(pPrNode, ctx) {
  if (!pPrNode) return undefined;
  if (pPrNode.find('a:buNone')) return { type: 'none' };
  const buChar = pPrNode.find('a:buChar');
  if (buChar) {
    const font = pPrNode.find('a:buFont')?.attr('typeface') ?? null;
    let ch = buChar.attr('char', '•');
    if (font && isSymbolFont(font)) // Wingdings bullets map before storage too
      ch = [...ch].map(c => mapSymbol(font, c.codePointAt(0), ctx.diag, ctx.slideIndex)).join('');
    return { type: 'char', char: ch, ...(font ? { font } : {}), ...bulletSize(pPrNode) };
  }
  const buAuto = pPrNode.find('a:buAutoNum');
  if (buAuto) {
    const startAt = buAuto.attrs.startAt !== undefined ? buAuto.int('startAt', 1) : undefined;
    return { type: 'auto', numType: buAuto.attr('type', 'arabicPeriod'),
      ...(startAt !== undefined ? { startAt } : {}), ...bulletSize(pPrNode) };
  }
  const buBlip = pPrNode.find('a:buBlip');
  if (buBlip) {
    const rid = buBlip.find('a:blip')?.attr('r:embed');
    let picPart = null;
    if (rid && ctx.pkg && ctx.partName) {
      const rel = ctx.pkg.rels(ctx.partName).find(r => r.id === rid);
      if (rel && !rel.external) picPart = ctx.pkg.resolvePartName(ctx.partName, rel.target);
      else ctx.diag.add('missing', `bullet image rel ${rid} not found`, ctx.slideIndex);
    }
    return { type: 'pic', ...(picPart ? { picPart } : {}), ...bulletSize(pPrNode) };
  }
  return undefined; // not defined at this level — inherits down the chain
}

function spacingOf(pPrNode, name) { // a:lnSpc / a:spcBef / a:spcAft
  const sp = pPrNode?.find(name);
  if (!sp) return undefined;
  const pct = sp.find('a:spcPct');
  if (pct) return { kind: 'pct', v: pct.num('val', 100000) };
  const pts = sp.find('a:spcPts');
  if (pts) return { kind: 'pts', v: Math.round(pts.num('val', 0) * HUNDREDTHS_PT_TO_PX * 100) / 100 };
  return undefined;
}

function tabsOf(pPrNode) {
  const tabs = pPrNode?.find('a:tabLst')?.all('a:tab') ?? [];
  return tabs.length ? tabs.map(t => ({ pos: px(t.int('pos', 0)), algn: t.attr('algn', 'l') })) : undefined;
}

// pPr-ish node (a:pPr or a:lvlNpPr — same content model) → defined props only
function extractPPr(pPrNode, ctx) {
  if (!pPrNode) return null;
  const p = {};
  if (pPrNode.attrs.algn !== undefined) p.algn = pPrNode.attr('algn');
  if (pPrNode.attrs.marL !== undefined) p.marL = px(pPrNode.int('marL', 0));
  if (pPrNode.attrs.indent !== undefined) p.indent = px(pPrNode.int('indent', 0));
  const bullet = bulletOf(pPrNode, ctx);
  if (bullet !== undefined) p.bullet = bullet;
  for (const [key, el] of [['lnSpc', 'a:lnSpc'], ['spcBef', 'a:spcBef'], ['spcAft', 'a:spcAft']]) {
    const sp = spacingOf(pPrNode, el);
    if (sp !== undefined) p[key] = sp;
  }
  const tabs = tabsOf(pPrNode);
  if (tabs !== undefined) p.tabs = tabs;
  return p;
}

// ---- run property levels ----------------------------------------------------

// rPr-ish node (a:rPr / a:defRPr / a:endParaRPr) → defined props only; color
// and highlight stay as RAW nodes — resolution happens after the merge.
function extractRPr(rPr, ctx) {
  if (!rPr) return null;
  const r = {};
  if (rPr.attrs.sz !== undefined) r.sz = Math.round(rPr.num('sz', 0) * HUNDREDTHS_PT_TO_PX);
  if (rPr.attrs.b !== undefined) r.b = rPr.bool('b');
  if (rPr.attrs.i !== undefined) r.i = rPr.bool('i');
  if (rPr.attrs.u !== undefined) r.u = rPr.attr('u', 'none');
  if (rPr.attrs.strike !== undefined) r.strike = rPr.attr('strike', 'noStrike');
  if (rPr.attrs.cap !== undefined) r.caps = rPr.attr('cap', 'none');
  if (rPr.attrs.baseline !== undefined) r.baselinePct = rPr.int('baseline', 0) / 1000;
  if (rPr.attrs.spc !== undefined)
    r.spc = rPr.num('spc', 0) / 100; // @spc is 1/100 pt — read as px (documented approximation)
  const solid = rPr.find('a:solidFill');
  if (solid) r.colorNode = solid.children.find(c => c.name.startsWith('a:')) ?? null;
  const hl = rPr.find('a:highlight');
  if (hl) r.highlightNode = hl.children[0] ?? null;
  const font = {};
  for (const slot of ['a:latin', 'a:ea', 'a:cs', 'a:sym']) {
    const tf = rPr.find(slot)?.attr('typeface');
    if (tf) font[slot.slice(2)] = tf; // theme refs ('+mn-lt') stay raw for render
  }
  if (Object.keys(font).length) r.font = font;
  const ln = rPr.find('a:ln'); // text outline — kept; render approximates
  if (ln) { const f = resolveFill(ln, ctx); if (f) r.outline = f; }
  if (rPr.find('a:gradFill')) { const f = resolveFill(rPr, ctx, 'a:gradFill'); if (f) r.gradFill = f; }
  return r;
}

// a:hlinkClick → { url, jump }: r:id resolves through the slide part rels
// (external targets carry the URL); ppaction://hlinksldjump → jump 'slide'.
function linkOf(rPrNode, ctx) {
  const hl = rPrNode?.find('a:hlinkClick');
  if (!hl) return null;
  const jump = (hl.attr('action', '') ?? '').includes('hlinksldjump') ? 'slide' : null;
  let url = null;
  const rid = hl.attr('r:id');
  if (rid && ctx.pkg && ctx.partName) {
    const rel = ctx.pkg.rels(ctx.partName).find(r => r.id === rid);
    if (rel?.external) url = rel.target;
    else if (!jump) ctx.diag.add('missing', `hyperlink rel ${rid} not found`, ctx.slideIndex);
  }
  return url || jump ? { url, jump } : null;
}

// ---- the chain ---------------------------------------------------------------

// a:lvlNpPr for a paragraph level (0-based) from a list-style container
const lvlPPr = (container, lvl) => container?.find(`a:lvl${(lvl ?? 0) + 1}pPr`) ?? null;

// the ph-matched ancestor sp contributes its a:lstStyle lvlNpPr AND its own
// paragraphs' a:pPr (same paragraph index, else the first — layout prompts
// typically carry exactly one styled paragraph)
function ancestorPPrs(spNode, lvl, paraIndex) {
  const txBody = txBodyOf(spNode);
  if (!txBody) return [];
  const paras = txBody.all('a:p');
  const para = paras[Math.min(paraIndex, paras.length - 1)] ?? paras[0] ?? null;
  return [lvlPPr(txBody.find('a:lstStyle'), lvl), para?.find('a:pPr') ?? null];
}

// Paragraph property levels, most-general → most-specific. A shape without
// p:ph skips the txStyles + two placeholder levels (the chain shortens to
// defaultTextStyle → lstStyle → pPr).
function paraLevels(txBodyNode, para, ctx, lvl, paraIndex) {
  const levels = [lvlPPr(ctx.defaultTextStyle, lvl)];
  if (ctx.ph) {
    const txStyles = ctx.masterRoot?.find('p:txStyles');
    const style = ctx.ph.type === 'title' || ctx.ph.type === 'ctrTitle' ? 'a:titleStyle' : 'a:bodyStyle';
    levels.push(lvlPPr(txStyles?.find(style), lvl));
    levels.push(...ancestorPPrs(ctx.phChain[2], lvl, paraIndex)); // master placeholder
    levels.push(...ancestorPPrs(ctx.phChain[1], lvl, paraIndex)); // layout placeholder
  }
  levels.push(lvlPPr(txBodyNode?.find('a:lstStyle'), lvl));           // own lstStyle
  levels.push(para.find('a:pPr'));                                    // own pPr
  return levels;
}

// ---- runs --------------------------------------------------------------------

function fieldOf(fldNode) {
  const raw = fldNode.attr('type', '');
  const type = raw.includes('slidenum') ? 'slidenum' : (raw.startsWith('datetime') ? 'datetime' : null);
  return { type, fixed: fldNode.find('a:t')?.textOf() ?? '', rawType: raw };
}

function runOf(runNode, para, txBodyNode, ctx, lvl, paraIndex) {
  const rPrNode = runNode.find('a:rPr');
  const levels = paraLevels(txBodyNode, para, ctx, lvl, paraIndex)
    .map(n => extractRPr(n?.find('a:defRPr'), ctx) ?? {})
    .concat([extractRPr(rPrNode, ctx) ?? {}]); // run a:rPr — most specific
  const m = mergeProps(levels);
  const color = m.colorNode ? resolveColor(m.colorNode, ctx) : null;       // resolve AFTER merge
  const highlight = m.highlightNode ? resolveColor(m.highlightNode, ctx) : null;
  // symbol fonts map to Unicode BEFORE storage
  let text = runNode.find('a:t')?.textOf() ?? '';
  const symTypeface = m.font?.sym ?? m.font?.latin ?? null;
  if (symTypeface && isSymbolFont(symTypeface))
    text = [...text].map(c => mapSymbol(symTypeface, c.codePointAt(0), ctx.diag, ctx.slideIndex)).join('');
  return {
    text,
    rPr: {
      sz: m.sz ?? null, b: m.b ?? false, i: m.i ?? false, u: m.u ?? 'none',
      strike: m.strike ?? 'noStrike', caps: m.caps ?? 'none',
      baselinePct: m.baselinePct ?? 0, spc: m.spc ?? 0,
      color, highlight,
      font: { latin: m.font?.latin ?? null, ea: m.font?.ea ?? null, cs: m.font?.cs ?? null, sym: m.font?.sym ?? null },
      link: linkOf(rPrNode, ctx),
      outline: m.outline ?? null, gradFill: m.gradFill ?? null,
    },
    field: runNode.name === 'a:fld' ? fieldOf(runNode) : null,
  };
}

// ---- the model ----------------------------------------------------------------

export function buildTextBody(txBodyNode, ctx) {
  const body = { bodyPr: bodyPrOf(txBodyNode), paragraphs: [] };
  if (!txBodyNode) return body;
  const paras = txBodyNode.all('a:p');
  paras.forEach((para, paraIndex) => {
    const pPrNode = para.find('a:pPr');
    const lvl = pPrNode?.int('lvl', 0) ?? 0;
    const m = mergeProps(paraLevels(txBodyNode, para, ctx, lvl, paraIndex)
      .map(n => extractPPr(n, ctx) ?? {}));
    body.paragraphs.push({
      pPr: {
        algn: m.algn ?? null,
        marL: m.marL ?? 0,
        indent: m.indent ?? 0,
        lvl,
        bullet: m.bullet ?? null,
        lnSpc: m.lnSpc ?? null,
        spcBef: m.spcBef ?? null,
        spcAft: m.spcAft ?? null,
        tabs: m.tabs ?? [],
      },
      runs: para.children.flatMap(child => {
        if (child.name === 'a:r' || child.name === 'a:fld')
          return [runOf(child, para, txBodyNode, ctx, lvl, paraIndex)];
        if (child.name === 'a:br') return [{ text: '\n', br: true, rPr: null, field: null }];
        return [];
      }),
    });
  });
  return body;
}
