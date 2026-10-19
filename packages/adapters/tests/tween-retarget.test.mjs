/**
 * Company: EonHive Inc. | Title: Live Tween Retargeting
 * Purpose: Verify value continuity, retained playback ownership, and terminal retarget behavior.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
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
  const motion = kernel.getContext().require(MotionCapability);
  motion.setReducedMotion(false);
  return { kernel, motion, group: motion.scoped(kernel.getContext().scope) };
}

test('retarget starts at the rendered value and retains one promise and completion', async (t) => {
  const { motion } = await fixture(t);
  const writes = [];
  let completed = 0;
  const handle = motion.tween({
    from: 0,
    to: 100,
    durationMs: 100,
    onUpdate(value) {
      writes.push(value);
    },
    onComplete() {
      completed++;
    },
  });
  const finished = handle.finished;
  motion.advance(40);
  assert.equal(handle.value, 40);
  assert.equal(handle.retarget(200), true);
  assert.equal(handle.value, 40);
  assert.equal(writes.length, 1);
  assert.equal(handle.progress, 0);
  assert.equal(handle.finished, finished);
  motion.advance(25);
  assert.equal(handle.value, 80);
  handle.retarget(0, { durationMs: 200, easing: (p) => p * p });
  motion.advance(100);
  assert.equal(handle.value, 60);
  for (const to of [NaN, Infinity]) assert.throws(() => handle.retarget(to), RangeError);
  assert.throws(() => handle.retarget(50, { durationMs: -1 }), RangeError);
  assert.equal(handle.value, 60);
  motion.advance(100);
  assert.equal((await finished).status, 'completed');
  assert.equal(handle.value, 0);
  assert.equal(handle.retarget(10), false);
  assert.equal(completed, 1);
  assert.equal(motion.activeCount, 0);
});

test('retarget skips the original delay while preserving pause, speed, and zero-duration semantics', async (t) => {
  const { kernel, motion, group } = await fixture(t);
  const handle = group.tween({ from: 10, to: 100, durationMs: 100, delayMs: 500, onUpdate() {} });
  motion.advance(100);
  assert.equal(handle.value, 10);
  handle.pause();
  group.setPlaybackRate(2);
  handle.retarget(50);
  motion.advance(100);
  assert.equal(handle.value, 10);
  handle.resume();
  kernel.pause();
  motion.advance(100);
  assert.equal(handle.value, 10);
  kernel.resume();
  motion.advance(10);
  assert.equal(handle.value, 18);
  handle.pause();
  handle.retarget(70, { durationMs: 0 });
  motion.advance(1000);
  assert.equal(handle.value, 18);
  handle.resume();
  motion.advance(0);
  assert.equal(handle.value, 70);
  assert.equal((await handle.finished).status, 'completed');
});

test('callback retargeting invalidates old progress and abort/shutdown prevent later writes', async (t) => {
  const { kernel, motion } = await fixture(t);
  const writes = [];
  const abort = new AbortController();
  let changed = false;
  const handle = motion.tween({
    from: 0,
    to: 100,
    durationMs: 100,
    signal: abort.signal,
    onUpdate(value) {
      writes.push(value);
      if (value === 50 && !changed) {
        changed = true;
        handle.retarget(200);
      }
    },
  });
  motion.advance(50);
  assert.equal(handle.progress, 0);
  motion.advance(20);
  assert.equal(handle.value, 80);
  abort.abort();
  assert.equal((await handle.finished).status, 'cancelled');
  assert.equal(handle.retarget(500), false);
  const pending = motion.tween({
    from: 0,
    to: 1,
    durationMs: 100,
    onUpdate(value) {
      writes.push(value);
    },
  });
  pending.retarget(2);
  await kernel.shutdown();
  const count = writes.length;
  motion.advance(1000);
  assert.equal(writes.length, count);
  assert.equal((await pending.finished).status, 'cancelled');
  assert.equal(motion.activeCount, 0);
});
