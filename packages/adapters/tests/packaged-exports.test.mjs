/**
 * Company: EonHive Inc.
 * Title: Packed Adapter Export Tests
 * Purpose: Verify isolated DOM imports without Three.js and preserve the root/Three peer boundary.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL('../../../', import.meta.url));

function packIntoFixture(name, fixture) {
  const packed = JSON.parse(execFileSync('npm', [
    'pack', '--workspace', name, '--pack-destination', fixture, '--json',
  ], { cwd: repo, encoding: 'utf8' }))[0];
  const packagePath = join(fixture, 'node_modules', name);
  mkdirSync(packagePath, { recursive: true });
  execFileSync('tar', ['-xzf', join(fixture, packed.filename), '-C', packagePath, '--strip-components=1']);
  return packed;
}

test('packed DOM and independent adapters resolve strict types and runtime without Three.js', (t) => {
  const fixture = mkdtempSync(join(tmpdir(), 'urk-adapter-exports-'));
  try {
    const core = packIntoFixture('@urk/core', fixture);
    const adapters = packIntoFixture('@urk/adapters', fixture);
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    const config = JSON.parse(readFileSync(new URL('./types/tsconfig.json', import.meta.url), 'utf8'));
    config.files = ['dom.ts'];
    writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify(config));
    cpSync(new URL('./types/dom.ts', import.meta.url), join(fixture, 'dom.ts'));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'], {
      cwd: fixture, encoding: 'utf8',
    });

    const types = readFileSync(new URL('./types/dom.ts', import.meta.url), 'utf8');
    const header = types.slice(0, types.indexOf('*/') + 2);
    writeFileSync(join(fixture, 'runtime.mjs'), `${header}
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
assert.throws(() => require.resolve('three'), { code: 'MODULE_NOT_FOUND' });
assert.throws(() => require.resolve('@types/three/package.json'), { code: 'MODULE_NOT_FOUND' });
const names = ['window', 'document', 'Audio', 'HTMLElement', 'requestAnimationFrame', 'setTimeout', 'setInterval'];
const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
try {
  for (const name of names) {
    Object.defineProperty(globalThis, name, { configurable: true,
      get() { throw new Error('Import or factory acquired ' + name); },
    });
  }
  const dom = await import('@urk/adapters/dom');
  for (const [path, name] of [
    ['audio', 'Audio'], ['input', 'Input'], ['loading', 'Loading'], ['pointer', 'Pointer'],
    ['storage', 'Storage'], ['ui-widgets', 'UiWidgets'],
  ]) {
    const leaf = await import('@urk/adapters/' + path);
    const capability = leaf[name + 'Capability'];
    assert.equal(leaf['create' + name + 'Adapter']().token, capability);
    if (path !== 'audio') assert.equal(dom[name + 'Capability'], capability);
  }
} finally {
  for (const [name, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
// The legacy root and Three entrypoints intentionally retain their Three peer requirement.
for (const path of ['@urk/adapters', '@urk/adapters/three']) {
  await assert.rejects(import(path), error => error.code === 'ERR_MODULE_NOT_FOUND' && /package 'three'/.test(error.message));
}
`);
    execFileSync(process.execPath, ['runtime.mjs'], { cwd: fixture, encoding: 'utf8' });
    assert.equal(existsSync(join(fixture, 'node_modules/three')), false);
    assert.equal(existsSync(join(fixture, 'node_modules/@types/three')), false);
    const metadata = JSON.parse(readFileSync(join(fixture, 'node_modules/@urk/adapters/package.json'), 'utf8'));
    assert.equal(metadata.peerDependencies['@urk/core'], '^0.2.0');
    assert.equal(metadata.peerDependenciesMeta.three.optional, true);
    assert.deepEqual(metadata.dependencies ?? {}, {});

    // Use the already installed peer in a fresh process; no network install is needed.
    const threePath = dirname(dirname(require.resolve('three')));
    assert.equal(JSON.parse(readFileSync(join(threePath, 'package.json'), 'utf8')).name, 'three');
    cpSync(threePath, join(fixture, 'node_modules/three'), { recursive: true });
    writeFileSync(join(fixture, 'three-runtime.mjs'), `${header}
import assert from 'node:assert/strict';
import * as root from '@urk/adapters';
import * as three from '@urk/adapters/three';
import * as dom from '@urk/adapters/dom';
assert.equal(root.ThreeCapability, three.ThreeCapability);
assert.equal(root.createThreeAdapter, three.createThreeAdapter);
assert.equal(root.PointerCapability, dom.PointerCapability);
assert.equal(three.createThreeAdapter().token, three.ThreeCapability);
assert.equal(typeof document, 'undefined');
assert.equal(typeof window, 'undefined');
`);
    execFileSync(process.execPath, ['three-runtime.mjs'], { cwd: fixture, encoding: 'utf8' });
    t.diagnostic(`${core.entryCount} core and ${adapters.entryCount} adapter packed files; strict DOM-only types and inert imports pass without Three.js, root/Three imports pass with the existing peer`);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
