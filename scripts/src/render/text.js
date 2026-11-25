// Semantic text rendering (adapted from PPTX2HTML src/render/text.js, MIT)
// — turns the 01-04 TextBody model into self-contained semantic HTML:
// titles as <h1>/<h2>, bulleted paragraph runs as real <ul>/<ol>+<li> (the
// bullet char in an aria-hidden span, native markers for auto numbers),
// styled runs as inline-styled <span>s (no classes — the output must be
// self-contained), fields, hyperlinks through a scheme whitelist, autofit
// scaling at emit time, vertical text, and PowerPoint blank lines preserved
// as <p><br></p>. All text escapes through escapeXml;
// all font-family values are single-quoted (attribute-safe — 02-FX1).

import { escapeXml } from '../util/xml.js';
import { fontFamily } from './fonts.js';

const num = (v) => Number(v.toFixed(2));

// ---- underline: all 18 ST_TextUnderlineType variants -> CSS ---------------
// CSS has no double underline: dbl falls back to a 3px double border-bottom
// (with display:inline-block so the border hugs the run). 'heavy' variants
// take text-decoration-thickness:2px — best-effort, no diagnostic.
const UNDERLINE = {
  none: { td: '' },
  sng: { td: 'underline' },
  heavy: { td: 'underline', thick: true },
  dbl: { td: 'none', extra: 'border-bottom:3px double currentColor;display:inline-block' },
  words: { td: 'underline', approx: 'word-only underline not supported' },
  wavy: { td: 'underline wavy' },
  wavyHeavy: { td: 'underline wavy', thick: true },
  wavyDbl: { td: 'underline wavy', approx: 'double wavy underline approximated' },
  dash: { td: 'underline dashed' },
  dashHeavy: { td: 'underline dashed', thick: true },
  dashLong: { td: 'underline dashed' },
  dashLongHeavy: { td: 'underline dashed', thick: true },
  dotDash: { td: 'underline dotted' },
  dotDashHeavy: { td: 'underline dotted', thick: true },
  dotDotDash: { td: 'underline dotted' },
  dotDotDashHeavy: { td: 'underline dotted', thick: true },
  dotted: { td: 'underline dotted' },
  dottedHeavy: { td: 'underline dotted', thick: true },
};

// a:buAutoNum@type -> <ol type> (unmapped -> '1' + approx-once)
const OL_TYPE = {
  arabicPeriod: '1', arabicParen: '1', arabicParenR: '1', arabic: '1',
  alphaLcPeriod: 'a', alphaLcParen: 'a', alphaLcParenR: 'a', alphaLc: 'a',
  alphaUcPeriod: 'A', alphaUcParen: 'A', alphaUcParenR: 'A', alphaUc: 'A',
  romanLcPeriod: 'i', romanLcParen: 'i', romanLcParenR: 'i', romanLc: 'i',
  romanUcPeriod: 'I', romanUcParen: 'I', romanUcParenR: 'I', romanUc: 'I',
};

const ALIGN = { l: 'left', ctr: 'center', r: 'right', just: 'justify', justLow: 'justify', thaiDist: 'justify', dist: 'justify' };
const ANCHOR = { t: 'flex-start', ctr: 'center', b: 'flex-end' };

// a:bodyPr@vert -> CSS writing-mode; wordArtVert* and anything unknown ->
// horizontal + approx-once diagnostic
const VERT_CSS = {
  horz: '',
  vert: 'writing-mode:vertical-rl',
  vert270: 'writing-mode:vertical-rl;transform:rotate(180deg)',
  eaVert: 'writing-mode:vertical-rl',
  mongolianVert: 'writing-mode:vertical-rl',
};

// hyperlink scheme whitelist — anything else (javascript:, data:, …) renders
// as a plain span plus an approx diagnostic (safety rule from upstream safeUrl)
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];
function safeUrl(url) {
  try { return SAFE_SCHEMES.includes(new URL(url).protocol); } catch { return false; }
}

// ---- runs --------------------------------------------------------------------

function fieldText(field, opts, rctx) {
  if (field?.type === 'slidenum') return String(opts.slideIndex ?? '');
  if (field?.type === 'datetime') return field.fixed;
  if (field) {
    rctx.diag.addOnce('approx', `unknown field type ${field.rawType} rendered as stored text`, rctx.slideIndex ?? null);
    return field.fixed;
  }
  return null;
}

function runHasProps(r) {
  return !!(r && (r.sz != null || r.b || r.i || (r.u && r.u !== 'none') ||
    (r.strike && r.strike !== 'noStrike') || (r.caps && r.caps !== 'none') ||
    r.baselinePct || r.spc || r.color || r.highlight ||
    (r.font && (r.font.latin || r.font.ea || r.font.cs || r.font.sym)) ||
    r.link || r.outline || r.gradFill));
}

