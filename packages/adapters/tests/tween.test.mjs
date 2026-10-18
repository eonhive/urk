/**
 * Company: EonHive Inc. | Title: Numeric Motion Contracts
 * Purpose: Verify frame demand, lifecycle timing, property conflicts, and destination cleanup.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, ResourceScope } from '@urk/core';
import { createMotionAdapter, MotionCapability } from '@urk/adapters/motion';

async function fixture(t, controllers = []) {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()], controllers });
  await kernel.boot();
  const scope = new ResourceScope();
  const api = kernel.getContext().require(MotionCapability);
  t.after(async () => { await scope.dispose(); await kernel.shutdown(); });
  return { scheduler, kernel, scope, api, motion: api.scoped(scope) };
}
const timing = { durationMs: 100 };

test('numeric work interpolates before render and does not stop unrelated controller demand', async t => {
  const target = { x: 0 };
  const rendered = [];
  const { scheduler, motion } = await fixture(t, [{ id: 'render', update() { rendered.push(target.x); } }]);
  const playback = motion.tween(target, { x: 10 }, timing);
  scheduler.step(0);
  scheduler.step(50);
  scheduler.step(100);
  assert.deepEqual(rendered, [0, 5, 10]);
  assert.deepEqual(await playback.finished, { status: 'completed' });
  assert.equal(motion.activeCount, 0);
  assert.equal(scheduler.isRunning(), true);
});

test('first tween acquires frame demand and completion or cancellation returns an auto kernel to idle', async t => {
  const { scheduler, motion } = await fixture(t);
  const target = { x: 0 };
  assert.equal(scheduler.isRunning(), false);
  const playback = motion.tween(target, { x: 10 }, timing);
  assert.equal(scheduler.isRunning(), true);
  scheduler.step(1000);
  scheduler.step(1100);
  assert.equal((await playback.finished).status, 'completed');
  assert.equal(scheduler.isRunning(), false);
  const next = motion.tween(target, { x: 0 }, timing);
  next.cancel();
  assert.equal((await next.finished).status, 'cancelled');
  assert.equal(target.x, 10);
  assert.equal(scheduler.isRunning(), false);
});

test('runtime, group, and individual pauses exclude paused time, including while unrelated frames continue', async t => {
  const { scheduler, kernel, motion } = await fixture(t, [{ id: 'render', update() {} }]);
  const target = { x: 0 };
  const playback = motion.tween(target, { x: 100 }, timing);
  scheduler.step(0);
  scheduler.step(20);
  kernel.pause();
  scheduler.step(5000);
  kernel.resume();
  scheduler.step(6000);
  assert.equal(target.x, 20);
  scheduler.step(6010);
  playback.pause();
  motion.pause();
  motion.resume();
  scheduler.step(9000);
  assert.equal(target.x, 30);
  playback.resume();
  scheduler.step(10000);
  scheduler.step(10020);
  assert.equal(target.x, 50);
  motion.pause();
  playback.resume();
  scheduler.step(20000);
  assert.equal(target.x, 50);
  motion.resume();
  scheduler.step(21000);
  scheduler.step(21050);
  assert.equal((await playback.finished).status, 'completed');
  assert.equal(target.x, 100);
});

test('pausing all numeric work releases its own frame demand', async t => {
  const { scheduler, motion } = await fixture(t);
  const playback = motion.tween({ x: 0 }, { x: 1 }, timing);
  playback.pause();
  assert.equal(scheduler.isRunning(), false);
  playback.resume();
  assert.equal(scheduler.isRunning(), true);
  motion.pause();
  assert.equal(scheduler.isRunning(), false);
  playback.resume();
  assert.equal(scheduler.isRunning(), false);
  motion.resume();
  playback.finish();
  assert.equal(scheduler.isRunning(), false);
});

test('overlapping properties cancel the old whole operation and start at current values across scopes', async t => {
  const { scheduler, motion, api } = await fixture(t);
  const scope = new ResourceScope();
  t.after(() => scope.dispose());
  const target = { x: 0, y: 0, z: 0 };
  const first = motion.tween(target, { x: 10, y: 20 }, timing);
  const independent = motion.tween(target, { z: 30 }, timing);
  scheduler.step(0);
  scheduler.step(50);
  const next = api.scoped(scope).tween(target, { x: 15 }, timing);
  assert.deepEqual(await first.finished, { status: 'cancelled', reason: 'replaced' });
  scheduler.step(60);
  assert.equal(target.x, 5);
  scheduler.step(110);
  assert.equal(target.x, 10);
  assert.equal(target.y, 10);
  assert.equal((await independent.finished).status, 'completed');
  next.finish();
  assert.equal(target.x, 15);
  assert.equal(scheduler.isRunning(), false);
});

test('delay and CSS easing preserve endpoints; finish and zero duration redraw once with destination values', async t => {
  const { scheduler, motion } = await fixture(t);
  const target = { x: 0 };
  let updates = 0;
  const options = { ...timing, delayMs: 50, easing: 'ease-in', onUpdate() { updates++; } };
  const playback = motion.tween(target, { x: 1 }, options);
  scheduler.step(0);
  scheduler.step(25);
  assert.equal(updates, 0);
  scheduler.step(100);
  assert.ok(Math.abs(target.x - 0.3153568) < 0.00001);
  playback.pause();
  playback.finish();
  assert.equal(target.x, 1);
  assert.equal(updates, 2);
  playback.resume();
  playback.finish();
  assert.equal(updates, 2);
  const instant = motion.tween(target, { x: 2 }, { durationMs: 0, onUpdate() { updates++; } });
  assert.equal((await instant.finished).status, 'completed');
  assert.equal(target.x, 2);
  assert.equal(updates, 3);
  assert.equal(scheduler.isRunning(), false);
});

test('invalid numeric requests throw without interrupting active work', async t => {
  const { scheduler, motion } = await fixture(t);
  const target = { x: 0, label: 'hello' };
  const playback = motion.tween(target, { x: 1 }, timing);
  for (const properties of [{}, { x: NaN }, { missing: 2 }, { label: 2 }, { 'x.y': 3 }]) {
    assert.throws(() => motion.tween(target, properties, timing), TypeError);
  }
  assert.throws(() => motion.tween(target, { x: 2 }, { durationMs: -1 }), RangeError);
  assert.throws(() => motion.tween(Object.freeze({ x: 0 }), { x: 1 }, timing), TypeError);
  assert.throws(() => motion.tween({ get x() { return 0; } }, { x: 1 }, timing), TypeError);
  assert.equal(motion.activeCount, 1);
  assert.equal(scheduler.isRunning(), true);
  playback.finish();
});

test('owner disposal and action abort release demand and preserve the last written values', async t => {
  const { scheduler, motion, scope } = await fixture(t);
  const target = { x: 0 };
  const action = new AbortController();
  const first = motion.tween(target, { x: 10 }, { ...timing, signal: action.signal });
  scheduler.step(0);
  scheduler.step(50);
  action.abort();
  assert.equal((await first.finished).status, 'cancelled');
  assert.equal(target.x, 5);
  const next = motion.tween(target, { x: 20 }, timing);
  const skipped = motion.tween(target, { x: 30 }, { ...timing, signal: action.signal });
  assert.equal((await skipped.finished).status, 'cancelled');
  assert.equal(motion.activeCount, 1);
  await scope.dispose();
  assert.equal((await next.finished).status, 'cancelled');
  assert.equal(target.x, 5);
  assert.equal(scheduler.isRunning(), false);
  assert.throws(() => motion.tween(target, { x: 0 }, timing), /disposed/);
});

test('startup queues numeric and native work; cancellation before running releases it', async () => {
  const scheduler = new ManualFrameScheduler();
  const target = { x: 0 };
  let playback, cancelled, nativeCalls = 0;
  const kernel = createKernel({ scheduler, frameMode: 'auto', adapters: [createMotionAdapter()], controllers: [{
    id: 'start', start(ctx) {
      const motion = ctx.require(MotionCapability).scoped(ctx.scope);
      playback = motion.tween(target, { x: 10 }, timing);
      const native = motion.animate({ animate() { nativeCalls++; throw new Error('must stay queued'); } },
        [{ opacity: 0 }, { opacity: 1 }], timing);
      native.cancel();
      cancelled = native.finished;
      assert.equal(scheduler.isRunning(), false);
      assert.equal(nativeCalls, 0);
    },
  }] });
  await kernel.boot();
  scheduler.step(0);
  scheduler.step(100);
  assert.equal((await playback.finished).status, 'completed');
  assert.equal((await cancelled).status, 'cancelled');
  assert.equal(nativeCalls, 0);
  await kernel.shutdown();
});

test('runtime failure settles motion and prevents new work', async t => {
  const { kernel, motion, scheduler } = await fixture(t);
  const playback = motion.tween({ x: 0 }, { x: 1 }, timing);
  kernel.getContext().registerFrameWork(() => { throw new Error('renderer failed'); });
  scheduler.step(0);
  assert.deepEqual(await playback.finished, { status: 'cancelled', reason: 'runtime-failed' });
  assert.equal(motion.activeCount, 0);
  assert.equal(scheduler.isRunning(), false);
  assert.throws(() => motion.tween({ x: 0 }, { x: 1 }, timing), /disposed/);
});

test('write and redraw failures settle as failed; reentrant replacement does not receive stale updates', async t => {
  const { motion, scheduler } = await fixture(t);
  const target = { x: 0 };
  const error = new Error('redraw failed');
  const failed = motion.tween(target, { x: 10 }, { ...timing, onUpdate() { throw error; } });
  scheduler.step(0);
  assert.deepEqual(await failed.finished, { status: 'failed', error });
  const frozen = { x: 0 };
  const write = motion.tween(frozen, { x: 10 }, timing);
  Object.freeze(frozen);
  write.finish();
  assert.equal((await write.finished).status, 'failed');
  let replacement;
  const first = motion.tween(target, { x: 10 }, { ...timing, onUpdate() {
    replacement ??= motion.tween(target, { x: 20 }, timing);
  } });
  scheduler.step(0);
  assert.equal((await first.finished).status, 'cancelled');
  assert.equal(motion.activeCount, 1);
  replacement.finish();
  assert.equal(target.x, 20);
  assert.equal(scheduler.isRunning(), false);
});
