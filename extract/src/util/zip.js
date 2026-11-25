import { deflateRawSync, inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50, CEN_SIG = 0x02014b50, LOC_SIG = 0x04034b50,
      ZIP64_EOCD_SIG = 0x06064b50, ZIP64_LOC_SIG = 0x07064b50;
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

// Adapted from PPTX2HTML (MIT): standard CRC-32 table.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
export function crc32(buf, crc = 0) {
  crc = ~crc;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}

export class ZipReader {
  constructor(data) {
    if (OLE2_MAGIC.equals(Buffer.from(data.buffer, data.byteOffset, 8)))
      throw new Error('This is a legacy .ppt (OLE2) file — re-save it as .pptx first');
    this.data = data instanceof Buffer ? data : Buffer.from(data);
    this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    this.entries = new Map(); // name -> { name, method, csize, usize, off }
    this.#readDirectory();
  }
  has(name) { return this.entries.has(name); }
  names() { return [...this.entries.keys()]; }
  read(name) {
    const e = this.entries.get(name);
    if (!e) throw new Error(`zip: no entry ${name}`);
    const d = this.data;
    if (this.#u32(e.off) !== LOC_SIG) throw new Error(`zip: bad local header for ${name}`);
    const nameLen = this.#u16(e.off + 26), exLen = this.#u16(e.off + 28);
    const start = e.off + 30 + nameLen + exLen;
    const raw = d.subarray(start, start + e.csize);
    if (e.method === 0) return new Uint8Array(raw);
    if (e.method === 8) return new Uint8Array(inflateRawSync(raw));
    throw new Error(`zip: unsupported compression method ${e.method} for ${name}`);
  }
  #u16(o) { return this.view.getUint16(o, true); }
  #u32(o) { return this.view.getUint32(o, true); }
  #u64(o) { return Number(this.view.getBigUint64(o, true)); }
  #findEocd() { // scan backwards within the max 64 KiB + 22-byte comment window
    const d = this.data, min = Math.max(0, d.length - 65557);
    for (let i = d.length - 22; i >= min; i--) if (this.#u32(i) === EOCD_SIG) return i;
    return -1;
  }
  #readDirectory() {
    const eocd = this.#findEocd();
    if (eocd < 0) { this.#recoverLocalHeaders(); return; }
    let count = this.#u16(eocd + 10), size = this.#u32(eocd + 12), off = this.#u32(eocd + 16);
    if (count === 0xffff || size === 0xffffffff || off === 0xffffffff) {
      // ZIP64: locator sits immediately before EOCD
      const loc = eocd - 20;
      if (loc >= 0 && this.#u32(loc) === ZIP64_LOC_SIG) {
        const z64 = this.#u64(loc + 8);
        if (this.#u32(z64) === ZIP64_EOCD_SIG) {
          count = this.#u64(z64 + 32); size = this.#u64(z64 + 40); off = this.#u64(z64 + 48);
        }
      }
    }
    if (this.#u32(off) !== CEN_SIG) { this.#recoverLocalHeaders(); return; }
    let p = off;
    for (let i = 0; i < count && p + 46 <= this.data.length; i++) {
      if (this.#u32(p) !== CEN_SIG) break;
      const flags = this.#u16(p + 8), method = this.#u16(p + 10);
      let csize = this.#u32(p + 20), usize = this.#u32(p + 24);
      const nameLen = this.#u16(p + 28), exLen = this.#u16(p + 30), cmtLen = this.#u16(p + 32);
      let lho = this.#u32(p + 42);
      const name = this.data.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
      // ZIP64 extra field 0x0001 overrides the 0xFFFFFFFF sentinels
      let q = p + 46 + nameLen; const end = q + exLen;
      while (q + 4 <= end) {
        const id = this.#u16(q), sz = this.#u16(q + 2);
        if (id === 1) {
          let r = q + 4;
          if (usize === 0xffffffff) { usize = this.#u64(r); r += 8; }
          if (csize === 0xffffffff) { csize = this.#u64(r); r += 8; }
          if (lho === 0xffffffff) lho = this.#u64(r);
        }
        q += 4 + sz;
      }
      if (flags & 0x1) throw new Error(`zip: entry ${name} is encrypted — unsupported`);
      this.entries.set(name, { name, method, csize, usize, off: lho });
      p += 46 + nameLen + exLen + cmtLen;
    }
  }
  #recoverLocalHeaders() { // truncated archive: walk local headers sequentially
    let p = 0;
    while (p + 30 <= this.data.length && this.#u32(p) === LOC_SIG) {
      const flags = this.#u16(p + 6), method = this.#u16(p + 8);
      const csize = this.#u32(p + 18), usize = this.#u32(p + 22);
      const nameLen = this.#u16(p + 26), exLen = this.#u16(p + 28);
      const name = this.data.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 30, p + 30 + nameLen);
      this.entries.set(name, { name, method, csize, usize, off: p });
      p += 30 + nameLen + exLen + (csize || usize);
      if (!csize && !usize) break; // data descriptor without sizes: cannot skip safely
    }
    if (!this.entries.size) throw new Error('zip: no readable entries (not a ZIP/OOXML file)');
  }
}

export function writeZip(files) {
  const chunks = [], central = []; let off = 0;
  for (const { name, data } of files) {
    const nb = Buffer.from(name, 'utf8');
    const db = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const comp = deflateRawSync(db), crc = crc32(db);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(LOC_SIG, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(db.length, 22); lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28);
    chunks.push(lh, nb, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(CEN_SIG, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(db.length, 24);
    ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    central.push(Buffer.concat([ch, nb]));
    off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0); eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...chunks, cd, eocd]);
}
