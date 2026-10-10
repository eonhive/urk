/**
 * Company: EonHive Inc.
 * Title: Runtime Inspector Cleanup Tests
 * Purpose: Verify diagnostics release subscriptions on disposal and kernel cleanup.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { CleanupError, createKernel, EventBus, ManualFrameScheduler, RuntimeStore } from '../dist/index.js';
import { createRuntimeInspector } from '../dist/runtime-inspector.js';

function trackSubscriptions(t, target, method) {
  const original = target[method];
  const tracking = { active: new Set(), unsubscribeCalls: 0 };

  t.mock.method(target, method, function (listener) {
    const unsubscribe = original.call(this, listener);
    tracking.active.add(listener);

    return () => {
      tracking.unsubscribeCalls += 1;
      tracking.active.delete(listener);
      unsubscribe();
    };
  });

  return tracking;
}

function inspectorHarness(t) {
  const state = new RuntimeStore('boot');
  const events = new EventBus();
  const stateSubscriptions = trackSubscriptions(t, state, 'subscribe');
  const eventSubscriptions = trackSubscriptions(t, events, 'onAny');
  const status = { booted: false, disposed: false, schedulerRunning: false, frameCount: 0 };
  const ctx = {
    id: 'inspector-test',
    state,
    events,
    adapters: { list: () => [], getRevision: () => 0 },
    controllers: { list: () => [], getRevision: () => 0 },
    services: { list: () => [], getRevision: () => 0 },
  };
  const inspector = createRuntimeInspector(ctx, () => status);

  return { inspector, state, events, status, stateSubscriptions, eventSubscriptions };
}

function trackKernelSubscriptions(t) {
  return {
    state: trackSubscriptions(t, RuntimeStore.prototype, 'subscribe'),
    events: trackSubscriptions(t, EventBus.prototype, 'onAny'),
  };
}

function assertKernelDetached(kernel, subscriptions) {
  assert.equal(subscriptions.state.active.size, 0);
  assert.equal(subscriptions.events.active.size, 0);
  assert.equal(subscriptions.state.unsubscribeCalls, 2);
  assert.equal(subscriptions.events.unsubscribeCalls, 1);

  const inspector = kernel.getInspector();
  const finalSnapshot = inspector.getSnapshot();
  assert.equal(finalSnapshot.disposed, true);
  assert.equal(finalSnapshot.schedulerRunning, false);
  kernel.getContext().state.setPhase('ready', 'test:after-shutdown');
  kernel.getEventBus().emit({ type: 'test:after-shutdown', source: 'test', timestamp: 0 });
  assert.deepEqual(inspector.getSnapshot(), finalSnapshot);
}

test('inspector disposal detaches both subscriptions exactly once', (t) => {
  const { inspector, stateSubscriptions, eventSubscriptions } = inspectorHarness(t);
  inspector.subscribe(() => {});
  assert.equal(stateSubscriptions.active.size, 1);
  assert.equal(eventSubscriptions.active.size, 1);

  inspector.dispose();
  inspector.dispose();

  assert.equal(stateSubscriptions.active.size, 0);
  assert.equal(eventSubscriptions.active.size, 0);
  assert.equal(stateSubscriptions.unsubscribeCalls, 1);
  assert.equal(eventSubscriptions.unsubscribeCalls, 1);
});

test('disposed inspector ignores new subscriptions, publication, state, and events', (t) => {
  const { inspector, state, events, status } = inspectorHarness(t);
  let notifications = 0;
  const unsubscribe = inspector.subscribe(() => { notifications += 1; });
  inspector.publish();
  assert.equal(notifications, 1);
  inspector.dispose();
  const finalSnapshot = inspector.getSnapshot();

  const unsubscribeAfterDisposal = inspector.subscribe(() => { notifications += 1; });
  status.frameCount = 10;
  state.setPhase('ready', 'test:after-disposal');
  events.emit({ type: 'test:after-disposal', source: 'test', timestamp: 0 });
  inspector.publish();
  unsubscribe();
  unsubscribeAfterDisposal();

  assert.equal(notifications, 1);
  assert.deepEqual(inspector.getSnapshot(), finalSnapshot);
});

test('throwing inspector listeners do not hide sibling notifications', (t) => {
  const { inspector } = inspectorHarness(t);
  let notifications = 0;
  inspector.subscribe(() => { throw new Error('diagnostic observer failed'); });
  inspector.subscribe(() => { notifications += 1; });

  assert.doesNotThrow(() => inspector.publish());

  assert.equal(notifications, 1);
  inspector.dispose();
});

test('throwing inspector listeners do not stop state or event observers', (t) => {
  const { inspector, state, events } = inspectorHarness(t);
  let stateNotifications = 0;
  let eventNotifications = 0;
  inspector.subscribe(() => { throw new Error('diagnostic observer failed'); });
  state.subscribe(() => { stateNotifications += 1; });
  events.on('test:event', () => { eventNotifications += 1; });

  assert.doesNotThrow(() => state.setPhase('ready', 'test:state'));
  assert.doesNotThrow(() => events.emit({ type: 'test:event', source: 'test', timestamp: 0 }));

  assert.equal(stateNotifications, 1);
  assert.equal(eventNotifications, 1);
  inspector.dispose();
});

test('throwing inspector listeners cannot fail kernel startup', async () => {
  const frames = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler: frames });
  let started = 0;
  kernel.getInspector().subscribe(() => { throw new Error('diagnostic observer failed'); });
  kernel.getEventBus().on('runtime:booted', () => { started += 1; });

  await assert.doesNotReject(kernel.boot());

  assert.equal(started, 1);
  assert.equal(frames.isRunning(), true);
  await kernel.shutdown();
});

test('completed kernel shutdown detaches inspector subscriptions', async (t) => {
  const subscriptions = trackKernelSubscriptions(t);
  const kernel = createKernel({ scheduler: new ManualFrameScheduler() });
  kernel.getInspector().subscribe(() => {});
  await kernel.boot();
  assert.equal(subscriptions.state.active.size, 2);
  assert.equal(subscriptions.events.active.size, 1);

  await kernel.shutdown();
  await kernel.shutdown();

  assertKernelDetached(kernel, subscriptions);
});

test('kernel cleanup failure still detaches inspector subscriptions', async (t) => {
  const subscriptions = trackKernelSubscriptions(t);
  const cleanupError = new Error('controller cleanup failed');
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    controllers: [{ id: 'failing-cleanup', dispose() { throw cleanupError; } }],
  });
  kernel.getInspector().subscribe(() => {});
  await kernel.boot();

  await assert.rejects(kernel.shutdown(), (error) => {
    assert.ok(error instanceof CleanupError);
    assert.deepEqual(error.errors, [cleanupError]);
    return true;
  });

  assertKernelDetached(kernel, subscriptions);
});

test('startup rollback detaches inspector subscriptions while preserving the startup failure', async (t) => {
  const subscriptions = trackKernelSubscriptions(t);
  const startupError = new Error('controller startup failed');
  const kernel = createKernel({
    scheduler: new ManualFrameScheduler(),
    controllers: [{ id: 'failing-start', start() { throw startupError; } }],
  });
  kernel.getInspector().subscribe(() => {});

  await assert.rejects(kernel.boot(), (error) => error === startupError);

  assertKernelDetached(kernel, subscriptions);
});
