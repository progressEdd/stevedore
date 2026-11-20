// Library entry (mirrors upstream PPTX2HTML's convert(data, options), MIT):
// bytes of a .pptx in, { html, diagnostics, slideCount } out — and, since
// 01-06, convertSplit: decision 12's second mode, one self-contained page
// per slide plus an index. Structural failures (not a zip, no presentation
// part) throw — that is a caller error; content failures degrade per
// feature and per slide through diagnostics.

import { ZipReader } from './util/zip.js';
import { OpcPackage } from './opc/package.js';
import { Diagnostics } from './pptx/context.js';
import { loadPresentation } from './pptx/presentation.js';
import { loadTheme } from './pptx/theme.js';
import { RenderContext } from './render/context.js';
import { renderSlide } from './render/slide.js';
import { renderDocument, decorateSlideHtml, documentShell, documentTitle } from './render/document.js';
import { escapeXml } from './util/xml.js';

// shared setup for both output modes: package open, presentation model,
// theme model (01-03: first master's theme part + its p:clrMap; absent or
// unreadable parts degrade to the Office-default theme, never a throw)
function openDeck(data) {
  const diag = new Diagnostics();
  const pkg = OpcPackage.open(data);
  const presentation = loadPresentation(pkg, diag);
  const rctx = new RenderContext(pkg, diag);
  let themeRoot = null;
  if (presentation.theme && pkg.has(presentation.theme)) {
    try { themeRoot = pkg.xml(presentation.theme); }
    catch (err) { diag.add('error', `failed to load theme ${presentation.theme}: ${err.message}`); }
  }
  rctx.theme = loadTheme(themeRoot, presentation.masters[0]?.clrMap ?? null, diag);
  rctx.slideSize = presentation.slideSize;
  return { diag, pkg, presentation, rctx };
}

// options.slides (1-based) selects a subset (CLI ranges expand before this);
// original indices are kept so a subset never renumbers the deck
function subsetSlides(presentation, options) {
  if (Array.isArray(options.slides) && options.slides.length > 0) {
    const want = new Set(options.slides);
    return presentation.slides.filter(s => want.has(s.index)); // original indices kept
  }
  return presentation.slides;
}

export function convert(data, options = {}) {
  const { diag, presentation, rctx } = openDeck(data);
  const slides = subsetSlides(presentation, options);
  const html = renderDocument({ ...presentation, slides }, rctx, options);
  return { html, diagnostics: diag, slideCount: presentation.slides.length };
}

// --split mode (01-06, decision 12): every slide becomes its own page with
// the same head/CSS/scaler as the single file (documentShell, viewport
// centered on exactly one slide), plus index.html listing every emitted
// slide. Numbering follows ORIGINAL indices — slide-07.html is slide 7 even
// when it is the only slide emitted.
export function convertSplit(data, options = {}) {
  const { diag, presentation, rctx } = openDeck(data);
  const slides = subsetSlides(presentation, options);
  const W = presentation.slideSize.pxW;
  const H = presentation.slideSize.pxH;
  const files = slides.map(slide => {
    let slideHtml;
    try {
      // hidden slides get their own file: the data-hidden flag is kept, the
      // `hidden` attribute is dropped — a hidden slide opened directly must
      // still show
      slideHtml = decorateSlideHtml(renderSlide(slide, rctx, { ...options, W, H }), slide, { hiddenAttr: false });
    } catch (err) { // same per-slide tolerance as the single-file renderer
      diag.add('error', `failed to render slide ${slide.index}: ${err.message}`, slide.index);
      slideHtml = `<div class="pp-slide pp-broken">Slide ${slide.index} could not be read</div>`;
    }
    const html = documentShell(`<div class="pp-viewport">\n${slideHtml}\n</div>`, presentation, { centerViewport: true });
    return { name: `slide-${String(slide.index).padStart(2, '0')}.html`, html };
  });
  files.unshift({ name: 'index.html', html: indexPageHtml({ ...presentation, slides }) });
  return { files, diagnostics: diag, slideCount: presentation.slides.length };
}

// first title/subtitle placeholder text on the slide — the index labels
// slides the way PowerPoint's slide sorter does; truncated to 80 chars
function slideTitleText(slide) {
  const el = (slide.elements ?? []).find(
    e => e.ph && ['title', 'ctrTitle', 'subTitle'].includes(e.ph.type) && e.text && e.text.trim() !== '');
  if (!el) return '';
  const text = el.text.trim().replace(/\s+/g, ' ');
  return text.length > 80 ? text.slice(0, 80) + '…' : text;
}

// index.html: semantic nav list — slide number, title text, a notes flag
// when the slide carries speaker notes — linking each emitted slide-NN.html
function indexPageHtml(presentation) {
  const items = presentation.slides.map(slide => {
    const num = String(slide.index).padStart(2, '0');
    const notesFlag = slide.notes != null && slide.notes.trim() !== ''
      ? ' <span class="pp-notes-flag" title="speaker notes">✎</span>' : '';
    return `    <li><a href="slide-${num}.html"><span class="pp-index-num">${slide.index}.</span> ` +
      `<span class="pp-index-title">${escapeXml(slideTitleText(slide))}</span>${notesFlag}</a></li>`;
  }).join('\n');
  return documentShell(`<div class="pp-viewport">
<nav class="pp-index" aria-label="Slides">
<h1>${escapeXml(documentTitle(presentation))}</h1>
<ol class="pp-index-list">
${items}
</ol>
</nav>
</div>`, presentation, { centerViewport: true });
}