function runSpan(run, textBody, rctx, opts) {
  if (run.br) return '<br>';
  const r = run.rPr ?? {};
  const field = fieldText(run.field, opts, rctx);
  const text = escapeXml(field != null ? field : run.text).replace(/\n/g, '<br>');
  if (!runHasProps(r)) return text; // property-free runs stay bare (clean semantics)

  const scale = textBody.bodyPr.autofit.fontScale; // autofit applies at emit time
  const s = [];
  if (r.sz != null) s.push(`font-size:${num(r.sz * scale)}px`);
  const face = r.font?.latin ?? r.font?.ea ?? r.font?.cs ?? r.font?.sym ?? null;
  if (face) s.push(`font-family:${fontFamily(face, rctx)}`); // theme refs resolve here
  s.push(`font-weight:${r.b ? '700' : '400'}`);
  s.push(`font-style:${r.i ? 'italic' : 'normal'}`);
  if (r.color) s.push(`color:${r.color}`);

  // text-decoration: underline variant + strike, combined
  const u = UNDERLINE[r.u] ?? UNDERLINE.none;
  const td = [u.td, r.strike === 'sngStrike' || r.strike === 'dblStrike' ? 'line-through' : null]
    .filter(Boolean).join(' ');
  if (td) s.push(`text-decoration:${td}`);
  if (u.thick) s.push('text-decoration-thickness:2px');
  if (u.extra) s.push(u.extra);
  if (u.approx) rctx.diag.addOnce('approx', u.approx, rctx.slideIndex ?? null);
  if (r.strike === 'dblStrike')
    rctx.diag.addOnce('approx', 'double strikethrough approximated as line-through', rctx.slideIndex ?? null);

  if (r.caps === 'small') s.push('font-variant:small-caps');
  if (r.caps === 'all') s.push('text-transform:uppercase');
  if (r.spc) s.push(`letter-spacing:${num(r.spc)}px`);
  if (r.highlight) s.push(`background-color:${r.highlight}`);
  if (r.baselinePct) s.push(`vertical-align:${r.baselinePct}%;position:relative;top:${num(-r.baselinePct * 0.4)}px`);
  if (r.outline) rctx.diag.addOnce('approx', 'text outline approximated (filled text only)', rctx.slideIndex ?? null);
  if (r.gradFill) rctx.diag.addOnce('approx', 'gradient text fill approximated (solid color)', rctx.slideIndex ?? null);

  const span = `<span style="${s.join(';')}">${text}</span>`;
  if (r.link) {
    if (r.link.url && safeUrl(r.link.url))
      return `<a href="${escapeXml(r.link.url)}"${r.link.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${span}</a>`;
    if (r.link.url) {
      // rel targets can be relative or unparsable (PPTX2HTML sample.pptx slide 19
      // carries a hyperlink Target="test/%5bContent_Types%5d.xml") — new URL throws
      // on those, which must never take the slide down with it
      let scheme = '(unparsable URL)';
      try { scheme = new URL(r.link.url).protocol; } catch { /* keep placeholder */ }
      rctx.diag.addOnce('approx', `hyperlink scheme not allowed (${scheme})`, rctx.slideIndex ?? null);
    }
    else
      rctx.diag.addOnce('approx', 'internal slide hyperlink rendered as text', rctx.slideIndex ?? null);
  }
  return span;
}

// ---- paragraphs ---------------------------------------------------------------

// alignment + line/space props shared by <p>, <li>, and heading paragraphs
function paraStyles(p, textBody, rctx) {
  const s = ['margin:0'];
  const red = textBody.bodyPr.autofit.lnSpcReduction;
  if (p.pPr.lnSpc) {
    const { kind, v } = p.pPr.lnSpc;
    s.push(kind === 'pct' ? `line-height:${num((v / 100000) * red)}` : `line-height:${num(v * red)}px`);
  }
  const space = (prop, css) => {
    const sp = p.pPr[prop];
    if (sp) s.push(`${css}:${sp.kind === 'pct' ? num(sp.v / 100000) + 'em' : num(sp.v) + 'px'}`);
  };
  space('spcBef', 'margin-top');
  space('spcAft', 'margin-bottom');
  const algn = p.pPr.algn;
  if (algn && ALIGN[algn]) {
    if (algn === 'dist') { s.push('text-align-last:justify', 'text-align:justify'); rctx.diag.addOnce('approx', 'distributed alignment approximated as justify', rctx.slideIndex ?? null); }
    else s.push(`text-align:${ALIGN[algn]}`);
    if (algn === 'justLow' || algn === 'thaiDist')
      rctx.diag.addOnce('approx', `alignment ${algn} approximated as justify`, rctx.slideIndex ?? null);
  }
  return s;
}

function runsHtml(p, textBody, rctx, opts) {
  return p.runs.map(run => runSpan(run, textBody, rctx, opts)).join('');
}

function openListAttrs(bullet, rctx) {
  if (bullet.type !== 'auto') return '';
  const attrs = [];
  if (bullet.startAt != null && bullet.startAt > 1) attrs.push(` start="${bullet.startAt}"`);
  const t = OL_TYPE[bullet.numType];
  attrs.push(` type="${t ?? '1'}"`);
  if (!t) rctx.diag.addOnce('approx', `numbering ${bullet.numType} rendered as decimal`, rctx.slideIndex ?? null);
  return attrs.join('');
}

