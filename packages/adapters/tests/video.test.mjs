/**
 * Company: EonHive Inc. | Title: Video Ownership and Playback Tests
 * Purpose: Verify races and cleanup with controllable native playback completion.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createKernel, ManualFrameScheduler, ResourceScope } from '@urk/core';
import { createVideoAdapter, VideoCapability } from '../dist/video/index.js';
import { createVideoTexture } from '../dist/three/video.js';

class Tracks extends EventTarget {
  values = [{ label: 'English', language: 'en', kind: 'captions', mode: 'disabled' },
    { label: 'Cues', language: '', kind: 'metadata', mode: 'hidden' }];
  [Symbol.iterator]() { return this.values[Symbol.iterator](); }
}

class Video extends EventTarget {
  paused = true; ended = false; seeking = false; readyState = 4; duration = 8;
  currentTime = 0; volume = 1; muted = false; playbackRate = 1; loop = false;
  src = 'borrowed.mp4'; srcObject = null; error = null; poster = ''; preload = 'metadata';
  textTracks = new Tracks(); pending = []; hold = false; playCalls = 0; loadCalls = 0; removed = false;
  listeners = new Map();
  addEventListener(name, callback, options) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
    super.addEventListener(name, callback, options);
  }
  removeEventListener(name, callback, options) {
    this.listeners.get(name)?.delete(callback);
    super.removeEventListener(name, callback, options);
  }
  play() {
    this.playCalls++;
    if (!this.hold) { this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
    return new Promise((resolve, reject) => this.pending.push({ resolve: () => { this.paused = false; resolve(); }, reject }));
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  load() { this.loadCalls++; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  querySelectorAll() { return []; }
  remove() { this.removed = true; }
  listenerCount() { return [...this.listeners.values()].reduce((count, values) => count + values.size, 0); }
}

async function setup(t) {
  const scheduler = new ManualFrameScheduler();
  const kernel = createKernel({ frameMode: 'auto', scheduler,
    adapters: [{ ...createVideoAdapter(), isSupported: () => true }],
  });
  await kernel.boot();
  t.after(() => kernel.shutdown());
  return { kernel, scheduler, api: kernel.getContext().require(VideoCapability) };
}
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

function visibilityFixture({ observerAvailable = true, hidden = false } = {}) {
  const observers = [];
  class Observer {
    connected = false;
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; this.connected = true; }
    disconnect() { this.connected = false; }
    emit(visible) {
      // Deliberately allow queued callbacks to arrive after disconnect.
      this.callback([{ target: this.target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]);
    }
  }
  const document = new EventTarget();
  document.hidden = hidden;
  document.defaultView = { IntersectionObserver: observerAvailable ? Observer : undefined };
  const listeners = new Set();
  document.addEventListener = (event, callback) => {
    listeners.add(callback); EventTarget.prototype.addEventListener.call(document, event, callback);
  };
  document.removeEventListener = (event, callback) => {
    listeners.delete(callback); EventTarget.prototype.removeEventListener.call(document, event, callback);
  };
  const element = new Video();
  element.ownerDocument = document;
  return { element, observers, listeners, hide(hidden) {
    document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange'));
  } };
}

test('lazy source waits for visibility, preserves borrowed media, and explicit source changes win', async t => {
  const { api } = await setup(t);
  const f = visibilityFixture();
  const target = {};
  const player = api.register({ id: 'lazy', element: f.element, src: 'deferred.mp4',
    visibility: { target, loadWhenVisible: true } });
  assert.equal(f.observers[0].target, target);
  assert.equal(f.element.src, 'borrowed.mp4'); assert.equal(f.element.loadCalls, 0);
  f.observers[0].emit(false); assert.equal(f.element.loadCalls, 0);
  f.hide(true); f.observers[0].emit(true); assert.equal(f.element.loadCalls, 0);
  f.hide(false);
  assert.equal(f.element.src, 'deferred.mp4'); assert.equal(f.element.loadCalls, 1);
  assert.equal(f.element.playCalls, 0);
  f.observers[0].emit(true); assert.equal(f.element.loadCalls, 1);
  api.unregister(player.id);
  const second = api.register({ id: 'replace', element: f.element, src: 'obsolete.mp4',
    visibility: { loadWhenVisible: true } });
  second.setSource('chosen.mp4');
  f.observers[1].emit(true);
  assert.equal(f.element.src, 'chosen.mp4'); assert.equal(f.element.loadCalls, 2);
});

test('play loads in the same gesture; offscreen and hidden policies cancel without automatic resume', async t => {
  const { api } = await setup(t);
  const f = visibilityFixture(); f.element.hold = true;
  const player = api.register({ id: 'policy', element: f.element, src: 'deferred.mp4',
    visibility: { loadWhenVisible: true, pauseWhenOffscreen: true, pauseWhenHidden: true } });
  const waiting = player.play();
  assert.equal(f.element.src, 'deferred.mp4'); assert.equal(f.element.playCalls, 1);
  const rejected = assert.rejects(waiting, { name: 'AbortError' });
  f.observers[0].emit(false); await rejected;
  f.element.pending[0].resolve(); await flush(); assert.equal(f.element.paused, true);
  await assert.rejects(player.play(), { name: 'AbortError' });
  f.observers[0].emit(true); assert.equal(f.element.playCalls, 1);
  f.element.hold = false; await player.play(); assert.equal(f.element.paused, false);
  f.hide(true); assert.equal(f.element.paused, true);
  await assert.rejects(player.resume(), { name: 'AbortError' });
  // Native controls are subject to the same explicitly configured pause policy.
  f.element.paused = false; f.element.dispatchEvent(new Event('play'));
  assert.equal(f.element.paused, true);
  f.hide(false); assert.equal(f.element.paused, true); assert.equal(f.element.playCalls, 2);
  await player.resume(); assert.equal(f.element.paused, false);
  api.unregister(player.id);
  assert.equal(f.observers[0].connected, false); assert.equal(f.listeners.size, 0);
});

test('abort disconnects policies immediately and stale visibility cannot load an abandoned source', async t => {
  const { api, kernel } = await setup(t); const f = visibilityFixture();
  const player = api.register({ id: 'cancel-lazy', element: f.element, src: 'abandoned.mp4',
    visibility: { loadWhenVisible: true } });
  const shutdown = kernel.shutdown();
  assert.equal(f.observers[0].connected, false); assert.equal(f.listeners.size, 0);
  f.observers[0].emit(true); f.hide(false);
  await shutdown;
  assert.equal(f.element.src, 'borrowed.mp4'); assert.equal(f.element.loadCalls, 0);
  assert.equal(player.getSnapshot().status, 'disposed');
});

test('without IntersectionObserver, lazy loading falls back to document visibility without autoplay', async t => {
  const { api } = await setup(t); const f = visibilityFixture({ observerAvailable: false, hidden: true });
  const player = api.register({ id: 'fallback', element: f.element, src: 'visible.mp4',
    visibility: { loadWhenVisible: true, pauseWhenOffscreen: true } });
  assert.equal(f.element.loadCalls, 0);
  f.hide(false); assert.equal(f.element.src, 'visible.mp4'); assert.equal(f.element.playCalls, 0);
  await player.play(); f.hide(true);
  // Document pausing is independent and was not enabled on this registration.
  assert.equal(f.element.paused, false);
});

test('unregister sends one terminal snapshot and releases real video texture bindings', async t => {
  const { api } = await setup(t); const element = new Video();
  const frames = new Map();
  element.requestVideoFrameCallback = callback => { frames.set(1, callback); return 1; };
  element.cancelVideoFrameCallback = id => frames.delete(id);
  const player = api.register({ id: 'texture', element });
  const scope = new ResourceScope(), abort = new AbortController();
  const binding = createVideoTexture(player, { scope, signal: abort.signal });
  let disposals = 0; const terminal = [];
  binding.texture.addEventListener('dispose', () => disposals++);
  player.subscribe((snapshot, event) => { if (event === 'disposed') terminal.push(snapshot); });
  assert.equal(frames.size, 1);
  api.unregister(player.id); api.unregister(player.id);
  assert.equal(disposals, 1); assert.equal(frames.size, 0);
  assert.deepEqual(terminal, [player.getSnapshot()]);
  assert.equal(element.src, 'borrowed.mp4'); assert.equal(element.removed, false);
  abort.abort(); await scope.dispose(); assert.equal(disposals, 1);
});

test('players are independent, duplicates reject, snapshots are stable, and the kernel stays idle', async t => {
  const { api, scheduler } = await setup(t);
  const one = new Video(), two = new Video();
  const a = api.register({ id: 'a', element: one }), b = api.register({ id: 'b', element: two });
  assert.throws(() => api.register({ id: 'a', element: two }), /already registered/);
  assert.throws(() => api.register({ id: 'other', element: one }), /already registered/);
  assert.equal(a.getSnapshot(), a.getSnapshot());
  assert.equal(Object.isFrozen(a.getSnapshot().textTracks[0]), true);
  await Promise.all([a.play(), b.play()]);
  a.pause(); a.seek(3); a.setMuted(true); a.setVolume(.3); a.setPlaybackRate(1.5); a.setLoop(true);
  assert.equal(one.currentTime, 3); assert.equal(two.paused, false); assert.equal(two.volume, 1);
  assert.equal(a.getSnapshot().playbackRate, 1.5); assert.equal(a.getSnapshot().loop, true);
  assert.equal(scheduler.isRunning(), false);
  assert.equal(api.getSnapshots().length, 2);
});

test('pause cancels shared pending play immediately; a late native completion stays paused', async t => {
  const { api } = await setup(t); const element = new Video(); element.hold = true;
  const handle = api.register({ id: 'held', element });
  const first = handle.play(); assert.equal(first, handle.play()); assert.equal(element.playCalls, 1);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  handle.pause(); await rejected;
  element.pending[0].resolve(); await flush();
  assert.equal(element.paused, true); assert.notEqual(handle.getSnapshot().status, 'playing');
});

test('an old completion cannot pause a newer play request or poison it with an error', async t => {
  const { api } = await setup(t); const element = new Video(); element.hold = true;
  const handle = api.register({ id: 'race', element });
  const old = handle.play(); const rejected = assert.rejects(old, { name: 'AbortError' });
  handle.pause(); await rejected;
  const current = handle.resume();
  element.pending[1].resolve(); await current;
  element.pending[0].reject(new DOMException('Old rejection', 'NotAllowedError')); await flush();
  assert.equal(element.paused, false); assert.equal(handle.getSnapshot().status, 'playing');
  assert.equal(handle.getSnapshot().error, null);
});

test('source replacement cancels pending work and rejects stale activation', async t => {
  const { api } = await setup(t); const element = new Video(); element.hold = true;
  const handle = api.register({ id: 'source', element });
  const waiting = handle.play(); const rejected = assert.rejects(waiting, { name: 'AbortError' });
  handle.setSource('next.mp4'); await rejected;
  element.pending[0].resolve(); await flush();
  assert.equal(element.src, 'next.mp4'); assert.equal(element.paused, true);
});

test('shutdown cancels unsettled playback before native completion and releases all listeners', async t => {
  const { kernel, api } = await setup(t); const element = new Video(); element.hold = true;
  const handle = api.register({ id: 'shutdown', element });
  const waiting = handle.play(); const rejected = assert.rejects(waiting, { name: 'AbortError' });
  await kernel.shutdown(); await rejected;
  assert.equal(handle.getSnapshot().status, 'disposed'); assert.equal(element.listenerCount(), 0);
  assert.equal(api.getSnapshots().length, 0);
  element.pending[0].resolve(); await flush(); assert.equal(element.paused, true);
  await assert.rejects(handle.play(), { name: 'AbortError' });
  assert.throws(() => handle.subscribe(() => {}), { name: 'AbortError' });
});

test('borrowed sources, nodes, and already external playback survive unregister; owned media releases', async t => {
  const { api } = await setup(t); const borrowed = new Video(); borrowed.paused = false;
  const owned = new Video();
  api.register({ id: 'borrowed', element: borrowed });
  api.register({ id: 'owned', element: owned, ownership: 'owned' });
  api.unregister('borrowed'); api.unregister('owned'); api.unregister('owned');
  assert.equal(borrowed.src, 'borrowed.mp4'); assert.equal(borrowed.paused, false);
  assert.equal(borrowed.removed, false); assert.equal(borrowed.loadCalls, 0);
  assert.equal(owned.src, ''); assert.equal(owned.removed, true); assert.equal(owned.loadCalls, 1);
});

test('a late completion does not pause a re-registered element', async t => {
  const { api } = await setup(t); const element = new Video(); element.hold = true;
  const old = api.register({ id: 'old', element }); const waiting = old.play();
  const rejected = assert.rejects(waiting, { name: 'AbortError' }); api.unregister('old'); await rejected;
  const fresh = api.register({ id: 'fresh', element }); const playing = fresh.play();
  element.pending[1].resolve(); await playing;
  element.pending[0].resolve(); await flush();
  assert.equal(element.paused, false);
});

test('element ownership survives a handoff between kernels without stale playback interference', async t => {
  const first = await setup(t), second = await setup(t);
  const element = new Video(); element.hold = true;
  const original = first.api.register({ id: 'original', element });
  assert.throws(() => second.api.register({ id: 'competing', element }), /already registered/);
  const oldPlay = original.play(); const rejected = assert.rejects(oldPlay, { name: 'AbortError' });
  await first.kernel.shutdown(); await rejected;
  const replacement = second.api.register({ id: 'replacement', element });
  const newPlay = replacement.play(); element.pending[1].resolve(); await newPlay;
  element.pending[0].resolve(); await flush();
  assert.equal(element.paused, false);
  assert.equal(replacement.getSnapshot().status, 'playing');
});

test('native rejection and seek errors stay local; captions do not disable metadata tracks', async t => {
  const { kernel, api } = await setup(t); const element = new Video();
  element.play = () => Promise.reject(new DOMException('User interaction required.', 'NotAllowedError'));
  const handle = api.register({ id: 'errors', element });
  await assert.rejects(handle.play(), { name: 'NotAllowedError' });
  assert.equal(handle.getSnapshot().error.name, 'NotAllowedError');
  assert.equal(kernel.getLifecycleSnapshot().state, 'running');
  assert.throws(() => handle.seek(NaN), RangeError);
  element.readyState = 0; assert.throws(() => handle.seek(1), { name: 'InvalidStateError' });
  element.readyState = 4; handle.seek(2);
  handle.setTextTrack(0); assert.equal(element.textTracks.values[0].mode, 'showing');
  handle.setTextTrack(null); assert.equal(element.textTracks.values[1].mode, 'hidden');
  assert.throws(() => handle.setTextTrack(1), /Unknown caption/);
});

test('observer failures cannot block sibling listeners or disposal, including boot rollback', async t => {
  const { api } = await setup(t); const element = new Video();
  const handle = api.register({ id: 'observers', element }); let updates = 0;
  handle.subscribe(() => { throw new Error('observer'); });
  handle.subscribe(() => { updates++; });
  await handle.play(); assert.ok(updates > 0);
  api.unregister('observers'); const before = updates;
  element.dispatchEvent(new Event('timeupdate')); assert.equal(updates, before);
  const partial = new Video();
  const kernel = createKernel({ frameMode: 'auto', adapters: [{ ...createVideoAdapter(), isSupported: () => true }],
    controllers: [{ id: 'partial', start(ctx) {
      ctx.require(VideoCapability).register({ id: 'partial', element: partial, ownership: 'owned' });
      throw new Error('setup failed');
    } }],
  });
  await assert.rejects(kernel.boot(), /setup failed/);
  assert.equal(partial.removed, true); assert.equal(partial.listenerCount(), 0);
  await kernel.shutdown();
});

test('cleanup continues across a native release failure and reports its cause', async () => {
  const kernel = createKernel({ frameMode: 'auto', adapters: [{ ...createVideoAdapter(), isSupported: () => true }] });
  await kernel.boot();
  const api = kernel.getContext().require(VideoCapability);
  const healthy = new Video(), broken = new Video();
  api.register({ id: 'healthy', element: healthy, ownership: 'owned' });
  api.register({ id: 'broken', element: broken, ownership: 'owned' });
  broken.load = () => { throw new Error('release failed'); };
  await assert.rejects(kernel.shutdown());
  assert.equal(healthy.removed, true); assert.equal(broken.removed, true);
  assert.equal(healthy.listenerCount(), 0); assert.equal(broken.listenerCount(), 0);
  assert.equal(api.getSnapshots().length, 0);
  assert.ok(kernel.getCleanupErrors().length > 0);
});
