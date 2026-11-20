// test/lib/deck.mjs — builds pptx bytes from declarative slide specs using
// writeZip. The fixture seam for the whole phase (grows in later plans):
// synthetic decks that exercise exactly the tolerance paths real producers
// (PowerPoint, pptxgenjs, LibreOffice) exhibit.
//
//   buildDeck({
//     slides: [{ texts: [{ text, title?, x?, y?, cx?, cy? }], hidden?,
//                rels?: [{ id, target, external?, type? }] }],
//     masters: [{}],                       // N minimal masters + themes (txStyles? raw)
//     layouts: [{ shapes?: rawSpXml }],    // slideLayouts (slide i uses layouts[spec.layout ?? 0])
//     extraParts: [{ name, data }],        // replaces/appends parts (e.g. malformed XML)
//     advertiseMissing: ['/ppt/…'],        // [Content_Types] Override naming a part NOT written
//     defaultTextStyle?: rawA,             // p:defaultTextStyle content in presentation.xml
//   }) -> Uint8Array

import { writeZip } from '../../src/util/zip.js';
import { escapeXml } from '../../src/util/xml.js';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const CT_PRES = 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
const CT_SLIDE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const CT_MASTER = 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml';
const CT_LAYOUT = 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml';

// Slide XML — exact template; later tests depend on its shape. One p:sp per
// entry in slide.texts (cNvPr id increments, optional <p:ph type="title"/>).
// 01-03 styling knobs per entry: geom (prst), fill (hex), grad, line
// {w, dash, cap, compound, headEnd, tailEnd}, flipH, effects.
// 01-04 text knobs per entry: ph (raw <p:ph …/> override), paragraphs
// [{ pPr: raw, runs: [{ t, sz, b, i, u, strike, cap, baseline, spc, latin,
// sym, color, linkId, action, field }] }], bodyPr (raw children of a:bodyPr),
// bodyPrAttrs (raw attr string), lstStyle (raw content).
function rPrXml(run) {
  const attrs = [
    run.sz != null ? ` sz="${run.sz}"` : '', run.b ? ' b="1"' : '', run.i ? ' i="1"' : '',
    run.u ? ` u="${run.u}"` : '', run.strike ? ` strike="${run.strike}"` : '',
    run.cap ? ` cap="${run.cap}"` : '', run.baseline != null ? ` baseline="${run.baseline}"` : '',
    run.spc != null ? ` spc="${run.spc}"` : '',
  ].join('');
  const fill = run.color ? `<a:solidFill><a:srgbClr val="${run.color}"/></a:solidFill>` : '';
  const fonts = (run.latin ? `<a:latin typeface="${run.latin}"/>` : '') +
    (run.sym ? `<a:sym typeface="${run.sym}"/>` : '');
  const link = run.linkId
    ? `<a:hlinkClick r:id="${run.linkId}"${run.action ? ` action="${run.action}"` : ''}/>` : '';
  return attrs || fill || fonts || link
    ? `<a:rPr lang="en-US"${attrs} dirty="0">${fill}${fonts}${link}</a:rPr>`
    : '<a:rPr lang="en-US" dirty="0"/>';
}

function runXml(run) {
  if (run.field)
    return `<a:fld id="{2C35A26B-C1BA-4DDB-A40B-08CAB027BFF4}" type="${run.field}">` +
      `${rPrXml(run)}<a:t>${escapeXml(run.t ?? '')}</a:t></a:fld>`;
  return `<a:r>${rPrXml(run)}<a:t>${escapeXml(run.t ?? '')}</a:t></a:r>`;
}

function txBodyXml(entry) {
  const paras = entry.paragraphs ??
    [{ pPr: entry.pPr ?? '', runs: [{ t: entry.text ?? '', color: entry.color, sz: entry.sz }] }];
  const lst = entry.lstStyle ? `<a:lstStyle>${entry.lstStyle}</a:lstStyle>` : '<a:lstStyle/>';
  return `<p:txBody><a:bodyPr${entry.bodyPrAttrs ? ' ' + entry.bodyPrAttrs : ''}>${entry.bodyPr ?? ''}</a:bodyPr>` +
    `${lst}` + paras.map(p =>
      `<a:p>${p.pPr ?? ''}${(p.runs ?? []).map(runXml).join('')}${p.endParaRPr ?? ''}</a:p>`).join('') +
    '</p:txBody>';
}

