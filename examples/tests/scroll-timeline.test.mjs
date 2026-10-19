/**
 * Company: EonHive Inc. | Title: Scroll Timeline Binding Contracts
 * Purpose: Verify native-progress sampling, retained ownership, and lifecycle cleanup.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import {
  createMotionAdapter,
  createMotionController,
  MotionCapability,
} from '@urk/adapters/motion';

const source = readFileSync(
  new URL('../scrollytelling/scroll-timeline.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
}).outputText;
const { createScrollTimeline } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

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
  const ctx = kernel.getContext();
  const api = ctx.require(MotionCapability);
  api.setReducedMotion(false);
  const motion = api.scoped(ctx.scope);
  return { ctx, api, motion, kernel, scheduler };
}

test('native progress restores overlapping poses in either direction without clock playback', async (t) => {
  const { ctx, motion, scheduler } = await fixture(t);
  let a, b;
  let completed = 0;
  const binding = createScrollTimeline(ctx, motion, () => ({
    tweens: [
      {
        from: 0,
        to: 100,
        durationMs: 100,
        onUpdate(value) {
          a = value;
        },
      },
      {
        from: 0,
        to: 100,
        atMs: 50,
        durationMs: 100,
        onUpdate(value) {
          b = value;
        },
      },
    ],
    onComplete() {
      completed++;
    },
  }));
  binding.sample(0.5);
  assert.deepEqual([a, b], [75, 25]);
  scheduler.step(0);
  scheduler.step(5000);
  assert.deepEqual([a, b], [75, 25]);
  binding.sample(1);
  assert.deepEqual([a, b], [100, 100]);
  binding.sample(0);
  assert.deepEqual([a, b], [0, 0]);
  binding.sample(0.5);
  assert.deepEqual([a, b], [75, 25]);
  assert.equal(binding.handle.status, 'paused');
  assert.equal(completed, 0);
});

test('unchanged/clamped positions avoid repeated writes and nonfinite input preserves the pose', async (t) => {
  const { ctx, motion } = await fixture(t);
  const writes = [];
  const binding = createScrollTimeline(ctx, motion, () => ({
    tweens: [
      {
        from: 0,
        to: 100,
        durationMs: 100,
        onUpdate(value) {
          writes.push(value);
        },
      },
    ],
  }));
  binding.sample(-1);
  binding.sample(0);
  binding.sample(-20);
  binding.sample(0.5);
  binding.sample(0.5);
  binding.sample(2);
  binding.sample(3);
  assert.deepEqual(writes, [0, 50, 100]);
  for (const value of [NaN, Infinity, -Infinity])
    assert.throws(() => binding.sample(value), RangeError);
  assert.deepEqual(writes, [0, 50, 100]);
});

test('runtime pause blocks scroll sampling and resume retains ownership without autoplay', async (t) => {
  const { ctx, motion, kernel, scheduler } = await fixture(t);
  let value;
  const binding = createScrollTimeline(ctx, motion, () => ({
    tweens: [
      {
        from: 0,
        to: 100,
        durationMs: 100,
        onUpdate(next) {
          value = next;
        },
      },
    ],
  }));
  binding.sample(0.25);
  kernel.pause();
  binding.sample(0.75);
  assert.equal(value, 25);
  kernel.resume();
  scheduler.step(0);
  scheduler.step(1000);
  assert.equal(value, 25);
  binding.sample(0.75);
  assert.equal(value, 75);
  assert.equal(binding.handle.status, 'paused');
});

test('remeasurement replaces and settles the old timeline while preserving normalized scroll', async (t) => {
  const { ctx, motion, api } = await fixture(t);
  let value,
    duration = 100;
  const binding = createScrollTimeline(ctx, motion, () => ({
    tweens: [
      {
        from: 0,
        to: duration,
        durationMs: duration,
        onUpdate(next) {
          value = next;
        },
      },
    ],
  }));
  binding.sample(0.5);
  const previous = binding.handle;
  duration = 400;
  binding.reset();
  binding.sample(0.5);
  assert.equal((await previous.finished).status, 'cancelled');
  assert.notEqual(binding.handle, previous);
  assert.equal(value, 200);
  assert.equal(binding.handle.progress, 0.5);
  assert.equal(api.activeCount, 1);
});

test('reduced motion cannot revive a finished preview; explicit reset enables fresh sampling', async (t) => {
  const { ctx, motion, api } = await fixture(t);
  let value;
  const binding = createScrollTimeline(ctx, motion, () => ({
    tweens: [
      {
        from: 0,
        to: 100,
        durationMs: 100,
        onUpdate(next) {
          value = next;
        },
      },
    ],
  }));
  binding.sample(0.5);
  const previous = binding.handle;
  api.setReducedMotion(true);
  assert.equal((await previous.finished).status, 'completed');
  binding.sample(0.2);
  assert.equal(value, 100);
  binding.reset();
  api.setReducedMotion(false);
  binding.sample(0.2);
  assert.equal(value, 20);
  assert.notEqual(binding.handle, previous);
});

test('shutdown settles an endpoint preview and prevents further bindings or writes', async (t) => {
  const { ctx, motion, api, kernel } = await fixture(t);
  const writes = [];
  let builds = 0;
  const binding = createScrollTimeline(ctx, motion, () => {
    builds++;
    return {
      tweens: [
        {
          from: 0,
          to: 100,
          durationMs: 100,
          onUpdate(value) {
            writes.push(value);
          },
        },
      ],
    };
  });
  binding.sample(1);
  const previous = binding.handle;
  await kernel.shutdown();
  assert.equal((await previous.finished).status, 'cancelled');
  binding.sample(0.5);
  binding.reset();
  binding.sample(0);
  assert.deepEqual(writes, [100]);
  assert.equal(builds, 1);
  assert.equal(api.activeCount, 0);
});
