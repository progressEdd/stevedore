// Presentation loader — reads ppt/presentation.xml and eagerly builds the
// slide list. The Presentation shape below is a frozen interface: every
// later plan builds against it. Robustness law (adopted from PPTX2HTML,
// MIT): one corrupt slide must never fail the whole deck — per-slide
// errors become `broken: true` placeholders that keep slide numbering
// aligned, reported through the diagnostics channel.

import { buildSlide } from './slide.js';

const DEFAULT_SLIDE_SIZE = { cx: 9144000, cy: 6858000 }; // 4:3 fallback when p:sldSz absent
const px = (emu) => Math.round(emu / 9525);

// dc: is not in the canonical prefix set (it's Dublin Core, not DrawingML),
// so dc:title keeps whatever prefix the producer chose — match on local name.
function findByLocal(node, local) {
  if (!node) return null;
  return node.children.find(c => c.name.endsWith(':' + local) || c.name === local) ?? null;
}

export function loadPresentation(pkg, diag) {
  const mainPart = pkg.mainPart();
  const presRoot = pkg.xml(mainPart); // p:presentation (root element)

  const presentation = {
    slideSize: null,
    slides: [],          // built eagerly, in p:sldIdLst order
    masters: [],         // from p:sldMasterIdLst; empty array tolerated, never assumed
    title: '',           // docProps/core.xml dc:title (core.xml optional)
    theme: null,         // first master's theme part name; 'missing' diagnostic when absent
  };

  // 1. slide size — the `type` attr is ignored; scale math handles any aspect
  const sldSz = presRoot.find('p:sldSz');
  const { cx, cy } = sldSz
    ? { cx: sldSz.int('cx', DEFAULT_SLIDE_SIZE.cx), cy: sldSz.int('cy', DEFAULT_SLIDE_SIZE.cy) }
    : DEFAULT_SLIDE_SIZE;
  presentation.slideSize = { cx, cy, pxW: px(cx), pxH: px(cy) };

  // 3. masters — p:sldMasterIdLst -> rels -> master parts; each master's
  // theme via the master part's own .rels; p:clrMap attrs captured raw
  // (the theme engine in 01-03 consumes them).
  const masterIdLst = presRoot.find('p:sldMasterIdLst');
  if (masterIdLst) {
    for (const mId of masterIdLst.all('p:sldMasterId')) {
      const rid = mId.attr('r:id');
      const rel = pkg.rels(mainPart).find(r => r.id === rid);
      if (!rel || rel.external) { diag.add('missing', `no rel ${rid} for slide master`); continue; }
      const name = pkg.resolvePartName(mainPart, rel.target);
      try {
        const masterRoot = pkg.xml(name);
        const themeRel = pkg.relBy('theme', name);
        const clrMap = masterRoot.find('p:clrMap');
        presentation.masters.push({
          partName: name,
          theme: themeRel ? pkg.resolvePartName(name, themeRel.target) : null,
          clrMap: clrMap ? { ...clrMap.attrs } : null,
        });
      } catch (err) {
        diag.add('error', `failed to load master ${name}: ${err.message}`);
      }
    }
  }
  const firstMaster = presentation.masters[0];
  presentation.theme = firstMaster ? firstMaster.theme : null;
  if (!presentation.theme) diag.add('missing', 'no theme part');

  // 2. slide list — per-slide try/catch: corrupt slides become broken
  // placeholders; numbering stays aligned; the deck always converts.
  const sldIdLst = presRoot.find('p:sldIdLst');
  const sldIds = sldIdLst ? sldIdLst.all('p:sldId') : [];
  let index = 0;
  for (const sldId of sldIds) {
    index++;
    const rid = sldId.attr('r:id');
    const rel = pkg.rels(mainPart).find(r => r.id === rid);
    const name = rel && !rel.external
      ? pkg.resolvePartName(mainPart, rel.target)
      : `<unresolved:${rid ?? '?'}>`;
    try {
      const sldRoot = pkg.xml(name);
      const ctx = { pkg, diag, presentation, slideIndex: index, partName: name, master: null, layout: null };
      const built = buildSlide(sldRoot, ctx);
      presentation.slides.push({
        partName: name,
        index,
        hidden: sldRoot.attr('show') === '0', // p:sld@show="0" -> hidden slide
        ...built,
      });
    } catch (err) {
      diag.add('error', `failed to load ${name}: ${err.message}`, index);
      presentation.slides.push({ partName: name, index, broken: true });
    }
  }

  // 4. docProps/core.xml — read only when present; take dc:title text
  if (pkg.has('docProps/core.xml')) {
    try {
      const title = findByLocal(pkg.xml('docProps/core.xml'), 'title');
      presentation.title = title ? title.textOf().trim() : '';
    } catch { presentation.title = ''; }
  }

  return presentation;
}
