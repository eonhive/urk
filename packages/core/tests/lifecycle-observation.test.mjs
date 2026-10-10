/**
 * Company: EonHive Inc.
 * Title: Lifecycle Observation Tests
 * Purpose: Verify operational snapshots, complete startup/disposal, and observer reentrancy.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CleanupError, createKernel, ManualFrameScheduler } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function observe(kernel) {
  const snapshots = [];
  const unsubscribe = kernel.subscribeLifecycle((snapshot) => { snapshots.push(snapshot); });
  return { snapshots, unsubscribe, states: () => snapshots.map((snapshot) => snapshot.state) };
}

test('lifecycle snapshots are immutable, cached, and independent of wall-clock identity', async () => {
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  const initial = kernel.getLifecycleSnapshot();
  assert.deepEqual(initial, { state: 'created', revision: 0, updatedAt: initial.updatedAt });
  assert.equal(kernel.getLifecycleSnapshot(), initial);
  assert.equal(Object.isFrozen(initial), true);
  assert.throws(() => { initial.state = 'running'; }, TypeError);
  const now = Date.now;
  Date.now = () => initial.updatedAt;
  try {
    await kernel.boot();
    const running = kernel.getLifecycleSnapshot();
    assert.equal(running.state, 'running');
    assert.equal(running.revision, 2);
    assert.equal(running.updatedAt, initial.updatedAt);
    kernel.pause();
    assert.equal(kernel.getLifecycleSnapshot().revision, 3);
    kernel.pause('ignored duplicate');
    assert.equal(kernel.getLifecycleSnapshot().revision, 3);
    kernel.resume();
    assert.equal(kernel.getLifecycleSnapshot().revision, 4);
    kernel.resume('ignored duplicate');
    assert.equal(kernel.getLifecycleSnapshot().revision, 4);
  } finally {
    Date.now = now;
    await kernel.shutdown();
  }
  const disposed = kernel.getLifecycleSnapshot();
  await kernel.shutdown('ignored duplicate');
  assert.equal(disposed.state, 'disposed');
  assert.equal(kernel.getLifecycleSnapshot(), disposed);
});

for (const stage of ['setup', 'start']) {
  test(`starting lasts until deferred ${stage} settles, independently of legacy phases`, async () => {
    const entered = deferred();
    const release = deferred();
    const hook = async () => { entered.resolve(); await release.promise; return {}; };
    const kernel = createKernel({
      scheduler: new ManualFrameScheduler(),
      adapters: stage === 'setup' ? [{ id: 'slow', capability: 'slow', setup: hook }] : [],
      controllers: stage === 'start' ? [{ id: 'slow', start: hook }] : [],
    });
    const observed = observe(kernel);
    const boot = kernel.boot();
    assert.equal(kernel.getLifecycleSnapshot().state, 'starting');
    await entered.promise;
    assert.equal(kernel.getState().phase, stage === 'setup' ? 'boot' : 'loading');
    kernel.getContext().state.setPhase('ready', 'application:assets');
    assert.equal(kernel.getLifecycleSnapshot().state, 'starting');
    release.resolve();
    await boot;
    assert.deepEqual(observed.states(), ['starting', 'running']);
    assert.equal(kernel.getState().phase, stage === 'setup' ? 'loading' : 'ready');
    const running = kernel.getLifecycleSnapshot();
    kernel.getContext().state.setPhase('transition', 'application:scene');
    assert.equal(kernel.getLifecycleSnapshot(), running);
    await kernel.shutdown();
    assert.deepEqual(observed.states(), ['starting', 'running', 'disposing', 'disposed']);
  });
}

test('starting observers see the installed shared boot promise before hooks run', async () => {
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  let nestedBoot;
  kernel.subscribeLifecycle((snapshot) => {
    if (snapshot.state === 'starting') { nestedBoot = kernel.boot(); }
  });
  const boot = kernel.boot();
  assert.equal(nestedBoot, boot);
  await boot;
  await kernel.shutdown();
});

test('direct legacy phase writes do not acquire operational scheduler side effects', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler });
  await kernel.boot();
  const running = kernel.getLifecycleSnapshot();
  for (const phase of ['boot', 'loading', 'ready', 'transition', 'paused', 'error']) {
    kernel.getContext().state.setPhase(phase, 'application:flow');
    assert.equal(kernel.getState().phase, phase);
    assert.equal(kernel.getLifecycleSnapshot(), running);
    assert.equal(scheduler.isRunning(), true);
  }
  await kernel.shutdown();
});

test('shutdown commits disposal intent before abort and waits for pending startup', async () => {
  const entered = deferred();
  const release = deferred();
  const kernel = createKernel({ scheduler: new ManualFrameScheduler(), controllers: [{
    id: 'slow', async start() { entered.resolve(); await release.promise; },
  }] });
  const observed = observe(kernel);
  const boot = kernel.boot().catch((error) => error);
  await entered.promise;
  let abortSnapshot;
  kernel.getContext().signal.addEventListener('abort', () => {
    abortSnapshot = kernel.getLifecycleSnapshot();
  });
  let completed = false;
  const shutdown = kernel.shutdown('host:unmount');
  void shutdown.then(() => { completed = true; });
  assert.equal(abortSnapshot.state, 'disposing');
  assert.equal(abortSnapshot.reason, 'host:unmount');
  assert.equal(kernel.getContext().signal.aborted, true);
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(kernel.getLifecycleSnapshot().state, 'disposing');
  release.resolve();
  assert.ok(await boot instanceof Error);
  await shutdown;
  assert.deepEqual(observed.states(), ['starting', 'disposing', 'disposed']);
});

test('startup failure exposes failed then rollback without replacing the initiating error', async () => {
  const failure = new Error('startup failure');
  const cleanupFailure = new Error('cleanup failure');
  const kernel = createKernel({ scheduler: new ManualFrameScheduler(), adapters: [{
    id: 'failed', capability: 'failed', setup(ctx) {
      ctx.scope.defer(() => { throw cleanupFailure; });
      throw failure;
    },
  }] });
  const observed = observe(kernel);
  await assert.rejects(kernel.boot(), (error) => error === failure);
  assert.deepEqual(observed.states(), ['starting', 'failed', 'disposing', 'disposed']);
  assert.equal(observed.snapshots[1].reason, 'runtime:boot');
  assert.deepEqual(kernel.getCleanupErrors(), [cleanupFailure]);
  await assert.rejects(kernel.shutdown(), CleanupError);
});

test('fatal frame failure stays failed until the host completes cleanup', async () => {
  const scheduler = new ManualFrameScheduler();
  const failure = new Error('frame failure');
  const kernel = createKernel({ scheduler, controllers: [{
    id: 'failed', update() { throw failure; },
  }] });
  const observed = observe(kernel);
  await kernel.boot();
  scheduler.step(0);
  assert.equal(scheduler.isRunning(), false);
  assert.equal(kernel.getLifecycleSnapshot().state, 'failed');
  assert.equal(kernel.getState().phase, 'error');
  await assert.rejects(kernel.boot(), /failed kernel/);
  await kernel.shutdown();
  assert.deepEqual(observed.states(), ['starting', 'running', 'failed', 'disposing', 'disposed']);
});

test('cleanup errors still finish disposal and are available to terminal observers', async () => {
  const failure = new Error('dispose failure');
  const kernel = createKernel({ scheduler: new ManualFrameScheduler(), controllers: [{
    id: 'failed', dispose() { throw failure; },
  }] });
  await kernel.boot();
  let terminalErrors;
  kernel.subscribeLifecycle((snapshot) => {
    if (snapshot.state === 'disposed') { terminalErrors = kernel.getCleanupErrors(); }
  });
  await assert.rejects(kernel.shutdown(), CleanupError);
  assert.equal(kernel.getLifecycleSnapshot().state, 'disposed');
  assert.deepEqual(terminalErrors, [failure]);
  assert.equal(Object.isFrozen(terminalErrors), true);
});

test('observer failures and repeated unsubscribe do not block sibling delivery or cleanup', async () => {
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  kernel.subscribeLifecycle(() => { throw new Error('observer failure'); });
  const observed = observe(kernel);
  await kernel.boot();
  observed.unsubscribe();
  observed.unsubscribe();
  kernel.pause();
  kernel.resume();
  await kernel.shutdown();
  assert.deepEqual(observed.states(), ['starting', 'running']);
  let lateNotifications = 0;
  const unsubscribe = kernel.subscribeLifecycle(() => { lateNotifications += 1; });
  await kernel.shutdown();
  await assert.rejects(kernel.boot());
  unsubscribe();
  assert.equal(lateNotifications, 0);
});

test('reentrant observers never deliver an older snapshot after a newer revision', async () => {
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  kernel.subscribeLifecycle((snapshot) => {
    if (snapshot.state === 'running') { kernel.pause('observer:pause'); }
  });
  const observed = observe(kernel);
  await kernel.boot();
  assert.deepEqual(observed.states(), ['starting', 'paused']);
  assert.equal(kernel.getLifecycleSnapshot().state, 'paused');
  assert.equal(kernel.getContext().scheduler.isRunning(), false);
  await kernel.shutdown();
  assert.ok(observed.snapshots.every((snapshot, index) =>
    index === 0 || snapshot.revision > observed.snapshots[index - 1].revision));
});

test('legacy phase reentrancy does not overwrite the final operational state', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler });
  await kernel.boot();
  const observed = observe(kernel);
  const unsubscribe = kernel.getContext().state.subscribe((next) => {
    if (next.phase === 'paused') { kernel.resume('legacy:resume'); }
  });
  kernel.pause();
  assert.equal(scheduler.isRunning(), true);
  assert.equal(kernel.getLifecycleSnapshot().state, 'running');
  assert.deepEqual(observed.states(), ['running']);
  unsubscribe();
  await kernel.shutdown();
});

test('shutdown requested by a starting observer cannot be overwritten by late boot work', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler });
  const observed = observe(kernel);
  let shutdown;
  kernel.subscribeLifecycle((snapshot) => {
    if (snapshot.state === 'starting') { shutdown = kernel.shutdown('observer:shutdown'); }
  });
  await assert.rejects(kernel.boot(), /disposed kernel/);
  await shutdown;
  assert.deepEqual(observed.states(), ['starting', 'disposing', 'disposed']);
  assert.equal(scheduler.isRunning(), false);
});

test('phase observers retain their existing timing and thrown errors', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler });
  await kernel.boot();
  const observed = observe(kernel);
  const failure = new Error('legacy observer');
  const unsubscribe = kernel.getContext().state.subscribe((next) => {
    assert.equal(kernel.getLifecycleSnapshot().state, 'paused');
    assert.equal(scheduler.isRunning(), false);
    assert.equal(next.phase, 'paused');
    throw failure;
  });
  assert.throws(() => kernel.pause(), (error) => error === failure);
  assert.deepEqual(observed.states(), ['paused']);
  unsubscribe();
  await kernel.shutdown();
});

test('injected schedulers observe committed lifecycle and dynamic starts preserve the frame chain', async () => {
  const frames = new ManualFrameScheduler();
  const calls = [];
  const scheduler = {
    start(callback) {
      calls.push(`start:${kernel.getLifecycleSnapshot().state}`);
      frames.start(callback);
    },
    stop() {
      const state = kernel.getLifecycleSnapshot().state;
      calls.push(`stop:${state}`);
      frames.stop();
      if (state === 'failed') {
        assert.throws(() => kernel.registerService('late', {}), /failed kernel/);
      }
    },
    isRunning: () => frames.isRunning(),
  };
  const kernel = createKernel({ scheduler, controllers: [{
    id: 'failure', update() { throw new Error('frame failure'); },
  }] });
  await kernel.boot();
  await kernel.registerController({ id: 'dynamic', update() {} });
  kernel.pause();
  kernel.resume();
  frames.step(10);
  await kernel.shutdown();
  assert.deepEqual(calls, [
    'start:running', 'stop:paused', 'start:running', 'stop:failed', 'stop:disposing',
  ]);
});
