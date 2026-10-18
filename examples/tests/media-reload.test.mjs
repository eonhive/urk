/**
 * Company: EonHive Inc. | Title: Film Reload Cancellation Checks
 * Purpose: Verify restoration ordering and release pending subscriptions on cancellation or failure.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { reloadFilm } from '../../packages/examples/dist/interactive-media/reload.js';

function fixture() {
  const listeners = new Set(), seeks = [], sources = [];
  const element = { readyState: 4, seeking: false };
  let snapshot = { status: 'ready', duration: 8, error: null };
  const player = {
    element,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setSource(src) {
      sources.push(src);
      this.event('pause');
      element.readyState = 0;
      this.event('source');
    },
    seek(time) { seeks.push(time); element.seeking = true; this.event('seek'); },
    play() { assert.fail('Restoration must not play media'); },
    event(event, changes = {}) {
      snapshot = { ...snapshot, ...changes };
      for (const listener of [...listeners]) listener(snapshot, event);
    },
  };
  return { player, element, listeners, seeks, sources };
}

test('reload waits for new metadata and seek completion, clamps position, and never plays', async () => {
  const f = fixture(); const abort = new AbortController();
  let complete = false;
  const done = reloadFilm(f.player, 'orbit.mp4', 12, abort.signal).then(() => { complete = true; });
  assert.deepEqual(f.seeks, []);
  f.element.readyState = 1; f.player.event('loadedmetadata');
  assert.deepEqual(f.seeks, [8]);
  await Promise.resolve(); assert.equal(complete, false);
  f.element.readyState = 2; f.player.event('loadeddata');
  await Promise.resolve(); assert.equal(complete, false);
  f.element.seeking = false; f.player.event('seeked');
  await done; assert.equal(f.listeners.size, 0);
});

test('cancellation before metadata releases observation and late events cannot seek', async () => {
  const f = fixture(); const abort = new AbortController();
  const done = reloadFilm(f.player, 'orbit.mp4', 5, abort.signal);
  const rejected = assert.rejects(done, { name: 'AbortError' });
  abort.abort(); await rejected;
  assert.equal(f.listeners.size, 0);
  f.element.readyState = 4; f.player.event('loadedmetadata');
  assert.deepEqual(f.seeks, []);
});

test('native errors and disposal reject pending reload and release observation', async () => {
  for (const changes of [{ error: { message: 'Decode failed' } }, { status: 'disposed' }]) {
    const f = fixture();
    const done = reloadFilm(f.player, 'orbit.mp4', 5, new AbortController().signal);
    const rejected = assert.rejects(done);
    f.player.event('error', changes); await rejected;
    assert.equal(f.listeners.size, 0);
  }
});

test('cancelled owners acquire nothing; synchronous source failure releases observation', async () => {
  const f = fixture(); const abort = new AbortController(); abort.abort();
  await assert.rejects(reloadFilm(f.player, 'orbit.mp4', 5, abort.signal), { name: 'AbortError' });
  assert.deepEqual(f.sources, []); assert.equal(f.listeners.size, 0);
  f.player.setSource = () => { throw new Error('Source unavailable'); };
  await assert.rejects(reloadFilm(f.player, 'orbit.mp4', 5, new AbortController().signal), /Source unavailable/);
  assert.equal(f.listeners.size, 0);
});
