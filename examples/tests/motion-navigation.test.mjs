/**
 * Company: EonHive Inc. | Title: Experience Navigation Contracts
 * Purpose: Verify latest-request navigation, cancellation, paused commands, and disposal.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import { createMotionAdapter, createMotionController, MotionCapability } from '@urk/adapters/motion';

// Exercise the same application helper used by the browser without a DOM binding.
const source = readFileSync(new URL('../motion-lab/navigation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { createViewNavigation } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

async function fixture(t) {
  const scheduler = new ManualFrameScheduler();
  let navigation;
  let shown;
  const activated = [];
  const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()], controllers: [
    createMotionController(), {
      id: 'navigation', start(ctx) {
        const api = ctx.require(MotionCapability);
        api.setReducedMotion(false);
        const segment = () => ({ tweens: [{ from: 0, to: 1, durationMs: 100, onUpdate() {} }] });
        navigation = createViewNavigation(ctx, api.scoped(ctx.scope), 'explore', {
          show(view) { shown = view; }, outgoing: segment, incoming: segment,
          activated(view) { activated.push(view); },
        });
      },
    },
  ] });
  await kernel.boot();
  await flush();
  t.after(() => kernel.shutdown());
  return { kernel, navigation, activated, get shown() { return shown; }, async step(time) { scheduler.step(time); await flush(); } };
}

test('rapid requests cancel old work; only the newest destination commits', async t => {
  const f = await fixture(t);
  const first = f.navigation.navigate('create');
  await flush();
  await f.step(0); await f.step(50);
  const second = f.navigation.navigate('connect');
  const third = f.navigation.navigate('create');
  await flush();
  assert.equal((await first).status, 'cancelled');
  assert.equal((await second).status, 'cancelled');
  await f.step(150); await f.step(250);
  assert.equal((await third).status, 'completed');
  assert.equal(f.shown, 'create');
  assert.equal(f.navigation.currentView, 'create');
  assert.deepEqual(f.activated, ['create']);
  assert.equal(f.kernel.getState().phase, 'ready');
});

test('cancel during incoming restores the committed view and settles the request', async t => {
  const f = await fixture(t);
  const request = f.navigation.navigate('connect');
  await flush();
  await f.step(0); await f.step(100); await f.step(140);
  assert.equal(f.shown, 'connect');
  await f.navigation.cancel();
  assert.equal((await request).status, 'cancelled');
  await f.step(1000);
  assert.equal(f.shown, 'explore');
  assert.equal(f.kernel.getState().phase, 'ready');
  assert.deepEqual(f.activated, []);
});

test('commands issued while paused reconcile the saved experience phase on resume', async t => {
  const f = await fixture(t);
  const request = f.navigation.navigate('create');
  await flush();
  await f.step(0); await f.step(25);
  f.kernel.pause();
  await f.navigation.cancel();
  assert.equal((await request).status, 'cancelled');
  f.kernel.resume();
  await flush();
  assert.equal(f.kernel.getState().phase, 'ready');
  f.kernel.pause();
  const next = f.navigation.navigate('connect');
  await flush();
  f.kernel.resume();
  await flush();
  assert.equal(f.kernel.getState().phase, 'transition');
  await f.step(1000); await f.step(1100); await f.step(1200);
  assert.equal((await next).status, 'completed');
  assert.equal(f.kernel.getState().phase, 'ready');
});

test('shutdown while a transition is pending leaves no stale activation', async t => {
  const f = await fixture(t);
  const request = f.navigation.navigate('create');
  await flush();
  await f.kernel.shutdown();
  assert.equal((await request).status, 'cancelled');
  assert.deepEqual(f.activated, []);
  assert.equal(f.kernel.getLifecycleSnapshot().state, 'disposed');
});
