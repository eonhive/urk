/**
 * Company: EonHive Inc. | Title: Motion Preset Contracts
 * Purpose: Verify pure preset definitions, stagger scheduling, and existing playback ownership.
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
  fade,
  slide,
  scale,
  stagger,
} from '@urk/adapters/motion';

test('presets are pure numeric definitions with validated defaults and overrides', () => {
  let writes = 0;
  const onUpdate = () => {
    writes++;
  };
  const options = Object.freeze({ onUpdate });
  for (const [make, from, to, durationMs] of [
    [fade, 0, 1, 300],
    [slide, 24, 0, 400],
    [scale, 0.9, 1, 350],
  ]) {
    assert.deepEqual(make(options), { onUpdate, from, to, durationMs, easing: 'ease-out' });
    const custom = make({
      from: 1,
      to: 0,
      durationMs: 0,
      atMs: 20,
      delayMs: 10,
      easing: 'linear',
      onUpdate,
    });
    assert.deepEqual(
      [custom.from, custom.to, custom.durationMs, custom.atMs, custom.delayMs, custom.easing],
      [1, 0, 0, 20, 10, 'linear'],
    );
  }
  assert.equal(writes, 0);
  assert.throws(() => fade({ from: -0.1, onUpdate }), RangeError);
  assert.throws(() => fade({ to: 2, onUpdate }), RangeError);
  assert.throws(() => scale({ to: -1, onUpdate }), RangeError);
  assert.throws(() => slide({ from: Infinity, onUpdate }), RangeError);
  assert.throws(() => slide({ durationMs: -1, onUpdate }), RangeError);
});

test('stagger adds gaps to authored offsets without mutating entries or delays', () => {
  const entries = Object.freeze([
    Object.freeze(fade({ atMs: 10, delayMs: 15, onUpdate() {} })),
    Object.freeze(slide({ atMs: 20, onUpdate() {} })),
  ]);
  const scheduled = stagger(entries, 80);
  assert.deepEqual(
    scheduled.map((entry) => entry.atMs),
    [10, 100],
  );
  assert.deepEqual(
    entries.map((entry) => entry.atMs),
    [10, 20],
  );
  assert.equal(scheduled[0].delayMs, 15);
  assert.notEqual(scheduled[0], entries[0]);
  assert.deepEqual(stagger([]), []);
  assert.equal(stagger(entries, 0)[1].atMs, 20);
  for (const gap of [-1, Infinity, NaN]) assert.throws(() => stagger(entries, gap), RangeError);
  assert.throws(() => stagger([{ ...entries[0], atMs: -1 }], 100), RangeError);
  assert.throws(() => stagger([...entries, entries[0]], Number.MAX_VALUE), RangeError);
});

test('composed presets inherit seek, speed, pause, reduction, and cancellation from timelines', async (t) => {
  const kernel = createKernel({
    frameMode: 'auto',
    scheduler: new ManualFrameScheduler(),
    adapters: [createMotionAdapter()],
    controllers: [createMotionController()],
  });
  await kernel.boot();
  t.after(() => kernel.shutdown());
  const api = kernel.getContext().require(MotionCapability);
  api.setReducedMotion(false);
  const motion = api.scoped(kernel.getContext().scope);
  const pose = {};
  let completed = 0;
  const timeline = motion.timeline({
    tweens: stagger(
      [
        fade({
          durationMs: 100,
          easing: 'linear',
          onUpdate(value) {
            pose.opacity = value;
          },
        }),
        slide({
          from: 100,
          durationMs: 100,
          easing: 'linear',
          onUpdate(value) {
            pose.x = value;
          },
        }),
        scale({
          from: 0.5,
          durationMs: 100,
          easing: 'linear',
          onUpdate(value) {
            pose.scale = value;
          },
        }),
      ],
      50,
    ),
    onComplete() {
      completed++;
    },
  });
  timeline.pause();
  timeline.seek(75);
  assert.deepEqual(pose, { scale: 0.5, opacity: 0.75, x: 75 });
  timeline.seek(0);
  assert.deepEqual(pose, { scale: 0.5, opacity: 0, x: 100 });
  motion.setPlaybackRate(2);
  timeline.resume();
  api.advance(50);
  assert.deepEqual(pose, { scale: 0.5, opacity: 1, x: 50 });
  timeline.pause();
  api.advance(100);
  assert.equal(timeline.currentTimeMs, 100);
  api.setReducedMotion(true);
  assert.equal((await timeline.finished).status, 'completed');
  assert.deepEqual(pose, { scale: 1, opacity: 1, x: 0 });
  assert.equal(completed, 1);
  api.setReducedMotion(false);
  const cancelled = motion.timeline({
    tweens: [
      fade({
        onUpdate(value) {
          pose.opacity = value;
        },
      }),
    ],
  });
  cancelled.pause();
  cancelled.seek(100);
  await kernel.shutdown();
  const frozen = pose.opacity;
  api.advance(1000);
  assert.equal((await cancelled.finished).status, 'cancelled');
  assert.equal(pose.opacity, frozen);
  assert.equal(api.activeCount, 0);
});
