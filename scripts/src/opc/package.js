import { ZipReader } from '../util/zip.js';
import { parseXml } from '../util/xml.js';
import { sniffMime, MIME_BY_EXT } from '../util/mime.js';

const OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

function normalize(partName) { return partName.replace(/^\//, ''); }

function relsNameFor(partName) {
  const p = normalize(partName);
  const slash = p.lastIndexOf('/');
  const dir = slash < 0 ? '' : p.slice(0, slash);
  const base = slash < 0 ? p : p.slice(slash + 1);
  return (dir ? dir + '/' : '') + '_rels/' + base + '.rels';
}

function safeDecodeSegment(seg) {
  try { return decodeURIComponent(seg); } catch { return seg; } // a literal '%' must not crash the converter
}

function normalizePathSegments(p) {
  const out = [];
  for (const raw of p.split('/')) {
    const seg = safeDecodeSegment(raw);
    if (seg === '' || seg === '.') continue; // drops './' and duplicate slashes
    if (seg === '..') { out.pop(); continue; }
    out.push(seg);
  }
  return out.join('/');
}

export class OpcPackage {
  /** @param {Uint8Array} bytes of the .pptx */
  static open(bytes) { return new OpcPackage(bytes); }
  constructor(bytes) {
    this.zip = new ZipReader(bytes);          // from task 1
    this.ctDefaults = {};                     // ext -> mime
    this.ctOverrides = {};                    // partname -> mime
    this.xmlCache = new Map();                // partname -> XNode
    this.relsCache = new Map();               // rels partname -> [{ id, type, target, external }]
    if (!this.zip.has('[Content_Types].xml'))
      throw new Error('pptx: missing [Content_Types].xml — not an OOXML package');
    // the parsed root IS <Types> (canonicalized by parseXml); accept it when
    // rooted there, else search one level (defensive against wrapper nodes)
    const ctRoot = this.xml('[Content_Types].xml');
    const types = ctRoot.name === 'Types' ? ctRoot : ctRoot.find('Types');
    if (!types) throw new Error('pptx: [Content_Types].xml has no <Types> element');
    for (const d of types.all(['Default', 'Override']))
      if (d.name === 'Default') this.ctDefaults[d.attr('Extension').toLowerCase()] = d.attr('ContentType');
      else this.ctOverrides[normalize(d.attr('PartName'))] = d.attr('ContentType');
  }
  has(name) { return this.zip.has(name); }
  bytes(name) {
    if (!this.zip.has(name)) throw new Error(`pptx: missing part ${name}`);
    return this.zip.read(name);
  }
  text(name) { return Buffer.from(this.bytes(name)).toString('utf8'); }
  xml(name) { // cached parseXml — one XNode per part, reused
    let node = this.xmlCache.get(name);
    if (!node) { node = parseXml(this.text(name)); this.xmlCache.set(name, node); }
    return node;
  }
  rels(partName) { // '<dir>/_rels/<base>.rels'; [] when the .rels part is absent
    const relsName = relsNameFor(partName);
    let list = this.relsCache.get(relsName);
    if (list) return list;
    list = [];
    if (this.zip.has(relsName)) {
      const relsRoot = this.xml(relsName);
      const relationships = relsRoot.name === 'Relationships' ? relsRoot : relsRoot.find('Relationships');
      if (relationships) {
        for (const rel of relationships.all('Relationship')) {
          // TargetMode="External" stays in the list (hyperlink code uses it)
          // but is never resolved as a part name
          const external = rel.attr('TargetMode') === 'External';
          list.push({ id: rel.attr('Id'), type: rel.attr('Type'), target: rel.attr('Target'), external });
        }
      }
    }
    this.relsCache.set(relsName, list);
    return list;
  }
  relBy(typeSuffixOrFull, partName) { // first rel whose Type ends with the suffix
    const rels = this.rels(partName);
    const full = String(typeSuffixOrFull);
    const suffix = '/' + full.replace(/^\//, '');
    return rels.find(r => r.type === full || r.type.endsWith(suffix)) ?? null;
  }
  resolvePartName(fromPart, target) {
    if (target.startsWith('/')) return normalizePathSegments(target.slice(1));
    const dir = (() => {
      const p = normalize(fromPart);
      const slash = p.lastIndexOf('/');
      return slash < 0 ? '' : p.slice(0, slash);
    })();
    return normalizePathSegments(dir ? dir + '/' + target : target);
  }
  mimeOf(partName) { // never throws
    const p = normalize(partName);
    const override = this.ctOverrides[p] ?? null;
    if (override && (override === 'application/xml' || override.endsWith('+xml'))) return override;
    const dot = p.lastIndexOf('.');
    const ext = dot < 0 ? '' : p.slice(dot + 1).toLowerCase();
    // lazily read bytes only for binary parts (no xml override mime): sniff first
    try {
      if (this.zip.has(p)) {
        const sniffed = sniffMime(this.zip.read(p));
        if (sniffed) return sniffed;
      }
    } catch { /* never throws */ }
    if (override) return override;
    return this.ctDefaults[ext] ?? MIME_BY_EXT[ext] ?? 'application/octet-stream';
  }
  mainPart() { // package rels ('_rels/.rels') officeDocument -> '/ppt/presentation.xml'
    const rel = this.rels('').find(r => r.type === OFFICE_DOCUMENT);
    if (!rel || rel.external) throw new Error('pptx: no officeDocument relationship in package rels');
    return this.resolvePartName('', rel.target);
  }
}
