// Library entry (mirrors upstream PPTX2HTML's convert(data, options), MIT):
// bytes of a .pptx in, { html, diagnostics, slideCount } out. Structural
// failures (not a zip, no presentation part) throw — that is a caller error;
// content failures degrade per feature and per slide through diagnostics.

import { ZipReader } from './util/zip.js';
import { OpcPackage } from './opc/package.js';
import { Diagnostics } from './pptx/context.js';
import { loadPresentation } from './pptx/presentation.js';
import { loadTheme } from './pptx/theme.js';
import { RenderContext } from './render/context.js';
import { renderDocument } from './render/document.js';

export function convert(data, options = {}) {
  // options: { slides?: number[] (1-based filter, also expands CLI ranges before this) }
  const diag = new Diagnostics();
  const pkg = OpcPackage.open(data);
  const presentation = loadPresentation(pkg, diag);
  const rctx = new RenderContext(pkg, diag);
  // theme model (01-03): first master's theme part + its p:clrMap; absent or
  // unreadable parts degrade to the Office-default theme, never a throw
  let themeRoot = null;
  if (presentation.theme && pkg.has(presentation.theme)) {
    try { themeRoot = pkg.xml(presentation.theme); }
    catch (err) { diag.add('error', `failed to load theme ${presentation.theme}: ${err.message}`); }
  }
  rctx.theme = loadTheme(themeRoot, presentation.masters[0]?.clrMap ?? null, diag);
  rctx.slideSize = presentation.slideSize;
  let slides = presentation.slides;
  if (Array.isArray(options.slides) && options.slides.length > 0) {
    const want = new Set(options.slides);
    slides = presentation.slides.filter(s => want.has(s.index)); // original indices kept
  }
  const html = renderDocument({ ...presentation, slides }, rctx, options);
  return { html, diagnostics: diag, slideCount: presentation.slides.length };
}
