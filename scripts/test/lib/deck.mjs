// test/lib/deck.mjs — builds pptx bytes from declarative slide specs using
// writeZip. The fixture seam for the whole phase (grows in later plans):
// synthetic decks that exercise exactly the tolerance paths real producers
// (PowerPoint, pptxgenjs, LibreOffice) exhibit.
//
//   buildDeck({
//     slides: [{ texts: [{ text, title?, x?, y?, cx?, cy? }], hidden? }],
//     masters: [{}],                       // N minimal masters + themes
//     extraParts: [{ name, data }],        // replaces/appends parts (e.g. malformed XML)
//     advertiseMissing: ['/ppt/…'],        // [Content_Types] Override naming a part NOT written
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
function slideXml(spec) {
  const shapes = (spec.texts ?? []).map((entry, i) => {
    const id = i + 2; // spTree root cNvPr is id 1
    const name = entry.name ?? (entry.title ? `Title ${i + 1}` : `TextBox ${i + 1}`);
    const x = entry.x ?? 838200, y = entry.y ?? 365125 + i * 1500000;
    const cx = entry.cx ?? 9144000, cy = entry.cy ?? 1325563;
    const ph = entry.title ? '<p:ph type="title"/>' : '';
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/>` +
      `<p:cNvSpPr txBox="1"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr>` +
      `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
      `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0"/>` +
      `<a:t>${escapeXml(entry.text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
  }).join('');
  const show = spec.hidden ? ' show="0"' : '';
  return `${XML_DECL}
<p:sld ${NS}${show}>
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
${shapes}
  </p:spTree></p:cSld>
</p:sld>`;
}

function masterXml() {
  return `${XML_DECL}
<p:sldMaster ${NS}>
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
</p:sldMaster>`;
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

const RELS_EMPTY = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

export function buildDeck({ slides = [], masters = [], extraParts = [], advertiseMissing = [] }) {
  const files = new Map(); // name -> data; extraParts replace/append by name

  const overrides = [`<Override PartName="/ppt/presentation.xml" ContentType="${CT_PRES}"/>`];
  const presRels = [];
  const masterIds = masters.map((_, i) =>
    `<p:sldMasterId id="${2147483648 + i}" r:id="rMaster${i + 1}"/>`).join('');
  const slideIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rSlide${i + 1}"/>`).join('');

  slides.forEach((spec, i) => {
    const n = i + 1;
    files.set(`ppt/slides/slide${n}.xml`, slideXml(spec));
    files.set(`ppt/slides/_rels/slide${n}.xml.rels`, RELS_EMPTY);
    overrides.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${CT_SLIDE}"/>`);
    presRels.push(`<Relationship Id="rSlide${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`);
  });
  masters.forEach((_, i) => {
    const n = i + 1;
    files.set(`ppt/slideMasters/slideMaster${n}.xml`, masterXml());
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
${overrides.join('\n')}
</Types>`);
  files.set('_rels/.rels', `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  files.set('ppt/presentation.xml', `${XML_DECL}
<p:presentation ${NS}>
${masterIds ? `  <p:sldMasterIdLst>${masterIds}</p:sldMasterIdLst>\n` : ''}  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
</p:presentation>`);
  files.set('ppt/_rels/presentation.xml.rels', `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presRels.join('\n')}
</Relationships>`);

  for (const extra of extraParts) files.set(extra.name, extra.data);

  return writeZip([...files].map(([name, data]) => ({ name, data })));
}
