// End-to-end: the consumer flow, as a consumer runs it — a real subprocess,
// a real file on disk, real HTML out. Proves round-trip tolerance at CLI
// level: a phantom [Content_Types] override (part named but never written)
// must not be fatal.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeck } from './lib/deck.mjs';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.resolve(scriptsDir, 'pptx-to-html.js');

function runCli(...argv) {
  return spawnSync(process.execPath, [cli, ...argv], { encoding: 'utf8' });
}

test('consumer flow: node extract/pptx-to-html.js <file>.pptx -o <out>.html (exit 0, real HTML on disk)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  const tmpOut = path.join(dir, 'out.html');
  writeFileSync(tmpPptx, buildDeck({
    slides: [{ texts: [{ text: 'Round trip', title: true }, { text: 'Second box' }] }],
    advertiseMissing: ['/ppt/slideLayouts/slideLayout99.xml'], // phantom content-type override
  }));

  const r = runCli(tmpPptx, '-o', tmpOut);
  assert.equal(r.status, 0, `exit 0, stderr was:\n${r.stderr}`);
  assert.ok(existsSync(tmpOut), 'output file written');

  const html = readFileSync(tmpOut, 'utf8');
  assert.ok(html.startsWith('<!DOCTYPE html>'), 'full document emitted');
  assert.ok(html.includes('Round trip'), "slide text present");
  assert.ok(/<h1[^>]*>\s*Round trip\s*<\/h1>|<h1[^>]*>Round trip<\/h1>/.test(html.replace(/\n/g, '')), 'title placeholder renders as <h1>');
  assert.ok(html.includes('Second box'), 'second text box present');
  assert.ok(html.includes('class="pp-el" style="left:'), 'absolute .pp-el boxes with left positioning');
  assert.ok(html.includes('data-slide-index="1"'), 'data- attributes intact');
  assert.ok(!r.stderr.includes('Cannot'), 'stderr mentions nothing fatal');
});

test('default output path: <input>.html next to the input', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  writeFileSync(tmpPptx, buildDeck({ slides: [{ texts: [{ text: 'x' }] }] }));
  const r = runCli(tmpPptx, '-q');
  assert.equal(r.status, 0);
  assert.ok(existsSync(path.join(dir, 'deck.html')), 'deck.html written by default');
});

test('diagnostics listing prints to stderr; -q silences it; --strict turns any diagnostic into exit 1', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  writeFileSync(tmpPptx, buildDeck({ slides: [{ texts: [{ text: 'x' }] }] })); // no masters -> 'missing: no theme part'
  const loud = runCli(tmpPptx, '-o', path.join(dir, 'a.html'));
  assert.equal(loud.status, 0, 'missing-kind diagnostics are not fatal');
  assert.match(loud.stderr, /^pptx-to-html: missing: /m, 'listing on stderr, prefixed');
  const quiet = runCli(tmpPptx, '-q', '-o', path.join(dir, 'b.html'));
  assert.equal(quiet.status, 0);
  assert.equal(quiet.stderr, '', '-q silences the listing');
  const strict = runCli(tmpPptx, '--strict', '-o', path.join(dir, 'c.html'));
  assert.equal(strict.status, 1, '--strict: ANY diagnostic -> exit 1');
  assert.ok(existsSync(path.join(dir, 'c.html')), 'HTML still written');
});

test('error path: non-zip input -> exit 2', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-'));
  const notZip = path.join(dir, 'not-a-zip.pptx');
  writeFileSync(notZip, 'definitely not a zip file');
  const r = runCli(notZip);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /pptx-to-html: /);
});

// (01-02's '--split exits 3' stub test retired when 01-06 made --split
// real — the split contract now lives in split.test.mjs)

test('--help prints the usage block (--split and --strict documented)', () => {
  const r = runCli('--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage: node extract\/pptx-to-html\.js <input\.pptx> \[options\]/);
  assert.ok(r.stdout.includes('--split'));
  assert.ok(r.stdout.includes('--strict'));
  assert.ok(r.stdout.includes('--slides'));
  assert.ok(r.stdout.includes('--output'));
});

test('--slides subset converts only the requested slides', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pptx-'));
  const tmpPptx = path.join(dir, 'deck.pptx');
  writeFileSync(tmpPptx, buildDeck({ slides: [
    { texts: [{ text: 'one' }] }, { texts: [{ text: 'two' }] }, { texts: [{ text: 'three' }] },
  ] }));
  const r = runCli(tmpPptx, '-q', '--slides', '1,3', '-o', path.join(dir, 'sub.html'));
  assert.equal(r.status, 0);
  const html = readFileSync(path.join(dir, 'sub.html'), 'utf8');
  assert.ok(html.includes('one') && html.includes('three'));
  assert.ok(!html.includes('two'), 'unselected slide omitted');
  assert.ok(html.includes('data-slide-index="3"'), 'original indices kept');
});
