/**
 * Company: EonHive Inc. | Title: Portable Package Regression Tests
 * Purpose: Verify CLI round trips, archive validation, limits, and safe failure behavior.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ZipWriter, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import { inspectPackage, unpackPackage, PACKAGE_LIMITS } from '../dist/utils/portable-package.js';

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const manifest = { formatVersion: 1, name: 'Portable proof', version: '0.1.0', type: 'widget', entrypoint: 'index.html' };
const html = '<!doctype html><title>Portable proof</title><script type="module" src="./assets/app.js"></script><link rel="stylesheet" href="./assets/app.css">';
const contents = {
  'index.html': Buffer.from(html),
  'assets/app.js': Buffer.from('document.body.textContent = "Compiled website";'),
  'assets/app.css': Buffer.from('body { color: green; background: url("./image.svg"); }'),
  'assets/image.svg': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>'),
  'content.json': Buffer.from('{"value":42}'),
  'nested/file.bin': Buffer.from([0, 255, 10, 13, 128]),
};

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'urk-package-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'dist/assets'), { recursive: true });
  mkdirSync(join(root, 'dist/nested'));
  for (const [name, bytes] of Object.entries(contents)) writeFileSync(join(root, 'dist', name), bytes);
  return root;
}

function run(root, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  return { ...result, log: result.stdout + result.stderr };
}

function passed(result) { assert.equal(result.status, 0, result.log); }
function failed(result, message) { assert.equal(result.status, 1, result.log); assert.match(result.log, message); }
function clean(root) { assert.deepEqual(readdirSync(root).filter(name => /^\.urk-(pack|unpack)-/.test(name)), []); }

async function archive(root, records = [], metadata = manifest) {
  const sink = new Uint8ArrayWriter();
  const writer = new ZipWriter(sink, { useWebWorkers: false, level: 0, dataDescriptor: false });
  if (metadata !== null) await writer.add('urk.json', new Uint8ArrayReader(Buffer.from(JSON.stringify(metadata))));
  await writer.add('index.html', new Uint8ArrayReader(Buffer.from('<!doctype html><title>Fixture title</title>')));
  for (const [name, bytes = '', options = {}] of records) {
    await writer.add(name, new Uint8ArrayReader(Buffer.from(bytes)), options);
  }
  const path = join(root, 'fixture.urkpkg');
  writeFileSync(path, await writer.close());
  return path;
}

// Deliberately alter ZIP headers for malformed fixtures; production parsing belongs to zip.js.
function changeHeader(path, filename, field, value) {
  const bytes = readFileSync(path);
  for (let index = 0; index <= bytes.length - 46; index++) {
    if (bytes.readUInt32LE(index) !== 0x02014b50) continue;
    const length = bytes.readUInt16LE(index + 28);
    if (bytes.subarray(index + 46, index + 46 + length).toString() !== filename) continue;
    const local = bytes.readUInt32LE(index + 42);
    if (field === 'size') {
      bytes.writeUInt32LE(value, index + 24);
      bytes.writeUInt32LE(value, local + 22);
    } else if (field === 'method') {
      bytes.writeUInt16LE(value, index + 10);
      bytes.writeUInt16LE(value, local + 8);
    }
    writeFileSync(path, bytes);
    return;
  }
  throw new Error(`Missing test ZIP entry: ${filename}`);
}

test('CLI packages defaults, inspects without extraction, and round-trips every byte', async t => {
  const root = fixture(t);
  passed(run(root, 'pack'));
  const packagePath = join(root, 'dist.urkpkg');
  const beforeInspect = readdirSync(root);
  const report = run(root, 'inspect', packagePath);
  passed(report);
  assert.match(report.stdout, /URK Package Inspection/);
  assert.match(report.stdout, /type: experience/);
  assert.match(report.stdout, /version: 0\.1\.0/);
  assert.match(report.stdout, /archive bytes: \d+/);
  assert.deepEqual(readdirSync(root), beforeInspect);
  assert.equal((await inspectPackage(packagePath)).manifest.name, root.split('/').at(-1));
  passed(run(root, 'unpack', packagePath, '--out-dir', 'site'));
  for (const [name, bytes] of Object.entries(contents)) assert.deepEqual(readFileSync(join(root, 'site', name)), bytes);
  assert.equal(JSON.parse(readFileSync(join(root, 'site/urk.json'), 'utf8')).entrypoint, 'index.html');
  clean(root);
});

test('metadata flags and default unpack path work; project inspection and help remain available', async t => {
  const root = fixture(t);
  passed(run(root, 'pack', 'dist', '--out=demo.urkpkg', '--name', 'Picking', '--version', '2.3.4-beta', '--type', 'custom-visualizer'));
  const report = await inspectPackage(join(root, 'demo.urkpkg'));
  assert.deepEqual(report.manifest, { ...manifest, name: 'Picking', version: '2.3.4-beta', type: 'custom-visualizer' });
  passed(run(root, 'unpack', 'demo.urkpkg'));
  assert.deepEqual(readFileSync(join(root, 'demo/index.html')), contents['index.html']);
  writeFileSync(join(root, 'package.json'), '{"name":"legacy-project"}');
  const project = run(root, 'inspect');
  passed(project);
  assert.match(project.stdout, /URK Project Inspection/);
  assert.match(project.stdout, /legacy-project/);
  for (const command of ['pack', 'inspect', 'unpack']) passed(run(root, command, '--help'));
});

test('replacement is explicit and failed builds or unpacking preserve previous output', t => {
  const root = fixture(t);
  passed(run(root, 'pack'));
  const original = readFileSync(join(root, 'dist.urkpkg'));
  failed(run(root, 'pack'), /--overwrite/);
  writeFileSync(join(root, 'dist/index.html'), '<script src="/src/main.ts"></script>');
  failed(run(root, 'pack', '--overwrite'), /urk export --base/);
  assert.deepEqual(readFileSync(join(root, 'dist.urkpkg')), original);
  writeFileSync(join(root, 'dist/index.html'), contents['index.html']);
  passed(run(root, 'pack', '--overwrite', '--name', 'Replacement'));
  mkdirSync(join(root, 'site'));
  writeFileSync(join(root, 'site/keep.txt'), 'Keep me');
  failed(run(root, 'unpack', 'dist.urkpkg', '--out-dir', 'site'), /absent or empty/);
  assert.equal(readFileSync(join(root, 'site/keep.txt'), 'utf8'), 'Keep me');
  mkdirSync(join(root, 'empty'));
  passed(run(root, 'unpack', 'dist.urkpkg', '--out-dir', 'empty'));
  clean(root);
});

test('pack rejects source entrypoints, fixed-base assets, reserved metadata, and symlinks', t => {
  const root = fixture(t);
  const badHtml = [
    '<script src="/assets/app.js"></script>', '<script src="./assets/app.ts"></script>',
    '<script src="./assets/app.tsx"></script>', '<script src="./@vite/client"></script>',
    '<script src="../assets/app.js"></script>', '<script src="./missing.js"></script>',
    '<link rel="stylesheet" href="/assets/app.css">', '<base href="/fixed/"><script src="assets/app.js"></script>',
  ];
  for (const page of badHtml) {
    writeFileSync(join(root, 'dist/index.html'), page);
    failed(run(root, 'pack'), /urk export --base/);
    clean(root);
  }
  rmSync(join(root, 'dist/index.html'));
  failed(run(root, 'pack'), /exported index\.html/);
  writeFileSync(join(root, 'dist/index.html'), html);
  writeFileSync(join(root, 'dist/urk.json'), '{}');
  failed(run(root, 'pack'), /reserved/);
  rmSync(join(root, 'dist/urk.json'));
  symlinkSync(join(root, 'dist/content.json'), join(root, 'dist/linked.json'));
  failed(run(root, 'pack'), /regular files/);
  clean(root);
});

test('unsafe destinations and invalid CLI options fail before replacing files', t => {
  const root = fixture(t);
  passed(run(root, 'pack'));
  symlinkSync(join(root, 'dist'), join(root, 'linked'), 'dir');
  failed(run(root, 'pack', '--out', 'dist/nested.urkpkg'), /outside the input/);
  failed(run(root, 'pack', '--out', 'linked/site.urkpkg'), /symlink/);
  failed(run(root, 'unpack', 'dist.urkpkg', '--out-dir', 'linked/site'), /symlink/);
  failed(run(root, 'unpack', 'dist.urkpkg', '--out-dir', '.'), /contain the source archive/);
  for (const args of [
    ['pack', '--bogus'], ['pack', '--name'], ['pack', '--out', 'bad.zip'], ['pack', 'dist', 'extra'],
    ['pack', '--type', 'Bad type'], ['pack', '--version='], ['pack', '--out=a.urkpkg', '--out=b.urkpkg'],
    ['unpack'], ['unpack', 'missing.zip'], ['unpack', 'dist.urkpkg', '--overwrite'], ['inspect', 'dist.urkpkg', 'extra'],
  ]) assert.equal(run(root, ...args).status, 1, String(args));
  clean(root);
});

test('manifest schema and required files reject incomplete or unsupported packages', async t => {
  const root = fixture(t);
  for (const value of [
    null, {}, { ...manifest, formatVersion: 2 }, { ...manifest, formatVersion: '1' },
    { ...manifest, name: '' }, { ...manifest, version: 3 }, { ...manifest, type: 'bad type' },
    { ...manifest, entrypoint: '../index.html' }, { ...manifest, name: 'x'.repeat(129) },
  ]) {
    const path = await archive(root, [], value);
    await assert.rejects(inspectPackage(path), /urk\.json|Manifest|formatVersion|entrypoint/);
  }
  const path = await archive(root);
  const bytes = readFileSync(path);
  writeFileSync(path, Buffer.from(bytes.toString('latin1').replaceAll('index.html', 'other.html'), 'latin1'));
  await assert.rejects(inspectPackage(path), /requires regular urk\.json and index\.html/);
});

test('ZIP traversal, Windows names, links, and colliding paths cannot escape extraction', async t => {
  const root = fixture(t);
  for (const name of ['../escaped.txt', '/absolute.txt', 'C:/drive.txt', '..\\escaped.txt', 'a\\file', 'CON', 'a/file.', 'a//file', 'a/./file', 'nul.txt']) {
    const path = await archive(root, [[name, 'unsafe']]);
    await assert.rejects(unpackPackage(path, join(root, 'site')), /filename|Unsafe package path/i, name);
    assert.ok(!readdirSync(root).includes('site'));
    clean(root);
  }
  for (const records of [
    [['link', '/tmp', { unixMode: 0o120777 }]],
    [['pipe', '', { unixMode: 0o010644 }]],
    [['INDEX.HTML', 'collision']],
    [['a', 'file'], ['a/b', 'child']],
    [['A/x', 'one'], ['a/y', 'two']],
    [['caf\u00e9', 'one'], ['cafe\u0301', 'two']],
  ]) {
    const path = await archive(root, records);
    await assert.rejects(unpackPackage(path, join(root, 'site')), /Links|special|conflicting|Duplicate/);
    clean(root);
  }
  const duplicate = await archive(root, [['other.html', 'same path']]);
  const bytes = readFileSync(duplicate);
  writeFileSync(duplicate, Buffer.from(bytes.toString('latin1').replaceAll('other.html', 'index.html'), 'latin1'));
  await assert.rejects(inspectPackage(duplicate), /ambiguous|duplicate/i);
});

test('CRC errors, truncation, encryption, and unsupported compression fail cleanly', async t => {
  const root = fixture(t);
  let path = await archive(root);
  let bytes = readFileSync(path);
  const title = bytes.indexOf('Fixture title');
  assert.ok(title > 0);
  bytes[title] ^= 1;
  writeFileSync(path, bytes);
  await assert.rejects(unpackPackage(path, join(root, 'site')), /CRC|signature/i);
  assert.ok(!readdirSync(root).includes('site'));
  clean(root);
  path = await archive(root);
  bytes = readFileSync(path);
  writeFileSync(path, bytes.subarray(0, bytes.length - 10));
  await assert.rejects(inspectPackage(path), /Invalid \.urkpkg/);
  path = await archive(root, [['encrypted.txt', 'secret', { password: 'secret' }]]);
  await assert.rejects(inspectPackage(path), /Encrypted/);
  path = await archive(root);
  changeHeader(path, 'index.html', 'method', 99);
  await assert.rejects(inspectPackage(path), /Unsupported ZIP/);
});

test('declared and streamed size limits reject oversized or misleading archives', async t => {
  const root = fixture(t);
  let path = await archive(root);
  truncateSync(path, PACKAGE_LIMITS.archive + 1);
  await assert.rejects(inspectPackage(path), /Archive exceeds/);
  path = await archive(root);
  changeHeader(path, 'urk.json', 'size', PACKAGE_LIMITS.manifest + 1);
  await assert.rejects(inspectPackage(path), /urk\.json exceeds/);
  path = await archive(root);
  changeHeader(path, 'index.html', 'size', PACKAGE_LIMITS.file + 1);
  await assert.rejects(inspectPackage(path), /index\.html exceeds/);
  path = await archive(root, [['a', 'a'], ['b', 'b'], ['c', 'c'], ['d', 'd']]);
  for (const name of ['a', 'b', 'c', 'd']) changeHeader(path, name, 'size', PACKAGE_LIMITS.file);
  await assert.rejects(inspectPackage(path), /Expanded package exceeds/);
  path = await archive(root, [['bomb.txt', 'x'.repeat(1024 * 1024), { level: 9 }]]);
  changeHeader(path, 'bomb.txt', 'size', 1);
  await assert.rejects(unpackPackage(path, join(root, 'site')), /Streamed data|size/i);
  assert.ok(!readdirSync(root).includes('site'));
  clean(root);
  path = await archive(root, Array.from({ length: PACKAGE_LIMITS.entries - 1 }, (_, index) => [`files/${index}`, '']));
  await assert.rejects(inspectPackage(path), /entry limit/);
});
