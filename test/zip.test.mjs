import test from 'node:test';
import assert from 'node:assert/strict';
import { ZipReader, writeZip } from '../src/util/zip.js';

test('round-trip: read what writeZip wrote', () => {
  const buf = writeZip([{ name: 'a.txt', data: 'hello' }]);
  const z = new ZipReader(buf);
  assert.equal(z.has('a.txt'), true);
  assert.equal(Buffer.from(z.read('a.txt')).toString('utf8'), 'hello');
  assert.deepEqual(z.names(), ['a.txt']);
});

test('deflate path: entry larger than 64 KiB', () => {
  // deterministic pseudo-random-ish payload, > 65535 bytes uncompressed
  const parts = [];
  for (let i = 0; i < 70000; i += 7) parts.push(`line-${i % 973}\n`);
  const payload = parts.join('').slice(0, 70000);
  assert.ok(payload.length > 65536);
  const z = new ZipReader(writeZip([{ name: 'big.bin', data: payload }]));
  const out = Buffer.from(z.read('big.bin')).toString('utf8');
  assert.equal(out, payload);
});

test('UTF-8 filename survives via flag 0x800', () => {
  const name = 'ppt/slides/幻灯片1.xml';
  const z = new ZipReader(writeZip([{ name, data: '<xml/>' }]));
  assert.equal(z.has(name), true);
  assert.ok(z.names().includes(name));
  assert.equal(Buffer.from(z.read(name)).toString('utf8'), '<xml/>');
});

test('has() is false for absent names', () => {
  const z = new ZipReader(writeZip([{ name: 'a.txt', data: 'hello' }]));
  assert.equal(z.has('nope.txt'), false);
  assert.equal(z.has(''), false);
  assert.throws(() => z.read('nope.txt'), /no entry/);
});

test('legacy .ppt (OLE2) files are rejected with guidance', () => {
  const ole2 = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(100),
  ]);
  assert.throws(() => new ZipReader(ole2), /OLE2/);
});

test('truncated archive: EOCD destroyed, local-header recovery still exposes entries', () => {
  const valid = writeZip([
    { name: 'a.txt', data: 'hello' },
    { name: 'dir/b.xml', data: '<b>content</b>' },
  ]);
  const truncated = Buffer.from(valid);
  truncated.fill(0, truncated.length - 22, truncated.length); // zero out EOCD
  const z = new ZipReader(truncated);
  assert.equal(z.has('a.txt'), true);
  assert.equal(z.has('dir/b.xml'), true);
  assert.equal(Buffer.from(z.read('a.txt')).toString('utf8'), 'hello');
  assert.equal(Buffer.from(z.read('dir/b.xml')).toString('utf8'), '<b>content</b>');
});

test('garbage that is neither ZIP nor OLE2 throws', () => {
  assert.throws(() => new ZipReader(Buffer.alloc(64, 0x41)), /no readable entries/);
});
