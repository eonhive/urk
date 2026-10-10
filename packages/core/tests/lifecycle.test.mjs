/**
 * Company: EonHive Inc.
 * Title: Kernel Lifecycle Regression Tests
 * Purpose: Verify startup, cancellation, activation, and cleanup through the public kernel.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { createKernel } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function scheduler() {
  let callback = null;
  return {
    start(next) { callback = next; },
    stop() { callback = null; },
    isRunning() { return callback !== null; },
    step() { callback?.({ timeMs: 16, deltaMs: 0, deltaSeconds: 0, frame: 1 }); },
  };
}

test('concurrent boot callers wait for the final controller start', async () => {
  const entered = deferred();
  const release = deferred();
  const kernel = createKernel({ scheduler: scheduler(), controllers: [{
    id: 'slow', async start() { entered.resolve(); await release.promise; },
  }] });
  const first = kernel.boot();
  await entered.promise;
  let completed = false;
  const second = kernel.boot().then(() => { completed = true; });
  await setImmediate();
  const completedBeforeStartup = completed;
  release.resolve();
  await Promise.all([first, second]);
  await kernel.shutdown();
  assert.equal(completedBeforeStartup, false);
});

test('shutdown interrupts adapter setup and prevents late publication', async () => {
  const entered = deferred();
  const release = deferred();
  let cleanupCount = 0;
  const frames = scheduler();
  const kernel = createKernel({ scheduler: frames, adapters: [{
    id: 'slow', capability: 'slow',
    async setup() { entered.resolve(); await release.promise; return {}; },
    dispose() { cleanupCount += 1; },
  }] });
  const boot = kernel.boot().then(() => null, (error) => error);
  await entered.promise;
  let completed = false;
  const shutdown = kernel.shutdown().then(() => { completed = true; });
  const cancelledImmediately = kernel.getContext().signal?.aborted;
  await setImmediate();
  const completedBeforeSettlement = completed;
  release.resolve();
  const bootError = await boot;
  await shutdown;
  assert.equal(cancelledImmediately, true);
  assert.equal(completedBeforeSettlement, false);
  assert.ok(bootError instanceof Error);
  assert.equal(kernel.getContext().adapters.get('slow'), undefined);
  assert.equal(cleanupCount, 1);
  assert.equal(frames.isRunning(), false);
});

test('shutdown during controller start waits before disposing its dependencies', async () => {
  const entered = deferred();
  const release = deferred();
  const actions = [];
  const frames = scheduler();
  const kernel = createKernel({
    scheduler: frames,
    adapters: [{ id: 'dependency', capability: 'dependency', setup: () => ({}),
      dispose() { actions.push('adapter:dispose'); } }],
    controllers: [{ id: 'slow', async start(ctx) {
      entered.resolve();
      await release.promise;
      ctx.adapters.require('dependency');
      actions.push('start:settled');
    }, dispose() { actions.push('controller:dispose'); } }],
  });
  const boot = kernel.boot().then(() => null, (error) => error);
  await entered.promise;
  const shutdown = kernel.shutdown();
  await setImmediate();
  const actionsBeforeSettlement = [...actions];
  release.resolve();
  const bootError = await boot;
  await shutdown;
  assert.deepEqual(actionsBeforeSettlement, []);
  assert.ok(bootError instanceof Error);
  assert.deepEqual(actions, ['start:settled', 'controller:dispose', 'adapter:dispose']);
  assert.equal(frames.isRunning(), false);
});

test('concurrent shutdown callers wait for the same completed cleanup', async () => {
  const entered = deferred();
  const release = deferred();
  let count = 0;
  const kernel = createKernel({ scheduler: scheduler(), controllers: [{
    id: 'slow', async dispose() { count += 1; entered.resolve(); await release.promise; },
  }] });
  await kernel.boot();
  const first = kernel.shutdown();
  await entered.promise;
  let completed = false;
  const second = kernel.shutdown().then(() => { completed = true; });
  await setImmediate();
  const completedBeforeCleanup = completed;
  release.resolve();
  await Promise.all([first, second]);
  assert.equal(completedBeforeCleanup, false);
  assert.equal(count, 1);
});

test('dynamic controllers update only after successful startup with their receiver', async () => {
  const entered = deferred();
  const release = deferred();
  const frames = scheduler();
  const kernel = createKernel({ scheduler: frames });
  await kernel.boot();
  let updates = 0;
  const registration = {
    id: 'dynamic',
    async start() { entered.resolve(); await release.promise; },
    update(frame, ctx) {
      assert.equal(this, registration);
      assert.equal(frame.timeMs, 16);
      assert.equal(ctx.id, kernel.getContext().id);
      updates += 1;
    },
  };
  const registered = kernel.registerController(registration);
  await entered.promise;
  frames.step();
  const updatesBeforeStartup = updates;
  release.resolve();
  await registered;
  frames.step();
  await kernel.shutdown();
  assert.equal(updatesBeforeStartup, 0);
  assert.equal(updates, 1);
});

test('startup failure rolls back initialized dependencies and remains terminal', async () => {
  const originalError = new Error('setup failed');
  const actions = [];
  const kernel = createKernel({ scheduler: scheduler(), adapters: [
    { id: 'first', capability: 'first', setup: () => ({}), dispose() { actions.push('disposed'); } },
    { id: 'second', capability: 'second', setup() { throw originalError; } },
  ] });
  const error = await kernel.boot().then(() => null, (failure) => failure);
  const rollbackActions = [...actions];
  await kernel.shutdown();
  await assert.rejects(kernel.boot());
  assert.equal(error, originalError);
  assert.deepEqual(rollbackActions, ['disposed']);
  assert.deepEqual(actions, ['disposed']);
});

test('legacy loading notification happens before controller start', async () => {
  const actions = [];
  const kernel = createKernel({ scheduler: scheduler(), controllers: [{
    id: 'legacy', init() { actions.push('init'); },
    start(ctx) { actions.push(`start:${ctx.state.getSnapshot().phase}`); },
  }] });
  kernel.getEventBus().on('runtime:booted', () => { actions.push('booted'); });
  await kernel.boot();
  await kernel.shutdown();
  assert.deepEqual(actions, ['init', 'booted', 'start:loading']);
});

test('pause and resume keep legacy phase behavior and shutdown is terminal', async () => {
  const frames = scheduler();
  const kernel = createKernel({ scheduler: frames });
  await kernel.boot();
  kernel.getContext().state.setPhase('ready', 'test');
  kernel.pause();
  assert.equal(frames.isRunning(), false);
  assert.equal(kernel.getState().phase, 'paused');
  kernel.resume();
  assert.equal(frames.isRunning(), true);
  assert.equal(kernel.getState().phase, 'ready');
  await kernel.shutdown();
  assert.throws(() => kernel.resume(), /disposed/);
  assert.equal(frames.isRunning(), false);
});
