/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Feature Checks
 * Purpose: Check dependency planning, shared typed lookup, and idle scheduling boundaries.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, token } from '../dist/index.js';

test('auto mode rests without updaters and wakes after dynamic startup', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler, frameMode: 'auto' });
  await kernel.boot();
  assert.equal(scheduler.isRunning(), false);
  let frames = 0;
  await kernel.registerController({ id: 'updates', update() { frames++; } });
  assert.equal(scheduler.isRunning(), true);
  scheduler.step(10);
  assert.equal(frames, 1);
  kernel.pause();
  assert.equal(scheduler.isRunning(), false);
  kernel.resume();
  scheduler.step(20);
  assert.equal(frames, 2);
  await kernel.shutdown();
  assert.equal(scheduler.isRunning(), false);
});

test('typed context resolves adapters and borrowed services with one provider per token', async () => {
  const Preferences = token('preferences');
  const Adapter = token('adapter');
  const borrowed = { value: 1 };
  const kernel = createKernel({ frameMode: 'auto',
    serviceBindings: [{ token: Preferences, value: borrowed }],
    adapters: [{ id: 'adapter', capability: 'adapter-api', token: Adapter, dependsOn: [Preferences],
      setup(ctx) { return { preferences: ctx.require(Preferences) }; },
    }],
  });
  await kernel.boot();
  const ctx = kernel.getContext();
  assert.equal(ctx.require(Preferences), borrowed);
  assert.equal(ctx.require(Adapter).preferences, borrowed);
  assert.throws(() => ctx.services.register(Adapter, {}), /token already registered/);
  await assert.rejects(ctx.adapters.register({ id: 'duplicate', capability: 'duplicate', token: Preferences, setup: () => ({}) }, ctx), /token already registered/);
  await kernel.shutdown();
  assert.equal(ctx.get(Adapter), undefined);
  assert.equal(ctx.get(Preferences), undefined);
  assert.deepEqual(borrowed, { value: 1 });
});

test('dependency planning orders forward references while retaining valid configured order', async () => {
  const calls = [];
  const Provider = token('provider');
  const Existing = token('existing-hook');
  const adapter = (id, dependsOn = [], capabilityToken) => ({ id, capability: id, dependsOn, token: capabilityToken,
    setup() { calls.push(id); return {}; },
  });
  const kernel = createKernel({ frameMode: 'auto', adapters: [
    adapter('consumer', [Provider, Existing]), adapter('unrelated'), adapter('provider', [], Provider),
  ] });
  await kernel.registerAdapter({ id: 'existing-hook', capability: 'existing-hook', token: Existing, setup() {} });
  await kernel.boot();
  assert.deepEqual(calls, ['provider', 'consumer', 'unrelated']);
  await kernel.shutdown();
});

test('missing dependencies, cycles, and duplicate controllers fail before acquisition', async () => {
  for (const kind of ['missing', 'cycle', 'duplicate-controller']) {
    let acquired = 0;
    const first = { id: 'first', capability: 'first', setup() { acquired++; return {}; } };
    const second = { id: 'second', capability: 'second', setup() { acquired++; return {}; } };
    if (kind === 'missing') first.dependsOn = ['absent'];
    if (kind === 'cycle') { first.dependsOn = ['second']; second.dependsOn = ['first']; }
    const kernel = createKernel({ adapters: [first, second],
      controllers: kind === 'duplicate-controller' ? [{ id: 'same' }, { id: 'same' }] : [],
    });
    await assert.rejects(kernel.boot());
    assert.equal(acquired, 0);
    assert.equal(kernel.getLifecycleSnapshot().state, 'disposed');
  }
});

test('ambiguous legacy context aliases require an explicit registry', async () => {
  const kernel = createKernel({ frameMode: 'auto', services: { shared: 1 },
    adapters: [{ id: 'adapter', capability: 'shared', setup: () => 2 }],
  });
  await kernel.boot();
  assert.throws(() => kernel.getContext().require('shared'), /Ambiguous capability/);
  assert.equal(kernel.getContext().adapters.require('shared'), 2);
  assert.equal(kernel.getContext().services.require('shared'), 1);
  await kernel.shutdown();
});

test('legacy registry mutation cannot reactivate a failed kernel', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler, controllers: [{ id: 'fatal', update() { throw new Error('fatal'); } }] });
  await kernel.boot();
  scheduler.step(10);
  assert.equal(kernel.getLifecycleSnapshot().state, 'failed');
  const ctx = kernel.getContext();
  assert.throws(() => ctx.services.register('late', {}), /failed kernel/);
  assert.throws(() => ctx.controllers.register({ id: 'late' }), /failed kernel/);
  await assert.rejects(ctx.adapters.register({ id: 'late', capability: 'late', setup: () => ({}) }, ctx), /failed kernel/);
  await kernel.shutdown();
});
