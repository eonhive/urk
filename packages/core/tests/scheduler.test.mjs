/**
 * Company: EonHive Inc.
 * Title: Frame Scheduler Regression Tests
 * Purpose: Verify frame ownership, restart safety, and deterministic scheduler timing.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { BrowserFrameScheduler, ManualFrameScheduler } from '../dist/index.js';

function installFakeAnimationFrames(t, scheduler) {
  const requestDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const cancelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  const pending = new Map();
  const callbacks = new Map();
  let nextHandle = 0;

  globalThis.requestAnimationFrame = (callback) => {
    const handle = ++nextHandle;
    pending.set(handle, callback);
    callbacks.set(handle, callback);
    return handle;
  };
  globalThis.cancelAnimationFrame = (handle) => pending.delete(handle);

  t.after(() => {
    scheduler.stop();
    if (requestDescriptor) {
      Object.defineProperty(globalThis, 'requestAnimationFrame', requestDescriptor);
    } else {
      delete globalThis.requestAnimationFrame;
    }
    if (cancelDescriptor) {
      Object.defineProperty(globalThis, 'cancelAnimationFrame', cancelDescriptor);
    } else {
      delete globalThis.cancelAnimationFrame;
    }
  });

  return {
    pending,
    fire(handle, timeMs) {
      const callback = callbacks.get(handle);
      assert.ok(callback, `Unknown animation frame ${handle}`);
      pending.delete(handle);
      callback(timeMs);
    },
    fireNext(timeMs) {
      const [handle] = pending.keys();
      assert.notEqual(handle, undefined, 'Expected a pending animation frame');
      this.fire(handle, timeMs);
    },
  };
}

test('browser restart inside a frame leaves exactly one pending request', (t) => {
  const scheduler = new BrowserFrameScheduler();
  const frames = installFakeAnimationFrames(t, scheduler);
  const received = [];

  scheduler.start(() => {
    scheduler.stop();
    scheduler.start((frame) => received.push(frame));
  });

  frames.fireNext(100);
  assert.equal(frames.pending.size, 1);
  frames.fireNext(120);
  assert.deepEqual(received, [{ timeMs: 120, deltaMs: 0, deltaSeconds: 0, frame: 1 }]);
  assert.equal(frames.pending.size, 1);
  scheduler.stop();
  assert.equal(frames.pending.size, 0);
});

test('browser ignores a cancelled callback delivered after restart', (t) => {
  const scheduler = new BrowserFrameScheduler();
  const frames = installFakeAnimationFrames(t, scheduler);
  const oldFrames = [];
  const newFrames = [];

  scheduler.start((frame) => oldFrames.push(frame));
  const [staleHandle] = frames.pending.keys();
  scheduler.stop();
  scheduler.start((frame) => newFrames.push(frame));

  // A callback already dispatched by the host can outlive cancellation.
  frames.fire(staleHandle, 100);
  assert.deepEqual(oldFrames, []);
  assert.deepEqual(newFrames, []);
  assert.equal(frames.pending.size, 1);
  frames.fireNext(120);
  assert.deepEqual(newFrames, [{ timeMs: 120, deltaMs: 0, deltaSeconds: 0, frame: 1 }]);
  scheduler.stop();
  assert.equal(frames.pending.size, 0);
});

test('browser preserves timing, callback receiver, and repeated start behavior', (t) => {
  const scheduler = new BrowserFrameScheduler();
  const frames = installFakeAnimationFrames(t, scheduler);
  const received = [];

  scheduler.start(function (frame) {
    assert.equal(this, scheduler);
    received.push(frame);
  });
  scheduler.start(() => assert.fail('A repeated start must retain the active callback'));
  assert.equal(scheduler.isRunning(), true);
  assert.equal(frames.pending.size, 1);

  frames.fireNext(100);
  frames.fireNext(125);
  frames.fireNext(120);
  frames.fireNext(5120);
  assert.deepEqual(received, [
    { timeMs: 100, deltaMs: 0, deltaSeconds: 0, frame: 1 },
    { timeMs: 125, deltaMs: 25, deltaSeconds: 0.025, frame: 2 },
    { timeMs: 120, deltaMs: 0, deltaSeconds: 0, frame: 3 },
    { timeMs: 5120, deltaMs: 5000, deltaSeconds: 5, frame: 4 },
  ]);

  const [staleHandle] = frames.pending.keys();
  scheduler.stop();
  scheduler.stop();
  frames.fire(staleHandle, 5140);
  assert.equal(scheduler.isRunning(), false);
  assert.equal(frames.pending.size, 0);
  assert.equal(received.length, 4);
});

test('browser stop inside a callback does not schedule another frame', (t) => {
  const scheduler = new BrowserFrameScheduler();
  const frames = installFakeAnimationFrames(t, scheduler);

  scheduler.start(() => scheduler.stop());
  frames.fireNext(100);
  assert.equal(scheduler.isRunning(), false);
  assert.equal(frames.pending.size, 0);
});

test('manual scheduler advances only on step and preserves browser timing', () => {
  const scheduler = new ManualFrameScheduler();
  const received = [];

  assert.equal(scheduler.isRunning(), false);
  scheduler.step(50);
  scheduler.start(function (frame) {
    assert.equal(this, scheduler);
    received.push(frame);
  });
  scheduler.start(() => assert.fail('A repeated start must retain the active callback'));
  assert.equal(scheduler.isRunning(), true);
  assert.deepEqual(received, []);

  scheduler.step(100);
  scheduler.step(125);
  scheduler.step(120);
  scheduler.step(5120);
  assert.deepEqual(received, [
    { timeMs: 100, deltaMs: 0, deltaSeconds: 0, frame: 1 },
    { timeMs: 125, deltaMs: 25, deltaSeconds: 0.025, frame: 2 },
    { timeMs: 120, deltaMs: 0, deltaSeconds: 0, frame: 3 },
    { timeMs: 5120, deltaMs: 5000, deltaSeconds: 5, frame: 4 },
  ]);

  scheduler.stop();
  scheduler.stop();
  scheduler.step(5140);
  assert.equal(scheduler.isRunning(), false);
  assert.equal(received.length, 4);
});

test('manual restart inside a frame starts at frame one on the next step', () => {
  const scheduler = new ManualFrameScheduler();
  const received = [];

  scheduler.start(() => {
    scheduler.stop();
    scheduler.start((frame) => received.push(frame));
  });

  scheduler.step(100);
  assert.deepEqual(received, []);
  scheduler.step(120);
  scheduler.step(140);
  assert.deepEqual(received, [
    { timeMs: 120, deltaMs: 0, deltaSeconds: 0, frame: 1 },
    { timeMs: 140, deltaMs: 20, deltaSeconds: 0.02, frame: 2 },
  ]);
  scheduler.stop();
});
