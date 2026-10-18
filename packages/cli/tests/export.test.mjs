/**
 * Company: EonHive Inc. | Title: Web Export Regression Tests
 * Purpose: Check portable assets, project configuration, and safe publication through the real CLI.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const header = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0] + '*/\n';

function run(root, args = []) {
  const result = spawnSync(process.execPath, [cli, 'export', ...args], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  return { ...result, log: result.stdout + result.stderr };
}

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'urk-export-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'public'));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>Before plugin</title><script type="module" src="./main.js"></script>');
  writeFileSync(join(root, 'main.js'), `${header}
import { message } from '@message';
import image from './marker.svg';
import './main.css';
document.body.innerHTML = message + '<img src="' + image + '">';
fetch(import.meta.env.BASE_URL + 'content.json');
`);
  writeFileSync(join(root, 'message.js'), `${header}export const message = 'Bundled experience';`);
  writeFileSync(join(root, 'main.css'), `${header}body { color: rgb(10, 20, 30); background-image: url('./marker.svg'); }`);
  writeFileSync(join(root, 'marker.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>');
  writeFileSync(join(root, 'public/content.json'), '{"message":"Portable public content"}');
  writeFileSync(join(root, 'vite.config.mjs'), `${header}
import { fileURLToPath } from 'node:url';
export default {
  resolve: { alias: { '@message': fileURLToPath(new URL('./message.js', import.meta.url)) } },
  plugins: [{ name: 'existing-plugin', transformIndexHtml: html => html.replace('Before plugin', 'Existing plugin ran') }],
  build: { assetsInlineLimit: 0 },
};
`);
  return root;
}

function noTemporaryOutput(root) {
  assert.deepEqual(readdirSync(root).filter(name => name.startsWith('.urk-export-')), []);
}

test('exports relative HTML, CSS, imported assets, public files, and existing plugins/aliases', t => {
  const root = fixture(t);
  const result = run(root);
  assert.equal(result.status, 0, result.log);
  const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
  assert.match(html, /Existing plugin ran/);
  assert.match(html, /src="\.\/assets\/.+\.js"/);
  assert.match(html, /href="\.\/assets\/.+\.css"/);
  assert.doesNotMatch(html, /main\.js|@vite/);
  const assets = readdirSync(join(root, 'dist/assets'));
  assert.ok(assets.some(name => name.endsWith('.svg')));
  const code = readFileSync(join(root, 'dist/assets', assets.find(name => name.endsWith('.js'))), 'utf8');
  assert.match(code, /Bundled experience/);
  assert.doesNotMatch(code, /@message/);
  assert.equal(readFileSync(join(root, 'dist/content.json'), 'utf8'), readFileSync(join(root, 'public/content.json'), 'utf8'));
  noTemporaryOutput(root);
});

