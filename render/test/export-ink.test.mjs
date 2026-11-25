// Browser-driven capture regression (02-FX4, VERIFICATION gap 4): a shape's
// tint fill must never paint over its own .pp-text runs in exported PNGs.
// Skipped unless STEVEDORE_CHROMIUM_PATH is set — run under:
//   nix shell nixpkgs#chromium --command env \
//     STEVEDORE_CHROMIUM_PATH=$(command -v chromium) node --test render/test/*.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inkFraction, loadPng } from '../../scripts/test/lib/ink.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const codeLine = (i, top) => `
  <div class="pp-el" style="left:40px;top:${top}px;width:600px;height:12px">
    <svg class="pp-geom" viewBox="0 0 600 12" width="600" height="12" preserveAspectRatio="none" style="position:absolute;left:0;top:0;overflow:visible">
      <path d="M3.93,0 H596.07 A3.93,3.93 0 0 1 600,3.93 V8.07 A3.93,3.93 0 0 1 596.07,12 H3.93 A3.93,3.93 0 0 1 0,8.07 V3.93 A3.93,3.93 0 0 1 3.93,0 Z" fill="#fdecee" fill-rule="evenodd" stroke="none"/>
    </svg>
    <div class="pp-text" style="display:flex;flex-direction:column;justify-content:flex-start;padding:0px 1px 0px 1px">
      <p style="margin:0;line-height:11.68px;text-align:left"><span style="font-size:10px;font-family:'ui-monospace', Calibri, sans-serif;font-weight:400;font-style:normal;color:#4b5563">+ class StoryStart(BaseModel): line ${i} — the quick brown fox jumps over the lazy dog 0123456789</span></p>
    </div>
  </div>`;

const FIXTURE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
:root { --pp-w: 1280px; --pp-h: 720px; }
* { box-sizing: border-box; }
body { margin: 0; background: #1a1a1a; }
.pp-slide { position: relative; width: var(--pp-w); height: var(--pp-h); background: #fff; overflow: hidden; margin: 0; transform-origin: top center; transform: scale(var(--pp-k, 1)); }
.pp-el { position: absolute; }
</style></head><body>
<div class="pp-slide">
  <div class="pp-el" style="left:40px;top:30px;width:500px;height:60px">
    <div class="pp-text" style="display:flex;flex-direction:column;justify-content:flex-start;padding:6px 10px 6px 10px">
      <p style="margin:0;line-height:44px;text-align:left"><span style="font-size:36px;font-family:'-apple-system', Calibri, sans-serif;font-weight:700;font-style:normal;color:#111827">Fixture title</span></p>
    </div>
  </div>
  ${[0, 1, 2, 3, 4].map(i => codeLine(i, 120 + i * 24)).join('')}
</div>
</body></html>`;

test('regression: tint fills do not hide .pp-text code runs in exports — VERIFICATION gap 4 (02-FX4)',
  { skip: process.env.STEVEDORE_CHROMIUM_PATH ? false : 'requires STEVEDORE_CHROMIUM_PATH (nix shell nixpkgs#chromium)' },
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'stevedore-fx4-test-'));
    const html = join(dir, 'fixture.html');
    const out = join(dir, 'out');
    writeFileSync(html, FIXTURE);
    const r = spawnSync(process.execPath, [join(ROOT, 'render/export-slides.mjs'), html, '-o', out],
      { encoding: 'utf8' });
    assert.equal(r.status, 0, `exporter failed: ${r.stderr}`);
    assert.deepEqual(readdirSync(out), ['01.png']);
    const png = loadPng(join(out, '01.png'));
    assert.equal(png.width, 1280); assert.equal(png.height, 720);
    // code-panel union rect: the five 600×12 tinted line boxes (40..640 × 120..228)
    const panel = inkFraction(png, { x: 42, y: 121, w: 596, h: 117 });
    assert.ok(panel.fraction >= 0.01,
      `code runs not visible in export — ink fraction ${panel.fraction.toFixed(5)} < 0.01 (gap-4 regression)`);
    // fill-less title text must stay visible (fix must not break plain text boxes)
    const title = inkFraction(png, { x: 45, y: 32, w: 495, h: 56 });
    assert.ok(title.fraction >= 0.01, `title ink missing: ${title.fraction.toFixed(5)}`);
  });
