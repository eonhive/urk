/**
 * Company: EonHive Inc. | Title: Timeline Seeking Contracts
 * Purpose: Verify deterministic full-pose sampling, retained playback, and terminal ownership.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, ResourceScope } from '@urk/core';
import {
  createMotionAdapter,
  createMotionController,
  MotionCapability,
} from '@urk/adapters/motion';

async function fixture(t) {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({
    frameMode: 'auto',
    scheduler,
    adapters: [createMotionAdapter()],
    controllers: [createMotionController()],
  });
  await kernel.boot();
  const motion = kernel.getContext().require(MotionCapability);
  motion.setReducedMotion(false);
  t.after(() => kernel.shutdown());
  return { motion, kernel, scheduler };
}
const entry = (onUpdate, extra = {}) => ({ from: 0, to: 100, durationMs: 100, onUpdate, ...extra });

test('absolute seeking samples overlap and resets future children on backward seeks', async (t) => {
  const { motion } = await fixture(t);
  const values = {};
  const timeline = motion.timeline({
    delayMs: 10,
    tweens: [
      entry((v) => {
        values.a = v;
      }),
      entry(
        (v) => {
          values.b = v;
        },
        { atMs: 50 },
      ),
      entry(
        (v) => {
          values.c = v;
        },
        { atMs: 150, delayMs: 20 },
      ),
    ],
  });
  assert.equal(timeline.durationMs, 280);
  timeline.pause();
  timeline.seek(85);
  assert.deepEqual(values, { c: 0, a: 75, b: 25 });
  assert.equal(timeline.currentTimeMs, 85);
  assert.equal(timeline.progress, 85 / 280);
  timeline.seek(210);
  assert.deepEqual(values, { c: 30, a: 100, b: 100 });
  timeline.seek(35);
  assert.deepEqual(values, { c: 0, a: 25, b: 0 });
  assert.equal(timeline.status, 'paused');
});

test('sequential clips sharing a binding resolve deterministically around their boundary', async (t) => {
  const { motion } = await fixture(t);
  let value;
  const timeline = motion.timeline({
    tweens: [
      entry((v) => {
        value = v;
      }),
      entry(
        (v) => {
          value = v;
        },
        { from: 100, to: 200, atMs: 100 },
      ),
    ],
  });
  for (const [time, expected] of [
    [150, 150],
    [50, 50],
    [0, 0],
    [100, 100],
    [200, 200],
  ]) {
    timeline.seek(time);
    assert.equal(value, expected);
  }
  assert.equal(timeline.status, 'running');
  timeline.seek(50);
  motion.advance(60);
  assert.equal(value, 110);
});

test('seek clamps finite positions, respects delays and zero-duration clips, and rejects nonfinite input', async (t) => {
  const { motion } = await fixture(t);
  let value = -1;
  const timeline = motion.timeline({
    delayMs: 20,
    tweens: [
      entry(
        (v) => {
          value = v;
        },
        { atMs: 10, durationMs: 0 },
      ),
    ],
  });
  timeline.seek(-100);
  assert.equal(value, 0);
  assert.equal(timeline.currentTimeMs, 0);
  assert.equal(timeline.status, 'pending');
  timeline.seek(29);
  assert.equal(value, 0);
  timeline.seek(30);
  assert.equal(value, 100);
  timeline.seek(5000);
  assert.equal(timeline.currentTimeMs, 30);
  assert.equal(timeline.progress, 1);
  for (const invalid of [NaN, Infinity, -Infinity])
    assert.throws(() => timeline.seek(invalid), RangeError);
  assert.equal(timeline.currentTimeMs, 30);
  const empty = motion.timeline({ tweens: [] });
  empty.seek(0);
  assert.equal(empty.durationMs, 0);
  assert.equal(empty.progress, 1);
  assert.equal(empty.status, 'running');
  empty.cancel();
});

test('seeking uses the same easing and exact numeric endpoints as tween playback', async (t) => {
  const { motion } = await fixture(t);
  let value;
  const timeline = motion.timeline({
    tweens: [
      entry(
        (v) => {
          value = v;
        },
        { easing: (p) => p * p },
      ),
    ],
  });
  timeline.seek(50);
  assert.equal(value, 25);
  timeline.seek(100);
  assert.equal(value, 100);
  timeline.seek(0);
  assert.equal(value, 0);
  const extreme = motion.timeline({
    tweens: [
      entry(
        (v) => {
          value = v;
        },
        { from: -Number.MAX_VALUE, to: Number.MAX_VALUE },
      ),
    ],
  });
  extreme.seek(50);
  assert.equal(value, 0);
});

test('seeking does not complete; resumed playback commits each completion once after rewinds', async (t) => {
  const { motion } = await fixture(t);
  const completed = [];
  let settled = false;
  const timeline = motion.timeline({
    tweens: [
      entry(() => {}, {
        onComplete() {
          completed.push('a');
        },
      }),
      entry(() => {}, {
        atMs: 100,
        onComplete() {
          completed.push('b');
        },
      }),
    ],
    onComplete() {
      completed.push('timeline');
    },
  });
  void timeline.finished.then(() => {
    settled = true;
  });
  timeline.pause();
  timeline.seek(200);
  await Promise.resolve();
  assert.deepEqual(completed, []);
  assert.equal(settled, false);
  timeline.seek(110);
  timeline.resume();
  motion.advance(0);
  assert.deepEqual(completed, ['a']);
  timeline.seek(0);
  assert.equal(motion.activeCount, 2);
  motion.advance(200);
  assert.deepEqual(completed, ['a', 'b', 'timeline']);
  assert.equal((await timeline.finished).status, 'completed');
  timeline.seek(50);
  assert.equal(timeline.currentTimeMs, 200);
  assert.deepEqual(completed, ['a', 'b', 'timeline']);
});

test('kernel, group, and individual pause retain the selected position while explicit seek can render', async (t) => {
  const { motion, kernel, scheduler } = await fixture(t);
  const scope = new ResourceScope();
  t.after(() => scope.dispose());
  const group = motion.scoped(scope);
  let value;
  const timeline = group.timeline({
    tweens: [
      entry((v) => {
        value = v;
      }),
    ],
  });
  scheduler.step(0);
  scheduler.step(20);
  kernel.pause();
  timeline.seek(40);
  assert.equal(value, 40);
  assert.equal(timeline.status, 'paused');
  scheduler.step(5000);
  assert.equal(value, 40);
  kernel.resume();
  scheduler.step(6000);
  scheduler.step(6010);
  assert.equal(value, 50);
  group.pause();
  timeline.seek(60);
  scheduler.step(6020);
  assert.equal(value, 60);
  group.resume();
  timeline.pause();
  scheduler.step(6030);
  assert.equal(value, 60);
  timeline.resume();
  scheduler.step(6040);
  assert.equal(value, 70);
});

test('seeking during an update invalidates the old frame, including its remaining children', async (t) => {
  const { motion } = await fixture(t);
  let rewound = false;
  let a, b;
  const timeline = motion.timeline({
    tweens: [
      entry((value, progress) => {
        a = value;
        if (progress > 0 && !rewound) {
          rewound = true;
          timeline.seek(10);
        }
      }),
      entry((value) => {
        b = value;
      }),
    ],
  });
  motion.advance(80);
  assert.equal(timeline.currentTimeMs, 10);
  assert.equal(a, 10);
  assert.equal(b, 10);
  motion.advance(10);
  assert.equal(a, 20);
  assert.equal(b, 20);
});

test('cancellation inside seek prevents later writes; terminal controls cannot revive owned work', async (t) => {
  const { motion, kernel } = await fixture(t);
  const writes = [];
  let cancel = false;
  const timeline = motion.timeline({
    tweens: [
      entry(() => {
        if (cancel) timeline.cancel('user');
      }),
      entry((value) => writes.push(value)),
    ],
  });
  cancel = true;
  timeline.seek(50);
  assert.equal((await timeline.finished).status, 'cancelled');
  assert.deepEqual(writes, []);
  timeline.seek(0);
  timeline.finish();
  timeline.resume();
  motion.advance(1000);
  assert.deepEqual(writes, []);
  const pending = motion.timeline({ tweens: [entry((v) => writes.push(v))] });
  pending.pause();
  pending.seek(50);
  await kernel.shutdown();
  const count = writes.length;
  pending.seek(0);
  assert.equal((await pending.finished).status, 'cancelled');
  assert.equal(writes.length, count);
  assert.equal(motion.activeCount, 0);
});

test('scope disposal and reduced motion settle a scrubbed timeline, including at its endpoint', async (t) => {
  const { motion } = await fixture(t);
  const scope = new ResourceScope();
  const scoped = motion.scoped(scope).timeline({ tweens: [entry(() => {})] });
  scoped.pause();
  scoped.seek(100);
  await scope.dispose();
  assert.equal((await scoped.finished).status, 'cancelled');
  let completed = 0;
  const timeline = motion.timeline({
    tweens: [
      entry(() => {}, {
        onComplete() {
          completed++;
        },
      }),
    ],
  });
  timeline.pause();
  timeline.seek(50);
  motion.setReducedMotion(true);
  assert.equal((await timeline.finished).status, 'completed');
  assert.equal(completed, 1);
});

test('seek failures settle before throwing; failures in controller updates use the fatal lifecycle', async (t) => {
  const { motion, kernel, scheduler } = await fixture(t);
  const error = new Error('seek binding failed');
  const timeline = motion.timeline({
    tweens: [
      entry(() => {
        throw error;
      }),
    ],
  });
  assert.throws(
    () => timeline.seek(50),
    (e) => e === error,
  );
  assert.deepEqual(await timeline.finished, { status: 'failed', error });
  assert.equal(motion.activeCount, 0);
  assert.equal(kernel.getLifecycleSnapshot().state, 'running');
  const bad = motion.timeline({ tweens: [entry(() => {}, { easing: () => NaN })] });
  scheduler.step(0);
  scheduler.step(50);
  assert.equal((await bad.finished).status, 'failed');
  assert.equal(kernel.getLifecycleSnapshot().state, 'failed');
});

test('seeking from a timeline update suppresses completion of the superseded endpoint', async (t) => {
  const { motion } = await fixture(t);
  let rewound = false;
  let completed = 0;
  const timeline = motion.timeline({
    tweens: [entry(() => {})],
    onUpdate(progress) {
      if (progress === 1 && !rewound) {
        rewound = true;
        timeline.seek(50);
      }
    },
    onComplete() {
      completed++;
    },
  });
  motion.advance(100);
  assert.equal(timeline.currentTimeMs, 50);
  assert.equal(timeline.status, 'running');
  assert.equal(completed, 0);
  motion.advance(50);
  assert.equal((await timeline.finished).status, 'completed');
  assert.equal(completed, 1);
});

test('an action signal cancels a paused endpoint preview without completion or further samples', async (t) => {
  const { motion } = await fixture(t);
  const action = new AbortController();
  let writes = 0;
  let completed = 0;
  const timeline = motion.timeline({
    signal: action.signal,
    tweens: [
      entry(() => {
        writes++;
      }),
    ],
    onComplete() {
      completed++;
    },
  });
  timeline.pause();
  timeline.seek(100);
  action.abort();
  assert.equal((await timeline.finished).status, 'cancelled');
  timeline.seek(0);
  timeline.resume();
  motion.advance(1000);
  assert.equal(writes, 1);
  assert.equal(completed, 0);
  assert.equal(motion.activeCount, 0);
});
