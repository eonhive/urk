/**
 * Company: EonHive Inc.
 * Title: Ordered Phase Transitions
 * Purpose: Check command ordering, cancellation, and compatibility through the public store.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, RuntimeStore } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

test('commands commit and finish controller handlers in order', { timeout: 2000 }, async () => {
  const entered = deferred();
  const gate = deferred();
  const calls = [];
  const first = {
    id: 'first',
    async onStateChange(next, previous, ctx) {
      if (!next.reason?.startsWith('command:')) return;
      assert.equal(this, first);
      assert.equal(ctx.state.getSnapshot().phase, next.phase);
      calls.push(`first:${next.phase}`);
      if (next.phase === 'transition') { entered.resolve(); await gate.promise; }
      assert.equal(ctx.state.getSnapshot().phase, next.phase);
      calls.push(`finished:${next.phase}`);
    },
  };
  const kernel = createKernel({ frameMode: 'auto', controllers: [first, {
    id: 'second', onStateChange(next) {
      if (next.reason?.startsWith('command:')) calls.push(`second:${next.phase}`);
    },
  }] });
  await kernel.boot();
  const state = kernel.getContext().state;
  const firstCommand = state.transition('transition', 'command:a');
  const secondCommand = state.transition('ready', 'command:b');
  await entered.promise;
  assert.equal(state.getSnapshot().phase, 'transition');
  assert.deepEqual(calls, ['first:transition']);
  gate.resolve();
  assert.equal((await firstCommand).phase, 'transition');
  assert.equal((await secondCommand).phase, 'ready');
  assert.deepEqual(calls, [
    'first:transition', 'finished:transition', 'second:transition',
    'first:ready', 'finished:ready', 'second:ready',
  ]);
  await kernel.shutdown();
});

test('awaited chaining, duplicate commands, and reentrant enqueue drain completely', { timeout: 2000 }, async () => {
  const state = new RuntimeStore();
  const calls = [];
  let followup;
  state.subscribe(next => {
    calls.push(next.phase);
    if (next.phase === 'transition') followup = state.transition('ready');
  });
  await state.transition('loading');
  await state.transition('loading');
  await state.transition('transition');
  await followup;
  await state.transition('paused');
  assert.deepEqual(calls, ['loading', 'transition', 'ready', 'paused']);
});

test('shutdown rejects active and queued commands before a handler settles', { timeout: 2000 }, async () => {
  const entered = deferred();
  const gate = deferred();
  const calls = [];
  const kernel = createKernel({ frameMode: 'auto', controllers: [{
    id: 'pending',
    async onStateChange(next, previous, ctx) {
      if (next.phase !== 'transition') return;
      entered.resolve();
      await gate.promise;
      assert.equal(ctx.signal.aborted, true);
      calls.push('settled');
    },
    dispose() { calls.push('disposed'); },
  }] });
  await kernel.boot();
  const state = kernel.getContext().state;
  const active = assert.rejects(state.transition('transition'), /disposed/);
  const queued = assert.rejects(state.transition('ready'), /disposed/);
  await entered.promise;
  let completed = false;
  const shutdown = kernel.shutdown().then(() => { completed = true; });
  assert.equal(kernel.getContext().signal.aborted, true);
  await Promise.all([active, queued]);
  assert.equal(completed, false);
  assert.equal(state.getSnapshot().phase, 'transition');
  assert.deepEqual(calls, []);
  gate.resolve();
  await shutdown;
  assert.deepEqual(calls, ['settled', 'disposed']);
  await assert.rejects(state.transition('ready'), /disposed/);
});

test('a controller rejection fails the runtime and rejects queued commands with the cause', { timeout: 2000 }, async () => {
  const failure = new Error('transition failed');
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler, controllers: [{ id: 'failure',
    async onStateChange(next) { if (next.phase === 'transition') throw failure; },
  }] });
  await kernel.boot();
  const state = kernel.getContext().state;
  const first = assert.rejects(state.transition('transition'), error => error === failure);
  const second = assert.rejects(state.transition('ready'), error => error === failure);
  await Promise.all([first, second]);
  assert.equal(kernel.getLifecycleSnapshot().state, 'failed');
  assert.equal(scheduler.isRunning(), false);
  assert.equal(state.getSnapshot().phase, 'error');
  await kernel.shutdown();
});

test('shutdown waits for asynchronous store listeners before destroying adapters', { timeout: 2000 }, async () => {
  const entered = deferred();
  const gate = deferred();
  let disposed = false;
  const kernel = createKernel({ frameMode: 'auto', adapters: [{
    id: 'resource', capability: 'resource', setup: () => ({}), dispose() { disposed = true; },
  }] });
  await kernel.boot();
  const state = kernel.getContext().state;
  state.subscribe(async next => {
    if (next.phase !== 'transition') return;
    entered.resolve();
    await gate.promise;
    assert.equal(disposed, false);
  });
  const rejection = assert.rejects(state.transition('transition'), /disposed/);
  await entered.promise;
  const shutdown = kernel.shutdown();
  await rejection;
  assert.equal(disposed, false);
  gate.resolve();
  await shutdown;
  assert.equal(disposed, true);
});

test('legacy writes remain synchronous and shutdown cancels commands before dispatch', async () => {
  const kernel = createKernel({ frameMode: 'auto' });
  const state = kernel.getContext().state;
  const observed = [];
  state.subscribe(next => { observed.push(next.phase); });
  state.setPhase('ready');
  assert.deepEqual(observed, ['ready']);
  const rejected = assert.rejects(state.transition('transition'), /disposed/);
  await kernel.shutdown();
  await rejected;
  assert.deepEqual(observed, ['ready']);
});
