/**
 * Company: EonHive Inc.
 * Title: Lazy Diagnostics Regression Tests
 * Purpose: Verify snapshot caching, observation ownership, and work outside runtime frames.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '../dist/index.js';

function harness(t) {
  const frames = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler: frames });
  t.after(() => kernel.shutdown());
  return { kernel, frames, ctx: kernel.getContext(), inspector: kernel.getInspector() };
}

function listCounters(t, ctx) {
  const counters = {};
  for (const name of ['adapters', 'controllers', 'services']) {
    const registry = ctx[name];
    const original = registry.list;
    counters[name] = 0;
    t.mock.method(registry, 'list', function () {
      counters[name] += 1;
      return original.call(this);
    });
  }
  return counters;
}

test('unopened diagnostics acquire no observation resources or per-frame snapshots', async (t) => {
  let timers = 0;
  t.mock.method(globalThis, 'setInterval', () => { timers += 1; return 0; });
  const { kernel, frames, ctx } = harness(t);
  const lists = listCounters(t, ctx);
  let subscriptions = 0;
  const originalStateSubscribe = ctx.state.subscribe;
  const originalEventSubscribe = ctx.events.onAny;
  t.mock.method(ctx.state, 'subscribe', function (listener) {
    subscriptions += 1;
    return originalStateSubscribe.call(this, listener);
  });
  t.mock.method(ctx.events, 'onAny', function (listener) {
    subscriptions += 1;
    return originalEventSubscribe.call(this, listener);
  });

  await kernel.boot();
  const before = { ...lists };
  for (let frame = 0; frame < 600; frame += 1) {
    frames.step(frame * 16);
    ctx.events.emit({ type: 'frame:probe', source: 'test', timestamp: frame });
  }
  assert.deepEqual(lists, before);
  assert.equal(subscriptions, 0);
  assert.equal(timers, 0);
});

test('snapshot reads remain resource-free and reuse unchanged immutable values', (t) => {
  const { inspector, ctx } = harness(t);
  const lists = listCounters(t, ctx);
  let subscriptions = 0;
  let timers = 0;
  t.mock.method(ctx.state, 'subscribe', () => { subscriptions += 1; return () => {}; });
  t.mock.method(ctx.events, 'onAny', () => { subscriptions += 1; return () => {}; });
  t.mock.method(globalThis, 'setInterval', () => { timers += 1; return 0; });
  const first = inspector.getSnapshot();
  for (let read = 0; read < 100; read += 1) {
    assert.equal(inspector.getSnapshot(), first);
  }
  assert.deepEqual(lists, { adapters: 1, controllers: 1, services: 1 });
  assert.equal(subscriptions, 0);
  assert.equal(timers, 0);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.runtime), true);
  assert.equal(Object.isFrozen(first.services), true);
  assert.throws(() => { first.frameCount = 7; }, TypeError);
  assert.throws(() => { first.services.push({ name: 'fake', kind: 'object' }); }, TypeError);
});

test('registry revisions invalidate only the structural list that changed', async (t) => {
  t.mock.method(Date, 'now', () => 1234);
  const { kernel, inspector, ctx } = harness(t);
  const lists = listCounters(t, ctx);
  const initial = inspector.getSnapshot();
  ctx.services.register('borrowed', {});
  const service = inspector.getSnapshot();
  assert.ok(service.revision > initial.revision);
  assert.equal(service.updatedAt, initial.updatedAt);
  assert.equal(service.adapters, initial.adapters);
  assert.equal(service.controllers, initial.controllers);
  assert.notEqual(service.services, initial.services);
  assert.equal(Object.isFrozen(service.services[0]), true);

  await ctx.adapters.register({ id: 'probe', capability: 'probe', setup: () => ({}) }, ctx);
  const adapter = inspector.getSnapshot();
  assert.notEqual(adapter.adapters, service.adapters);
  assert.equal(adapter.services, service.services);
  ctx.controllers.register({ id: 'controller' });
  const registered = inspector.getSnapshot();
  assert.notEqual(registered.controllers, adapter.controllers);
  await ctx.controllers.initializeOne('controller', ctx);
  const initialized = inspector.getSnapshot();
  assert.equal(initialized.controllers[0].initialized, true);
  await ctx.controllers.startOne('controller', ctx);
  const started = inspector.getSnapshot();
  assert.equal(started.controllers[0].started, true);
  assert.notEqual(started.controllers, initialized.controllers);
  ctx.state.setPhase('ready', 'same-clock-change');
  const state = inspector.getSnapshot();
  assert.ok(state.revision > started.revision);
  assert.equal(state.runtime.phase, 'ready');
  assert.equal(state.controllers, started.controllers);
  assert.deepEqual(lists, { adapters: 2, controllers: 4, services: 2 });
  await kernel.shutdown();
  assert.deepEqual(inspector.getSnapshot().services, []);
});

test('subscribed frame metrics sample at 5 Hz without rebuilding registry lists', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { kernel, inspector, frames, ctx } = harness(t);
  const updates = [];
  inspector.subscribe((snapshot) => { updates.push(snapshot); });
  await kernel.boot();
  updates.length = 0;
  const lists = listCounters(t, ctx);
  const before = inspector.getSnapshot();
  for (let frame = 0; frame < 600; frame += 1) frames.step(frame * 16);
  assert.equal(updates.length, 0);
  t.mock.timers.tick(199);
  assert.equal(updates.length, 0);
  t.mock.timers.tick(1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].frameCount, 600);
  assert.equal(updates[0].controllers, before.controllers);
  assert.deepEqual(lists, { adapters: 0, controllers: 0, services: 0 });
  t.mock.timers.tick(1000);
  assert.equal(updates.length, 1);
});

test('the last unsubscribe releases both upstream observers and the sampler', (t) => {
  const { inspector, ctx } = harness(t);
  const callbacks = [];
  const cleared = [];
  t.mock.method(globalThis, 'setInterval', (callback, delay) => {
    assert.equal(delay, 200);
    callbacks.push(callback);
    return callbacks.length;
  });
  t.mock.method(globalThis, 'clearInterval', (handle) => { cleared.push(handle); });
  let stateSubscriptions = 0;
  let eventSubscriptions = 0;
  const stateSubscribe = ctx.state.subscribe;
  const eventSubscribe = ctx.events.onAny;
  t.mock.method(ctx.state, 'subscribe', function (listener) {
    stateSubscriptions += 1;
    const unsubscribe = stateSubscribe.call(this, listener);
    return () => { stateSubscriptions -= 1; unsubscribe(); };
  });
  t.mock.method(ctx.events, 'onAny', function (listener) {
    eventSubscriptions += 1;
    const unsubscribe = eventSubscribe.call(this, listener);
    return () => { eventSubscriptions -= 1; unsubscribe(); };
  });
  const first = inspector.subscribe(() => {});
  const second = inspector.subscribe(() => {});
  assert.equal(callbacks.length, 1);
  first();
  assert.equal(stateSubscriptions, 1);
  assert.equal(eventSubscriptions, 1);
  second();
  second();
  assert.equal(stateSubscriptions, 0);
  assert.equal(eventSubscriptions, 0);
  assert.deepEqual(cleared, [1]);
  const third = inspector.subscribe(() => {});
  assert.equal(callbacks.length, 2);
  third();
  assert.deepEqual(cleared, [1, 2]);
});

test('event history covers subscribed intervals and retains bounded metadata only', (t) => {
  const { inspector, ctx } = harness(t);
  const emit = (number) => ctx.events.emit({
    type: `event:${number}`, source: 'test', timestamp: number,
    payload: { resource: ctx, circular: ctx.events },
  });
  emit(-1);
  assert.equal(inspector.getSnapshot().totalEvents, 0);
  const unsubscribe = inspector.subscribe(() => {});
  for (let number = 0; number < 80; number += 1) emit(number);
  const snapshot = inspector.getSnapshot();
  assert.equal(snapshot.totalEvents, 80);
  assert.equal(snapshot.recentEvents.length, 60);
  assert.equal(snapshot.recentEvents[0].type, 'event:20');
  assert.equal(snapshot.recentEvents[59].type, 'event:79');
  assert.equal(Object.isFrozen(snapshot.recentEvents), true);
  assert.equal(Object.isFrozen(snapshot.recentEvents[0]), true);
  assert.equal(snapshot.recentEvents.every((event) => !Object.hasOwn(event, 'payload')), true);
  unsubscribe();
  emit(80);
  assert.equal(inspector.getSnapshot(), snapshot);
  const unsubscribeAgain = inspector.subscribe(() => {});
  emit(81);
  assert.equal(inspector.getSnapshot().totalEvents, 81);
  unsubscribeAgain();
});

test('a subscriber can dispose the kernel without losing terminal cleanup', async (t) => {
  const { kernel, inspector, ctx } = harness(t);
  let shutdown;
  inspector.subscribe(() => { shutdown ??= kernel.shutdown(); });
  ctx.events.emit({ type: 'request:shutdown', source: 'test', timestamp: 0 });
  await shutdown;
  const final = inspector.getSnapshot();
  assert.equal(final.disposed, true);
  assert.equal(final.schedulerRunning, false);
  ctx.state.setPhase('ready', 'after-disposal');
  assert.equal(inspector.getSnapshot(), final);
});

test('service kind inspection cannot let a borrowed getter fail startup', async (t) => {
  const { kernel, inspector } = harness(t);
  const borrowed = Object.defineProperty({}, 'constructor', {
    get() { throw new Error('borrowed getter'); },
  });
  kernel.registerService('borrowed', borrowed);
  const proxy = Proxy.revocable({}, {});
  proxy.revoke();
  kernel.registerService('revoked', proxy.proxy);
  inspector.subscribe(() => {});
  await assert.doesNotReject(kernel.boot());
  assert.equal(inspector.getSnapshot().services[0].kind, 'object');
  assert.equal(inspector.getSnapshot().services[1].kind, 'object');
});

test('reentrant state changes do not deliver an older snapshot after a newer revision', (t) => {
  const { inspector, ctx } = harness(t);
  const phases = [];
  inspector.subscribe((snapshot) => {
    if (snapshot.runtime.phase === 'ready') {
      ctx.state.setPhase('transition', 'observer:transition');
    }
  });
  inspector.subscribe((snapshot) => { phases.push(snapshot.runtime.phase); });

  ctx.state.setPhase('ready', 'test:ready');
  assert.equal(inspector.getSnapshot().runtime.phase, 'transition');
  assert.deepEqual(phases, ['transition']);
});
