/**
 * Company: EonHive Inc. | Title: DOM Motion Binding Checks
 * Purpose: Verify composed styles, borrowed-style restoration, and scoped timeline ownership.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, ResourceScope } from '@urk/core';
import {
  createDomMotionBinding,
  createMotionAdapter,
  createMotionController,
  MotionCapability,
  fade,
  slide,
} from '@urk/adapters/motion';

function element() {
  const values = new Map();
  return {
    style: {
      getPropertyValue(key) {
        return values.get(key)?.value ?? '';
      },
      getPropertyPriority(key) {
        return values.get(key)?.priority ?? '';
      },
      setProperty(key, value, priority = '') {
        values.set(key, { value, priority });
      },
      removeProperty(key) {
        values.delete(key);
      },
    },
  };
}

test('property callbacks compose one transform and invalid patches leave the pose unchanged', async () => {
  const scope = new ResourceScope();
  const target = element();
  const initial = { x: 10, rotate: 20 };
  const binding = createDomMotionBinding(target, scope, initial);
  initial.x = 999;
  binding.property('y')(30);
  binding.property('scale')(1.5);
  binding.property('opacity')(0.25);
  assert.equal(
    target.style.getPropertyValue('transform'),
    'translate(10px, 30px) rotate(20deg) scale(1.5)',
  );
  assert.equal(target.style.getPropertyValue('opacity'), '0.25');
  const snapshot = binding.getSnapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  for (const patch of [
    { x: NaN },
    { y: Infinity },
    { opacity: 2 },
    { scale: -1 },
    { x: 50, rotate: undefined },
  ]) {
    assert.throws(() => binding.set(patch), RangeError);
    assert.deepEqual(binding.getSnapshot(), snapshot);
  }
  assert.throws(() => binding.property('width'), TypeError);
  assert.throws(() => binding.set({ width: 10 }), TypeError);
  binding.set({ x: -20, scale: 0 });
  assert.equal(snapshot.x, 10);
  await scope.dispose();
});

test('scope cleanup restores only borrowed opacity/transform including priorities and blocks late writes', async () => {
  const target = element();
  target.style.setProperty('opacity', '0.7', 'important');
  target.style.setProperty('transform', 'translateX(5px)', 'important');
  target.style.setProperty('color', 'red');
  const scope = new ResourceScope();
  const binding = createDomMotionBinding(target, scope);
  const late = binding.property('x');
  late(80);
  target.style.setProperty('color', 'blue');
  await scope.dispose();
  late(90);
  binding.set({ opacity: 0 });
  binding.dispose();
  assert.equal(target.style.getPropertyValue('opacity'), '0.7');
  assert.equal(target.style.getPropertyPriority('opacity'), 'important');
  assert.equal(target.style.getPropertyValue('transform'), 'translateX(5px)');
  assert.equal(target.style.getPropertyPriority('transform'), 'important');
  assert.equal(target.style.getPropertyValue('color'), 'blue');
  assert.throws(() => createDomMotionBinding(target, scope));
  assert.equal(target.style.getPropertyValue('opacity'), '0.7');
});

test('presets can seek independent DOM properties and shutdown settles work before later writes', async (t) => {
  const kernel = createKernel({
    frameMode: 'auto',
    scheduler: new ManualFrameScheduler(),
    adapters: [createMotionAdapter()],
    controllers: [createMotionController()],
  });
  await kernel.boot();
  t.after(() => kernel.shutdown());
  const ctx = kernel.getContext();
  const api = ctx.require(MotionCapability);
  api.setReducedMotion(false);
  const group = api.scoped(ctx.scope);
  const target = element();
  const binding = createDomMotionBinding(target, ctx.scope, { rotate: 15 });
  const timeline = group.timeline({
    tweens: [
      fade({ durationMs: 100, easing: 'linear', onUpdate: binding.property('opacity') }),
      slide({ from: 100, durationMs: 100, easing: 'linear', onUpdate: binding.property('x') }),
    ],
  });
  timeline.pause();
  timeline.seek(50);
  assert.equal(target.style.getPropertyValue('opacity'), '0.5');
  assert.equal(
    target.style.getPropertyValue('transform'),
    'translate(50px, 0px) rotate(15deg) scale(1)',
  );
  timeline.seek(0);
  assert.equal(target.style.getPropertyValue('opacity'), '0');
  timeline.resume();
  group.setPlaybackRate(2);
  api.advance(25);
  assert.equal(target.style.getPropertyValue('opacity'), '0.5');
  await kernel.shutdown();
  binding.property('x')(1000);
  api.advance(1000);
  assert.equal(target.style.getPropertyValue('transform'), '');
  assert.equal(target.style.getPropertyValue('opacity'), '');
  assert.equal((await timeline.finished).status, 'cancelled');
  assert.equal(api.activeCount, 0);
});
