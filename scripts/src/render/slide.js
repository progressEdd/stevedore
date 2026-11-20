// Slide renderer (adapted from PPTX2HTML, MIT) — hybrid positioning per
// decision 15: per-element absolute .pp-el boxes carry the geometry; semantic
// tags (h1/h2/p) live inside the boxes so the markup stays meaningful.
// Viewport scaling is the document layer's job (render/document.js).

import { escapeXml } from '../util/xml.js';

// placeholder ph.type -> semantic tag; everything else renders as <p>
const SEMANTIC_TAGS = { title: 'h1', ctrTitle: 'h1', subTitle: 'h2' };

function elementBox(el, rctx) {
  const g = el.geom ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  let style = `left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px`;
  if (g.rot) style += `;transform:rotate(${g.rot / 60000}deg);transform-origin:center`;
  let inner;
  if (el.image) {
    inner = `<img class="pp-img" src="${rctx.url(el.image.partName)}" alt="" style="width:100%;height:100%;object-fit:fill">`;
  } else {
    const tag = SEMANTIC_TAGS[el.ph?.type] ?? 'p';
    inner = `<${tag} style="margin:0">${escapeXml(el.text ?? '')}</${tag}>`;
  }
  return `  <div class="pp-el" style="${style}">\n    ${inner}\n  </div>`;
}

export function renderSlide(slide, rctx, opts) {
  if (slide.broken)
    return `<div class="pp-slide pp-broken">Slide ${slide.index} could not be read</div>`;
  const bg = slide.background && slide.background.solid
    ? ` style="background:${slide.background.solid}"`
    : '';
  const boxes = (slide.elements ?? []).map(el => elementBox(el, rctx));
  return `<div class="pp-slide" data-slide-index="${slide.index}" role="group" aria-label="Slide ${slide.index}"${bg}>\n` +
    boxes.join('\n') + `\n</div>`;
}
