/**
 * Company: EonHive Inc. | Title: Controller Motion Contracts
 * Purpose: Verify deterministic value tweens, timeline ownership, callback safety, and runtime cleanup.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, ResourceScope } from '@urk/core';
import { createMotionAdapter, createMotionController, MotionCapability } from '@urk/adapters/motion';

async function fixture(t) {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()], controllers: [createMotionController()] });
  await kernel.boot();
  const motion = kernel.getContext().require(MotionCapability);
  motion.setReducedMotion(false);
  t.after(() => kernel.shutdown());
  return { kernel, scheduler, motion };
}
const tween = (onUpdate, extra = {}) => ({ from: 0, to: 100, durationMs: 100, onUpdate, ...extra });

test('value tween uses deltas, reports progress, and writes the exact destination once on overshoot', async t => {
  const { scheduler, motion } = await fixture(t);
  const updates = [];
  let completions = 0;
  const handle = motion.tween(tween((value, progress) => updates.push([value, progress]), { onComplete() { completions++; } }));
  assert.equal(handle.status, 'pending');
  scheduler.step(9000);
  scheduler.step(9025);
  scheduler.step(9050);
  scheduler.step(9500);
  scheduler.step(9600);
  assert.deepEqual(updates, [[0, 0], [25, .25], [50, .5], [100, 1]]);
  assert.deepEqual(await handle.finished, { status: 'completed' });
  assert.equal(handle.status, 'completed');
  assert.equal(handle.progress, 1);
  handle.finish(); handle.cancel(); handle.pause(); handle.resume();
  assert.equal(completions, 1);
  assert.equal(motion.activeCount, 0);
  // The compatibility controller does not retain demand after the last operation.
  assert.equal(scheduler.isRunning(), false);
});

test('CSS easings and custom easing share the numeric interpolation path', async t => {
  const { motion } = await fixture(t);
  const values = [];
  for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out', p => p * p]) {
    motion.tween(tween(value => values.push(value), { easing }));
  }
  motion.advance(50);
  assert.ok(Math.abs(values[0] - 50) < 1e-5);
  assert.ok(Math.abs(values[1] - 31.53568) < 1e-4);
  assert.ok(Math.abs(values[2] - 68.46432) < 1e-4);
  assert.ok(Math.abs(values[3] - 50) < 1e-4);
  assert.equal(values[4], 25);
});

test('delay applies to zero-duration work and zero-delay starts on its first update', async t => {
  const { motion } = await fixture(t);
  const values = [];
  const handle = motion.tween(tween(value => values.push(value), { durationMs: 0, delayMs: 50 }));
  motion.advance(0);
  motion.advance(49);
  assert.equal(handle.status, 'pending');
  assert.deepEqual(values, []);
  motion.advance(1);
  motion.advance(100);
  assert.deepEqual(values, [100]);
  assert.equal((await handle.finished).status, 'completed');
  const instant = motion.tween(tween(value => values.push(value), { durationMs: 0 }));
  motion.advance(0);
  assert.equal((await instant.finished).status, 'completed');
  assert.deepEqual(values, [100, 100]);
});

test('timeline coordinates sequential, parallel, overlapping, and delayed children', async t => {
  const { motion } = await fixture(t);
  const values = {};
  const completed = [];
  const entry = (id, atMs, durationMs, delayMs = 0) => ({ ...tween(value => { values[id] = value; }), atMs, durationMs, delayMs, onComplete() { completed.push(id); } });
  const handle = motion.timeline({ delayMs: 10, tweens: [entry('C', 700, 300), entry('A', 0, 400), entry('B', 200, 500), entry('D', 200, 200, 20)] });
  motion.advance(210);
  assert.deepEqual(values, { A: 50, B: 0 });
  assert.equal(motion.activeCount, 4);
  motion.advance(200);
  assert.equal(values.A, 100);
  assert.equal(values.B, 40);
  assert.equal(values.D, 90);
  assert.deepEqual(completed, ['A']);
  assert.equal(handle.progress, 410 / 1010);
  motion.advance(6000);
  assert.deepEqual(values, { A: 100, B: 100, D: 100, C: 100 });
  assert.deepEqual(completed, ['A', 'D', 'B', 'C']);
  assert.equal((await handle.finished).status, 'completed');
  assert.equal(motion.activeCount, 0);
});

test('large frame visits completion boundaries before later start callbacks', async t => {
  const { motion } = await fixture(t);
  const order = [];
  const handle = motion.timeline({ tweens: [
    { ...tween(() => {}, { durationMs: 40, onComplete() { order.push('out'); } }), atMs: 0 },
    { ...tween(() => { if (!order.includes('in')) order.push('in'); }), atMs: 40 },
  ], onComplete() { order.push('done'); } });
  motion.advance(1000);
  assert.equal((await handle.finished).status, 'completed');
  assert.deepEqual(order, ['out', 'in', 'done']);
});

test('individual, group, timeline, and kernel pause preserve exact progress', async t => {
  const { motion, kernel, scheduler } = await fixture(t);
  const scope = new ResourceScope();
  t.after(() => scope.dispose());
  const group = motion.scoped(scope);
  let value;
  const handle = group.timeline({ tweens: [tween(v => { value = v; })] });
  scheduler.step(0); scheduler.step(20);
  handle.pause(); scheduler.step(200);
  assert.equal(handle.status, 'paused');
  assert.equal(value, 20);
  group.pause(); handle.resume(); scheduler.step(300);
  assert.equal(value, 20);
  group.resume(); scheduler.step(310);
  assert.equal(value, 30);
  kernel.pause(); scheduler.step(5000);
  assert.equal(handle.status, 'paused');
  kernel.resume(); scheduler.step(6000);
  assert.equal(value, 30);
  scheduler.step(6020);
  assert.equal(value, 50);
  handle.cancel();
  assert.equal((await handle.finished).status, 'cancelled');
});

test('callback cancellation prevents later writes and newly created work waits for the next frame', async t => {
  const { motion } = await fixture(t);
  const writes = [];
  let added;
  const first = motion.tween(tween(() => {
    second.cancel();
    added ??= motion.tween(tween(value => writes.push(value)));
  }));
  const second = motion.tween(tween(() => { throw new Error('cancelled work wrote'); }));
  motion.advance(25);
  assert.deepEqual(writes, []);
  assert.equal((await second.finished).status, 'cancelled');
  first.cancel();
  motion.advance(25);
  assert.deepEqual(writes, [25]);
  const timeline = motion.timeline({ tweens: [
    tween(() => timeline.cancel()),
    tween(() => { throw new Error('cancelled timeline child wrote'); }),
  ] });
  motion.advance(0);
  assert.equal((await timeline.finished).status, 'cancelled');
});

test('scope disposal, action abort, and kernel shutdown settle all owned handles without future writes', async t => {
  const { motion, kernel, scheduler } = await fixture(t);
  const scope = new ResourceScope();
  const action = new AbortController();
  let writes = 0;
  const scoped = motion.scoped(scope);
  const a = scoped.tween(tween(() => { writes++; }));
  const b = motion.timeline({ tweens: [tween(() => { writes++; }, { delayMs: 500 })] });
  const c = motion.tween(tween(() => { writes++; }, { signal: action.signal }));
  action.abort();
  await scope.dispose();
  await kernel.shutdown();
  scheduler.step(1000);
  assert.equal(writes, 0);
  for (const handle of [a, b, c]) assert.equal((await handle.finished).status, 'cancelled');
  assert.equal(motion.activeCount, 0);
  assert.throws(() => scoped.timeline({ tweens: [] }), /disposed/);
  assert.throws(() => motion.tween(tween(() => {})), /disposed/);
});

test('invalid requests fail before admission; callback failures settle and follow kernel fatal-update policy', async t => {
  const { motion, kernel, scheduler } = await fixture(t);
  for (const invalid of [{ from: Infinity }, { to: NaN }, { durationMs: -1 }, { delayMs: Infinity }, { easing: 'spring' }, { onComplete: 1 }]) {
    assert.throws(() => motion.tween(tween(() => {}, invalid)));
  }
  assert.throws(() => motion.timeline({ tweens: [{ ...tween(() => {}), atMs: -1 }] }));
  assert.throws(() => motion.timeline({ tweens: [{ ...tween(() => {}, { durationMs: Number.MAX_VALUE }), atMs: Number.MAX_VALUE }] }));
  assert.throws(() => motion.advance(NaN));
  assert.equal(motion.activeCount, 0);
  const error = new Error('binding failed');
  const failed = motion.timeline({ tweens: [tween(() => { throw error; })] });
  const other = motion.tween(tween(() => { throw new Error('later work must not run'); }));
  scheduler.step(0);
  assert.deepEqual(await failed.finished, { status: 'failed', error });
  assert.equal((await other.finished).status, 'cancelled');
  assert.equal(kernel.getLifecycleSnapshot().state, 'failed');
  assert.equal(scheduler.isRunning(), false);
});

test('empty timelines and reduced-motion completion settle once, including paused work', async t => {
  const { motion } = await fixture(t);
  const empty = motion.timeline({ tweens: [] });
  motion.advance(0);
  assert.equal((await empty.finished).status, 'completed');
  let updates = 0;
  let completed = 0;
  const handle = motion.timeline({ tweens: [tween(() => { updates++; })], onComplete() { completed++; } });
  handle.pause();
  motion.setReducedMotion(true);
  assert.equal((await handle.finished).status, 'completed');
  handle.finish();
  assert.equal(updates, 1);
  assert.equal(completed, 1);
  const instant = motion.tween(tween(() => { updates++; }, { delayMs: 900 }));
  assert.equal((await instant.finished).status, 'completed');
  assert.equal(updates, 2);
});
