/**
 * Company: EonHive Inc. | Title: Motion Playback Contracts
 * Purpose: Verify settlement, scoped ownership, native failures, pause policy, and idle scheduling.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, ResourceScope } from '@urk/core';
import { createMotionAdapter, MotionCapability } from '@urk/adapters/motion';

const frames = [{ opacity: 0 }, { opacity: 1 }];
const timing = { durationMs: 200 };

async function fixture(t) {
  class Preference extends EventTarget {
    matches = false;
    listeners = new Set();
    addEventListener(type, listener, options) {
      this.listeners.add(listener);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
      this.listeners.delete(listener);
      super.removeEventListener(type, listener, options);
    }
    reduce(value) {
      this.matches = value;
      this.dispatchEvent(new Event('change'));
    }
  }
  const preference = new Preference();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => preference } });
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ frameMode: 'auto', scheduler, adapters: [createMotionAdapter()] });
  const scope = new ResourceScope();
  t.after(async () => {
    await scope.dispose();
    await kernel.shutdown();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  });
  await kernel.boot();
  const api = kernel.getContext().require(MotionCapability);
  const motion = api.scoped(scope);
  const animations = [];
  const element = {
    style: { opacity: '1' },
    animate(keyframes, options) {
      let resolve, reject;
      const animation = {
        keyframes, options,
        playState: 'running',
        finished: new Promise((ok, fail) => { resolve = ok; reject = fail; }),
        pause() { this.playState = 'paused'; },
        play() { this.playState = 'running'; },
        finish() { this.playState = 'finished'; resolve(); },
        cancel() { this.playState = 'idle'; reject(new DOMException('Cancelled', 'AbortError')); },
        fail(error) { reject(error); },
      };
      animations.push(animation);
      return animation;
    },
  };
  return { kernel, scheduler, scope, api, motion, element, preference, animations };
}

test('completion and finish release effects, preserve authored styles, and make handles terminal', async t => {
  const { motion, element, animations } = await fixture(t);
  const playback = motion.animate(element, frames, timing);
  assert.equal(motion.activeCount, 1);
  animations[0].finish();
  assert.deepEqual(await playback.finished, { status: 'completed' });
  assert.equal(motion.activeCount, 0);
  assert.equal(animations[0].playState, 'idle');
  playback.resume();
  playback.cancel('late');
  assert.deepEqual(await playback.finished, { status: 'completed' });
  const next = motion.animate(element, frames, timing);
  next.pause();
  next.finish();
  assert.deepEqual(await next.finished, { status: 'completed' });
  assert.equal(element.style.opacity, '1');
  assert.equal(animations[1].playState, 'idle');
});

test('replacement settles cancellation across groups without transferring cleanup ownership', async t => {
  const { api, scope, motion, element, animations } = await fixture(t);
  const otherScope = new ResourceScope();
  t.after(() => otherScope.dispose());
  const other = api.scoped(otherScope);
  const first = motion.animate(element, frames, timing);
  const next = other.animate(element, frames, timing);
  assert.deepEqual(await first.finished, { status: 'cancelled', reason: 'replaced' });
  assert.equal(motion.activeCount, 0);
  assert.equal(other.activeCount, 1);
  await scope.dispose();
  assert.equal(animations[1].playState, 'running');
  next.cancel('navigation');
  assert.deepEqual(await next.finished, { status: 'cancelled', reason: 'navigation' });
  assert.equal(other.activeCount, 0);
});

test('group resume preserves individual pause and new work inherits group suspension', async t => {
  const { motion, element, animations } = await fixture(t);
  const first = motion.animate(element, frames, timing);
  first.pause();
  motion.pause();
  motion.resume();
  assert.equal(animations[0].playState, 'paused');
  first.resume();
  assert.equal(animations[0].playState, 'running');
  motion.pause();
  const next = motion.animate({ ...element }, frames, timing);
  next.resume();
  assert.equal(animations.length, 1);
  motion.resume();
  assert.equal(animations[1].playState, 'running');
  motion.cancel();
  assert.equal((await first.finished).status, 'cancelled');
  assert.equal((await next.finished).status, 'cancelled');
});

test('invalid requests fail before replacing valid playback', async t => {
  const { motion, element, animations } = await fixture(t);
  const playback = motion.animate(element, frames, timing);
  for (const options of [{ durationMs: -1 }, { durationMs: Infinity }, { ...timing, delayMs: NaN }]) {
    assert.throws(() => motion.animate(element, frames, options), RangeError);
  }
  assert.throws(() => motion.animate(element, frames, { ...timing, easing: 'spring' }), TypeError);
  assert.throws(() => motion.animate(element, [{ width: '2px' }, { width: '3px' }], timing), TypeError);
  assert.throws(() => motion.animate(element, [{ opacity: NaN }, { opacity: 1 }], timing), RangeError);
  assert.throws(() => motion.animate(element, [{ opacity: 0, offset: 1 }, { opacity: 1, offset: 0 }], timing), RangeError);
  assert.throws(() => motion.animate(element, [], timing), TypeError);
  assert.equal(motion.activeCount, 1);
  assert.equal(animations.length, 1);
  playback.finish();
});

test('action cancellation settles normally; an already aborted request leaves current work alone', async t => {
  const { motion, element, animations } = await fixture(t);
  const action = new AbortController();
  const playback = motion.animate(element, frames, { ...timing, signal: action.signal });
  playback.pause();
  action.abort();
  assert.deepEqual(await playback.finished, { status: 'cancelled', reason: 'aborted' });
  const next = motion.animate(element, frames, timing);
  const skipped = motion.animate(element, frames, { ...timing, signal: action.signal });
  assert.equal((await skipped.finished).status, 'cancelled');
  assert.equal(animations[1].playState, 'running');
  next.finish();
});

test('reduced motion finishes paused work, skips new effects, and releases its listener at shutdown', async t => {
  const { motion, element, animations, preference, kernel } = await fixture(t);
  const playback = motion.animate(element, frames, timing);
  motion.pause();
  preference.reduce(true);
  assert.deepEqual(await playback.finished, { status: 'completed' });
  assert.deepEqual(await motion.animate(element, frames, timing).finished, { status: 'completed' });
  preference.reduce(false);
  assert.deepEqual(await motion.animate(element, frames, { durationMs: 0 }).finished, { status: 'completed' });
  assert.deepEqual(await motion.animate({}, frames, timing).finished, { status: 'completed' });
  assert.equal(animations.length, 1);
  assert.equal(motion.activeCount, 0);
  await kernel.shutdown();
  assert.equal(preference.listeners.size, 0);
});

test('native creation, control, and asynchronous errors settle as failed without leaking active work', async t => {
  const { motion, element, animations } = await fixture(t);
  const error = new Error('Native failure');
  const failed = motion.animate({ animate() { throw error; } }, frames, timing);
  assert.deepEqual(await failed.finished, { status: 'failed', error });
  const playback = motion.animate(element, frames, timing);
  animations[0].fail(error);
  assert.deepEqual(await playback.finished, { status: 'failed', error });
  const next = motion.animate(element, frames, timing);
  animations[1].pause = () => { throw error; };
  next.pause();
  assert.deepEqual(await next.finished, { status: 'failed', error });
  assert.equal(motion.activeCount, 0);
});

test('external native cancellation is observed and settles as cancelled', async t => {
  const { motion, element, animations } = await fixture(t);
  const playback = motion.animate(element, frames, timing);
  animations[0].cancel();
  assert.deepEqual(await playback.finished, { status: 'cancelled', reason: 'native-cancelled' });
  assert.equal(motion.activeCount, 0);
});

test('each scope registers one cleanup regardless of repeated lookup and playback', async t => {
  const { api, element } = await fixture(t);
  const scope = new ResourceScope();
  let registrations = 0;
  const defer = scope.defer.bind(scope);
  scope.defer = cleanup => { registrations++; defer(cleanup); };
  const motion = api.scoped(scope);
  for (let index = 0; index < 100; index++) {
    assert.equal(api.scoped(scope), motion);
    motion.animate(element, frames, timing).finish();
  }
  assert.equal(registrations, 1);
  assert.equal(motion.activeCount, 0);
  const pending = motion.animate(element, frames, timing);
  await scope.dispose();
  assert.deepEqual(await pending.finished, { status: 'cancelled', reason: 'owner-disposed' });
  assert.throws(() => motion.animate(element, frames, timing), /disposed/);
  assert.equal(motion.activeCount, 0);
  const disposed = new ResourceScope();
  await disposed.dispose();
  assert.throws(() => api.scoped(disposed), /disposal/);
});

test('DOM playback never requests kernel frames and shutdown cancels every active group', async t => {
  const { api, motion, element, scheduler, kernel } = await fixture(t);
  const otherScope = new ResourceScope();
  t.after(() => otherScope.dispose());
  const other = api.scoped(otherScope);
  const first = motion.animate(element, frames, timing);
  const next = other.animate({ ...element }, frames, timing);
  assert.equal(scheduler.isRunning(), false);
  await kernel.shutdown();
  assert.equal((await first.finished).status, 'cancelled');
  assert.equal((await next.finished).status, 'cancelled');
  assert.equal(motion.activeCount + other.activeCount, 0);
  assert.equal(scheduler.isRunning(), false);
  assert.throws(() => api.scoped(new ResourceScope()), /disposed/);
});

test('reentrant cancellation during native acquisition still releases the acquired animation', async t => {
  const { motion, element, animations } = await fixture(t);
  const action = new AbortController();
  const playback = motion.animate({
    animate(...args) {
      action.abort();
      return element.animate(...args);
    },
  }, frames, { ...timing, signal: action.signal });
  assert.equal((await playback.finished).status, 'cancelled');
  assert.equal(animations[0].playState, 'idle');
  assert.equal(motion.activeCount, 0);
});
