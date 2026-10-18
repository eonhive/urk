/**
 * Company: EonHive Inc. | Title: Media Cue Contracts
 * Purpose: Verify seek/replay rules, cooperative cancellation, and opt-in video frame ownership.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCues,
  createTimeSource,
  createVideoTimeSource,
} from '../../packages/examples/dist/media/index.js';
import { readBookmark } from '../../packages/examples/dist/interactive-media/bookmarks.js';

test('timestamp order, skipped seeks, repeating replay, once-only and ended cues', async () => {
  const source = createTimeSource();
  const fired = [];
  const cues = createCues({
    source,
    onError: assert.fail,
    cues: [
      { id: 'late', when: { at: 4 }, run: () => fired.push('late') },
      { id: 'begin', when: { at: 0 }, run: () => fired.push('begin') },
      { id: 'title', when: { at: 2 }, run: () => fired.push('title') },
      { id: 'once', once: true, when: { at: 2 }, run: () => fired.push('once') },
      { id: 'end', when: { event: 'ended' }, run: () => fired.push('end') },
    ],
  });
  source.update(2);
  assert.deepEqual(fired, ['begin', 'title', 'once']);
  source.update(6, 'seek');
  source.update(7);
  assert.equal(fired.includes('late'), false);
  source.update(2, 'seek');
  source.update(2);
  assert.deepEqual(fired.slice(-1), ['title']);
  source.update(8, 'ended');
  assert.deepEqual(fired.slice(-2), ['late', 'end']);
  source.update(0, 'seek');
  cues.reset();
  source.update(2);
  assert.deepEqual(fired.slice(-3), ['begin', 'title', 'once']);
  await cues.dispose();
  source.update(8, 'ended');
  assert.equal(fired.at(-1), 'once');
});

test('actions cancel on seeks, group changes and abort; disposal waits for cooperative work', async () => {
  const source = createTimeSource();
  const owner = new AbortController();
  const actions = [];
  const cues = createCues({
    source,
    signal: owner.signal,
    onError: assert.fail,
    cues: [
      {
        id: 'load',
        group: 'scene',
        when: { event: 'choice' },
        run({ signal }) {
          return new Promise((resolve) => actions.push({ signal, resolve }));
        },
      },
    ],
  });
  cues.trigger('choice');
  source.update(4, 'seek');
  assert.equal(actions[0].signal.aborted, true);
  cues.trigger('choice');
  cues.setActive('scene', false);
  assert.equal(actions[1].signal.aborted, true);
  cues.trigger('choice');
  assert.equal(actions.length, 2);
  cues.setActive('scene', true);
  cues.trigger('choice');
  owner.abort();
  assert.equal(actions[2].signal.aborted, true);
  cues.trigger('choice');
  assert.equal(actions.length, 3);
  let disposed = false;
  const done = cues.dispose().then(() => {
    disposed = true;
  });
  await Promise.resolve();
  assert.equal(disposed, false);
  actions.forEach((action) => action.resolve());
  await done;
  assert.equal(disposed, true);
});

test('reentrant seeks stop stale crossings; errors stay local; suspended cues do not fire', async () => {
  const source = createTimeSource();
  const fired = [],
    errors = [];
  const cues = createCues({
    source,
    onError: (error) => errors.push(error.message),
    cues: [
      { id: 'handoff', when: { at: 0 }, run: () => source.update(7, 'seek') },
      { id: 'stale', when: { at: 2 }, run: () => fired.push('stale') },
      {
        id: 'bad',
        when: { event: 'bad' },
        run: () => {
          throw new Error('local failure');
        },
      },
      { id: 'good', when: { event: 'bad' }, run: () => fired.push('good') },
    ],
  });
  source.update(3);
  assert.deepEqual(fired, []);
  cues.trigger('bad');
  assert.deepEqual(errors, ['local failure']);
  assert.deepEqual(fired, ['good']);
  cues.suspend(true);
  cues.trigger('bad');
  source.update(8, 'ended');
  assert.equal(fired.length, 1);
  cues.suspend(false);
  cues.trigger('bad');
  assert.equal(fired.length, 2);
  await cues.dispose();
});

test('invalid sources, duplicate cues, and malformed bookmarks reject or use safe defaults', () => {
  assert.equal(readBookmark({ version: 1, musicVolume: 0, narrationVolume: 0.7 }).musicVolume, 0);
  assert.equal(readBookmark({ version: 1, musicVolume: NaN, narrationVolume: 2 }).narrationVolume, undefined);
  assert.throws(() => createTimeSource(-1), RangeError);
  const source = createTimeSource();
  assert.throws(() => source.update(Infinity), RangeError);
  const cue = { id: 'a', when: { at: 0 }, run() {} };
  assert.throws(() => createCues({ source, cues: [cue, cue], onError: assert.fail }), /Duplicate/);
  assert.deepEqual(readBookmark({ version: 1, position: -2, branch: 'unknown', captions: 'yes' }), {
    version: 1,
    position: 0,
    branch: null,
    captions: false,
  });
  assert.equal(readBookmark({ version: 9, position: 5 }).position, 0);
});

function videoSource(frames = true) {
  const listeners = new Set(),
    pending = new Map();
  let next = 0;
  const element = {
    currentTime: 0,
    paused: true,
    ended: false,
    seeking: false,
    requestVideoFrameCallback: frames
      ? (callback) => {
          pending.set(++next, callback);
          return next;
        }
      : undefined,
    cancelVideoFrameCallback: (id) => pending.delete(id),
  };
  let snapshot = { ...element, status: 'ready' };
  return {
    element,
    pending,
    listeners,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    event(event, changes = {}) {
      Object.assign(element, changes);
      snapshot = { ...snapshot, ...element, ...changes };
      for (const listener of listeners) listener(snapshot, event);
    },
  };
}

test('video event time suppresses seek timeupdates and never requests frames by default', () => {
  const player = videoSource(),
    samples = [];
  const off = createVideoTimeSource(player).subscribe((sample) => samples.push(sample));
  player.event('playing', { paused: false, status: 'playing' });
  player.event('timeupdate', { currentTime: 1 });
  player.event('seek', { currentTime: 5, seeking: true });
  player.event('timeupdate', { seeking: false });
  player.event('seeked', { currentTime: 5.05 });
  player.event('timeupdate', { currentTime: 5.2 });
  assert.deepEqual(
    samples.map((sample) => sample.kind),
    ['tick', 'seek', 'seek', 'tick'],
  );
  assert.equal(samples[2].time, 5);
  assert.equal(player.pending.size, 0);
  off();
  assert.equal(player.listeners.size, 0);
});

test('optional video frame sampling cancels on pause, seek, and unsubscribe with an rAF fallback', () => {
  const fallback = new Map();
  let next = 0;
  const previousFrame = globalThis.requestAnimationFrame,
    previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    fallback.set(++next, callback);
    return next;
  };
  globalThis.cancelAnimationFrame = (id) => fallback.delete(id);
  try {
    for (const native of [true, false]) {
      const player = videoSource(native),
        samples = [];
      const pending = native ? player.pending : fallback;
      const off = createVideoTimeSource(player, { frames: true }).subscribe((sample) => samples.push(sample));
      assert.equal(pending.size, 0);
      player.event('playing', { paused: false, status: 'playing', currentTime: 1 });
      assert.equal(pending.size, 1);
      const [id, deliver] = [...pending][0];
      pending.delete(id);
      deliver(0, { mediaTime: 0.95 });
      assert.equal(samples[0].time, native ? 0.95 : 1);
      assert.equal(pending.size, 1);
      player.event('pause', { paused: true });
      assert.equal(pending.size, 0);
      player.event('playing', { paused: false });
      assert.equal(pending.size, 1);
      player.event('seek', { seeking: true });
      assert.equal(pending.size, 0);
      player.event('seeked', { seeking: false });
      assert.equal(pending.size, 1);
      off();
      assert.equal(pending.size, 0);
      assert.equal(player.listeners.size, 0);
    }
  } finally {
    if (previousFrame) globalThis.requestAnimationFrame = previousFrame;
    else delete globalThis.requestAnimationFrame;
    if (previousCancel) globalThis.cancelAnimationFrame = previousCancel;
    else delete globalThis.cancelAnimationFrame;
  }
});
