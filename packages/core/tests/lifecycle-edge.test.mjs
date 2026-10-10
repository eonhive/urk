/**
 * Company: EonHive Inc.
 * Title: Kernel Lifecycle Edge Tests
 * Purpose: Verify reentrant lifecycle requests, failure isolation, and resource ownership.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { CleanupError, createKernel, ManualFrameScheduler } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function outcome(promise) {
  return promise.then(() => null, (error) => error);
}

test('boot requested synchronously from setup waits for the same startup completion', async () => {
  const entered = deferred();
  const release = deferred();
  let reentrantBoot;
  let setupCount = 0;
  let reentrantComplete = false;
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [{
      id: 'reentrant', capability: 'reentrant',
      setup() {
        setupCount += 1;
        // Guard the probe itself so a broken kernel cannot recurse indefinitely.
        if (setupCount === 1) {
          reentrantBoot = outcome(kernel.boot()).then((error) => {
            reentrantComplete = error === null;
            return error;
          });
        }
        return {};
      },
    }],
    controllers: [{
      id: 'slow-start',
      async start() { entered.resolve(); await release.promise; },
    }],
  });
  const firstBoot = outcome(kernel.boot());
  await entered.promise;
  await setImmediate();
  const finishedBeforeStart = reentrantComplete;
  release.resolve();
  const firstError = await firstBoot;
  const reentrantError = await reentrantBoot;
  await kernel.shutdown();
  assert.equal(firstError, null);
  assert.equal(reentrantError, null);
  assert.equal(finishedBeforeStart, false);
  assert.equal(setupCount, 1);
});

test('a controller can request shutdown from start without awaiting its own cleanup', async () => {
  const frames = new ManualFrameScheduler();
  const actions = [];
  let requestedShutdown;
  let cancelledInStart = false;
  const kernel = createKernel({
    scheduler: frames,
    adapters: [{
      id: 'dependency', capability: 'dependency', setup: () => ({}),
      dispose() { actions.push('adapter:dispose'); },
    }],
    controllers: [{
      id: 'request-stop',
      start(ctx) {
        requestedShutdown = kernel.shutdown();
        cancelledInStart = ctx.signal.aborted;
        actions.push('start:return');
      },
      update() { actions.push('unexpected:update'); },
      dispose() { actions.push('controller:dispose'); },
    }],
  });
  const bootError = await outcome(kernel.boot());
  await requestedShutdown;
  frames.step(16);
  assert.ok(bootError instanceof Error);
  assert.equal(cancelledInStart, true);
  assert.equal(frames.isRunning(), false);
  assert.deepEqual(actions, ['start:return', 'controller:dispose', 'adapter:dispose']);
});

test('shutdown requested during an update stops remaining controllers in that frame', async () => {
  const frames = new ManualFrameScheduler();
  const actions = [];
  let requestedShutdown;
  const kernel = createKernel({ scheduler: frames, controllers: [
    {
      id: 'request-stop',
      update() { actions.push('first:update'); requestedShutdown = kernel.shutdown(); },
      dispose() { actions.push('first:dispose'); },
    },
    {
      id: 'later',
      update() { actions.push('unexpected:update'); },
      dispose() { actions.push('later:dispose'); },
    },
  ] });
  await kernel.boot();
  frames.step(16);
  await requestedShutdown;
  frames.step(32);
  assert.equal(frames.isRunning(), false);
  assert.deepEqual(actions, ['first:update', 'later:dispose', 'first:dispose']);
});

test('throwing error and shutdown observers cannot skip cleanup or event clearing', async () => {
  const cleanupError = new Error('controller cleanup failed');
  const observerError = new Error('observer failed');
  const actions = [];
  let probeCalls = 0;
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [{
      id: 'dependency', capability: 'dependency', setup: () => ({}),
      dispose() { actions.push('adapter:dispose'); },
    }],
    controllers: [
      { id: 'remaining', dispose() { actions.push('remaining:dispose'); } },
      { id: 'failing', dispose() { actions.push('failing:dispose'); throw cleanupError; } },
    ],
  });
  await kernel.boot();
  const events = kernel.getEventBus();
  events.on('runtime:error', () => { throw observerError; });
  events.on('runtime:shutdown', () => { throw observerError; });
  events.on('probe', () => { probeCalls += 1; });
  const error = await outcome(kernel.shutdown());
  events.emit({ type: 'probe', source: 'test', timestamp: 0 });
  assert.ok(error instanceof CleanupError);
  assert.deepEqual(error.errors, [cleanupError]);
  assert.deepEqual(kernel.getCleanupErrors(), [cleanupError]);
  assert.equal(Object.isFrozen(error.errors), true);
  assert.deepEqual(actions, ['failing:dispose', 'remaining:dispose', 'adapter:dispose']);
  assert.equal(probeCalls, 0);
  assert.equal(kernel.getContext().adapters.get('dependency'), undefined);
  assert.doesNotThrow(() => {
    events.emit({ type: 'runtime:error', source: 'test', timestamp: 0 });
    events.emit({ type: 'runtime:shutdown', source: 'test', timestamp: 0 });
  });
});

test('concurrent and repeated shutdown callers receive the same cleanup failure', async () => {
  const entered = deferred();
  const release = deferred();
  const cleanupError = new Error('cleanup failed');
  let cleanupCount = 0;
  let secondComplete = false;
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    controllers: [{
      id: 'failing-cleanup',
      async dispose() {
        cleanupCount += 1;
        entered.resolve();
        await release.promise;
        throw cleanupError;
      },
    }],
  });
  await kernel.boot();
  const first = outcome(kernel.shutdown());
  await entered.promise;
  const second = outcome(kernel.shutdown()).then((error) => {
    secondComplete = true;
    return error;
  });
  await setImmediate();
  const completedBeforeCleanup = secondComplete;
  release.resolve();
  const errors = await Promise.all([first, second]);
  errors.push(await outcome(kernel.shutdown()));
  assert.equal(completedBeforeCleanup, false);
  assert.ok(errors[0] instanceof CleanupError);
  assert.ok(errors.every((error) => error === errors[0]));
  assert.deepEqual(errors[0].errors, [cleanupError]);
  assert.deepEqual(kernel.getCleanupErrors(), [cleanupError]);
  assert.equal(cleanupCount, 1);
});

test('boot preserves its initiating error and reports every cleanup failure separately', async () => {
  const initError = new Error('initialization failed');
  const controllerError = new Error('controller cleanup failed');
  const scopeError = new Error('scope cleanup failed');
  const adapterError = new Error('adapter cleanup failed');
  const actions = [];
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [{
      id: 'dependency', capability: 'dependency', setup: () => ({}),
      dispose() { actions.push('adapter:dispose'); throw adapterError; },
    }],
    controllers: [{
      id: 'partial-init',
      init(ctx) {
        ctx.scope.defer(() => { actions.push('scope:dispose'); throw scopeError; });
        throw initError;
      },
      dispose() { actions.push('controller:dispose'); throw controllerError; },
    }],
  });
  const bootError = await outcome(kernel.boot());
  const cleanupErrors = kernel.getCleanupErrors();
  const shutdownError = await outcome(kernel.shutdown());
  assert.equal(bootError, initError);
  assert.ok(shutdownError instanceof CleanupError);
  assert.deepEqual(cleanupErrors, [controllerError, scopeError, adapterError]);
  assert.deepEqual(shutdownError.errors, cleanupErrors);
  assert.equal(kernel.getCleanupErrors(), cleanupErrors);
  assert.equal(Object.isFrozen(cleanupErrors), true);
  assert.equal(Object.isFrozen(shutdownError.errors), true);
  assert.deepEqual(actions, ['controller:dispose', 'scope:dispose', 'adapter:dispose']);
});

test('partial controller initialization rolls back its scope before adapter cleanup', async () => {
  const initError = new Error('controller init failed');
  const actions = [];
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [{
      id: 'dependency', capability: 'dependency', setup: () => ({}),
      dispose() { actions.push('adapter:dispose'); },
    }],
    controllers: [{
      id: 'partial-init',
      init(ctx) {
        ctx.scope.defer(() => { actions.push('scope:first'); });
        ctx.scope.defer(() => { actions.push('scope:second'); });
        throw initError;
      },
      start() { actions.push('unexpected:start'); },
      update() { actions.push('unexpected:update'); },
    }],
  });
  const error = await outcome(kernel.boot());
  const rollbackActions = [...actions];
  await kernel.shutdown();
  assert.equal(error, initError);
  assert.deepEqual(rollbackActions, ['scope:second', 'scope:first', 'adapter:dispose']);
  assert.deepEqual(actions, rollbackActions);
});

test('shutdown clears service lookup while borrowed resources remain usable', async () => {
  let disposalCount = 0;
  const borrowed = {
    value: 'still available',
    dispose() { disposalCount += 1; },
  };
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    services: { borrowed },
  });
  await kernel.boot();
  const services = kernel.getContext().services;
  assert.equal(services.require('borrowed'), borrowed);
  await kernel.shutdown();
  assert.equal(services.get('borrowed'), undefined);
  assert.deepEqual(services.list(), []);
  assert.equal(disposalCount, 0);
  assert.equal(borrowed.value, 'still available');
});

test('captured registries reject new registrations after kernel shutdown', async () => {
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  const ctx = kernel.getContext();
  await kernel.boot();
  await kernel.shutdown();
  let setups = 0;
  await assert.rejects(ctx.adapters.register({
    id: 'late', capability: 'late', setup() { setups += 1; return {}; },
  }, ctx));
  assert.throws(() => ctx.controllers.register({ id: 'late' }));
  assert.throws(() => ctx.services.register('late', {}));
  assert.equal(setups, 0);
  assert.deepEqual(ctx.adapters.list(), []);
  assert.deepEqual(ctx.controllers.list(), []);
  assert.deepEqual(ctx.services.list(), []);
});

test('shutdown waits for a pending state-change hook before destroying its adapters', async () => {
  const entered = deferred();
  const release = deferred();
  const actions = [];
  const dependency = { value: 'available' };
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    adapters: [{
      id: 'dependency', capability: 'dependency', setup: () => dependency,
      dispose() { actions.push('adapter:dispose'); },
    }],
    controllers: [{
      id: 'state-observer',
      async onStateChange(next, _previous, ctx) {
        if (next.phase !== 'ready') return;
        entered.resolve();
        await release.promise;
        assert.equal(ctx.adapters.require('dependency'), dependency);
        actions.push('state:settled');
      },
      dispose() { actions.push('controller:dispose'); },
    }],
  });
  await kernel.boot();
  kernel.getContext().state.setPhase('ready', 'test:ready');
  await entered.promise;
  let shutdownComplete = false;
  const shutdown = kernel.shutdown().then(() => { shutdownComplete = true; });
  await setImmediate();
  const completedBeforeHook = shutdownComplete;
  const actionsBeforeHook = [...actions];
  release.resolve();
  await shutdown;
  assert.equal(completedBeforeHook, false);
  assert.deepEqual(actionsBeforeHook, []);
  assert.deepEqual(actions, ['state:settled', 'controller:dispose', 'adapter:dispose']);
});

test('boot starts a controller registered while the empty startup pass settles', async () => {
  const frames = new ManualFrameScheduler();
  const actions = [];
  const kernel = createKernel({ scheduler: frames });
  let registration;
  kernel.getEventBus().on('runtime:booted', () => {
    queueMicrotask(() => {
      registration = kernel.registerController({
        id: 'late-startup',
        init() { actions.push('init'); },
        start() { actions.push('start'); },
        update() { actions.push('update'); },
      });
    });
  });

  await kernel.boot();
  await registration;
  frames.step(16);
  await kernel.shutdown();
  assert.deepEqual(actions, ['init', 'start', 'update']);
});

test('boot waits for a late controller start and cancellation prevents its activation', async () => {
  const entered = deferred();
  const release = deferred();
  const frames = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler: frames });
  let registration;
  let updates = 0;
  kernel.getEventBus().on('runtime:booted', () => {
    queueMicrotask(() => {
      registration = kernel.registerController({
        id: 'late-slow',
        async start() { entered.resolve(); await release.promise; },
        update() { updates += 1; },
      });
    });
  });

  const boot = outcome(kernel.boot());
  // A broken boot finishes without entering the late controller; avoid a hanging test.
  await Promise.race([entered.promise, boot]);
  let shutdownFinished = false;
  const shutdown = kernel.shutdown().then(() => { shutdownFinished = true; });
  await setImmediate();
  const finishedBeforeStart = shutdownFinished;
  release.resolve();
  const bootError = await boot;
  await registration;
  await shutdown;
  frames.step(16);
  assert.ok(bootError instanceof Error);
  assert.equal(finishedBeforeStart, false);
  assert.equal(updates, 0);
  assert.equal(frames.isRunning(), false);
});

test('a controller update failure stops frames and preserves explicit terminal cleanup', async () => {
  const frames = new ManualFrameScheduler();
  const actions = [];
  const kernel = createKernel({ scheduler: frames, controllers: [
    { id: 'first', update() { actions.push('update'); throw new Error('frame failed'); },
      dispose() { actions.push('dispose:first'); } },
    { id: 'second', update() { actions.push('unexpected:update'); },
      dispose() { actions.push('dispose:second'); } },
  ] });
  await kernel.boot();
  frames.step(16);
  frames.step(32);
  assert.equal(kernel.getState().phase, 'error');
  assert.equal(frames.isRunning(), false);
  await assert.rejects(kernel.boot(), /failed/);
  assert.throws(() => kernel.getContext().scheduler.start(() => {}), /failed/);
  await kernel.shutdown();
  assert.deepEqual(actions, ['update', 'dispose:second', 'dispose:first']);
});
