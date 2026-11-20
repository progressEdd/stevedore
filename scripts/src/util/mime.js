// Magic-byte media sniffing + extension fallback for OPC parts.
// Adapted from PPTX2HTML (MIT) src/opc/package.js: magic table.

export const MIME_BY_EXT = {
  png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf',
  webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', xml: 'application/xml',
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
};

/**
 * Sniff a media type from leading magic bytes; null when unknown (caller
 * falls back to the extension tables). @param {Uint8Array} bytes
 */
export function sniffMime(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4) return null;
  const bytesAt = (off, sig) => {
    if (off + sig.length > b.length) return false;
    for (let i = 0; i < sig.length; i++) if (b[off + i] !== sig[i]) return false;
    return true;
  };
  const asciiAt = (off, s) => bytesAt(off, Array.from(s, c => c.charCodeAt(0)));
  const u32le = (off) => (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>> 0;

  if (bytesAt(0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (bytesAt(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (asciiAt(0, 'GIF8')) return 'image/gif';
  if (asciiAt(0, 'BM')) return 'image/bmp';
  if (bytesAt(0, [0x49, 0x49, 0x2a, 0x00]) || bytesAt(0, [0x4d, 0x4d, 0x00, 0x2a])) return 'image/tiff';
  if (asciiAt(0, 'RIFF') && asciiAt(8, 'WEBP')) return 'image/webp';
  // MP4 checked before EMF: its 'ftyp' box sits at offset 4, where EMF's
  // version DWORD (01 00 00 00) never forms ASCII
  if (asciiAt(4, 'ftyp')) return 'video/mp4';
  if (asciiAt(0, 'OggS')) return 'audio/ogg';
  if (asciiAt(0, 'ID3') || bytesAt(0, [0xff, 0xfb]) || bytesAt(0, [0xff, 0xf3]) || bytesAt(0, [0xff, 0xf2]))
    return 'audio/mpeg';
  if (bytesAt(0, [0xd7, 0xcd, 0xc6, 0x6a]) || bytesAt(0, [0x01, 0x00, 0x09, 0x00]))
    return 'image/x-wmf';
  // EMF: record type 1 + header size DWORD (>= 88) at offset 4, little-endian
  if (bytesAt(0, [0x01, 0x00, 0x00, 0x00]) && b.length >= 8 && u32le(4) >= 88) return 'image/x-emf';
  // SVG (and XML-ish text): look for markup in the first 512 bytes
  const head = Buffer.from(b.buffer, b.byteOffset, Math.min(512, b.byteLength)).toString('latin1');
  if (head.includes('<svg') || head.includes('<?xml')) return 'image/svg+xml';
  return null;
}
