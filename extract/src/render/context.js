// Render context — the bridge between package parts and HTML emission
// (adapted from PPTX2HTML, MIT). Media parts become cached data URIs so the
// emitted document is self-contained; failures bubble to the slide-level
// catch in the document renderer and surface as error diagnostics.

export class RenderContext {
  constructor(pkg, diag) { this.pkg = pkg; this.diag = diag; this.uriCache = new Map(); }
  url(partName) { // media part -> data URI; cached
    let uri = this.uriCache.get(partName);
    if (uri === undefined) {
      const b64 = Buffer.from(this.pkg.bytes(partName)).toString('base64');
      uri = `data:${this.pkg.mimeOf(partName)};base64,${b64}`;
      this.uriCache.set(partName, uri);
    }
    return uri;
  }
  cssPx(emu) { return Math.round(emu / 9525); }
}
