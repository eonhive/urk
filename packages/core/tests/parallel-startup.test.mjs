/**
 * Company: EonHive Inc.
 * Title: Parallel Adapter Startup
 * Purpose: Check dependency barriers and deterministic ownership during concurrent setup.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, token } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

test('parallel dependencies publish before consumers and sibling disposal follows planned order', { timeout: 2000 }, async () => {
  const firstStarted = deferred();
  const secondStarted = deferred();
  const firstGate = deferred();
  const secondGate = deferred();
  const secondFinished = deferred();
  const First = token('first');
  const Preferences = token('preferences');
  const calls = [];
  const kernel = createKernel({ frameMode: 'auto', adapterStartup: 'parallel',
    serviceBindings: [{ token: Preferences, value: { enabled: true } }],
    adapters: [
      { id: 'consumer', capability: 'consumer', dependsOn: [First, 'second'],
        setup(ctx) {
          assert.equal(ctx.require(First).ready, true);
          assert.equal(ctx.require('second').ready, true);
          calls.push('consumer');
        }, dispose() { calls.push('dispose:consumer'); },
      },
      { id: 'first', capability: 'first', token: First, dependsOn: [Preferences],
        async setup(ctx) {
          assert.equal(ctx.require(Preferences).enabled, true);
          firstStarted.resolve(); await firstGate.promise; calls.push('first'); return { ready: true };
        }, dispose() { calls.push('dispose:first'); },
      },
      { id: 'second', capability: 'second',
        async setup() {
          secondStarted.resolve(); await secondGate.promise; calls.push('second'); secondFinished.resolve(); return { ready: true };
        }, dispose() { calls.push('dispose:second'); },
      },
    ], controllers: [{ id: 'controller', start() { calls.push('controller'); }, dispose() { calls.push('dispose:controller'); } }],
  });
  const boot = kernel.boot();
  await Promise.all([firstStarted.promise, secondStarted.promise]);
  assert.deepEqual(calls, []);
  secondGate.resolve();
  await secondFinished.promise;
  assert.deepEqual(calls, ['second']);
  firstGate.resolve();
  await boot;
  assert.deepEqual(kernel.getContext().adapters.list().map(record => record.id), ['first', 'second', 'consumer']);
  await kernel.shutdown();
  assert.deepEqual(calls, ['second', 'first', 'consumer', 'controller',
    'dispose:controller', 'dispose:consumer', 'dispose:second', 'dispose:first']);
});

for (const action of ['failure', 'shutdown']) {
  test(`parallel ${action} cancels immediately and waits for pending setup cleanup`, { timeout: 2000 }, async () => {
    const started = deferred();
    const gate = deferred();
    const trigger = deferred();
    const cancelled = deferred();
    const failure = new Error('setup failed');
    const calls = [];
    let dependentStarted = false;
    let pendingContext;
    const kernel = createKernel({ frameMode: 'auto', adapterStartup: 'parallel', adapters: [
      { id: 'pending', capability: 'pending',
        async setup(ctx) {
          pendingContext = ctx;
          ctx.scope.defer(() => { calls.push('scope'); });
          ctx.signal.addEventListener('abort', () => cancelled.resolve(), { once: true });
          started.resolve();
          await gate.promise;
          return {};
        }, dispose() { calls.push('legacy'); },
      },
      { id: 'trigger', capability: 'trigger', async setup() { await trigger.promise; throw failure; } },
      { id: 'dependent', capability: 'dependent', dependsOn: ['pending'],
        setup() { dependentStarted = true; },
      },
    ] });
    let bootSettled = false;
    const boot = kernel.boot().then(() => { throw new Error('Unexpected boot success'); }, error => {
      bootSettled = true;
      if (action === 'failure') assert.equal(error, failure);
    });
    await started.promise;
    const shutdown = action === 'shutdown' ? kernel.shutdown() : undefined;
    trigger.resolve();
    await cancelled.promise;
    assert.equal(pendingContext.signal.aborted, true);
    assert.equal(bootSettled, false);
    assert.equal(dependentStarted, false);
    assert.deepEqual(calls, []);
    gate.resolve();
    await boot;
    await shutdown;
    await kernel.shutdown();
    assert.deepEqual(calls, ['legacy', 'scope']);
    assert.equal(kernel.getContext().adapters.has('pending'), false);
    assert.equal(kernel.getLifecycleSnapshot().state, 'disposed');
  });
}

test('parallel preflight rejects cycles before any resources are acquired', async () => {
  let setups = 0;
  const kernel = createKernel({ adapterStartup: 'parallel', frameMode: 'auto', adapters: [
    { id: 'a', capability: 'a', dependsOn: ['b'], setup() { setups++; } },
    { id: 'b', capability: 'b', dependsOn: ['a'], setup() { setups++; } },
  ] });
  await assert.rejects(kernel.boot(), /cycle/);
  assert.equal(setups, 0);
});

test('setup failure signals cancellation before awaiting partial cleanup', { timeout: 2000 }, async () => {
  const failure = new Error('acquisition failed');
  let cleanupFinished = false;
  const kernel = createKernel({ adapterStartup: 'parallel', frameMode: 'auto', adapters: [{
    id: 'partial', capability: 'partial', setup(ctx) {
      ctx.scope.defer(async () => {
        if (!ctx.signal.aborted) {
          await new Promise(resolve => ctx.signal.addEventListener('abort', resolve, { once: true }));
        }
        cleanupFinished = true;
      });
      throw failure;
    },
  }] });
  await assert.rejects(kernel.boot(), error => error === failure);
  assert.equal(cleanupFinished, true);
  assert.equal(kernel.getLifecycleSnapshot().state, 'disposed');
});
