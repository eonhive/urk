/**
 * Company: EonHive Inc. | Title: Static Embed Command Tests
 * Purpose: Verify generated hosts, option validation, safe output, and installed-package resolution.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cliRoot = fileURLToPath(new URL('../', import.meta.url));
const cli = join(cliRoot, 'dist/index.js');
const player = fileURLToPath(import.meta.resolve('@urk/player'));
const source = 'https://experiences.example.invalid/demo/index.html';

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'urk-embed-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(root, args, entry = cli) {
  const result = spawnSync(process.execPath, [entry, 'embed', ...args], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  return { ...result, log: result.stdout + result.stderr };
}

function clean(root) {
  assert.deepEqual(readdirSync(root).filter(name => name.startsWith('.urk-embed-')), []);
}

test('generates a relocatable static host with the existing compiled Player and no URL fetch', t => {
  const root = fixture(t);
  const result = run(root, [source]);
  assert.equal(result.status, 0, result.log);
  assert.deepEqual(readdirSync(join(root, 'embed')).sort(), ['HOSTING.txt', 'index.html', 'plain-iframe.html', 'urk-player.js']);
  assert.deepEqual(readFileSync(join(root, 'embed/urk-player.js')), readFileSync(player));
  const html = readFileSync(join(root, 'embed/index.html'), 'utf8');
  assert.match(html, /src="\.\/urk-player\.js"/);
  assert.match(html, /<urk-player id="experience" title="uRK experience"/);
  assert.match(html, /height: 70vh/);
  assert.doesNotMatch(html, / fullscreen| check-src/);
  const plain = readFileSync(join(root, 'embed/plain-iframe.html'), 'utf8');
  assert.match(plain, /<iframe title=/);
  assert.match(plain, /sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"/);
  assert.doesNotMatch(plain, /<script|<urk-player|allowfullscreen/);
  assert.match(readFileSync(join(root, 'embed/HOSTING.txt'), 'utf8'), /DIFFERENT origin/);
  clean(root);
});

test('configures and escapes title, URL, height, fullscreen, and optional URL checking', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'site'));
  const title = '</title><script>alert("x")</script> & proof';
  const url = `${source}?first=1&second=%22hello%22#scene`;
  const result = run(root, [url, '--out-dir=site', '--title', title, '--height', '640px', '--fullscreen', '--check-src']);
  assert.equal(result.status, 0, result.log);
  const html = readFileSync(join(root, 'site/index.html'), 'utf8');
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; proof/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /first=1&amp;second=%22hello%22#scene/);
  assert.match(html, /height: 640px/);
  assert.match(html, / fullscreen check-src>/);
  assert.match(readFileSync(join(root, 'site/plain-iframe.html'), 'utf8'), /allowfullscreen/);
  clean(root);
});

test('rejects invalid arguments and URLs without creating output', t => {
  const root = fixture(t);
  for (const args of [
    [], ['/games/demo/'], ['file:///tmp/game.html'], ['javascript:alert(1)'],
    ['https://user:secret@example.com/'], ['https://example.com/game.urkpkg'],
    [source, 'extra'], [source, '--unknown'], [source, '--fullscreen=false'],
    [source, '--out-dir'], [source, '--out-dir='], [source, '--title', ' '],
    [source, '--title', 'x'.repeat(201)], [source, '--title', 'bad\ntitle'],
    [source, '--height', '100%;color:red'], [source, '--height', '-1px'],
    [source, '--height', '0px'], [source, '--height', 'auto'], [source, '--height', '100%'],
  ]) {
    const result = run(root, args);
    assert.equal(result.status, 1, `${args}: ${result.log}`);
    assert.deepEqual(readdirSync(root), []);
  }
  assert.equal(run(root, ['--help']).status, 0);
});

test('refuses unsafe or occupied destinations and preserves existing files', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'site'));
  writeFileSync(join(root, 'site/keep.txt'), 'Existing work');
  writeFileSync(join(root, 'file'), 'Existing file');
  symlinkSync(join(root, 'site'), join(root, 'linked'), 'dir');
  for (const output of ['.', '..', 'site', 'file', 'linked', 'linked/child', '.git/output', 'node_modules/embed']) {
    const result = run(root, [source, '--out-dir', output]);
    assert.equal(result.status, 1, `${output}: ${result.log}`);
    clean(root);
  }
  assert.equal(readFileSync(join(root, 'site/keep.txt'), 'utf8'), 'Existing work');
  assert.equal(readFileSync(join(root, 'file'), 'utf8'), 'Existing file');
});

test('resolves the Player from a relocated installed CLI and reports a missing build cleanly', t => {
  const root = fixture(t);
  const installed = join(root, 'node_modules/@urk/cli');
  const installedPlayer = join(root, 'node_modules/@urk/player');
  cpSync(join(cliRoot, 'dist'), join(installed, 'dist'), { recursive: true });
  cpSync(join(cliRoot, 'package.json'), join(installed, 'package.json'));
  cpSync(dirname(player), join(installedPlayer, 'dist'), { recursive: true });
  cpSync(join(dirname(player), '../package.json'), join(installedPlayer, 'package.json'));
  const entry = join(installed, 'dist/index.js');
  assert.equal(run(root, [source], entry).status, 0);
  assert.deepEqual(readFileSync(join(root, 'embed/urk-player.js')), readFileSync(player));
  rmSync(join(installedPlayer, 'dist'), { recursive: true });
  const failed = run(root, [source, '--out-dir', 'missing-build'], entry);
  assert.equal(failed.status, 1, failed.log);
  assert.match(failed.log, /compiled @urk\/player module is missing/);
  assert.ok(!readdirSync(root).includes('missing-build'));
  clean(root);
});
