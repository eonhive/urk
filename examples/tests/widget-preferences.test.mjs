/**
 * Company: EonHive Inc. | Title: Widget Preference Validation
 * Purpose: Reject corrupt stored settings and keep restored values independent and immutable.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readWidgetSettings } from '../../packages/examples/dist/motion-widget/preferences.js';

const record = () => ({
  version: 1,
  timing: { entranceMs: 700, staggerMs: 140, revealMs: 320 },
  playbackRate: 1,
});

test('restored settings are validated copies and contain no playback state', () => {
  const input = { ...record(), progress: 0.5, userPaused: true };
  const restored = readWidgetSettings(input);
  assert.deepEqual(restored, { timing: input.timing, playbackRate: 1 });
  input.timing.entranceMs = 9000;
  assert.equal(restored.timing.entranceMs, 700);
  assert.equal(Object.isFrozen(restored), true);
  assert.equal(Object.isFrozen(restored.timing), true);
  assert.equal(readWidgetSettings({ ...record(), playbackRate: 0.75 }).playbackRate, 0.75);
});

test('incomplete, unsupported, and invalid records reject atomically', () => {
  for (const input of [
    null,
    [],
    {},
    'settings',
    { ...record(), version: 2 },
    { ...record(), timing: { entranceMs: 500 } },
  ])
    assert.equal(readWidgetSettings(input), undefined);
  for (const rate of [0, -1, NaN, Infinity, '2', null])
    assert.equal(readWidgetSettings({ ...record(), playbackRate: rate }), undefined);
  for (const timing of [
    { ...record().timing, staggerMs: -1 },
    { ...record().timing, revealMs: 0.5 },
    { ...record().timing, extra: 20 },
  ])
    assert.equal(readWidgetSettings({ ...record(), timing }), undefined);
});