test('supports an explicit project, project-relative output, and fixed hosting base', t => {
  const root = fixture(t);
  const result = run(realpathSync(tmpdir()), [root, '--out-dir=release', '--base', '/games/proof/']);
  assert.equal(result.status, 0, result.log);
  const html = readFileSync(join(root, 'release/index.html'), 'utf8');
  assert.match(html, /src="\/games\/proof\/assets\//);
  const assets = readdirSync(join(root, 'release/assets'));
  const code = readFileSync(join(root, 'release/assets', assets.find(name => name.endsWith('.js'))), 'utf8');
  assert.match(code, /\/games\/proof\/content\.json/);
  noTemporaryOutput(root);
});

test('requires overwrite, preserves old output on build failure, and replaces it on success', t => {
  const root = fixture(t);
  assert.equal(run(root).status, 0);
  const original = readFileSync(join(root, 'dist/index.html'), 'utf8');
  writeFileSync(join(root, 'dist/old.txt'), 'Old output');
  const refused = run(root);
  assert.equal(refused.status, 1);
  assert.match(refused.log, /--overwrite/);
  const main = readFileSync(join(root, 'main.js'), 'utf8');
  writeFileSync(join(root, 'main.js'), `${header}import './missing.js';`);
  const failed = run(root, ['--overwrite']);
  assert.equal(failed.status, 1);
  assert.match(failed.log, /missing\.js/);
  assert.equal(readFileSync(join(root, 'dist/index.html'), 'utf8'), original);
  assert.equal(readFileSync(join(root, 'dist/old.txt'), 'utf8'), 'Old output');
  noTemporaryOutput(root);
  writeFileSync(join(root, 'main.js'), main);
  const replaced = run(root, ['--overwrite']);
  assert.equal(replaced.status, 0, replaced.log);
  assert.ok(!readdirSync(join(root, 'dist')).includes('old.txt'));
  noTemporaryOutput(root);
});

test('keeps configured Rollup output directories outside the export transaction untouched', t => {
  const root = fixture(t);
  const configured = join(root, 'original-output');
  mkdirSync(configured);
  writeFileSync(join(configured, 'keep.txt'), 'Existing build');
  const configPath = join(root, 'vite.config.mjs');
  const original = readFileSync(configPath, 'utf8');
  for (const output of [{ dir: configured }, [{ dir: configured }]]) {
    writeFileSync(configPath, original.replace('assetsInlineLimit: 0', `assetsInlineLimit: 0, rollupOptions: { output: ${JSON.stringify(output)} }`));
    const result = run(root, ['--overwrite']);
    assert.equal(result.status, 0, result.log);
    assert.match(readFileSync(join(root, 'dist/index.html'), 'utf8'), /Existing plugin ran/);
    assert.deepEqual(readdirSync(configured), ['keep.txt']);
    assert.equal(readFileSync(join(configured, 'keep.txt'), 'utf8'), 'Existing build');
    noTemporaryOutput(root);
  }
});

test('rejects unsafe output paths, symlinks, and imported source directories', t => {
  const root = fixture(t);
  for (const path of ['.', '..', 'src/output', 'public', 'node_modules/output', '.git/output']) {
    const result = run(root, ['--out-dir', path, '--overwrite']);
    assert.equal(result.status, 1, path);
    assert.match(result.log, /output must not/i);
  }
  mkdirSync(join(root, 'actual'));
  symlinkSync(join(root, 'actual'), join(root, 'linked'), 'dir');
  for (const path of ['linked', 'linked/output']) {
    const result = run(root, ['--out-dir', path, '--overwrite']);
    assert.equal(result.status, 1);
    assert.match(result.log, /symlink/);
  }
  mkdirSync(join(root, 'code'));
  writeFileSync(join(root, 'code/source.js'), `${header}document.body.textContent = 'Source';`);
  writeFileSync(join(root, 'main.js'), `${header}import './code/source.js';`);
  const source = run(root, ['--out-dir', 'code', '--overwrite']);
  assert.equal(source.status, 1, source.log);
  assert.match(source.log, /contains a build input/);
  assert.match(readFileSync(join(root, 'code/source.js'), 'utf8'), /Source/);
  noTemporaryOutput(root);
});

test('rejects server/library builds, external modules, and missing emitted index', t => {
  const root = fixture(t);
  const cases = [
    ["{ build: { ssr: 'main.js' } }", /SSR and library/],
    ["{ build: { lib: { entry: 'main.js', formats: ['es'] } } }", /SSR and library/],
    ["{ build: { rollupOptions: { external: ['@message'] } } }", /external module dependency: @message/],
    ["{ build: { rollupOptions: { input: 'message.js' } } }", /did not emit index\.html/],
    ["{ publicDir: 'release' }", /overlap the configured public/],
    ["{ build: { rollupOptions: { output: { format: 'cjs' } } } }", /ES module browser output/],
  ];
  for (const [config, message] of cases) {
    writeFileSync(join(root, 'vite.config.mjs'), `${header}export default ${config};`);
    const result = run(root, ['--out-dir', 'release']);
    assert.equal(result.status, 1, result.log);
    assert.match(result.log, message);
    noTemporaryOutput(root);
  }
});

test('reports invalid arguments and missing entrypoints, and documents the command', t => {
  const root = fixture(t);
  for (const args of [['--bogus'], ['--base'], ['--out-dir='], ['.', 'another']]) {
    assert.equal(run(root, args).status, 1, String(args));
  }
  rmSync(join(root, 'index.html'));
  const missing = run(root);
  assert.equal(missing.status, 1);
  assert.match(missing.log, /requires index\.html/);
  const help = run(root, ['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--overwrite/);
  noTemporaryOutput(root);
});

test('new projects expose export through the installed CLI without changing build/dev', t => {
  const root = fixture(t);
  const result = spawnSync(process.execPath, [cli, 'create', 'starter'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const manifest = JSON.parse(readFileSync(join(root, 'starter/package.json'), 'utf8'));
  assert.equal(manifest.scripts.export, 'urk export');
  assert.equal(manifest.scripts.build, 'tsc --noEmit && vite build');
  assert.equal(manifest.scripts.dev, 'vite');
  assert.equal(manifest.devDependencies['@urk/cli'], '^0.2.0');
});
