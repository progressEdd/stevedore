// OOXML XML parser with canonical namespace rewriting.
//
// Node has no built-in XML parser, so this is our own light DOM: a scanning
// tokenizer plus a namespace-resolving pass. The design decision that makes
// the whole converter simple (adapted from PPTX2HTML src/util/xml.js, MIT):
// canonicalize every element/attribute name to a fixed prefix set so
// downstream code matches 'a:solidFill' by string regardless of producer
// prefixes or transitional-vs-strict OOXML.

// prefix -> namespace URI, both transitional and strict (ECMA-376) variants
const CANON = {
  a: ['http://schemas.openxmlformats.org/drawingml/2006/main', 'http://purl.oclc.org/ooxml/drawingml/main'],
  p: ['http://schemas.openxmlformats.org/presentationml/2006/main', 'http://purl.oclc.org/ooxml/presentationml/main'],
  r: ['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships'],
  c: ['http://schemas.openxmlformats.org/drawingml/2006/chart'],
  cx: ['http://schemas.microsoft.com/office/drawing/2014/chartex'],
  dgm: ['http://schemas.openxmlformats.org/drawingml/2006/diagram'],
  dsp: ['http://schemas.microsoft.com/office/drawing/2008/diagram'],
  p14: ['http://schemas.microsoft.com/office/powerpoint/2010/main'],
  p15: ['http://schemas.microsoft.com/office/powerpoint/2012/main'],
  a14: ['http://schemas.microsoft.com/office/drawing/2010/main'],
  mc: ['http://schemas.openxmlformats.org/markup-compatibility/2006'],
};
const URI_TO_CANON = new Map(Object.entries(CANON).flatMap(([pfx, uris]) => uris.map(u => [u, pfx])));

const NAMED_ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

// Adapted from PPTX2HTML (MIT) decodeOoxmlEscapes: Office writes odd numeric
// escapes, so decode named plus decimal/hex code points everywhere.
function decodeOoxmlEscapes(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9._]*);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return m;
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return NAMED_ENTITIES[e] ?? m;
  });
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitQName(qname) {
  const colon = qname.indexOf(':');
  return colon < 0
    ? { rawName: qname, prefix: null, local: qname, uri: null }
    : { rawName: qname, prefix: qname.slice(0, colon), local: qname.slice(colon + 1), uri: null };
}

function canonicalName(uri, prefix, local) {
  if (prefix) return (URI_TO_CANON.get(uri) ?? prefix) + ':' + local;
  // unprefixed: with a default xmlns, adopt the canonical prefix if known
  if (uri) { const c = URI_TO_CANON.get(uri); return c ? c + ':' + local : local; }
  return local;
}

export class XNode {
  constructor(name) { this.name = name; this.attrs = {}; this.children = []; this.parent = null; this.text = ''; }
  all(name) { // direct children with canonical name; single name or array of names
    const names = Array.isArray(name) ? name : [name];
    return this.children.filter(c => names.includes(c.name));
  }
  find(name) { return this.all(name)[0] ?? null; }
  path(spec) { // '/'-separated canonical names, e.g. 'p:cSld/p:spTree'; first match or null
    let node = this;
    for (const part of spec.split('/').filter(Boolean)) {
      node = node.find(part);
      if (!node) return null;
    }
    return node;
  }
  textOf() { return this.text; } // concatenated direct text, entity-decoded
  attr(k, d = null) { return this.attrs[k] !== undefined ? this.attrs[k] : d; }
  num(k, d = 0) { const v = parseFloat(this.attrs[k]); return Number.isNaN(v) ? d : v; }
  int(k, d = 0) { const v = parseInt(this.attrs[k], 10); return Number.isNaN(v) ? d : v; }
  bool(k, d = false) { const v = this.attrs[k]; return v === undefined ? d : (v === '1' || v === 'true'); }
}

