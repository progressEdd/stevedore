// 01-06 task 1: p:timing -> plain JSON tree, p:transition -> data record,
// both embedded per slide as HTML-safe application/json (decision 22:
// parse yes, player no). The fixture timing tree matches the dom-to-pptx
// shape from research: a p:par/cTn@nodeType=clickEffect branch containing
// p:childTnLst/p:par with p:cBhvr + p:spTgt@spid="4".

import test from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/index.js';
import { parseTiming } from '../src/pptx/timing.js';
import { parseTransition } from '../src/pptx/transition.js';
import { parseXml } from '../src/util/xml.js';
import { Diagnostics } from '../src/pptx/context.js';
import { buildDeck } from './lib/deck.mjs';

// hand-built timing tree (shape-faithful subset of what PowerPoint writes):
// tmRoot -> mainSeq -> clickEffect p:par, target spid=4; bldLst rides along.
// desc="fade &lt;in&gt;" puts a decoded '<' inside a string value — the
// escape-path probe (XML attr values may carry '<' only via entities).
const TIMING = `<p:timing><p:tnLst><p:par>
  <p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>
    <p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>
      <p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>
        <p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>
          <p:par><p:cTn id="5" presetID="1" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect" descr="fade &lt;in&gt;"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>
            <p:set><p:cBhvr><p:cTn id="6" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="4"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>
          </p:childTnLst></p:cTn></p:par>
        </p:childTnLst></p:cTn></p:par>
      </p:childTnLst></p:cTn></p:par>
    </p:childTnLst></p:cTn><p:prevCondLst/><p:nextCondLst/></p:seq>
  </p:childTnLst></p:cTn>
</p:par></p:tnLst>
<p:bldLst><p:bldP spid="4" grpId="0" build="p"/></p:bldLst></p:timing>`;

function extractJsonScripts(html, cls) {
  return [...html.matchAll(
    new RegExp(`<script type="application/json" class="${cls}">([^<]*)</script>`, 'g'),
  )].map(m => JSON.parse(m[1])); // no raw '<' inside — parse proves the escape
}

// deep-find by predicate over the { tag, attrs, children } JSON tree
function findAll(node, pred, out = []) {
  if (pred(node)) out.push(node);
  for (const c of node.children ?? []) findAll(c, pred, out);
  return out;
}

test('timing JSON round-trips through the embedded script: nodeType clickEffect, spid 4 as number, bldLst present', () => {
  const { html } = convert(buildDeck({
    slides: [{ texts: [{ text: 'Profit < Loss', title: true }], timing: TIMING }],
  }));
  const scripts = extractJsonScripts(html, 'pp-timing-json');
  assert.equal(scripts.length, 1, 'one pp-timing-json script per slide');
  const payload = scripts[0];
  assert.equal(payload.timing.tag, 'p:timing');

  const effect = findAll(payload.timing, n => n.nodeType === 'clickEffect');
  assert.equal(effect.length, 1, 'nodeType passthrough readable');
  const spTgt = findAll(payload.timing, n => n.tag === 'p:spTgt');
  assert.equal(spTgt.length, 1);
  assert.equal(spTgt[0].spid, 4);
  assert.strictEqual(typeof spTgt[0].spid, 'number', 'spid numeric when /^\\d+$/');

  assert.ok(findAll(payload.timing, n => n.tag === 'p:bldLst').length === 1, 'p:bldLst included as-is');
  // pure JSON: the whole payload survives a stringify round-trip (no
  // functions, no Map/Set, no undefined-only holes)
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
});

test('"<" inside timing strings escapes to \\u003c in the embedded JSON (deck title carries "<" too)', () => {
  const { html } = convert(buildDeck({
    slides: [{ texts: [{ text: 'Profit < Loss', title: true }], timing: TIMING }],
  }));
  const raw = html.match(/<script type="application\/json" class="pp-timing-json">([^<]*)</)[1];
  assert.ok(raw.includes('\\u003c'), 'the decoded "<" from desc="fade <in>" is \\u003c in the script text');
  assert.ok(!raw.includes('<'), 'no raw "<" inside the script element');
  const payload = extractJsonScripts(html, 'pp-timing-json')[0];
  const effect = findAll(payload.timing, n => n.nodeType === 'clickEffect')[0];
  assert.equal(effect.attrs.descr, 'fade <in>', 'JSON.parse restores the literal "<"');
});

test('p:transition of type morph yields known:true with advance rules', () => {
  const { html } = convert(buildDeck({
    slides: [{
      timing: TIMING,
      transition: '<p:transition spd="slow" advClick="1" advTm="3000"><p:morph option="byObject"/></p:transition>',
    }],
  }));
  const t = extractJsonScripts(html, 'pp-timing-json')[0].transition;
  assert.equal(t.type, 'morph');
  assert.equal(t.known, true);
  assert.equal(t.advClick, true);
  assert.equal(t.advTm, 3000);
});

test('unknown transition warp7: known:false + exactly one approx diagnostic; absent timing/transition embed as null', () => {
  const { html, diagnostics } = convert(buildDeck({
    slides: [{ transition: '<p:transition><p:warp7/></p:transition>' }],
  }));
  const t = extractJsonScripts(html, 'pp-timing-json')[0].transition;
  assert.equal(t.type, 'warp7');
  assert.equal(t.known, false);
  const approxes = diagnostics.items.filter(d => d.kind === 'approx' && /transition warp7 recorded but not interpreted/.test(d.msg));
  assert.equal(approxes.length, 1, 'exactly one approx diagnostic (addOnce)');

  // slide without p:timing / p:transition still embeds the script, nulls inside
  const bare = convert(buildDeck({ slides: [{ texts: [{ text: 'x' }] }] }));
  const payload = extractJsonScripts(bare.html, 'pp-timing-json')[0];
  assert.equal(payload.timing, null);
  assert.equal(payload.transition, null);
});

test('parseTiming caps runaway trees at 20,000 nodes (truncated + approx); null node -> null', () => {
  const diag = new Diagnostics();
  const huge = parseXml(`<p:timing><p:tnLst>${'<p:par/>'.repeat(20005)}</p:tnLst></p:timing>`);
  const out = parseTiming(huge, { diag });
  assert.equal(out.truncated, true);
  assert.equal(out.tag, 'p:timing');
  assert.ok(out.children[0].children.length < 20005, 'partial tree kept');
  assert.deepEqual(
    diag.items.filter(d => d.kind === 'approx' && /timing tree truncated/.test(d.msg)).map(d => d.msg),
    ['timing tree truncated'],
  );
  assert.equal(parseTiming(null, { diag: new Diagnostics() }), null);
});

test('parseTransition unit surface: p14:dur lifted, unknown once per slide, null when absent', () => {
  const mk = xml => parseXml(`<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">${xml}</p:sld>`);
  const withP14 = parseTransition(mk('<p:transition spd="slow" p14:dur="1500" advClick="0"><p:fade/></p:transition>'), { diag: new Diagnostics() });
  assert.equal(withP14.type, 'fade');
  assert.equal(withP14.known, true);
  assert.equal(withP14.p14.dur, 1500);
  assert.equal(withP14.advClick, false);
  assert.equal(withP14.advTm, null);
  assert.equal(parseTransition(mk('<p:cSld/>'), { diag: new Diagnostics() }), null);
});
