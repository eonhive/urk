/**
 * Company: EonHive Inc.
 * Title: Framework Package Compatibility Tests
 * Purpose: Verify packed wrapper exports, shared context, types, and inert SSR.
 * Author: Stan Nesi
 * Created: 2026-10-12
 * Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const header = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0] + '*/\n';

test('packed old and new wrapper names share exports, context, ownership, and strict declarations', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'urk-wrapper-compat-'));
  try {
    for (const name of ['@urk/core', '@urk/react', '@urk/next', '@urk/react-urk', '@urk/next-urk']) {
      const [packed] = JSON.parse(execFileSync('npm', [
        'pack', '--workspace', name, '--ignore-scripts', '--pack-destination', fixture, '--json',
      ], { cwd: repo, encoding: 'utf8' }));
      const destination = join(fixture, 'node_modules', name);
      mkdirSync(destination, { recursive: true });
      execFileSync('tar', ['-xzf', join(fixture, packed.filename), '-C', destination, '--strip-components=1']);
      assert.ok(packed.files.some(file => file.path === 'dist/index.d.ts'));
      assert.ok(!packed.files.some(file => file.path.startsWith('src/')));
    }
    for (const name of ['react', 'react-dom', '@types/react', '@types/prop-types', 'csstype']) {
      cpSync(dirname(require.resolve(`${name}/package.json`)), join(fixture, 'node_modules', name), { recursive: true });
    }
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    const manifest = JSON.parse(readFileSync(join(fixture, 'node_modules/@urk/next/package.json'), 'utf8'));
    assert.equal(manifest.dependencies['@urk/react'], '^0.2.0');
    for (const name of ['next', 'next-urk']) {
      assert.match(readFileSync(join(fixture, `node_modules/@urk/${name}/dist/index.js`), 'utf8'), /['"]use client['"]/);
    }
    writeFileSync(join(fixture, 'runtime.mjs'), `${header}
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import * as react from '@urk/react';
import * as legacyReact from '@urk/react-urk';
import * as next from '@urk/next';
import * as legacyNext from '@urk/next-urk';

for (const [canonical, legacy] of [[react, legacyReact], [next, legacyNext]]) {
  assert.deepEqual(Object.keys(legacy), Object.keys(canonical));
  for (const key of Object.keys(canonical)) assert.equal(legacy[key], canonical[key]);
}
for (const key of Object.keys(react)) assert.equal(next[key], react[key]);

for (const provider of [react, legacyReact, next, legacyNext]) {
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [{ id: 'inert', setup() { throw new Error('SSR must not boot'); } }],
  });
  function Consumer() {
    for (const hooks of [react, legacyReact, next, legacyNext]) {
      assert.equal(hooks.useKernel(), kernel);
      assert.equal(hooks.useLifecycleSnapshot().state, 'created');
      assert.equal(hooks.useRuntimePhase(), 'boot');
    }
    return createElement('span', null, 'shared');
  }
  const html = renderToString(createElement(
    provider.UrkNextProvider ?? provider.UrkProvider,
    { kernel, createKernel: () => kernel, ownership: 'provider' },
    createElement(Consumer),
  ));
  assert.equal(html, '<span>shared</span>');
  assert.equal(kernel.getContext().scheduler.isRunning(), false);
  assert.equal(kernel.getContext().signal.aborted, false);
  await kernel.shutdown();
}
`);
    execFileSync(process.execPath, ['runtime.mjs'], { cwd: fixture, encoding: 'utf8' });
    writeFileSync(join(fixture, 'types.ts'), `${header}
import { UrkProvider, type UrkProviderProps, type KernelOwnership } from '@urk/react';
import { UrkProvider as LegacyProvider, type UrkProviderProps as LegacyProps } from '@urk/react-urk';
import { UrkNextProvider, useClientKernel, type UrkNextProviderProps } from '@urk/next';
import { UrkNextProvider as LegacyNext, type KernelFactory, type UrkNextProviderProps as LegacyNextProps } from '@urk/next-urk';
const provider: typeof UrkProvider = LegacyProvider;
const nextProvider: typeof UrkNextProvider = LegacyNext;
declare const legacyProps: LegacyProps;
declare const legacyNextProps: LegacyNextProps;
declare const factory: KernelFactory;
const props: UrkProviderProps = legacyProps;
const nextProps: UrkNextProviderProps = legacyNextProps;
const ownership: KernelOwnership = 'provider';
void [provider, nextProvider, props, nextProps, ownership, useClientKernel(factory)];
`);
    writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'NodeNext', moduleResolution: 'NodeNext',
        strict: true, skipLibCheck: false, noEmit: true, types: ['react'] },
      files: ['types.ts'],
    }));
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'], {
      cwd: fixture, encoding: 'utf8',
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
