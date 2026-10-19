/**
 * Company: EonHive Inc. | Title: Motion Preference Observation
 * Purpose: Verify effective-mode delivery, observer isolation, and cleanup.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import {
  createMotionAdapter,
  createMotionController,
  MotionCapability,
} from '@urk/adapters/motion';

async function fixture(t) {
  const kernel = createKernel({
    frameMode: 'auto',
    scheduler: new ManualFrameScheduler(),
    adapters: [createMotionAdapter()],
    controllers: [createMotionController()],
  });
  await kernel.boot();
  t.after(() => kernel.shutdown());
  return { kernel, api: kernel.getContext().require(MotionCapability) };
}

test('effective changes isolate observers, suppress stale reentrant delivery, and close on shutdown', async (t) => {
  const { kernel, api } = await fixture(t);
  assert.equal(api.reducedMotion, false);
  const events = [];
  const stopRepeated = api.subscribeReducedMotion((value) => api.setReducedMotion(value));
  const stopThrowing = api.subscribeReducedMotion(() => {
    throw new Error('observer');
  });
  const unsubscribe = api.subscribeReducedMotion((value) => events.push(value));
  assert.deepEqual(events, []);
  api.setReducedMotion(false);
  api.setReducedMotion(true);
  api.setReducedMotion(true);
  api.setReducedMotion(false);
  assert.deepEqual(events, [true, false]);
  unsubscribe();
  unsubscribe();
  stopThrowing();
  stopRepeated();
  api.subscribeReducedMotion((value) => {
    if (value) api.setReducedMotion(false);
  });
  const latest = [];
  api.subscribeReducedMotion((value) => latest.push(value));
  api.setReducedMotion(true);
  assert.equal(api.reducedMotion, false);
  assert.deepEqual(latest, [false]);
  await kernel.shutdown();
  api.subscribeReducedMotion(() => {
    throw new Error('closed');
  })();
  api.setReducedMotion(true);
  assert.deepEqual(latest, [false]);
});

test('system changes respect overrides, finish held work, and detach their native listener', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const nativeListeners = new Set();
  const preference = {
    matches: true,
    addEventListener(_type, listener) {
      nativeListeners.add(listener);
    },
    removeEventListener(_type, listener) {
      nativeListeners.delete(listener);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { matchMedia: () => preference },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete globalThis.window;
  });
  const { kernel, api } = await fixture(t);
  const events = [];
  api.subscribeReducedMotion((value) => events.push(value));
  assert.equal(api.reducedMotion, true);
  api.setReducedMotion(false);
  const timeline = api.timeline({ tweens: [{ from: 0, to: 1, durationMs: 100, onUpdate() {} }] });
  timeline.pause();
  preference.matches = false;
  for (const listener of nativeListeners) listener();
  preference.matches = true;
  for (const listener of nativeListeners) listener();
  assert.equal(api.reducedMotion, false);
  assert.equal(timeline.status, 'paused');
  api.setReducedMotion(undefined);
  assert.equal(api.reducedMotion, true);
  assert.equal((await timeline.finished).status, 'completed');
  assert.deepEqual(events, [false, true]);
  const lateCallback = [...nativeListeners][0];
  await kernel.shutdown();
  assert.equal(nativeListeners.size, 0);
  preference.matches = false;
  lateCallback();
  assert.deepEqual(events, [false, true]);
});
