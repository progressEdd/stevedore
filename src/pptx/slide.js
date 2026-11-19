// Minimal slide builder for plan 01-02. The full three-layer
// master/layout/slide walk (adapted from PPTX2HTML src/pptx/slide.js, MIT)
// arrives in task 2; this is the frozen model the renderer consumes:
//   { background: null | { solid }, elements: [], notes: null }
// loadPresentation merges this per slide with { partName, index, hidden }.

const EMU_PER_PX = 9525;

export function buildSlide(sldRoot, ctx) {
  // Background — minimal for this plan: solid srgbClr hex only. The full
  // fill engine (scheme colors, gradients, pictures) arrives in 01-03.
  let background = null;
  const bg = sldRoot.path('p:cSld/p:bg');
  if (bg) {
    const hex = bg.path('p:bgPr/a:solidFill/a:srgbClr')?.attr('val');
    if (hex) background = { solid: '#' + hex };
    else ctx.diag.add('approx', 'background style not rendered (fill engine later)');
  }
  return { background, elements: [], notes: null };
}

// exported for the renderer's px math (same EMU constant everywhere)
export const EMU = { PER_PX: EMU_PER_PX, toPx: (emu) => Math.round(emu / EMU_PER_PX) };
