/**
 * Company: EonHive Inc.
 * Title: Packed Capability Contract Tests
 * Purpose: Verify public declarations and token identity with two isolated installed core copies.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL('../../../', import.meta.url));

test('packed core resolves token types and shared identities across independent installed copies', (t) => {
  const fixture = mkdtempSync(join(tmpdir(), 'urk-capabilities-package-'));
  try {
    const packed = JSON.parse(execFileSync('npm', [
      'pack', '--workspace', '@urk/core', '--pack-destination', fixture, '--json',
    ], { cwd: repo, encoding: 'utf8' }))[0];
    const packagePath = join(fixture, 'node_modules/@urk/core');
    mkdirSync(packagePath, { recursive: true });
    execFileSync('tar', [
      '-xzf', join(fixture, packed.filename), '-C', packagePath, '--strip-components=1',
    ]);
    cpSync(packagePath, join(fixture, 'node_modules/@urk/core-copy'), { recursive: true });
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    cpSync(new URL('./types/tsconfig.json', import.meta.url), join(fixture, 'tsconfig.json'));

    const types = readFileSync(new URL('./types/capabilities.ts', import.meta.url), 'utf8');
    writeFileSync(join(fixture, 'capabilities.ts'), `${types}
import { token as independentToken } from '@urk/core-copy';
const IndependentAudio = independentToken<AudioApi>('audio');
const independentApi: AudioApi = registry.require(IndependentAudio);
void independentApi;
`);
    execFileSync(process.execPath, [
      require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json',
    ], { cwd: fixture, encoding: 'utf8' });

    const header = types.slice(0, types.indexOf('*/') + 2);
    writeFileSync(join(fixture, 'runtime.mjs'), `${header}
import assert from 'node:assert/strict';
import { AdapterRegistry, token } from '@urk/core';
import { AdapterRegistry as IndependentRegistry, token as independentToken } from '@urk/core-copy';
const original = token('canonical-contract');
const independent = independentToken('canonical-contract');
const api = { value: 1 };
for (const registry of [new AdapterRegistry(), new IndependentRegistry()]) {
  const ctx = { id: 'packed', adapters: registry, signal: new AbortController().signal };
  await registry.register({ id: 'provider', capability: 'legacy-api', token: original, setup: () => api }, ctx);
  assert.equal(registry.require(original), api);
  assert.equal(registry.require('legacy-api'), api);
  assert.equal(registry.get(independent), undefined);
  await registry.disposeAll(ctx);
  assert.equal(registry.get(original), undefined);
  await assert.rejects(registry.register({ id: 'late', capability: 'late', token: original, setup: () => api }, ctx));
}
const localRegistry = new AdapterRegistry();
const ctx = { id: 'foreign-token', adapters: localRegistry, signal: new AbortController().signal };
await localRegistry.register({ id: 'foreign', capability: 'foreign-api', token: independent, setup: () => api }, ctx);
assert.equal(localRegistry.require(independent), api);
assert.equal(localRegistry.get(original), undefined);
await localRegistry.disposeAll(ctx);
`);
    execFileSync(process.execPath, ['runtime.mjs'], { cwd: fixture, encoding: 'utf8' });
    const metadata = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf8'));
    assert.deepEqual(metadata.dependencies ?? {}, {});
    t.diagnostic(`${packed.entryCount} packed files; public types and independent runtime identities pass without React or Three.js`);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
