// Tests for the zero-dep deck comparator (plan 01-07): module functions via
// import, plus spawnSync CLI runs asserting exit codes 0/1 per the gates.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { splitSlides, words, jaccard, countImages } from '../compare-decks.mjs';

const CLI = fileURLToPath(new URL('../compare-decks.mjs', import.meta.url));

// Marp-shaped source: 3 real slides + 1 empty background section (must be
// dropped by the slide-count gate). 11/8/7 words per real slide — long
// enough that a one-word change per slide stays above the 0.70 mean gate.
const SOURCE_DECK = `<!DOCTYPE html><html><head><style>.x{background:url(data:image/png;base64,NOPE)}</style></head><body>
<section id="1"><h1>Alpha Slide</h1><p>The quick brown fox jumps over the lazy dog</p></section>
<section id="2"><h2>Beta Slide</h2><ul><li>one item here</li><li>two item here</li></ul></section>
<section id="3"><p>Gamma conclusion and results with final remarks</p><img src="pic-a.png"><img src="pic-b.png"></section>
<section id="4" data-background="dark"></section>
<script>bespoke noise that must not count</script>
</body></html>`;

// Converter-shaped deck: identical text, nested div inside slide 1 (exercises
// div-depth counting), two data-URI images.
const CONVERTED_DECK = `<!DOCTYPE html><html><head><style>.pp-slide{position:relative}</style></head><body><div class="pp-viewport">
<div class="pp-slide" data-slide-index="1"><h1>Alpha Slide</h1><div class="pp-el"><p>The quick brown fox jumps over the lazy dog</p></div></div>
<div class="pp-slide" data-slide-index="2"><h2>Beta Slide</h2><ul><li>one item here</li><li>two item here</li></ul></div>
<div class="pp-slide" data-slide-index="3"><p>Gamma conclusion and results with final remarks</p><img class="pp-img" src="data:image/png;base64,AAAA"><img class="pp-img" src="data:image/png;base64,BBBB"></div>
</div><script>scaler noise</script></body></html>`;

// One word changed on every slide (fox→cat, two→deux, final→last).
const CHANGED_DECK = CONVERTED_DECK
  .replace('quick brown fox jumps', 'quick brown cat jumps')
  .replace('two item here', 'deux item here')
  .replace('with final remarks', 'with last remarks');

// Slide 3 removed → 3 source (after drop) vs 2 converted → count gate FAIL.
const SHORT_DECK = CONVERTED_DECK.replace(/<div class="pp-slide" data-slide-index="3">[\s\S]*?<\/div>\n/, '');

const TMP = mkdtempSync(join(tmpdir(), 'compare-decks-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

function run(name, srcHtml, convHtml) {
  const src = join(TMP, `${name}-src.html`);
  const conv = join(TMP, `${name}-conv.html`);
  writeFileSync(src, srcHtml);
  writeFileSync(conv, convHtml);
  return spawnSync(process.execPath, [CLI, src, conv], { encoding: 'utf8' });
}

test('splitSlides recognizes both deck shapes', () => {
  assert.equal(splitSlides(SOURCE_DECK).length, 4); // drop happens in main, not splitSlides
  assert.equal(splitSlides(CONVERTED_DECK).length, 3);
});

test('words: tags/scripts/styles stripped, punctuation edges trimmed, lowercase', () => {
  assert.deepEqual(words('<p>The quick, brown fox!</p>'), ['the', 'quick', 'brown', 'fox']);
  assert.deepEqual(words('<script>ignored()</script><style>.a{}</style><p>kept</p>'), ['kept']);
  assert.deepEqual(words('<p>R&amp;D &#8212; done</p>'), ['r&d', 'done']);
});

test('jaccard: count-aware multiset similarity', () => {
  assert.equal(jaccard(['a', 'b', 'b'], ['b', 'b', 'c']), 0.5); // ∩=2 (the two b's), ∪=4
  assert.equal(jaccard(['x', 'y'], ['x', 'y']), 1);
  assert.equal(jaccard(['x'], ['y']), 0);
});

test('identical text across shapes: per-slide jaccard 1.0', () => {
  const a = splitSlides(SOURCE_DECK).slice(0, 3);
  const b = splitSlides(CONVERTED_DECK);
  for (let i = 0; i < 3; i++)
    assert.equal(jaccard(words(a[i]), words(b[i])), 1);
});

test('countImages counts <img plus data:image, ignoring style blocks', () => {
  assert.equal(countImages(SOURCE_DECK), 2); // 2 <img>; the data:image in <style> is stripped
  assert.equal(countImages(CONVERTED_DECK), 4); // 2 <img> + 2 data:image
});

test('CLI: identical decks PASS with mean 1.0, exit 0', () => {
  const r = run('same', SOURCE_DECK, CONVERTED_DECK);
  assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  assert.match(r.stdout, /PASS/);
  assert.match(r.stdout, /mean 1\.000/);
  assert.match(r.stdout, /1 empty dropped: #4/); // the empty background section is reported
});

test('CLI: one word changed per slide still PASS with mean < 1', () => {
  const r = run('changed', SOURCE_DECK, CHANGED_DECK);
  assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`);
  assert.match(r.stdout, /PASS/);
  const mean = Number(/mean ([0-9.]+) /.exec(r.stdout)[1]);
  assert.ok(mean < 1 && mean >= 0.70, `mean=${mean}`);
});

test('CLI: slide count mismatch FAIL exit 1', () => {
  const r = run('short', SOURCE_DECK, SHORT_DECK);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL/);
  assert.match(r.stderr, /slide counts differ/);
});

test('thresholds 0.70 / 0.30 / 50% appear verbatim in the script; imports are node built-ins only', () => {
  const src = readFileSync(CLI, 'utf8');
  assert.ok(src.includes('0.70'), '0.70 mean threshold verbatim');
  assert.ok(src.includes('0.30'), '0.30 min threshold verbatim');
  assert.ok(src.includes('50%'), '50% image threshold verbatim');
  const specifiers = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.ok(specifiers.length > 0);
  for (const s of specifiers) assert.match(s, /^node:/, `non-builtin import: ${s}`);
});
