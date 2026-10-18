/**
 * Company: EonHive Inc. | Title: Audio Cancellation and Mixer Tests
 * Purpose: Verify late playback, isolated volume groups, finite fades, and resource release.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler } from '@urk/core';
import { createAudioAdapter, AudioCapability } from '../dist/audio/index.js';
import { createAudioMixerAdapter, AudioMixerCapability } from '../dist/audio/mixer.js';

class Audio extends EventTarget {
  static instances = [];
  paused = true;
  ended = false;
  readyState = 4;
  currentTime = 0;
  volume = 1;
  muted = false;
  hold = false;
  pending = [];
  calls = 0;
  listeners = new Set();
  constructor(src) {
    super();
    this.src = src;
    Audio.instances.push(this);
  }
  addEventListener(type, fn, options) {
    this.listeners.add(fn);
    super.addEventListener(type, fn, options);
  }
  removeEventListener(type, fn, options) {
    this.listeners.delete(fn);
    super.removeEventListener(type, fn, options);
  }
  play() {
    this.calls++;
    if (!this.hold) {
      this.paused = false;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) =>
      this.pending.push({
        resolve: () => {
          this.paused = false;
          resolve();
        },
        reject,
      }),
    );
  }
  pause() {
    this.paused = true;
  }
  load() {}
}
async function setup(t, mixer = false) {
  const original = globalThis.Audio;
  globalThis.Audio = Audio;
  Audio.instances = [];
  const registration = mixer
    ? createAudioMixerAdapter({
        channels: [
          { id: 'bed', group: 'music' },
          { id: 'guide', group: 'narration' },
        ],
      })
    : createAudioAdapter();
  const kernel = createKernel({
    frameMode: 'auto',
    scheduler: new ManualFrameScheduler(),
    adapters: [{ ...registration, isSupported: () => true }],
  });
  await kernel.boot();
  t.after(async () => {
    await kernel.shutdown();
    if (original) globalThis.Audio = original;
    else delete globalThis.Audio;
  });
  return {
    kernel,
    api: kernel.getContext().require(mixer ? AudioMixerCapability : AudioCapability),
  };
}
const register = (api, id = 'one') => {
  api.registerTrack({ id, label: id, src: `${id}.wav` });
  return Audio.instances.at(-1);
};

test('play enters native playback immediately and pause silences a shared pending request until settlement', async (t) => {
  const { api } = await setup(t);
  const element = register(api);
  element.readyState = 0;
  element.hold = true;
  const waiting = api.play('one');
  const rejected = assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(element.calls, 1);
  assert.equal(api.play('one'), waiting);
  api.pause();
  api.setMuted(false);
  assert.equal(element.muted, true);
  element.pending[0].resolve();
  await rejected;
  assert.equal(element.paused, true);
  assert.equal(api.getSnapshot().status, 'paused');
  element.hold = false;
  await api.play();
  assert.equal(element.muted, false);
});

test('older completions cannot stop or poison a newer request for the same track', async (t) => {
  const { api } = await setup(t);
  const element = register(api);
  element.hold = true;
  const rejected = assert.rejects(api.play('one'), { name: 'AbortError' });
  api.stop();
  const current = api.play('one');
  element.pending[1].resolve();
  await current;
  element.pending[0].resolve();
  await rejected;
  assert.equal(element.paused, false);
  assert.equal(api.getSnapshot().status, 'playing');
  assert.equal(api.getSnapshot().errorMessage, undefined);
});

test('switching tracks and shutdown invalidate pending work and release native listeners and sources', async (t) => {
  const { api, kernel } = await setup(t);
  const one = register(api),
    two = register(api, 'two');
  one.hold = true;
  const rejected = assert.rejects(api.play('one'), { name: 'AbortError' });
  await api.play('two');
  assert.equal(one.muted, true);
  one.pending[0].resolve();
  await rejected;
  assert.equal(one.paused, true);
  assert.equal(two.paused, false);
  two.hold = true;
  const late = assert.rejects(api.play('two'), { name: 'AbortError' });
  await kernel.shutdown();
  assert.equal(two.muted, true);
  two.pending[0].resolve();
  await late;
  for (const element of Audio.instances) {
    assert.equal(element.paused, true);
    assert.equal(element.src, '');
    assert.equal(element.listeners.size, 0);
  }
});

test('reentrant pause during loading cancels the registered native request', async (t) => {
  const { api } = await setup(t);
  const element = register(api);
  element.hold = true;
  api.subscribe((snapshot) => {
    if (snapshot.status === 'loading') api.pause();
  });
  const rejected = assert.rejects(api.play('one'), { name: 'AbortError' });
  assert.equal(element.muted, true);
  element.pending[0].resolve();
  await rejected;
  assert.equal(element.paused, true);
});

test('a late preload cannot overwrite newer playback status', async (t) => {
  const { api } = await setup(t);
  const element = register(api);
  element.readyState = 0;
  const loading = api.preload('one');
  await api.play('one');
  element.dispatchEvent(new Event('loadeddata'));
  await loading;
  assert.equal(api.getSnapshot().status, 'playing');
});

function frames(t) {
  const previousFrame = globalThis.requestAnimationFrame,
    previousCancel = globalThis.cancelAnimationFrame;
  const queued = new Map();
  let next = 0;
  globalThis.requestAnimationFrame = (callback) => {
    queued.set(++next, callback);
    return next;
  };
  globalThis.cancelAnimationFrame = (id) => queued.delete(id);
  t.after(() => {
    if (previousFrame) globalThis.requestAnimationFrame = previousFrame;
    else delete globalThis.requestAnimationFrame;
    if (previousCancel) globalThis.cancelAnimationFrame = previousCancel;
    else delete globalThis.cancelAnimationFrame;
  });
  return {
    queued,
    finish() {
      for (const [id, callback] of [...queued]) {
        queued.delete(id);
        callback(performance.now() + 10000);
      }
    },
  };
}

test('mixer ducking preserves independent group volumes, ends its frames, and isolates mute', async (t) => {
  const { api } = await setup(t, true);
  const clock = frames(t);
  const bed = api.channel('bed'),
    guide = api.channel('guide');
  const a = register(bed),
    b = register(guide);
  await Promise.all([bed.play('one'), guide.play('one')]);
  api.setGroupVolume('music', 0.4);
  api.setGroupVolume('narration', 0.8);
  const duck = api.fadeGroup('music', 0.25, 100);
  clock.finish();
  await duck;
  assert.equal(a.volume, 0.1);
  assert.equal(b.volume, 0.8);
  assert.deepEqual(api.getGroupSnapshot('music'), { volume: 0.4, level: 0.25 });
  api.setGroupVolume('music', 0.6);
  assert.equal(a.volume, 0.15);
  const restore = api.fadeGroup('music', 1, 100);
  clock.finish();
  await restore;
  assert.equal(a.volume, 0.6);
  assert.equal(clock.queued.size, 0);
  bed.setMuted(true);
  api.setMuted(true);
  api.setMuted(false);
  assert.equal(a.muted, true);
  assert.equal(b.muted, false);
});

test('replaced, aborted, reentrant, and disposed fades reject without retaining frames', async (t) => {
  const { api, kernel } = await setup(t, true);
  const clock = frames(t);
  const bed = api.channel('bed');
  register(bed);
  const old = assert.rejects(api.fadeChannel('bed', 0, 100), {
    name: 'AbortError',
  });
  const replacement = api.fadeChannel('bed', 0.5, 100);
  await old;
  clock.finish();
  await replacement;
  const abort = new AbortController();
  const cancelled = assert.rejects(api.fadeChannel('bed', 0, 100, abort.signal), {
    name: 'AbortError',
  });
  abort.abort();
  await cancelled;
  assert.equal(clock.queued.size, 0);
  const off = bed.subscribe(() => bed.stop());
  const reentrant = assert.rejects(api.fadeChannel('bed', 1, 100), {
    name: 'AbortError',
  });
  clock.finish();
  await reentrant;
  off();
  assert.equal(clock.queued.size, 0);
  const disposed = assert.rejects(api.fadeGroup('music', 0, 100), {
    name: 'AbortError',
  });
  await kernel.shutdown();
  await disposed;
  assert.equal(clock.queued.size, 0);
});
