// Diagnostics channel — the one place every approximation, unsupported
// feature, and hard error funnels through. Adopted from PPTX2HTML (MIT):
// converters never fail whole decks, they degrade per-feature and report.
// Kinds (decision: mirror upstream):
//   unsupported — a feature exists in the deck but this converter won't render it yet
//   approx      — rendered, but knowingly simplified
//   error       — something broke (corrupt slide, unreadable media); deck still converts
//   missing     — a referenced part/relationship is absent (pptxgenjs quirk class)

export class Diagnostics {
  constructor() { this.items = []; }          // { kind, msg, slide }
  add(kind, msg, slide = null) {
    if (!['unsupported', 'approx', 'error', 'missing'].includes(kind))
      throw new Error(`diagnostics: bad kind ${kind}`);
    this.items.push({ kind, msg, slide });
  }
  // once per (msg, slide) — the rate-limiter for per-shape diagnostics that
  // would otherwise flood the channel on shape-heavy slides (01-03)
  addOnce(kind, msg, slide = null) {
    if (this.items.some(i => i.msg === msg && i.slide === slide)) return;
    this.add(kind, msg, slide);
  }
  get hasErrors() { return this.items.some(d => d.kind === 'error'); }
  format() { return this.items.map(d => `${d.slide != null ? `slide ${d.slide}: ` : ''}${d.kind}: ${d.msg}`); }
}
