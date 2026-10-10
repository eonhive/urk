/**
 * Company: EonHive Inc.
 * Title: Controller Execution Regression Tests
 * Purpose: Verify active controller order and frame boundaries during dynamic startup.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '../dist/index.js';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

test('concurrent dynamic starts retain registration order without activating early', async () => {
  const frames = new ManualFrameScheduler();
  const kernel = createKernel({ scheduler: frames });
  const entered = deferred();
  const release = deferred();
  const updates = [];
  let firstContext;
  let secondContext;
  await kernel.boot();

  const first = {
    id: 'first',
    async start(ctx) {
      firstContext = ctx;
      entered.resolve();
      await release.promise;
    },
    update(frame, ctx) {
      assert.equal(this, first);
      assert.equal(ctx, firstContext);
      updates.push({ id: this.id, frame });
    },
  };
  const second = {
    id: 'second',
    start(ctx) { secondContext = ctx; },
    update(frame, ctx) {
      assert.equal(this, second);
      assert.equal(ctx, secondContext);
      updates.push({ id: this.id, frame });
    },
  };

  const firstStart = kernel.registerController(first);
  await entered.promise;
  await kernel.registerController(second);
  frames.step(100);
  assert.deepEqual(updates.map(({ id }) => id), ['second']);

  release.resolve();
  await firstStart;
  updates.length = 0;
  frames.step(125);
  assert.deepEqual(updates.map(({ id }) => id), ['first', 'second']);
  assert.equal(updates[0].frame, updates[1].frame);
  assert.deepEqual(updates[0].frame, {
    timeMs: 125, deltaMs: 25, deltaSeconds: 0.025, frame: 2,
  });
  await kernel.shutdown();
});

test('a controller registered during a frame starts updating on a later frame', async () => {
  const frames = new ManualFrameScheduler();
  const updates = [];
  let registration;
  const late = {
    id: 'late',
    update() { updates.push('late'); },
  };
  const kernel = createKernel({ scheduler: frames, controllers: [{
    id: 'first',
    update() {
      updates.push('first');
      registration ??= kernel.registerController(late);
    },
  }] });
  await kernel.boot();

  frames.step(100);
  assert.deepEqual(updates, ['first']);
  frames.step(125);
  assert.deepEqual(updates, ['first', 'first']);
  await registration;
  frames.step(150);
  assert.deepEqual(updates, ['first', 'first', 'first', 'late']);
  await kernel.shutdown();
});
