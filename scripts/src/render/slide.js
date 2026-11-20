// Slide renderer (adapted from PPTX2HTML, MIT) — hybrid positioning per
// decision 15: per-element absolute .pp-el boxes carry the geometry; semantic
// tags (h1/h2/p) live inside the boxes so the markup stays meaningful.
// 01-03: shapes render as inline SVG (.pp-geom) behind the text, and slide
// backgrounds go through the full fill engine (solid / gradient / pattern /
// picture) instead of the 01-02 solid-hex-only path.

import { resolveFill } from '../pptx/fill.js';
import { buildTextBody, matchPlaceholder } from '../pptx/text.js';
import { buildTable } from '../pptx/table.js';
import { geometrySvg } from './shape.js';
import { svgPaint } from './paint.js';
import { renderText } from './text.js';
import { renderTable } from './table.js';
import { parseChart } from '../charts/parse.js';
import { renderChart } from '../charts/render.js';
import { buildSmartArt } from '../pptx/smartart.js';
import { escapeXml } from '../util/xml.js';

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

// srcRect l/t/r/b per-mille (0..1000). CSS object-position percentage p maps
// so that p% of the container aligns with p% of the image; to show the crop
// window [l, 1000-r] × [t, 1000-b]:
//   const wl = 1000 - l - r, ht = 1000 - t - b;
//   px = wl > 0 ? (l / wl) * 100 : 50;  py = ht > 0 ? (t / ht) * 100 : 50;
// object-fit:cover scales the image so the crop window fills the box.
function cropStyle(srcRect) {
  const { l = 0, t = 0, r = 0, b = 0 } = srcRect ?? {};
  const wl = 1000 - l - r, ht = 1000 - t - b;
  const px = wl > 0 ? (l / wl) * 100 : 50;
  const py = ht > 0 ? (t / ht) * 100 : 50;
  return `width:100%;height:100%;object-fit:cover;object-position:${px}% ${py}%`;
}

// parse-side ctx for graphicFrame content (tables now, charts and SmartArt
// in 01-05's later tasks): everything the content parsers need from rctx
function frameParseCtx(el, rctx) {
  return {
    theme: rctx.theme, diag: rctx.diag, pkg: rctx.pkg,
    partName: rctx.partName, slideIndex: rctx.slideIndex,
  };
}

function elementBox(el, rctx, slide, off = null) {
  const g = el.geom ?? { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  let style = `left:${g.x - (off?.x ?? 0)}px;top:${g.y - (off?.y ?? 0)}px;width:${g.w}px;height:${g.h}px`;
  if (g.rot) style += `;transform:rotate(${g.rot / 60000}deg);transform-origin:center`;
  // geometry SVG sits BEHIND the semantic text, filling the same box
  const svg = (el.kind === 'sp' || el.kind === 'cxnSp' || el.kind === 'graphicFrame')
    ? geometrySvg(el, rctx, `pp${rctx.slideIndex ?? 0}e${el.id}`) : '';
  let inner;
  if (el.image) {
    if (el.image.unsupported) {
      // decision 21 deferred tier: keep the box truthful, mark the gap
      inner = `<div class="pp-img-deferred" style="width:100%;height:100%;border:2px dashed #999;display:flex;align-items:center;justify-content:center;color:#666">[image: EMF/WMF/TIFF deferred]</div>`;
    } else {
      const s = el.image.srcRect;
      const cropped = s && (s.l || s.t || s.r || s.b);
      inner = `<img class="pp-img" src="${rctx.url(el.image.partName)}" alt="" style="${cropped ? cropStyle(s) : 'width:100%;height:100%;object-fit:fill'}">`;
    }
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
  } else if (el.kind === 'graphicFrame' && el.frameKind === 'table') {
    // 01-05: a:tbl frames render as semantic tables inside the frame box
    // (the frame's p:xfrm positions this .pp-el)
    inner = renderTable(buildTable(el.node, frameParseCtx(el, rctx)), rctx);
  } else if (el.kind === 'graphicFrame' && el.frameKind === 'chart' && el.chartPartName) {
    // 01-05: minimal SVG charts from the cached series model + diagnostics
    try {
      const chart = parseChart(rctx.pkg.xml(el.chartPartName), frameParseCtx(el, rctx));
      inner = renderChart(chart, rctx, { w: g.w, h: g.h });
    } catch (err) {
      rctx.diag.add('error', `failed to load chart ${el.chartPartName}: ${err.message}`, rctx.slideIndex ?? null);
      inner = '';
    }
  } else if (el.kind === 'graphicFrame' && el.frameKind === 'smartArt') {
    // 01-05: pre-rendered dsp: drawing → real shapes inside the frame box;
    // absent drawing → honest placeholder + unsupported diagnostic
    const sm = buildSmartArt(el.node, frameParseCtx(el, rctx));
    if (sm.elements.length) {
      inner = renderElements(sm.elements, rctx, slide, { x: g.x, y: g.y });
    } else {
      inner = `<div class="pp-smartart-approx" style="border:1px dashed #999;display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-style:italic">` +
        `SmartArt: ${escapeXml(sm.title || 'diagram')} — layout engine deferred</div>`;
    }
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

// contiguous children of one ROTATED group wrap in a single container div
// carrying the rotation — children keep their computed positions (their
// left/top are offset so the container's origin cancels out). Non-rotated
// groups need no wrapper: children are already remapped by the walker.
// off (01-05 SmartArt): an extra origin subtracted from every child box so
// drawing-absolute coordinates render inside the frame's .pp-el box.
function renderElements(elements, rctx, slide, off = null) {
  const out = [];
  let i = 0;
  while (i < elements.length) {
    const el = elements[i];
    if (!el.groupId || !el.groupRot) { out.push(elementBox(el, rctx, slide, off)); i++; continue; }
    let j = i;
    while (j < elements.length && elements[j].groupId === el.groupId) j++;
    const run = elements.slice(i, j);
    const bx = off?.x ?? 0, by = off?.y ?? 0;
    const x = Math.min(...run.map(e => e.geom?.x ?? 0)) - bx;
    const y = Math.min(...run.map(e => e.geom?.y ?? 0)) - by;
    const w = Math.max(...run.map(e => (e.geom?.x ?? 0) + (e.geom?.w ?? 0))) - x - bx;
    const h = Math.max(...run.map(e => (e.geom?.y ?? 0) + (e.geom?.h ?? 0))) - y - by;
    out.push(`  <div class="pp-group" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${el.groupRot / 60000}deg);transform-origin:center">` +
      `\n${run.map(e => elementBox(e, rctx, slide, { x: x + bx, y: y + by })).join('\n')}\n  </div>`);
    i = j;
  }
  return out;
}

export function renderSlide(slide, rctx, opts = {}) {
  if (slide.broken)
    return `<div class="pp-slide pp-broken">Slide ${slide.index} could not be read</div>`;
  // transient per-slide render context: rel resolution + addOnce scoping
  rctx.partName = slide.partName;
  rctx.slideIndex = slide.index;
  const bg = slideBackground(slide, rctx, opts);
  const boxes = renderElements(slide.elements ?? [], rctx, slide);
  return `<div class="pp-slide" data-slide-index="${slide.index}" role="group" aria-label="Slide ${slide.index}"${bg.styleAttr}>\n` +
    bg.svg + boxes.join('\n') + `\n</div>`;
}
