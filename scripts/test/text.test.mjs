// Text model tests (adapted from PPTX2HTML, MIT) — the placeholder
// inheritance chain: layout-level bullets reaching a slide placeholder that
// only sets run color (both directions of the chain in one merged result),
// master txStyles, presentation defaultTextStyle, the no-ph shortened chain,
// autofit scaling, fields, hyperlinks, default insets, symbol mapping.

import test from 'node:test';
import assert from 'node:assert/strict';
import { OpcPackage } from '../src/opc/package.js';
import { loadPresentation } from '../src/pptx/presentation.js';
import { loadTheme } from '../src/pptx/theme.js';
import { Diagnostics } from '../src/pptx/context.js';
import { buildTextBody, matchPlaceholder } from '../src/pptx/text.js';
import { mapSymbol } from '../src/pptx/symbols.js';
import { buildDeck } from './lib/deck.mjs';

// load a fixture deck and hand back the loaded presentation + a buildTextBody
// ctx wired to slide 1 (theme, phChain through layout/master spTrees)
function load(spec) {
  const diag = new Diagnostics();
  const pkg = OpcPackage.open(buildDeck(spec));
  const presentation = loadPresentation(pkg, diag);
  const slide = presentation.slides[0];
  const theme = loadTheme(
    presentation.theme && pkg.has(presentation.theme) ? pkg.xml(presentation.theme) : null,
    presentation.masters[0]?.clrMap ?? null, diag);
  const slideRoot = pkg.xml(slide.partName);
  return { pkg, diag, presentation, slide, slideRoot, theme };
}

function textCtxFor(base, element) {
  const layoutSpTree = base.slide.layoutRoot?.path('p:cSld/p:spTree') ?? null;
  const masterSpTree = base.slide.masterRoot?.path('p:cSld/p:spTree') ?? null;
  const ph = element.ph;
  return {
    theme: base.theme, diag: base.diag, slideIndex: base.slide.index,
    phChain: [
      element.layer === 'slide' ? element.node : null,
      element.layer === 'layout' ? element.node : matchPlaceholder(layoutSpTree, ph),
      element.layer === 'master' ? element.node : matchPlaceholder(masterSpTree, ph),
    ],
    ph,
    masterRoot: base.slide.masterRoot ?? null,
    defaultTextStyle: base.slide.defaultTextStyle ?? null,
    pkg: base.pkg, partName: base.slide.partName,
  };
}

function bodyOf(base, element) {
  return buildTextBody(element.node.find('p:txBody'), textCtxFor(base, element));
}

