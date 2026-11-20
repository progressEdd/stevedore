// Document renderer (adapted from PPTX2HTML, MIT) — emits the full
// self-contained HTML document. Viewport scaling per decision 15: slides are
// fixed-size boxes scaled by --pp-k to fit the viewport width; because every
// element box is absolutely positioned, slide content never reflows — only
// the scale factor changes. W/H are baked in from presentation.slideSize.

import { escapeXml } from '../util/xml.js';
import { renderSlide } from './slide.js';

// per-slide data embed (01-06): the parsed p:timing + p:transition ride
// the slide div as JSON inside <script type="application/json"> — data for
// a future player, never a runtime (decision 22). JSON.stringify output is
// made HTML-safe: '<' would close the script context, so it is escaped.
function timingJsonScript(slide) {
  const json = JSON.stringify({ timing: slide.timing ?? null, transition: slide.transition ?? null })
    .replace(/</g, '\\u003c');
  return `<script type="application/json" class="pp-timing-json">${json}</script>`;
}

// insert per-slide data as the last children of the rendered .pp-slide div
// (broken-slide divs get the same decoration — every emitted slide carries
// its data). Exported: the 01-06 split renderer reuses this verbatim.
export function decorateSlideHtml(html, slide) {
  const close = html.lastIndexOf('</div>');
  if (close < 0) return html;
  return html.slice(0, close) + timingJsonScript(slide) + '\n' + html.slice(close);
}

export function renderDocument(presentation, rctx, opts = {}) {
  const W = presentation.slideSize.pxW;
  const H = presentation.slideSize.pxH;
  // per-slide render wrapped in try/catch: one unreadable slide (e.g. missing
  // media) becomes a .pp-broken placeholder + error diagnostic — content
  // failures never take the whole document down
  const slides = presentation.slides.map(slide => {
    try {
      return decorateSlideHtml(renderSlide(slide, rctx, { ...opts, W, H }), slide);
    } catch (err) {
      rctx.diag.add('error', `failed to render slide ${slide.index}: ${err.message}`, slide.index);
      return `<div class="pp-slide pp-broken">Slide ${slide.index} could not be read</div>`;
    }
  }).join('\n');
  const title = escapeXml(presentation.title || 'Deck');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root { --pp-w: ${W}px; --pp-h: ${H}px; }
* { box-sizing: border-box; }
body { margin: 0; background: #1a1a1a; }
.pp-viewport { display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
.pp-slide { position: relative; width: var(--pp-w); height: var(--pp-h);
  background: #fff; overflow: hidden; margin: 16px 0;
  transform-origin: top center; transform: scale(var(--pp-k, 1)); }
.pp-el { position: absolute; }
.pp-slide img { max-width: none; }
</style>
</head>
<body>
<div class="pp-viewport">
${slides}
</div>
<script>
(function () {
  var fit = function () {
    var k = Math.min(1, (document.documentElement.clientWidth - 32) / ${W});
    document.querySelectorAll('.pp-slide').forEach(function (s) { s.style.setProperty('--pp-k', k); });
  };
  addEventListener('resize', fit); fit();
})();
</script>
</body>
</html>
`;
}
