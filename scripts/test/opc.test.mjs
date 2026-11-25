import test from 'node:test';
import assert from 'node:assert/strict';
import { writeZip } from '../src/util/zip.js';
import { OpcPackage } from '../src/opc/package.js';
import { sniffMime, MIME_BY_EXT } from '../src/util/mime.js';

const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout9.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
</Types>`;

const PKG_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

const PRESENTATION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`;

const PRESENTATION_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/doc" TargetMode="External"/>
</Relationships>`;

// real PNG magic + a plausible chunk start
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('IHDR', 'latin1'), Buffer.alloc(16),
]);

function buildPkg() {
  return writeZip([
    { name: '[Content_Types].xml', data: CT },
    { name: '_rels/.rels', data: PKG_RELS },
    { name: 'ppt/presentation.xml', data: PRESENTATION },
    { name: 'ppt/_rels/presentation.xml.rels', data: PRESENTATION_RELS },
    { name: 'ppt/media/image1.png', data: PNG_BYTES },
    // NOTE: /ppt/slideLayouts/slideLayout9.xml is advertised in CT but NOT in the zip (pptxgenjs quirk)
  ]);
}

test('constructor tolerates overrides for parts absent from the zip', () => {
  const pkg = new OpcPackage(buildPkg()); // must NOT throw
  assert.equal(pkg.has('ppt/slideLayouts/slideLayout9.xml'), false);
  assert.equal(pkg.ctOverrides['ppt/slideLayouts/slideLayout9.xml'],
    'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml');
});

test('non-OOXML zips are rejected', () => {
  assert.throws(() => new OpcPackage(writeZip([{ name: 'foo.txt', data: 'x' }])), /Content_Types/);
});

test('mainPart() resolves the officeDocument relationship', () => {
  const pkg = new OpcPackage(buildPkg());
  assert.equal(pkg.mainPart(), 'ppt/presentation.xml');
  assert.equal(pkg.xml('ppt/presentation.xml').name, 'p:presentation');
});

test('parts without a .rels file yield []', () => {
  const pkg = new OpcPackage(buildPkg());
  assert.deepEqual(pkg.rels('ppt/slides/slide1.xml'), []);
  assert.deepEqual(pkg.rels('ppt/media/image1.png'), []);
});

test('rels parsing: internal + external (TargetMode) entries', () => {
  const pkg = new OpcPackage(buildPkg());
  const rels = pkg.rels('ppt/presentation.xml');
  assert.equal(rels.length, 2);
  const slideRel = pkg.relBy('slide', 'ppt/presentation.xml');
  assert.ok(slideRel);
  assert.equal(slideRel.id, 'rId2');
  assert.equal(slideRel.external, false);
  // external rel is kept for hyperlink code but never resolved as a part name
  const linkRel = pkg.relBy('hyperlink', 'ppt/presentation.xml');
  assert.equal(linkRel.external, true);
  assert.equal(linkRel.target, 'https://example.com/doc');
});

test('resolvePartName: relative targets, .., absolute, percent-decoding', () => {
  const pkg = new OpcPackage(buildPkg());
  assert.equal(pkg.resolvePartName('ppt/slides/slide1.xml', '../media/image1.png'), 'ppt/media/image1.png');
  assert.equal(pkg.resolvePartName('ppt/presentation.xml', 'slides/slide1.xml'), 'ppt/slides/slide1.xml');
  assert.equal(pkg.resolvePartName('ppt/presentation.xml', '/ppt/theme/theme1.xml'), 'ppt/theme/theme1.xml');
  assert.equal(pkg.resolvePartName('ppt/slides/slide1.xml', './notesSlide1.xml'), 'ppt/slides/notesSlide1.xml');
  assert.equal(pkg.resolvePartName('ppt/slides/slide1.xml', '../media/my%20image.png'), 'ppt/media/my image.png');
  assert.equal(pkg.resolvePartName('ppt/slides/slide1.xml', '../media/100%.png'), 'ppt/media/100%.png');
  // internal rel target from a real .rels resolves into the package
  assert.equal(
    pkg.resolvePartName('ppt/presentation.xml', pkg.relBy('slide', 'ppt/presentation.xml').target),
    'ppt/slides/slide1.xml');
});

test('missing parts throw a descriptive error from bytes()/text()', () => {
  const pkg = new OpcPackage(buildPkg());
  assert.throws(() => pkg.bytes('ppt/slides/slide1.xml'), /missing part/);
  assert.throws(() => pkg.text('ppt/slideLayouts/slideLayout9.xml'), /missing part/);
});

test('mimeOf: sniffed PNG beats extension tables; xml override never sniffs', () => {
  const pkg = new OpcPackage(buildPkg());
  assert.equal(pkg.mimeOf('ppt/media/image1.png'), 'image/png');
  assert.equal(pkg.mimeOf('ppt/presentation.xml'),
    'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');
  assert.equal(pkg.mimeOf('ppt/not/there.xyz'), 'application/octet-stream');
});

test('xml cache: same XNode object per part', () => {
  const pkg = new OpcPackage(buildPkg());
  assert.equal(pkg.xml('ppt/presentation.xml'), pkg.xml('ppt/presentation.xml'));
});

test('mime sniffing table basics', () => {
  assert.equal(sniffMime(PNG_BYTES), 'image/png');
  assert.equal(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffMime(Buffer.from('<svg xmlns="x"/>', 'utf8')), 'image/svg+xml');
  assert.equal(sniffMime(Buffer.from('plain text, no magic here at all')), null);
  assert.equal(MIME_BY_EXT.svg, 'image/svg+xml');
  assert.equal(MIME_BY_EXT.rels, 'application/vnd.openxmlformats-package.relationships+xml');
});
