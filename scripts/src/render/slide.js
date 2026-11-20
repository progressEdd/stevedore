// Slide renderer (adapted from PPTX2HTML, MIT) — hybrid positioning per
// decision 15: per-element absolute .pp-el boxes carry the geometry; semantic
// tags (h1/h2/p) live inside the boxes so the markup stays meaningful.
// 01-03: shapes render as inline SVG (.pp-geom) behind the text, and slide
// backgrounds go through the full fill engine (solid / gradient / pattern /
// picture) instead of the 01-02 solid-hex-only path.

import { resolveFill } from '../pptx/fill.js';
import { buildTextBody, matchPlaceholder } from '../pptx/text.js';
import { geometrySvg } from './shape.js';
import { svgPaint } from './paint.js';
import { renderText } from './text.js';

// placeholder ph.type -> heading level for renderText's titleLevel
const TITLE_LEVELS = { title: 1, ctrTitle: 1, subTitle: 2 };

// buildTextBody ctx for one element: the phChain assembles by matching this
// shape's placeholder in each under-layer's spTree (own node for its layer)
function textCtx(el, rctx, slide) {
  const ph = el.ph;
  const layoutSpTree = slide?.layoutRoot?.path('p:cSld/p:spTree') ?? null;
  const masterSpTree = slide?.masterRoot?.path('p:cSld/p:spTree') ?? null;
  return {
    theme: rctx.theme, diag: rctx.diag, slideIndex: rctx.slideIndex,
    phChain: ph ? [
      el.layer === 'slide' ? el.node : null,
      el.layer === 'layout' ? el.node : matchPlaceholder(layoutSpTree, ph),
      el.layer === 'master' ? el.node : matchPlaceholder(masterSpTree, ph),
    ] : [null, null, null],
    ph,
    masterRoot: slide?.masterRoot ?? null,
    defaultTextStyle: slide?.defaultTextStyle ?? null,
    pkg: rctx.pkg, partName: rctx.partName,
  };
}

function elementBox(el, rctx, slide) {
  const g = el.geom ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  let style = `left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px`;
  if (g.rot) style += `;transform:rotate(${g.rot / 60000}deg);transform-origin:center`;
  // geometry SVG sits BEHIND the semantic text, filling the same box
  const svg = (el.kind === 'sp' || el.kind === 'cxnSp' || el.kind === 'graphicFrame')
    ? geometrySvg(el, rctx, `pp${rctx.slideIndex ?? 0}e${el.id}`) : '';
  let inner;
  if (el.image) {
    inner = `<img class="pp-img" src="${rctx.url(el.image.partName)}" alt="" style="width:100%;height:100%;object-fit:fill">`;
  } else if (el.kind === 'sp' || el.kind === 'cxnSp') {
    // 01-04: the full txBody model + semantic render replace the 01-02
    // concatenated text; title boxes become <h1>/<h2> via titleLevel
    const txBody = el.node?.children.find(c => c.name === 'p:txBody') ?? null;
    const body = txBody ? buildTextBody(txBody, textCtx(el, rctx, slide)) : null;
    inner = body ? renderText(body, el, rctx, {
      slideIndex: rctx.slideIndex,
      slideCount: slide ? slide.index : null,
      titleLevel: el.ph ? TITLE_LEVELS[el.ph.type] ?? 0 : 0,
    }) : '';
  } else {
    inner = '';
  }
  return `  <div class="pp-el" style="${style}">\n    ${svg ? svg + '\n    ' : ''}${inner}\n  </div>`;
}

// Background (01-03 upgrade): p:bg/p:bgPr through resolveFill. Solid fills
// stay a CSS background; gradient/pattern/picture backgrounds render as an
// absolutely-positioned full-slide <svg class="pp-bg"> with defs.
function slideBackground(slide, rctx, opts) {
  const fctx = { theme: rctx.theme, diag: rctx.diag, pkg: rctx.pkg, partName: slide.partName };
  let bgNode = null;
  if (slide.partName && rctx.pkg.has(slide.partName)) {
    try { bgNode = rctx.pkg.xml(slide.partName).path('p:cSld/p:bg'); } catch { bgNode = null; }
  }
  const fill = bgNode ? resolveFill(bgNode.find('p:bgPr'), fctx) : null;
  if (!fill) {
    // 01-02 minimal fallback (e.g. bgRef style references resolve in 01-04)
    return { styleAttr: slide.background?.solid ? ` style="background:${slide.background.solid}"` : '', svg: '' };
  }
  if (fill.kind === 'none') return { styleAttr: ' style="background:transparent"', svg: '' };
  if (fill.kind === 'solid') return { styleAttr: ` style="background:${fill.color ?? 'transparent'}"`, svg: '' };
  const W = opts.W, H = opts.H;
  const paint = svgPaint(fill, `bg${slide.index}-f`, rctx);
  if (!paint) return { styleAttr: '', svg: '' };
  const svg = `<svg class="pp-bg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none" style="position:absolute;left:0;top:0">` +
    (paint.defs ? `\n  <defs>${paint.defs}</defs>` : '') +
    `\n  <rect x="0" y="0" width="${W}" height="${H}" fill="${paint.attr}"/>` +
    `\n</svg>\n`;
  return { styleAttr: '', svg };
}

export function renderSlide(slide, rctx, opts = {}) {
  if (slide.broken)
    return `<div class="pp-slide pp-broken">Slide ${slide.index} could not be read</div>`;
  // transient per-slide render context: rel resolution + addOnce scoping
  rctx.partName = slide.partName;
  rctx.slideIndex = slide.index;
  const bg = slideBackground(slide, rctx, opts);
  const boxes = (slide.elements ?? []).map(el => elementBox(el, rctx, slide));
  return `<div class="pp-slide" data-slide-index="${slide.index}" role="group" aria-label="Slide ${slide.index}"${bg.styleAttr}>\n` +
    bg.svg + boxes.join('\n') + `\n</div>`;
}