// char/pic bullets: native markers off, the char (or bullet image) in an
// aria-hidden span, hanging indent per OOXML semantics — marL is the block
// indent, indent the SIGNED first-line offset (negative = bullet hangs left)
function listItemHtml(p, textBody, rctx, opts) {
  const { bullet, marL, indent } = p.pPr;
  const s = ['list-style-type:none', `padding-left:${Math.max(marL, 0)}px`, `text-indent:${indent}px`, ...paraStyles(p, textBody, rctx)];
  let marker;
  if (bullet.type === 'pic' && bullet.picPart)
    marker = `<img class="pp-bu-img" src="${rctx.url(bullet.picPart)}"${bullet.size ? ` style="width:${bullet.size}px"` : ''} alt="">`;
  else marker = `<span aria-hidden="true">${escapeXml(bullet.char ?? '•')} </span>`;
  return `  <li style="${s.join(';')}">${marker}${runsHtml(p, textBody, rctx, opts)}</li>`;
}

// auto bullets keep native <ol> numbering — semantic markers, no spans
function autoItemHtml(p, textBody, rctx, opts) {
  return `  <li style="${paraStyles(p, textBody, rctx).join(';')}">${runsHtml(p, textBody, rctx, opts)}</li>`;
}

function plainParaHtml(p, textBody, rctx, opts) {
  const style = paraStyles(p, textBody, rctx).join(';');
  const inner = p.runs.length ? runsHtml(p, textBody, rctx, opts) : '<br>'; // blank lines survive
  return `  <p style="${style}">${inner}</p>`;
}

function headingHtml(tag, p, textBody, rctx, opts) {
  return `  <${tag} style="${paraStyles(p, textBody, rctx).join(';')}">${runsHtml(p, textBody, rctx, opts) || '<br>'}</${tag}>`;
}

// ---- the body container --------------------------------------------------------

function bodyStyle(textBody, rctx) {
  const { bodyPr } = textBody;
  const s = [`display:flex;flex-direction:${bodyPr.cols > 1 ? 'row' : 'column'}`];
  if (bodyPr.cols > 1) s.push(`column-count:${bodyPr.cols}`);
  s.push(`justify-content:${ANCHOR[bodyPr.anchor] ?? 'flex-start'}`);
  const { t, r, b, l } = bodyPr.insets;
  s.push(`padding:${t}px ${r}px ${b}px ${l}px`);
  if (bodyPr.wrap === 'none') s.push('white-space:nowrap');
  if (bodyPr.vert && bodyPr.vert !== 'horz') {
    const css = VERT_CSS[bodyPr.vert];
    if (css) s.push(css);
    else rctx.diag.addOnce('approx', `vertical text ${bodyPr.vert} rendered horizontally`, rctx.slideIndex ?? null);
  }
  return s.join(';');
}

const TITLE_LEVELS = { title: 1, ctrTitle: 1, subTitle: 2 };

// renderText(textBody, element, rctx, opts) -> semantic HTML string.
// opts = { slideIndex, slideCount, titleLevel } — titleLevel defaults from
// element.ph (title/ctrTitle -> 1, subTitle -> 2, else 0).
export function renderText(textBody, element, rctx, opts = {}) {
  if (!textBody || !textBody.paragraphs?.length) return '';
  opts = { slideIndex: rctx.slideIndex ?? null, slideCount: null, ...opts };
  if (opts.titleLevel == null)
    opts.titleLevel = element?.ph ? TITLE_LEVELS[element.ph.type] ?? 0 : 0;
  const titleLevel = opts.titleLevel;
  const titleTag = titleLevel === 1 ? 'h1' : titleLevel === 2 ? 'h2' : null;

  const out = [];
  let list = null; // open list buffer { tag, attrs }
  const closeList = () => { if (list) { out.push(`</${list.tag}>`); list = null; } };

  for (const p of textBody.paragraphs) {
    const bullet = p.pPr.bullet;
    const bulleted = (bullet?.type === 'char' || bullet?.type === 'pic') ? 'custom'
      : bullet?.type === 'auto' ? 'auto' : null;
    if (titleTag) {
      closeList();
      out.push(headingHtml(titleTag, p, textBody, rctx, opts));
    } else if (bulleted === 'custom') {
      if (list?.tag !== 'ul') { closeList(); list = { tag: 'ul', attrs: '' }; out.push('<ul>'); }
      out.push(listItemHtml(p, textBody, rctx, opts));
    } else if (bulleted === 'auto') {
      const attrs = openListAttrs(bullet, rctx);
      if (list?.tag !== 'ol' || list.attrs !== attrs) {
        closeList();
        list = { tag: 'ol', attrs };
        out.push(`<ol${attrs}>`);
      }
      out.push(autoItemHtml(p, textBody, rctx, opts));
    } else {
      closeList();
      out.push(plainParaHtml(p, textBody, rctx, opts));
    }
  }
  closeList();

  return `<div class="pp-text" style="${bodyStyle(textBody, rctx)}">\n${out.join('\n')}\n</div>`;
}