test('layout-level bullet + marL and slide-level run color merge into one result', () => {
  const base = load({
    masters: [{}],
    layouts: [{
      shapes: `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body Placeholder 1"/>` +
        `<p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
        `<p:spPr><a:xfrm><a:off x="457200" y="1143000"/><a:ext cx="8229600" cy="4572000"/></a:xfrm></p:spPr>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/>` +
        `<a:p><a:pPr marL="228600" indent="-228600"><a:buChar char="•"/></a:pPr><a:endParaRPr lang="en-US"/></a:p>` +
        `</p:txBody></p:sp>`,
    }],
    slides: [{
      rels: [],
      texts: [{
        ph: '<p:ph type="body" idx="1"/>',
        paragraphs: [{ pPr: '', runs: [{ t: 'inherited bullet, own color', color: 'FF0000' }] }],
      }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  assert.ok(el.ph, 'slide sp carries a ph');
  const body = bodyOf(base, el);
  const p = body.paragraphs[0];
  // bullet + marL resolved from the LAYOUT level of the chain
  assert.deepEqual(p.pPr.bullet, { type: 'char', char: '•' });
  assert.equal(p.pPr.marL, 24, 'marL 228600 EMU -> 24px from the layout level');
  assert.equal(p.pPr.indent, -24, 'indent -228600 EMU -> -24px from the layout level');
  // run color from the SLIDE level (most specific wins)
  assert.equal(p.runs[0].rPr.color, '#ff0000');
  assert.equal(p.runs[0].text, 'inherited bullet, own color');
  assert.equal(base.diag.hasErrors, false);
});

test('master a:txStyles level: bodyStyle lvl1pPr alignment reaches a body placeholder', () => {
  const base = load({
    masters: [{
      txStyles: '<a:bodyStyle><a:lvl1pPr marL="457200" indent="-457200" algn="just">' +
        '<a:buChar char="–"/></a:lvl1pPr></a:bodyStyle>' +
        '<a:titleStyle><a:lvl1pPr algn="l"/></a:titleStyle>',
    }],
    layouts: [{ shapes: '' }],
    slides: [{ rels: [], texts: [{ ph: '<p:ph type="body" idx="1"/>', paragraphs: [{ runs: [{ t: 'x' }] }] }] }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const p = bodyOf(base, el).paragraphs[0].pPr;
  assert.equal(p.algn, 'just', 'master txStyles bodyStyle lvl1pPr algn');
  assert.equal(p.bullet.char, '–', 'master bodyStyle bullet char');
  assert.equal(p.marL, 48, '457200 EMU -> 48px');
});

test('presentation defaultTextStyle level feeds a ph-less shape; placeholder levels skipped', () => {
  const base = load({
    masters: [{
      txStyles: '<a:bodyStyle><a:lvl1pPr algn="r"><a:buChar char="»"/></a:lvl1pPr></a:bodyStyle>',
      shapes: `<p:sp><p:nvSpPr><p:cNvPr id="9" name="Master Body"/><p:cNvSpPr/><p:nvPr>` +
        `<p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr marL="914400"><a:buChar char="*"/></a:pPr></a:p></p:txBody></p:sp>`,
    }],
    layouts: [{
      shapes: `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/><p:nvPr>` +
        `<p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
        `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr marL="914400"><a:buChar char="+"/></a:pPr></a:p></p:txBody></p:sp>`,
    }],
    defaultTextStyle: '<a:lvl1pPr marL="228600"><a:buNone/><a:buChar char="§"/></a:lvl1pPr>',
    slides: [{ rels: [], texts: [{ paragraphs: [{ runs: [{ t: 'plain box' }] }] }] }], // no ph
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  assert.equal(el.ph, null, 'fixture shape really has no placeholder');
  const p = bodyOf(base, el).paragraphs[0].pPr;
  // defaultTextStyle level applies… but buNone in the SAME level defuses the
  // buChar sibling? No — defined keys win by document order of extraction;
  // buNone wins because bulletOf checks a:buNone first.
  assert.equal(p.bullet.type, 'none', 'buNone at the defaultTextStyle level');
  assert.equal(p.marL, 24, 'marL from presentation defaultTextStyle');
  assert.equal(p.algn, null, 'txStyles skipped for a ph-less shape');
});

test('normAutofit fontScale="75000" -> autofit.fontScale === 0.75; spAutoFit flag', () => {
  const base = load({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [
        { bodyPr: '<a:normAutofit fontScale="75000" lnSpcReduction="50000"/>', paragraphs: [{ runs: [{ t: 'a' }] }] },
        { bodyPr: '<a:spAutoFit/>', paragraphs: [{ runs: [{ t: 'b' }] }] },
      ],
    }],
  });
  const els = base.slide.elements.filter(e => e.layer === 'slide');
  const a = bodyOf(base, els[0]).bodyPr.autofit;
  assert.equal(a.fontScale, 0.75);
  assert.equal(a.lnSpcReduction, 0.5);
  const b = bodyOf(base, els[1]).bodyPr.autofit;
  assert.equal(b.fontScale, 1);
  assert.equal(b.spAutoFit, true);
});

test('a:fld slidenum captured with fixed fallback text; datetime normalized', () => {
  const base = load({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [
        { t: 'Page ', sz: 1200 },
        { field: 'slidenum', t: '7' },
        { field: 'datetime1', t: '2024-01-01' },
        { field: 'customFmt', t: 'raw' },
      ] }] }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const runs = bodyOf(base, el).paragraphs[0].runs;
  assert.deepEqual(runs[1].field, { type: 'slidenum', fixed: '7', rawType: 'slidenum' });
  assert.equal(runs[2].field.type, 'datetime');
  assert.equal(runs[2].field.fixed, '2024-01-01');
  assert.equal(runs[3].field.type, null, 'unknown field type -> null (render approximates)');
  assert.equal(runs[3].field.fixed, 'raw');
});

