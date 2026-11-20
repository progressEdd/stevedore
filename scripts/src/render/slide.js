// Slide renderer (adapted from PPTX2HTML, MIT) — hybrid positioning per
// decision 15: per-element absolute .pp-el boxes carry the geometry; semantic
// tags (h1/h2/p) live inside the boxes so the markup stays meaningful.
// 01-03: shapes render as inline SVG (.pp-geom) behind the text, and slide
// backgrounds go through the full fill engine (solid / gradient / pattern /
// picture) instead of the 01-02 solid-hex-only path.

import { escapeXml } from '../util/xml.js';
import { resolveFill } from '../pptx/fill.js';
import { geometrySvg } from './shape.js';
import { svgPaint } from './paint.js';

// placeholder ph.type -> semantic tag; everything else renders as <p>
const SEMANTIC_TAGS = { title: 'h1', ctrTitle: 'h1', subTitle: 'h2' };

function elementBox(el, rctx) {
  const g = el.geom ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  let style = `left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px`;
  if (g.rot) style += `;transform:rotate(${g.rot / 60000}deg);transform-origin:center`;
  // geometry SVG sits BEHIND the semantic text, filling the same box
  const svg = (el.kind === 'sp' || el.kind === 'cxnSp' || el.kind === 'graphicFrame')
    ? geometrySvg(el, rctx, `pp${rctx.slideIndex ?? 0}e${el.id}`) : '';
  let inner;
  if (el.image) {
    inner = `<img class="pp-img" src="${rctx.url(el.image.partName)}" alt="" style="width:100%;height:100%;object-fit:fill">`;
  } else {
    const tag = SEMANTIC_TAGS[el.ph?.type] ?? 'p';
    inner = `<${tag} style="margin:0">${escapeXml(el.text ?? '')}</${tag}>`;
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
  const boxes = (slide.elements ?? []).map(el => elementBox(el, rctx));
  return `<div class="pp-slide" data-slide-index="${slide.index}" role="group" aria-label="Slide ${slide.index}"${bg.styleAttr}>\n` +
    bg.svg + boxes.join('\n') + `\n</div>`;
}
