---
status: complete
duration: 25min
key-files:
  created:
    - package.json
    - src/util/zip.js
    - test/zip.test.mjs
    - src/util/xml.js
    - test/xml.test.mjs
    - src/util/mime.js
    - src/opc/package.js
    - test/opc.test.mjs
  modified: []
requirements-completed:
  - 01-01/T1 — ZIP reader/writer over node:zlib (central directory + ZIP64 + local-header recovery, OLE2 reject, writeZip test seam)
  - 01-01/T2 — XML tokenizer with canonical namespace rewriting (transitional + strict URIs, entity decoding, XNode helpers, escapeXml)
  - 01-01/T3 — OPC package wrapper (content types, relationships with external targets, tolerant part access, mime sniffing, mainPart)
  - 01-01 plan verification checklist — all four boxes demonstrated (see Decisions & deviations re: `node --test test/` on Node 24)
key-decisions:
  - "XNode helpers resolved namespaces at parse time and rewrite names in one post-parse walk, exactly the upstream-modeled design; xmlns* declarations never enter attrs"
  - "OGG (`OggS`) magic — listed in the plan without a mime string — returns 'audio/ogg'"
  - "mimeOf sniffs bytes only for parts without an XML override mime (override 'application/xml' or '*+xml' returns directly), keeping XML parts lazily unread"
deviations:
  - "OpcPackage constructor: plan literal `this.xml('[Content_Types].xml').find('Types')` null-derefs because parseXml returns the root element (root IS <Types>); took the root-or-child minimum adaptation in src/opc/package.js (same one-liner shape for <Relationships> in rels())"
  - "Node 24.22.2 rejects directory args to `node --test` (tries to require 'test'); full-suite verification ran as bare `node --test` (auto-discovers test/) plus `node --test \"test/*.test.mjs\"` — 28/28 pass; per-task verifies used the plan's exact file-arg commands"
  - "GitHub mirror T3 tasklist flip failed once (transient); immediate retry succeeded — final state [01-01] T1/T2/T3 all flipped on issue #22"
---

# Plan 01-01 Summary: Zero-dep foundation — ZIP reader, XML light DOM, OPC package

All three self-implemented layers landed with zero dependencies (`node:` built-ins only): a ZIP reader/writer over `node:zlib` with truncated-archive recovery, an OOXML XML parser that canonicalizes namespaces to the fixed prefix set regardless of producer prefixes or strict URIs, and an OPC package wrapper that tolerates advertised-but-absent parts (the pptxgenjs round-trip quirk).

## Accomplishments

- `ZipReader` reads central directories (incl. ZIP64 sentinel/extra-field handling), recovers entries from local headers when the EOCD is destroyed, rejects legacy OLE2 `.ppt` files with actionable guidance; `writeZip` provides the zero-dep test/fixture seam with UTF-8 name flag support
- `parseXml` builds an `XNode` tree with canonical element/attribute names — producer prefix `zz:` and strict `purl.oclc.org` URIs both resolve to `a:`/`p:`/`r:` — plus entity decoding (named + decimal/hex Office escapes), CDATA as literal text, DOCTYPE skipping, and `<!ENTITY` rejection
- `OpcPackage` wires zip+xml into content types, cached part/rels access, relationship resolution with `..`/percent-decoding and external-target passthrough, magic-byte mime sniffing with lazy reads, and `mainPart()`; a synthetic pptx built purely from `writeZip` parses end-to-end
- 28 tests across three suites, all green under Node's built-in runner; GitHub mirror tasklist for issue #22 shows T1–T3 complete

## Task commits

1. **ZIP reader/writer over node:zlib** — `35fbb76` feat(01-01): add ZIP reader/writer over node:zlib
2. **XML tokenizer with canonical namespace rewriting** — `408d26e` feat(01-01): add XML parser with canonical namespace rewriting
3. **OPC package — content types, relationships, tolerant part access** — `9aca584` feat(01-01): add OPC package wrapper with tolerant part access

## Files created/modified

- `package.json` — repo root manifest, private, ESM (`"type": "module"`), no dependencies key
- `src/util/zip.js` — ZipReader (central dir + ZIP64 + recovery), writeZip, crc32
- `src/util/xml.js` — parseXml with CANON/URI_TO_CANON namespace canonicalization, XNode, escapeXml
- `src/util/mime.js` — sniffMime magic table + MIME_BY_EXT extension fallback
- `src/opc/package.js` — OpcPackage: content types, rels, resolvePartName, mimeOf, mainPart
- `test/zip.test.mjs`, `test/xml.test.mjs`, `test/opc.test.mjs` — the three suites

## Decisions & deviations

Key decisions: namespace resolution happens during parsing with a single post-parse name-rewrite walk (upstream-modeled design); `mimeOf` only reads bytes for binary parts; OGG magic returns `audio/ogg` (plan listed the magic without a mime).

Deviations (blockers only, each minimal): the constructor's literal `.find('Types')` dereference was adapted to root-or-child because `parseXml` returns the root element itself (same file, `src/opc/package.js`); the verification command `node --test test/` is not accepted verbatim by Node 24's runner (directory args are rejected as entry points) so the suite was demonstrated with the equivalent bare `node --test` discovery; the mirror's T3 flip needed one retry (succeeded).

## Next phase readiness

The three foundation layers every later phase-01 plan builds on are in place on branch `agent/01-pptx-to-html/stevedore`: `ZipReader`/`writeZip` for package IO and fixtures, `parseXml`/`XNode` with canonical names for all model builders, and `OpcPackage` for tolerant part/relationship/media access — ready for wave 2 (presentation/slide model builders).
