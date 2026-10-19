/**
 * Company: EonHive Inc. | Title: Finite Timeline Repetition
 * Purpose: Verify repeated/yoyo scheduling through the existing timeline clock and cleanup.
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
  return { kernel, motion };
}
const entry = (onUpdate) => ({ from: 0, to: 100, durationMs: 100, onUpdate });

test('finite passes repeat child delays, apply parent delay once, and notify completion once', async (t) => {
  const { motion } = await fixture(t);
  let value,
    childCompleted = 0,
    completed = 0;
  const handle = motion.timeline({
    delayMs: 10,
    iterations: 2,
    tweens: [
      {
        ...entry((v) => {
          value = v;
        }),
        delayMs: 20,
        onComplete() {
          childCompleted++;
        },
      },
    ],
    onComplete() {
      completed++;
    },
  });
  assert.equal(handle.durationMs, 250);
  motion.advance(70);
  assert.equal(value, 40);
  motion.advance(100);
  assert.equal(value, 20);
  assert.equal(childCompleted, 1);
  motion.advance(1000);
  assert.equal(value, 100);
  assert.equal((await handle.finished).status, 'completed');
  handle.finish();
  motion.advance(1000);
  assert.deepEqual([childCompleted, completed, motion.activeCount], [1, 1, 0]);
});

test('yoyo mirrors easing and child progress, while seeks and finish use the whole duration', async (t) => {
  const { motion } = await fixture(t);
  let value, progress;
  const handle = motion.timeline({
    iterations: 2,
    yoyo: true,
    tweens: [
      {
        ...entry((v, p) => {
          value = v;
          progress = p;
        }),
        easing: (p) => p * p,
      },
    ],
  });
  motion.advance(25);
  assert.equal(value, 6.25);
  motion.advance(100);
  assert.equal(value, 56.25);
  assert.equal(progress, 0.75);
  handle.pause();
  handle.seek(175);
  assert.equal(value, 6.25);
  assert.equal(progress, 0.25);
  handle.finish();
  assert.equal(value, 0);
  assert.equal(handle.currentTimeMs, 200);
  assert.equal((await handle.finished).status, 'completed');
});

test('reverse scheduling handles sequences, trailing mirrored delay, and zero duration', async (t) => {
  const { motion } = await fixture(t);
  let value;
  const handle = motion.timeline({
    iterations: 2,
    yoyo: true,
    tweens: [
      entry((v) => {
        value = v;
      }),
      {
        ...entry((v) => {
          value = v;
        }),
        atMs: 100,
        from: 100,
        to: 200,
      },
    ],
  });
  handle.pause();
  handle.seek(250);
  assert.equal(value, 150);
  handle.seek(350);
  assert.equal(value, 50);
  handle.finish();
  assert.equal(value, 0);
  const delayed = motion.timeline({
    iterations: 2,
    yoyo: true,
    tweens: [
      {
        ...entry((v) => {
          value = v;
        }),
        delayMs: 50,
      },
    ],
  });
  motion.advance(250);
  assert.equal(value, 0);
  assert.equal(delayed.status, 'running');
  motion.advance(50);
  assert.equal((await delayed.finished).status, 'completed');
  const instant = motion.timeline({
    iterations: 3,
    yoyo: true,
    tweens: [
      {
        ...entry((v) => {
          value = v;
        }),
        durationMs: 0,
      },
    ],
  });
  motion.advance(0);
  assert.equal(value, 100);
  assert.equal((await instant.finished).status, 'completed');
});

test('invalid counts reject before writes and repeated work retains pause, speed, and cleanup', async (t) => {
  const { kernel, motion } = await fixture(t);
  const writes = [];
  for (const iterations of [0, -1, 1.5, Infinity, 101]) {
    assert.throws(
      () => motion.timeline({ iterations, tweens: [entry((v) => writes.push(v))] }),
      RangeError,
    );
  }
  assert.equal(writes.length, 0);
  const group = motion.scoped(kernel.getContext().scope);
  group.setPlaybackRate(2);
  const handle = group.timeline({ iterations: 3, tweens: [entry((v) => writes.push(v))] });
  motion.advance(75);
  assert.equal(handle.currentTimeMs, 150);
  group.pause();
  motion.advance(1000);
  assert.equal(handle.currentTimeMs, 150);
  await kernel.shutdown();
  const count = writes.length;
  motion.advance(1000);
  assert.equal(writes.length, count);
  assert.equal((await handle.finished).status, 'cancelled');
  assert.equal(motion.activeCount, 0);
});
