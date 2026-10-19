/**
 * Company: EonHive Inc. | Title: Scoped Motion Speed Checks
 * Purpose: Verify speed changes, pause ownership, scope isolation, and cleanup.
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
  t.after(() => kernel.shutdown());
  const api = kernel.getContext().require(MotionCapability);
  api.setReducedMotion(false);
  return { kernel, scheduler, api, group: api.scoped(kernel.getContext().scope) };
}
const clip = (onUpdate) => ({ from: 0, to: 100, durationMs: 100, onUpdate });

test('current/future clock work scales once while seek and pause retain their positions', async (t) => {
  const { kernel, api, group } = await fixture(t);
  let value;
  const tween = group.tween(
    clip((v) => {
      value = v;
    }),
  );
  group.setPlaybackRate(2);
  api.advance(20);
  assert.equal(value, 40);
  group.setPlaybackRate(0.5);
  api.advance(20);
  assert.equal(value, 50);
  const timeline = group.timeline({ tweens: [clip(() => {})] });
  api.advance(20);
  assert.equal(timeline.currentTimeMs, 10);
  timeline.pause();
  timeline.seek(60);
  group.setPlaybackRate(2);
  api.advance(10);
  assert.equal(timeline.currentTimeMs, 60);
  timeline.resume();
  kernel.pause();
  api.advance(1000);
  assert.equal(timeline.currentTimeMs, 60);
  kernel.resume();
  api.advance(20);
  assert.equal(timeline.currentTimeMs, 100);
  assert.equal((await timeline.finished).status, 'completed');
  assert.equal((await tween.finished).status, 'completed');
  for (const rate of [0, -1, NaN, Infinity])
    assert.throws(() => group.setPlaybackRate(rate), RangeError);
  assert.equal(group.playbackRate, 2);
});

test('property timing includes delay, isolates scopes, and releases scaled work at shutdown', async (t) => {
  const { kernel, scheduler, api, group } = await fixture(t);
  const scope = new ResourceScope();
  t.after(() => scope.dispose());
  const other = api.scoped(scope);
  const point = { x: 0 };
  const property = group.tween(point, { x: 100 }, { durationMs: 100, delayMs: 20 });
  const normal = other.timeline({ tweens: [clip(() => {})] });
  group.setPlaybackRate(2);
  scheduler.step(0);
  scheduler.step(20);
  assert.equal(point.x, 20);
  assert.equal(normal.currentTimeMs, 20);
  group.pause();
  group.setPlaybackRate(0.5);
  scheduler.step(1000);
  assert.equal(point.x, 20);
  group.resume();
  scheduler.step(2000);
  scheduler.step(2020);
  assert.equal(point.x, 30);
  await kernel.shutdown();
  assert.equal((await property.finished).status, 'cancelled');
  assert.equal(api.activeCount, 0);
  assert.throws(() => group.setPlaybackRate(1), /disposed/);
});

test('pending native playback inherits speed and changing it preserves individual pause', async (t) => {
  const { kernel, group } = await fixture(t);
  const rates = [];
  let acquisitions = 0,
    cancelled = 0,
    plays = 0;
  const element = {
    animate() {
      acquisitions++;
      return {
        finished: new Promise(() => {}),
        updatePlaybackRate(rate) {
          rates.push(rate);
        },
        pause() {},
        play() {
          plays++;
        },
        cancel() {
          cancelled++;
        },
      };
    },
  };
  group.pause();
  group.setPlaybackRate(0.5);
  const native = group.animate(element, [{ opacity: 0 }, { opacity: 1 }], { durationMs: 100 });
  assert.equal(acquisitions, 0);
  group.resume();
  assert.deepEqual(rates, [0.5]);
  native.pause();
  const before = plays;
  group.setPlaybackRate(2);
  assert.deepEqual(rates, [0.5, 2]);
  assert.equal(plays, before);
  await kernel.shutdown();
  assert.equal((await native.finished).status, 'cancelled');
  assert.equal(cancelled, 1);
});
