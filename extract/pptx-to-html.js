#!/usr/bin/env node
// CLI entry (conventions adopted from upstream PPTX2HTML bin/pptx2html.js,
// MIT). Runnable with bare `node` — zero install, zero deps (decision 5).
// Exit codes: 0 ok (diagnostics without errors still ok), 1 any error-kind
// diagnostic (or, under --strict, ANY diagnostic), 2 usage/IO errors.
// Output modes (decision 12): default one self-contained .html; --split
// writes one page per slide + index.html into a directory.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { convert, convertSplit } from './src/index.js'; // sibling after the scripts/ relocation (plan text said ../src/index.js)

const USAGE = `Usage: node extract/pptx-to-html.js <input.pptx> [options]

Options:
  -o, --output <path>  Output file (default: <input>.html). With --split: output directory
      --split          Emit one HTML file per slide + index.html into the output directory
      --slides <spec>  Convert a subset, e.g. "1,3-5" (1-based)
      --strict         Exit non-zero when ANY diagnostic was recorded
  -q, --quiet          Suppress the diagnostics listing on stderr
  -h, --help           Show this help
`;

function fail(msg, code = 2) {
  process.stderr.write(`pptx-to-html: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { input: null, output: null, split: false, slides: null, strict: false, quiet: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '-o' || a === '--output') {
      if (i + 1 >= argv.length) fail(`option ${a} requires a value\n\n${USAGE}`);
      args.output = argv[++i];
    }
    else if (a === '--split') args.split = true;
    else if (a === '--slides') {
      if (i + 1 >= argv.length) fail(`option ${a} requires a value\n\n${USAGE}`);
      args.slides = argv[++i];
    }
    else if (a === '--strict') args.strict = true;
    else if (a === '-q' || a === '--quiet') args.quiet = true;
    else if (a.startsWith('-')) fail(`unknown option ${a}\n\n${USAGE}`);
    else if (args.input === null) args.input = a;
    else fail(`unexpected argument ${a}\n\n${USAGE}`);
  }
  return args;
}

// "1,3-5" -> [1,3,4,5] — range expansion happens here, before convert()
function expandSlides(spec) {
  const out = [];
  for (const part of String(spec).split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) fail(`bad --slides spec: ${spec} (expected e.g. "1,3-5")`);
    const lo = parseInt(m[1], 10);
    const hi = m[2] !== undefined ? parseInt(m[2], 10) : lo;
    if (hi < lo) fail(`bad --slides range ${part}: ${hi} < ${lo}`);
    for (let n = lo; n <= hi; n++) out.push(n);
  }
  return out;
}

function defaultOutput(input) { // deck.pptx -> deck.html, next to the input
  const slash = Math.max(input.lastIndexOf('/'), input.lastIndexOf('\\'));
  const dot = input.lastIndexOf('.');
  return (dot > slash ? input.slice(0, dot) : input) + '.html';
}

function defaultSplitDir(input) { // deck.pptx -> deck-split/, next to the input
  const slash = Math.max(input.lastIndexOf('/'), input.lastIndexOf('\\'));
  const dot = input.lastIndexOf('.');
  return (dot > slash ? input.slice(0, dot) : input) + '-split';
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { process.stdout.write(USAGE); process.exit(0); }
if (args.input === null) fail(`missing <input.pptx>\n\n${USAGE}`);

let data;
try {
  data = readFileSync(args.input);
} catch (err) {
  fail(`cannot read ${args.input}: ${err.message}`);
}

let result;
try {
  const options = { slides: args.slides !== null ? expandSlides(args.slides) : undefined };
  result = args.split ? convertSplit(data, options) : convert(data, options);
} catch (err) { // not a zip, missing package parts — a usage/IO failure, not content
  fail(err.message);
}

if (args.split) {
  const dir = args.output !== null ? args.output : defaultSplitDir(args.input);
  try {
    mkdirSync(dir, { recursive: true });
    for (const file of result.files) writeFileSync(join(dir, file.name), file.html);
  } catch (err) {
    fail(`cannot write ${dir}: ${err.message}`);
  }
} else {
  const output = args.output !== null ? args.output : defaultOutput(args.input);
  try {
    writeFileSync(output, result.html);
  } catch (err) {
    fail(`cannot write ${output}: ${err.message}`);
  }
}

if (!args.quiet)
  for (const line of result.diagnostics.format())
    process.stderr.write(`pptx-to-html: ${line}\n`);

const failed = result.diagnostics.hasErrors || (args.strict && result.diagnostics.items.length > 0);
process.exit(failed ? 1 : 0);