function lineXml(line) {
  if (!line) return '';
  const attrs = [line.w != null ? ` w="${line.w}"` : '', line.cap ? ` cap="${line.cap}"` : '',
    line.compound ? ` cmpd="${line.compound}"` : ''].join('');
  const fill = line.color ? `<a:solidFill><a:srgbClr val="${line.color}"/></a:solidFill>` : '';
  const dash = line.dash ? `<a:prstDash val="${line.dash}"/>` : '';
  const end = (slot) => line[slot]
    ? `<a:${slot} type="${line[slot].type}"${line[slot].w ? ` w="${line[slot].w}"` : ''}${line[slot].len ? ` len="${line[slot].len}"` : ''}/>`
    : '';
  return `<a:ln${attrs}>${fill}${dash}${end('headEnd')}${end('tailEnd')}</a:ln>`;
}

function spPrXml(entry, i) {
  const geom = entry.geom ?? 'rect';
  const flip = entry.flipH ? ' flipH="1"' : '';
  const fill = entry.fill
    ? `<a:solidFill><a:srgbClr val="${entry.fill}"/></a:solidFill>` : '';
  const grad = entry.grad
    ? `<a:gradFill><a:gsLst>` +
      `<a:gs pos="0"><a:schemeClr val="accent1"/></a:gs>` +
      `<a:gs pos="100000"><a:srgbClr val="FFFFFF"/></a:gs>` +
      `</a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>` : '';
  const effects = entry.effects
    ? '<a:effectLst><a:outerShdw blurRad="50800" dist="38100" dir="2700000" algn="tl">' +
      '<a:srgbClr val="000000"><a:alpha val="40000"/></a:srgbClr></a:outerShdw></a:effectLst>' : '';
  return `<p:spPr><a:xfrm${flip}><a:off x="${entry.x ?? 838200}" y="${entry.y ?? 365125 + i * 1500000}"/>` +
    `<a:ext cx="${entry.cx ?? 9144000}" cy="${entry.cy ?? 1325563}"/></a:xfrm>` +
    `<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${fill}${grad}` +
    `${lineXml(entry.line)}${effects}</p:spPr>`;
}

function bgXml(spec) {
  if (spec.bgSolid)
    return `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${spec.bgSolid}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
  if (spec.bgGrad)
    return `<p:bg><p:bgPr><a:gradFill><a:gsLst>` +
      `<a:gs pos="0"><a:schemeClr val="accent1"/></a:gs>` +
      `<a:gs pos="100000"><a:srgbClr val="FFFFFF"/></a:gs>` +
      `</a:gsLst><a:lin ang="5400000" scaled="1"/><a:tileRect/></a:gradFill><a:effectLst/></p:bgPr></p:bg>`;
  return '';
}

function picXml(entry, id) {
  const srcRect = entry.srcRect
    ? `<a:srcRect l="${entry.srcRect.l ?? 0}" t="${entry.srcRect.t ?? 0}" r="${entry.srcRect.r ?? 0}" b="${entry.srcRect.b ?? 0}"/>` : '';
  const blip = entry.svgRel
    ? `<a:blip r:embed="${entry.rel}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">` +
      `<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG" r:embed="${entry.svgRel}"/></a:ext></a:extLst></a:blip>`
    : `<a:blip r:embed="${entry.rel}"/>`;
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill>${blip}${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${entry.x ?? 914400}" y="${entry.y ?? 914400}"/>` +
    `<a:ext cx="${entry.cx ?? 1905000}" cy="${entry.cy ?? 1428750}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function slideXml(spec) {
  const shapes = (spec.texts ?? []).map((entry, i) => {
    const id = i + 2; // spTree root cNvPr is id 1
    const name = entry.name ?? (entry.title ? `Title ${i + 1}` : `TextBox ${i + 1}`);
    const ph = entry.ph ?? (entry.title ? '<p:ph type="title"/>' : '');
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/>` +
      `<p:cNvSpPr txBox="1"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr>` +
      `${spPrXml(entry, i)}` +
      `${txBodyXml(entry)}</p:sp>`;
  }).join('');
  const pics = (spec.pictures ?? []).map((entry, i) =>
    picXml(entry, (spec.texts?.length ?? 0) + i + 2)).join('');
  const show = spec.hidden ? ' show="0"' : '';
  return `${XML_DECL}
<p:sld ${NS}${show}>
  <p:cSld>${bgXml(spec)}<p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
${shapes}${pics}${spec.shapes ?? ''}
  </p:spTree></p:cSld>
</p:sld>`;
}

