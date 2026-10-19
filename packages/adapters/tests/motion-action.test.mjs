/**
 * Company: EonHive Inc. | Title: Shared Motion Cancellation
 * Purpose: Prove action-level AbortSignal composition without another cancellation mechanism.
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

test('one shared signal settles multiple handles and leaves unrelated work running', async (t) => {
  const { motion } = await fixture(t);
  const abort = new AbortController();
  const signal = abort.signal;
  const pose = {};
  let unrelated;
  const handles = [
    motion.tween({
      from: 0,
      to: 100,
      durationMs: 100,
      signal,
      onUpdate(value) {
        pose.x = value;
      },
    }),
    motion.timeline({
      signal,
      tweens: [
        {
          from: 1,
          to: 2,
          durationMs: 100,
          onUpdate(value) {
            pose.scale = value;
          },
        },
      ],
    }),
    motion.tween({
      from: 0,
      to: 1,
      durationMs: 100,
      signal,
      onUpdate(value) {
        pose.progress = value;
      },
    }),
  ];
  motion.tween({
    from: 0,
    to: 100,
    durationMs: 200,
    onUpdate(value) {
      unrelated = value;
    },
  });
  motion.advance(40);
  assert.deepEqual(pose, { x: 40, scale: 1.4, progress: 0.4 });
  abort.abort();
  assert.deepEqual(
    (await Promise.all(handles.map((handle) => handle.finished))).map((result) => result.status),
    ['cancelled', 'cancelled', 'cancelled'],
  );
  motion.advance(40);
  assert.deepEqual(pose, { x: 40, scale: 1.4, progress: 0.4 });
  assert.equal(unrelated, 40);
  assert.equal(motion.activeCount, 1);
  const late = motion.timeline({
    signal,
    tweens: [
      {
        from: 0,
        to: 1,
        durationMs: 100,
        onUpdate() {
          throw new Error('aborted action wrote');
        },
      },
    ],
  });
  assert.equal((await late.finished).status, 'cancelled');
});

test('paused cancellation and fresh signals work in the same scope; shutdown settles replacement work', async (t) => {
  const { kernel, motion } = await fixture(t);
  const first = new AbortController();
  const pending = motion.tween({
    from: 0,
    to: 1,
    durationMs: 100,
    signal: first.signal,
    onUpdate() {},
  });
  kernel.pause();
  first.abort();
  assert.equal((await pending.finished).status, 'cancelled');
  const second = new AbortController();
  let value = 0;
  const replacement = motion.tween({
    from: 0,
    to: 1,
    durationMs: 100,
    signal: second.signal,
    onUpdate(next) {
      value = next;
    },
  });
  first.abort();
  motion.advance(1000);
  assert.equal(replacement.status, 'paused');
  assert.equal(value, 0);
  kernel.resume();
  motion.advance(25);
  assert.equal(value, 0.25);
  await kernel.shutdown();
  assert.equal((await replacement.finished).status, 'cancelled');
  motion.advance(1000);
  assert.equal(value, 0.25);
  assert.equal(motion.activeCount, 0);
});
