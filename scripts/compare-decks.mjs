#!/usr/bin/env node
// Deck comparator (plan 01-07, decision 13): pure-node structural comparison
// of two HTML decks — a Marp source (top-level <section> slides) against our
// converter's output (<div class="pp-slide"> slides). No DOM, no deps
// (decision 5): string scanning + word-multiset Jaccard only.
//
// Usage: node scripts/compare-decks.mjs <source.html> <converted.html>
//
// Gates (exit 1 on failure, message to stderr):
//   - slide counts equal after dropping source slides with no text AND no
//     images (Marp section-split background containers inflate counts)
//   - mean per-slide Jaccard >= 0.70 and min per-slide Jaccard >= 0.30
//     (code-block slides legitimately drift through the pptx round trip)
//   - converted deck keeps >= 50% of the source's image count

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MEAN_THRESHOLD = 0.70; // mean per-slide Jaccard
const MIN_THRESHOLD = 0.30;  // min per-slide Jaccard
const IMAGE_RATIO_THRESHOLD = 0.50; // converted keeps >= 50% of source images

// Strip <script>/<style> blocks and comments first so markup noise can never
// enter the text or image metrics (base64 CSS backgrounds, scaler JS, the
// per-slide timing JSON our converter embeds).
export function stripScriptStyle(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ');
}

// Balanced-block scanner: every block opened by `openRe` and spanning to its
// matching close token, nested same-shaped tokens counted. Deep enough for
// the two deck shapes this tool compares (Marp sections, pp-slide divs).
function extractBalanced(html, openRe, nestRe, isNestOpen) {
  const blocks = [];
  openRe.lastIndex = 0;
  let m;
  while ((m = openRe.exec(html)) !== null) {
    const start = m.index;
    let i = start + m[0].length;
    let depth = 1;
    nestRe.lastIndex = i;
    let mm;
    while (depth > 0 && (mm = nestRe.exec(html)) !== null) {
      const opened = isNestOpen(mm[0]);
      depth += opened ? 1 : -1;
      i = mm.index + mm[0].length;
      if (!opened) { // consume the '>' of the closing tag — else it leaks into text
        const gt = html.indexOf('>', i);
        if (gt >= 0) i = gt + 1;
      }
    }
    if (depth !== 0) break; // unbalanced — skip this open, try the next
    blocks.push(html.slice(start, i));
    openRe.lastIndex = i; // skip nested openings inside the captured block
  }
  return blocks;
}

// Split one deck's HTML into slide-block strings. Two shapes are recognized
// (the plan's two decks): Marp `<section …>…</section>` containers and our
// converter's `<div class="pp-slide" …>…</div>` containers (the class value
// may continue after pp-slide, e.g. `pp-slide pp-broken`; a bare prefix like
// pp-slide-x is rejected by the lookahead). pp-slide divs win when both
// shapes appear — a converted deck quotes section markup only as escaped
// text, never as real tags.
export function splitSlides(html) {
  const clean = stripScriptStyle(html);
  const divs = extractBalanced(
    clean,
    /<div class="pp-slide(?=[">\s/])/gi,
    /<div\b|<\/div/gi,
    tok => /^<div\b/i.test(tok),
  );
  if (divs.length > 0) return divs;
  return extractBalanced(
    clean,
    /<section\b/gi,
    /<section\b|<\/section/gi,
    tok => /^<section\b/i.test(tok),
  );
}

// Word tokens of one slide's markup: tags stripped (attribute noise like
// base64 data URIs dies with them), entities decoded, whitespace collapsed,
// punctuation edges trimmed, lowercased.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(\w+);/g, (s0, name) => ENTITIES[name] ?? s0);
}

export function words(slideHtml) {
  return decodeEntities(stripScriptStyle(slideHtml).replace(/<[^>]*>/g, ' '))
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
    .filter(Boolean);
}

// Count-aware (multiset) Jaccard over word lists:
// |A∩B| = Σ min(countA, countB);  |A∪B| = |A| + |B| − |A∩B| (counts summed).
export function jaccard(a, b) {
  const counts = new Map();
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
  const countsB = new Map();
  for (const w of b) countsB.set(w, (countsB.get(w) ?? 0) + 1);
  let inter = 0;
  for (const [w, n] of counts) inter += Math.min(n, countsB.get(w) ?? 0);
  const union = a.length + b.length - inter;
  return union === 0 ? 1 : inter / union;
}

