/**
 * Company: EonHive Inc. | Title: Video Texture Ownership Checks
 * Purpose: Verify native callback cleanup without taking ownership of borrowed playback.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceScope } from '@urk/core';
import { createVideoTexture } from '../dist/three/video.js';

function fixture() {
  let status = 'paused', next = 0;
  const callbacks = new Map(), listeners = new Set();
  const element = {
    requestVideoFrameCallback(callback) { callbacks.set(++next, callback); return next; },
    cancelVideoFrameCallback(id) { callbacks.delete(id); },
    pause() { assert.fail('Borrowed playback must remain untouched'); },
    remove() { assert.fail('Borrowed element must remain attached'); },
  };
  const player = { element, getSnapshot: () => ({ status }), subscribe(listener) {
    listeners.add(listener); return () => listeners.delete(listener);
  } };
  return { player, callbacks, listeners, release() {
    status = 'disposed'; for (const listener of listeners) listener({ status });
  } };
}
for (const reason of ['abort', 'player', 'scope', 'explicit']) {
  test(`texture releases exactly once on ${reason}, preserving borrowed video`, async () => {
    const f = fixture(), abort = new AbortController(), scope = new ResourceScope();
    const binding = createVideoTexture(f.player, { signal: abort.signal, scope });
    let disposals = 0;
    binding.texture.addEventListener('dispose', () => disposals++);
    assert.equal(binding.texture.image, f.player.element);
    assert.equal(binding.texture.colorSpace, 'srgb');
    assert.equal(f.callbacks.size, 1);
    if (reason === 'abort') abort.abort();
    if (reason === 'player') f.release();
    if (reason === 'scope') await scope.dispose();
    if (reason === 'explicit') binding.dispose();
    binding.dispose(); abort.abort(); await scope.dispose();
    assert.equal(disposals, 1);
    assert.equal(f.callbacks.size, 0);
    assert.equal(f.listeners.size, 0);
  });
}
test('unavailable owners acquire nothing, and scope registration failure rolls back', async () => {
  const f = fixture(), abort = new AbortController(), scope = new ResourceScope();
  abort.abort();
  assert.throws(() => createVideoTexture(f.player, { signal: abort.signal, scope }), { name: 'AbortError' });
  await scope.dispose();
  assert.throws(() => createVideoTexture(f.player, { signal: new AbortController().signal, scope }), /scope disposal/);
  assert.equal(f.callbacks.size, 0);
  assert.equal(f.listeners.size, 0);
});