test('hlinkClick: external rel -> URL via slide rels; ppaction://hlinksldjump -> jump slide', () => {
  const base = load({
    masters: [{}],
    slides: [{
      rels: [
        { id: 'rId9', target: 'https://example.com/doc', external: true },
        { id: 'rId10', target: 'slide5.xml' },
      ],
      texts: [{ paragraphs: [{ runs: [
        { t: 'ext', linkId: 'rId9' },
        { t: 'jump', linkId: 'rId10', action: 'ppaction://hlinksldjump' },
      ] }] }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const runs = bodyOf(base, el).paragraphs[0].runs;
  assert.deepEqual(runs[0].rPr.link, { url: 'https://example.com/doc', jump: null });
  assert.deepEqual(runs[1].rPr.link, { url: null, jump: 'slide' });
});

test('empty a:bodyPr still yields the OOXML default insets (0.1"/0.05" -> px)', () => {
  const base = load({ masters: [{}], slides: [{ rels: [], texts: [{ paragraphs: [{ runs: [{ t: 'x' }] }] }] }] });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const bp = bodyOf(base, el).bodyPr;
  assert.deepEqual(bp.insets, { l: 10, t: 5, r: 10, b: 5 });
  assert.equal(bp.anchor, 't');
  assert.equal(bp.wrap, 'square');
  assert.equal(bp.vert, 'horz');
  assert.equal(bp.cols, 1);
});

test('bodyPr knobs survive: anchor/vert/wrap/cols and lnSpc pct+pts spacing', () => {
  const base = load({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{
        bodyPrAttrs: 'anchor="ctr" vert="eaVert" wrap="none"',
        bodyPr: '<a:cols num="2"/>',
        paragraphs: [{
          pPr: '<a:pPr algn="ctr" marL="457200"><a:lnSpc><a:spcPct val="150000"/></a:lnSpc>' +
            '<a:spcBef><a:spcPts val="1200"/></a:spcBef><a:tabLst><a:tab pos="914400" algn="r"/></a:tabLst></a:pPr>',
          runs: [{ t: 'spaced' }],
        }],
      }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const body = bodyOf(base, el);
  assert.equal(body.bodyPr.anchor, 'ctr');
  assert.equal(body.bodyPr.vert, 'eaVert');
  assert.equal(body.bodyPr.wrap, 'none');
  assert.equal(body.bodyPr.cols, 2);
  const p = body.paragraphs[0].pPr;
  assert.deepEqual(p.lnSpc, { kind: 'pct', v: 150000 });
  assert.deepEqual(p.spcBef, { kind: 'pts', v: 16 }, '1200 (12pt) -> 16px');
  assert.deepEqual(p.tabs, [{ pos: 96, algn: 'r' }]);
});

test('run properties survive the merge: sz/pt->px, baseline, spc, caps, fonts, strike', () => {
  const base = load({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [{
        t: 'styled', sz: 2400, b: true, i: true, u: 'sng', strike: 'sngStrike',
        cap: 'small', baseline: 30000, spc: 300, latin: 'Calibri', sym: 'Wingdings',
      }] }] }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  const r = bodyOf(base, el).paragraphs[0].runs[0].rPr;
  assert.equal(r.sz, 32, '24pt -> 32px');
  assert.equal(r.b, true); assert.equal(r.i, true);
  assert.equal(r.u, 'sng'); assert.equal(r.strike, 'sngStrike');
  assert.equal(r.caps, 'small');
  assert.equal(r.baselinePct, 30);
  assert.equal(r.spc, 3);
  assert.deepEqual(r.font, { latin: 'Calibri', ea: null, cs: null, sym: 'Wingdings' });
});

test('Wingdings runs map to Unicode before storage; F0FC -> checkmark', () => {
  assert.equal(mapSymbol('Wingdings', 0xF0FC), '✓');
  assert.equal(mapSymbol('Wingdings', 0xF0FB), '✗');
  assert.equal(mapSymbol('Symbol', 0xF0B7), '•');
  assert.equal(mapSymbol('Wingdings', 0xF0DA), '→');
  const base = load({
    masters: [{}],
    slides: [{
      rels: [],
      texts: [{ paragraphs: [{ runs: [{ t: '\uF0A7 x \uF0FC', sym: 'Wingdings' }] }] }],
    }],
  });
  const el = base.slide.elements.find(e => e.layer === 'slide');
  // F0A7 -> small square, F0FC -> check; unmapped slots (like 'x') pass through
  assert.equal(bodyOf(base, el).paragraphs[0].runs[0].text, '▪ x ✓');
});

test('unmapped symbol code passes through with one addOnce approx diagnostic', () => {
  const diag = new Diagnostics();
  assert.equal(mapSymbol('Wingdings', 0xF022, diag, 3), '\uF022');
  mapSymbol('Wingdings', 0xF022, diag, 3);
  const hits = diag.items.filter(d => d.msg === 'symbol glyph unmapped');
  assert.equal(hits.length, 1, 'addOnce dedupes');
  assert.equal(hits[0].kind, 'approx');
  assert.equal(hits[0].slide, 3);
});
