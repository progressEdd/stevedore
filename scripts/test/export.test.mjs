// Export tooling tests (02-03): pure helpers + CLI argument/env errors.
// Browser-driven capture is verified on the real decks by the plan's task 2.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pad2, parseArgs } from '../export-slides.mjs';

test('pad2 zero-pads to two digits', () => {
  assert.equal(pad2(1), '01');
  assert.equal(pad2(9), '09');
  assert.equal(pad2(10), '10');
  assert.equal(pad2(20), '20');
});

test('parseArgs reads flags and positional', () => {
  const a = parseArgs(['deck.html', '-o', 'out', '--selector', 'section', '--width', '800']);
  assert.equal(a.html, 'deck.html');
  assert.equal(a.out, 'out');
  assert.equal(a.selector, 'section');
  assert.equal(a.width, 800);
  assert.equal(a.height, 720, 'height default');
  const b = parseArgs([]);
  assert.equal(b.html, null);
  assert.equal(b.out, null);
});

test('CLI: missing args -> exit 2 with usage', () => {
  const r = spawnSync(process.execPath, ['scripts/export-slides.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage: node scripts\/export-slides\.mjs/);
});

test('CLI: missing STEVEDORE_CHROMIUM_PATH -> exit 2 with the nix hint', () => {
  const r = spawnSync(process.execPath, ['scripts/export-slides.mjs', 'x.html', '-o', 'out'],
    { encoding: 'utf8', env: { ...process.env, STEVEDORE_CHROMIUM_PATH: '' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /STEVEDORE_CHROMIUM_PATH/);
  assert.match(r.stderr, /nix shell nixpkgs#chromium/);
});