function masterXml(master = {}) {
  return `${XML_DECL}
<p:sldMaster ${NS}>
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${master.shapes ?? ''}</p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  ${master.txStyles ? `<p:txStyles>${master.txStyles}</p:txStyles>` : ''}
</p:sldMaster>`;
}

function layoutXml(spec = {}) {
  return `${XML_DECL}
<p:sldLayout ${NS} type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${spec.shapes ?? ''}</p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function themeXml(n) {
  return `${XML_DECL}
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme${n}">
  <a:themeElements>
    <a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme>
    <a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
  </a:themeElements>
</a:theme>`;
}

// (slide .rels entries are composed per-slide in buildDeck: layout rel + spec.rels)

export function buildDeck({ slides = [], masters = [], layouts = [], extraParts = [], advertiseMissing = [], defaultTextStyle = null, ctDefaults = [] }) {
  const files = new Map(); // name -> data; extraParts replace/append by name

  const overrides = [`<Override PartName="/ppt/presentation.xml" ContentType="${CT_PRES}"/>`];
  const presRels = [];
  const masterIds = masters.map((_, i) =>
    `<p:sldMasterId id="${2147483648 + i}" r:id="rMaster${i + 1}"/>`).join('');
  const slideIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rSlide${i + 1}"/>`).join('');
  const hyperlinkRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';

  slides.forEach((spec, i) => {
    const n = i + 1;
    files.set(`ppt/slides/slide${n}.xml`, slideXml(spec));
    const slideRelEntries = [];
    if (layouts.length)
      slideRelEntries.push(`<Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${(spec.layout ?? 0) + 1}.xml"/>`);
    for (const r of spec.rels ?? [])
      slideRelEntries.push(`<Relationship Id="${r.id}" Type="${r.type ?? hyperlinkRel}" Target="${escapeXml(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`);
    files.set(`ppt/slides/_rels/slide${n}.xml.rels`, `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slideRelEntries.join('')}</Relationships>`);
    overrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${CT_SLIDE}"/>`);
    presRels.push(`<Relationship Id="rSlide${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`);
  });
  layouts.forEach((spec, i) => {
    const n = i + 1;
    files.set(`ppt/slideLayouts/slideLayout${n}.xml`, layoutXml(spec));
    files.set(`ppt/slideLayouts/_rels/slideLayout${n}.xml.rels`, `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster${spec.master ?? 1}.xml"/>
</Relationships>`);
    overrides.push(`<Override PartName="/ppt/slideLayouts/slideLayout${n}.xml" ContentType="${CT_LAYOUT}"/>`);
  });
  masters.forEach((master, i) => {
    const n = i + 1;
    files.set(`ppt/slideMasters/slideMaster${n}.xml`, masterXml(master));
    files.set(`ppt/slideMasters/_rels/slideMaster${n}.xml.rels`, `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme${n}.xml"/>
</Relationships>`);
    files.set(`ppt/theme/theme${n}.xml`, themeXml(n));
    overrides.push(`<Override PartName="/ppt/slideMasters/slideMaster${n}.xml" ContentType="${CT_MASTER}"/>`);
    presRels.push(`<Relationship Id="rMaster${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster${n}.xml"/>`);
  });
  for (const phantom of advertiseMissing)
    overrides.push(`<Override PartName="${phantom}" ContentType="${CT_LAYOUT}"/>`); // named but never written

  files.set('[Content_Types].xml', `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
${ctDefaults.map(d => `<Default Extension="${d.ext}" ContentType="${d.mime}"/>`).join('\n')}
${overrides.join('\n')}
</Types>`);
  files.set('_rels/.rels', `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  files.set('ppt/presentation.xml', `${XML_DECL}
<p:presentation ${NS}>
${masterIds ? `  <p:sldMasterIdLst>${masterIds}</p:sldMasterIdLst>\n` : ''}  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst>${slideIds}</p:sldIdLst>${defaultTextStyle ? `\n  <p:defaultTextStyle>${defaultTextStyle}</p:defaultTextStyle>` : ''}
</p:presentation>`);
  files.set('ppt/_rels/presentation.xml.rels', `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presRels.join('\n')}
</Relationships>`);

  for (const extra of extraParts) files.set(extra.name, extra.data);

  return writeZip([...files].map(([name, data]) => ({ name, data })));
}
