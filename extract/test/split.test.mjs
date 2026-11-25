// --split output mode (01-06, decision 12): subprocess CLI runs proving both
// modes on one fixture — default single self-contained file, and --split
// emitting one page per slide (numbering by ORIGINAL index) + index.html.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeck } from './lib/deck.mjs';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.resolve(scriptsDir, 'pptx-to-html.js');

function runCli(...argv) {
  return spawnSync(process.execPath, [cli, ...argv], { encoding: 'utf8' });
}

// one shared fixture: 3 slides, slide 2 hidden, slide 3 with speaker notes
const DECK = buildDeck({
  masters: [{}],
  slides: [
    { texts: [{ text: 'Opening Slide', title: true }] },
    { texts: [{ text: 'Hidden middle' }], hidden: true },
    { texts: [{ text: 'Closer' }], notes: ['Final words.'] },
  ],
});

test('--split: exit 0, exactly index.html + slide-01..03.html, per-page contract', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-split-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  const out = path.join(dir, 'out');
  writeFileSync(tmpPptx, DECK);

  const r = runCli(tmpPptx, '--split', '-o', out);
  assert.equal(r.status, 0, `exit 0, stderr was:\n${r.stderr}`);
  assert.deepEqual(readdirSync(out).sort(),
    ['index.html', 'slide-01.html', 'slide-02.html', 'slide-03.html'],
    'directory contains exactly the four files');

  const s1 = readFileSync(path.join(out, 'slide-01.html'), 'utf8');
  assert.ok(s1.startsWith('<!DOCTYPE html>'), 'per-slide page is a full document');
  assert.equal((s1.match(/<div class="pp-slide/g) ?? []).length, 1, 'exactly one slide per page');
  assert.ok(s1.includes('justify-content: center'), 'viewport centering CSS on per-slide pages');
  assert.ok(s1.includes('pp-timing-json'), 'per-slide timing/transition data still embedded');

  const s2 = readFileSync(path.join(out, 'slide-02.html'), 'utf8');
  assert.ok(s2.includes('data-hidden="true"'), 'hidden slide gets its own file with the flag');
  // ...but no `hidden` attribute — a hidden slide opened directly must show
  assert.ok(!s2.includes('<div class="pp-slide" data-hidden="true" hidden'),
    'hidden attribute dropped in split mode, flag intact');

  const index = readFileSync(path.join(out, 'index.html'), 'utf8');
  for (const name of ['slide-01.html', 'slide-02.html', 'slide-03.html'])
    assert.ok(index.includes(`href="${name}"`), `index links ${name}`);
  assert.ok(index.includes('Opening Slide'), 'index shows the slide-1 title text');
  assert.ok(index.includes('pp-notes-flag'), 'notes flag on the slide-3 entry');
});

test('--split --slides 3: only slide-03.html — numbering follows ORIGINAL indices', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-split-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  const out = path.join(dir, 'out');
  writeFileSync(tmpPptx, DECK);

  const r = runCli(tmpPptx, '--split', '--slides', '3', '-o', out);
  assert.equal(r.status, 0, `exit 0, stderr was:\n${r.stderr}`);
  assert.deepEqual(readdirSync(out).sort(), ['index.html', 'slide-03.html'],
    'subset keeps original numbering: slide-03, never slide-01');
  const index = readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.ok(index.includes('href="slide-03.html"'), 'index lists the emitted slide');
  assert.ok(!index.includes('href="slide-01.html"'), 'index omits slides outside the subset');
});

test('--split default output directory: <input-basename>-split/ next to the input', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-split-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  writeFileSync(tmpPptx, DECK);

  const r = runCli(tmpPptx, '--split', '-q');
  assert.equal(r.status, 0, `exit 0, stderr was:\n${r.stderr}`);
  assert.ok(existsSync(path.join(dir, 'deck-split', 'index.html')), 'deck-split/index.html by default');
});

test('regression: same fixture without --split — one file, all 3 slide divs', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-split-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  const tmpOut = path.join(dir, 'single.html');
  writeFileSync(tmpPptx, DECK);

  const r = runCli(tmpPptx, '-o', tmpOut);
  assert.equal(r.status, 0, `exit 0, stderr was:\n${r.stderr}`);
  const html = readFileSync(tmpOut, 'utf8');
  assert.equal((html.match(/<div class="pp-slide/g) ?? []).length, 3,
    'default mode still emits every slide in one file');
  assert.ok(html.includes('data-hidden="true" hidden'), 'hidden flag + attribute in single-file mode');
});
