/**
 * Company: EonHive Inc. | Title: Temporary Frame Work
 * Purpose: Verify demand, ordering, reentrancy, and lifecycle access on runtime contexts.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '../dist/index.js';

test('temporary demand starts and stops auto frames; context observes the existing lifecycle', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler, frameMode: 'auto' });
  const ctx = kernel.getContext();
  const states = [];
  const off = ctx.subscribeLifecycle(snapshot => states.push(snapshot.state));
  assert.equal(ctx.getLifecycleSnapshot(), kernel.getLifecycleSnapshot());
  let frames = 0;
  const remove = ctx.registerFrameWork(() => frames++);
  assert.equal(scheduler.isRunning(), false);
  await kernel.boot();
  scheduler.step(0);
  kernel.pause();
  scheduler.step(20);
  kernel.resume();
  scheduler.step(1000);
  assert.equal(frames, 2);
  remove();
  remove();
  assert.equal(scheduler.isRunning(), false);
  assert.deepEqual(states, ['starting', 'running', 'paused', 'running']);
  off();
  await kernel.shutdown();
  assert.throws(() => ctx.registerFrameWork(() => {}), /disposed/);
});

test('work precedes rendering, skips removed work, and defers new admissions to the next frame', async () => {
  const scheduler = new ManualFrameScheduler();
  const calls = [];
  const kernel = createKernel({ scheduler, frameMode: 'auto', controllers: [{
    id: 'render', update() { calls.push('render'); },
  }] });
  const ctx = kernel.getContext();
  let removeFirst, removeSecond, removeLast;
  removeFirst = ctx.registerFrameWork(() => {
    calls.push('first');
    removeFirst();
    removeSecond();
    removeLast = ctx.registerFrameWork(() => calls.push('later'));
  });
  removeSecond = ctx.registerFrameWork(() => calls.push('removed'));
  await kernel.boot();
  scheduler.step(0);
  assert.deepEqual(calls, ['first', 'render']);
  scheduler.step(10);
  assert.deepEqual(calls, ['first', 'render', 'later', 'render']);
  removeLast();
  assert.equal(scheduler.isRunning(), true);
  await kernel.shutdown();
});

test('pause or shutdown inside work prevents remaining delivery in the same frame', async () => {
  for (const action of ['pause', 'shutdown']) {
    const scheduler = new ManualFrameScheduler();
    const kernel = createKernel({ scheduler, frameMode: 'auto', controllers: [{
      id: 'render', update() { assert.fail('Render after pause/shutdown'); },
    }] });
    const ctx = kernel.getContext();
    ctx.registerFrameWork(() => { void kernel[action](); });
    ctx.registerFrameWork(() => assert.fail('Later callback after pause/shutdown'));
    await kernel.boot();
    scheduler.step(0);
    assert.equal(scheduler.isRunning(), false);
    await kernel.shutdown();
  }
});

test('frame work errors fail the runtime and continuous mode remains continuous after release', async () => {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler });
  const ctx = kernel.getContext();
  await kernel.boot();
  const remove = ctx.registerFrameWork(() => {});
  remove();
  assert.equal(scheduler.isRunning(), true);
  ctx.registerFrameWork(() => { throw new Error('frame failure'); });
  scheduler.step(0);
  assert.equal(ctx.getLifecycleSnapshot().state, 'failed');
  assert.equal(scheduler.isRunning(), false);
  assert.throws(() => ctx.registerFrameWork(() => {}), /failed/);
  await kernel.shutdown();
});
