/**
 * Company: EonHive Inc. | Title: Story Scroll Motion Contracts
 * Purpose: Verify that a second application reuses public motion with interruption and cleanup.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import { createMotionAdapter, createMotionController, MotionCapability } from '@urk/adapters/motion';

const source = readFileSync(new URL('../scrollytelling/scroll-motion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText;
const { createScrollMotion } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

async function fixture(t) {
  const scheduler = new ManualFrameScheduler();
  let scroll, api;
  let position = 0;
  const writes = [];
  const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()], controllers: [createMotionController(), {
    id: 'story', start(ctx) {
      ctx.state.setPhase('loading');
      api = ctx.require(MotionCapability);
      api.setReducedMotion(false);
      scroll = createScrollMotion(ctx, api.scoped(ctx.scope), {
        read: () => position,
        write(value) { position = value; writes.push(value); },
      });
    },
  }] });
  await kernel.boot();
  await flush();
  t.after(() => kernel.shutdown());
  return { kernel, scroll, api, writes, get position() { return position; }, async step(time) { scheduler.step(time); await flush(); } };
}

test('startup preserves loading; guided scrolling advances through the existing controller', async t => {
  const f = await fixture(t);
  assert.equal(f.kernel.getState().phase, 'loading');
  f.kernel.pause();
  f.kernel.resume();
  await flush();
  assert.equal(f.kernel.getState().phase, 'loading');
  await f.kernel.getContext().state.transition('ready');
  const request = f.scroll.navigate(1000);
  await flush();
  await f.step(0);
  await f.step(360);
  assert.ok(Math.abs(f.position - 500) < .001);
  assert.equal(f.kernel.getState().phase, 'transition');
  await f.step(720);
  assert.equal((await request).status, 'completed');
  assert.equal(f.position, 1000);
  assert.equal(f.kernel.getState().phase, 'ready');
  assert.equal(f.api.activeCount, 0);
});

test('replacing navigation starts from the rendered position and stale destinations cannot commit', async t => {
  const f = await fixture(t);
  const first = f.scroll.navigate(1000);
  await flush();
  await f.step(0); await f.step(360);
  const middle = f.scroll.navigate(200);
  const latest = f.scroll.navigate(800);
  await flush();
  assert.equal((await first).status, 'cancelled');
  assert.equal((await middle).status, 'cancelled');
  await f.step(720);
  assert.ok(Math.abs(f.position - 650) < .001);
  await f.step(1080);
  assert.equal((await latest).status, 'completed');
  assert.equal(f.position, 800);
  assert.equal(f.kernel.getState().phase, 'ready');
});

test('manual cancellation retains the current position; pause and resume preserve progress', async t => {
  const f = await fixture(t);
  const first = f.scroll.navigate(1000);
  await flush();
  await f.step(0); await f.step(180);
  f.kernel.pause();
  const frozen = f.position;
  await f.step(5000);
  assert.equal(f.position, frozen);
  f.kernel.resume();
  await f.step(6000);
  assert.equal(f.position, frozen);
  await f.step(6180);
  assert.ok(Math.abs(f.position - 500) < .001);
  await f.scroll.cancel('manual-scroll');
  assert.equal((await first).status, 'cancelled');
  await f.step(8000);
  assert.ok(Math.abs(f.position - 500) < .001);
  assert.equal(f.kernel.getState().phase, 'ready');
});

test('cancel while paused reconciles the restored legacy phase; reduced motion completes immediately', async t => {
  const f = await fixture(t);
  const first = f.scroll.navigate(1000);
  await flush();
  await f.step(0); await f.step(100);
  f.kernel.pause();
  await f.scroll.cancel();
  assert.equal((await first).status, 'cancelled');
  f.kernel.resume();
  await flush();
  assert.equal(f.kernel.getState().phase, 'ready');
  f.api.setReducedMotion(true);
  assert.equal((await f.scroll.navigate(2000)).status, 'completed');
  assert.equal(f.position, 2000);
  assert.equal(f.kernel.getState().phase, 'ready');
});

test('shutdown cancels active and queued requests without later scroll writes', async t => {
  const f = await fixture(t);
  const first = f.scroll.navigate(1000);
  await flush();
  await f.step(0); await f.step(100);
  const count = f.writes.length;
  const second = f.scroll.navigate(2000);
  await f.kernel.shutdown();
  assert.equal((await first).status, 'cancelled');
  assert.equal((await second).status, 'cancelled');
  await f.step(10000);
  assert.equal(f.writes.length, count);
  assert.equal(f.api.activeCount, 0);
  assert.equal((await f.scroll.navigate(10)).status, 'cancelled');
});