export function parseXml(text) {
  if (typeof text !== 'string') text = Buffer.from(text).toString('utf8');
  let i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // skip BOM
  const n = text.length;

  const nsStack = [new Map()]; // prefix -> URI; '' is the default namespace
  const open = [];             // open element stack
  const records = [];          // per-node name resolution, rewritten post-parse
  let root = null;

  const current = () => (open.length ? open[open.length - 1] : null);
  const appendText = (s, decode = true) => {
    if (!s) return;
    const node = current();
    if (node) node.text += decode ? decodeOoxmlEscapes(s) : s; // text before/after root is dropped
  };
  const findTagEnd = (start) => { // index of '>' honoring quoted strings
    let quote = null;
    for (let j = start + 1; j < n; j++) {
      const c = text[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') return j;
    }
    return -1;
  };

  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) { appendText(text.slice(i)); break; }
    if (lt > i) appendText(text.slice(i, lt));

    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4); // comments do not nest
      if (end < 0) throw new Error('xml: unterminated comment');
      i = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      if (end < 0) throw new Error('xml: unterminated CDATA section');
      appendText(text.slice(lt + 9, end), false); // CDATA is literal — no entity decoding
      i = end + 3;
      continue;
    }
    if (text.startsWith('<!', lt)) {
      // <!DOCTYPE ...> / <!ENTITY ...> — scan to the closing '>', honoring
      // quotes and the optional '[internal subset]' (no DTD support)
      let j = lt + 2, quote = null, depth = 0, end = -1;
      for (; j < n; j++) {
        const c = text[j];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth === 0) { end = j; break; }
      }
      if (end < 0) throw new Error('xml: unterminated declaration');
      const body = text.slice(lt + 2, end);
      if (/^\s*ENTITY|<!ENTITY/i.test(body))
        throw new Error('xml: <!ENTITY> declarations are not supported (no DTD/entity expansion)');
      i = end + 1;
      continue;
    }
    if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt + 2);
      if (end < 0) throw new Error('xml: unterminated processing instruction');
      i = end + 2;
      continue;
    }

    // element tag: <name attr="v" attr='v' attr=bare ...>
    const gt = findTagEnd(lt);
    if (gt < 0) throw new Error('xml: unterminated tag');
    let raw = text.slice(lt + 1, gt);
    const selfClosing = raw.endsWith('/');
    if (selfClosing) raw = raw.slice(0, -1);

    if (raw.startsWith('/')) { // closing tag
      const name = raw.slice(1).trim();
      const top = open.pop();
      nsStack.pop();
      if (!top || top.name !== name)
        throw new Error(`xml: mismatched closing tag </${name}>`);
      i = gt + 1;
      continue;
    }

    const nameMatch = /^([A-Za-z_:][-A-Za-z0-9_.:]*)(?:\s|$)/.exec(raw);
    if (!nameMatch) throw new Error(`xml: cannot parse tag <${raw}>`);
    const rawName = nameMatch[1];
    const rest = raw.slice(rawName.length);

    // namespace scope for this element: inherit, then apply xmlns / xmlns:PFX
    const scope = new Map(nsStack[nsStack.length - 1]);
    const attrRecs = [];
    const attrs = {};
    const attrRe = /([A-Za-z_:][-A-Za-z0-9_.:]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
    let am;
    while ((am = attrRe.exec(rest)) !== null) {
      const an = am[1];
      let av = am[2] ?? '';
      if (av.length >= 2 && ((av[0] === '"' && av.endsWith('"')) || (av[0] === "'" && av.endsWith("'"))))
        av = av.slice(1, -1);
      if (an === 'xmlns') scope.set('', av);
      else if (an.startsWith('xmlns:')) scope.set(an.slice(6), av);
      else {
        attrs[an] = decodeOoxmlEscapes(av);
        attrRecs.push(splitQName(an));
      }
    }
    nsStack.push(scope);

    const { prefix, local } = splitQName(rawName);
    const uri = (prefix ? scope.get(prefix) : scope.get('')) ?? null;
    for (const arec of attrRecs) arec.uri = arec.prefix ? scope.get(arec.prefix) ?? null : null;

    const node = new XNode(rawName);
    node.attrs = attrs;
    const parent = current();
    if (parent) { node.parent = parent; parent.children.push(node); }
    else if (root === null) root = node;
    else throw new Error('xml: multiple root elements');
    open.push(node);
    records.push({ node, uri, prefix, local, attrRecs });

    if (selfClosing) { open.pop(); nsStack.pop(); }
    i = gt + 1;
  }

  if (open.length) throw new Error(`xml: unclosed element <${open[open.length - 1].name}>`);
  if (!root) throw new Error('xml: no root element found');

  // post-parse walk: rewrite every name to the canonical prefix set
  for (const rec of records) {
    rec.node.name = canonicalName(rec.uri, rec.prefix, rec.local);
    const newAttrs = {};
    for (const arec of rec.attrRecs) {
      const key = arec.prefix
        ? (URI_TO_CANON.get(arec.uri) ?? arec.prefix) + ':' + arec.local
        : arec.local; // attributes in no namespace keep their bare name
      newAttrs[key] = rec.node.attrs[arec.rawName];
    }
    rec.node.attrs = newAttrs; // xmlns* declarations were never stored here
  }
  return root;
}