// Image count of a deck or slide block: `<img` tags plus `data:image`
// occurrences (data-URI attribute values). Report-only metric per deck;
// per-slide it drives the empty-slide drop rule.
export function countImages(html) {
  const clean = stripScriptStyle(html);
  return (clean.match(/<img/gi) ?? []).length + (clean.match(/data:image/gi) ?? []).length;
}

function fmt(n) { return n.toFixed(3); }

function main() {
  const [srcPath, convPath] = process.argv.slice(2);
  if (!srcPath || !convPath) {
    process.stderr.write('Usage: node scripts/compare-decks.mjs <source.html> <converted.html>\n');
    process.exit(2);
  }
  let srcHtml, convHtml;
  try {
    srcHtml = readFileSync(srcPath, 'utf8');
    convHtml = readFileSync(convPath, 'utf8');
  } catch (err) {
    process.stderr.write(`compare-decks: ${err.message}\n`);
    process.exit(2);
  }

  const failures = [];
  const srcAll = splitSlides(srcHtml);
  const convSlides = splitSlides(convHtml);
  if (srcAll.length === 0) failures.push(`no slides found in source ${srcPath}`);
  if (convSlides.length === 0) failures.push(`no slides found in converted ${convPath}`);

  // Drop source slides with no text AND no images (Marp background sections)
  // — but only when the source has MORE slides than the converted deck: the
  // rule deflates section-split containers that inflate counts. When raw
  // counts already match, slides pair 1:1 and dropping would misalign them
  // (found on the real LAND.E round trip: 20↔20 with empty slides on both
  // sides at the same indexes).
  const dropped = [];
  let srcSlides = srcAll;
  if (srcAll.length > convSlides.length) {
    srcSlides = srcAll.filter((s, i) => {
      if (words(s).length === 0 && countImages(s) === 0) { dropped.push(i + 1); return false; }
      return true;
    });
  }

  const out = [];
  out.push(`source     ${srcPath}: ${srcAll.length} slides` +
    (dropped.length ? ` (${dropped.length} empty dropped: #${dropped.join(', #')})` : ''));
  out.push(`converted  ${convPath}: ${convSlides.length} slides`);
  if (srcSlides.length !== convSlides.length)
    failures.push(`slide counts differ: source ${srcSlides.length} (after drops) vs converted ${convSlides.length}`);

  const pairs = Math.min(srcSlides.length, convSlides.length);
  const perSlide = [];
  out.push('slide   jaccard   words src/conv');
  for (let i = 0; i < pairs; i++) {
    const wa = words(srcSlides[i]);
    const wb = words(convSlides[i]);
    const j = jaccard(wa, wb);
    perSlide.push(j);
    out.push(`${String(i + 1).padStart(4)}   ${fmt(j).padStart(7)}   ${String(wa.length).padStart(4)}/${String(wb.length).padStart(4)}`);
  }
  const mean = perSlide.length ? perSlide.reduce((x, y) => x + y, 0) / perSlide.length : 0;
  const min = perSlide.length ? Math.min(...perSlide) : 0;
  if (perSlide.length) out.push(`mean ${fmt(mean)}   min ${fmt(min)}`);
  if (mean < MEAN_THRESHOLD) failures.push(`mean Jaccard ${fmt(mean)} < ${MEAN_THRESHOLD}`);
  if (perSlide.length && min < MIN_THRESHOLD) failures.push(`min slide Jaccard ${fmt(min)} < ${MIN_THRESHOLD}`);

  const imgsSrc = countImages(srcHtml);
  const imgsConv = countImages(convHtml);
  const ratio = imgsSrc === 0 ? Infinity : imgsConv / imgsSrc;
  out.push(`images: source ${imgsSrc}   converted ${imgsConv}  ` +
    (imgsSrc === 0 ? '(source has none)' : `(${Math.round(ratio * 100)}% of source)`));
  if (imgsConv < IMAGE_RATIO_THRESHOLD * imgsSrc)
    failures.push(`converted has ${imgsConv} images < ${IMAGE_RATIO_THRESHOLD * 100}% of source's ${imgsSrc}`);

  process.stdout.write(out.join('\n') + '\n');
  if (failures.length) {
    for (const f of failures) process.stderr.write(`compare-decks: gate failed: ${f}\n`);
    process.stdout.write('FAIL\n');
    process.exit(1);
  }
  process.stdout.write('PASS\n');
  process.exit(0);
}

// importable module + CLI in one file: main() runs only when executed directly
// (process.argv[1] is undefined under dynamic import — guard both).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
