/**
 * Company: EonHive Inc.
 * Title: Packed Adapter Export Tests
 * Purpose: Verify isolated DOM imports without Three.js and preserve the root/Three peer boundary.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-18
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
    config.files = ['dom.ts', 'motion.ts'];
    writeFileSync(join(fixture, 'tsconfig.json'), JSON.stringify(config));
    cpSync(new URL('./types/dom.ts', import.meta.url), join(fixture, 'dom.ts'));
    cpSync(new URL('./types/motion.ts', import.meta.url), join(fixture, 'motion.ts'));
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
    ['motion', 'Motion'],
    ['video', 'Video'], ['audio', 'Audio'], ['input', 'Input'], ['loading', 'Loading'], ['pointer', 'Pointer'],
    ['storage', 'Storage'], ['ui-widgets', 'UiWidgets'], ['ui-overlay', 'UiOverlay'],
  ]) {
    const leaf = await import('@urk/adapters/' + path);
    const capability = leaf[name + 'Capability'];
    assert.equal(leaf['create' + name + 'Adapter']().token, capability);
    if (path !== 'audio' && path !== 'video') assert.equal(dom[name + 'Capability'], capability);
  }
  const mixer = await import('@urk/adapters/audio/mixer');
  assert.equal(mixer.createAudioMixerAdapter({ channels: [{ id: 'bed', group: 'music' }] }).token, mixer.AudioMixerCapability);
  const overlay = await import('@urk/adapters/ui-overlay');
  const widgets = await import('@urk/adapters/ui-widgets');
  assert.equal(overlay.createUiOverlayAdapter, widgets.createUiWidgetsAdapter);
  assert.equal(overlay.UiOverlayCapability, widgets.UiWidgetsCapability);
} finally {
  for (const [name, descriptor] of original) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
// Exercise numeric playback from the archives without DOM or rendering peers.
const { createKernel, ManualFrameScheduler, ResourceScope } = await import('@urk/core');
const motionExports = await import('@urk/adapters/motion');
const { createMotionAdapter, createMotionController, MotionCapability, fade, slide, scale, stagger } = motionExports;
for (const name of ['createMotionController', 'createDomMotionBinding', 'fade', 'slide', 'scale', 'stagger']) {
  assert.equal(typeof motionExports[name], 'function');
  assert.equal((await import('@urk/adapters/dom'))[name], motionExports[name]);
}
assert.equal(createMotionController().update, undefined);
const scheduler = new ManualFrameScheduler();
const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()], controllers: [createMotionController()] });
const scope = new ResourceScope();
try {
  await kernel.boot();
  const api = kernel.getContext().require(MotionCapability);
  api.setReducedMotion(false);
  assert.equal(scheduler.isRunning(), false);
  const group = api.scoped(scope);
  let value;
  const tween = group.tween({ from: 0, to: 100, durationMs: 100, onUpdate(next) { value = next; } });
  scheduler.step(0);
  scheduler.step(50);
  assert.equal(value, 50);
  kernel.pause();
  scheduler.step(500);
  assert.equal(value, 50);
  kernel.resume();
  scheduler.step(1000);
  scheduler.step(1050);
  assert.equal(value, 100);
  assert.equal((await tween.finished).status, 'completed');
  assert.equal(scheduler.isRunning(), false);
  const target = { x: 0 };
  const legacy = group.tween(target, { x: 1 }, { durationMs: 100 });
  legacy.finish();
  assert.equal(target.x, 1);
  assert.equal((await legacy.finished).status, 'completed');
  const sequence = group.timeline({ tweens: stagger([
    fade({ durationMs: 100, onUpdate() {} }),
    slide({ durationMs: 100, onUpdate() {} }),
    scale({ durationMs: 100, onUpdate() {} }),
  ], 50) });
  sequence.pause();
  sequence.seek(75);
  group.setPlaybackRate(2);
  assert.equal(sequence.currentTimeMs, 75);
  assert.equal(sequence.status, 'paused');
  sequence.finish();
  assert.equal((await sequence.finished).status, 'completed');
  const pending = group.tween({ from: 0, to: 1, durationMs: 100, onUpdate() {} });
  await kernel.shutdown();
  assert.equal((await pending.finished).status, 'cancelled');
  assert.equal(api.activeCount, 0);
  assert.equal(scheduler.isRunning(), false);
} finally {
  await kernel.shutdown();
  await scope.dispose();
}
// The legacy root and Three entrypoints intentionally retain their Three peer requirement.
for (const path of ['@urk/adapters', '@urk/adapters/three', '@urk/adapters/three/video']) {
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
import { createVideoTexture } from '@urk/adapters/three/video';
assert.equal(typeof createVideoTexture, 'function');
import * as dom from '@urk/adapters/dom';
assert.equal(root.ThreeCapability, three.ThreeCapability);
assert.equal(root.createThreeAdapter, three.createThreeAdapter);
assert.equal(root.PointerCapability, dom.PointerCapability);
assert.equal(three.createThreeAdapter().token, three.ThreeCapability);
assert.equal(typeof document, 'undefined');
assert.equal(typeof window, 'undefined');
`);
    execFileSync(process.execPath, ['three-runtime.mjs'], { cwd: fixture, encoding: 'utf8' });
    t.diagnostic(`${core.entryCount} core and ${adapters.entryCount} adapter packed files; strict DOM/motion types, inert imports, and numeric playback pass without Three.js; root/Three imports pass with the existing peer`);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
