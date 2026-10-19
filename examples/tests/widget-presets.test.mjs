/**
 * Company: EonHive Inc. | Title: Portable Widget Preset Contracts
 * Purpose: Verify portable settings round trips and reject invalid input before application.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWidgetPreset,
  serializeWidgetPreset,
  widgetPresetMaxLength,
} from '../../packages/examples/dist/motion-widget/presets.js';

const settings = { timing: { entranceMs: 0, staggerMs: 140, revealMs: 10000 }, playbackRate: 0.75 };

test('presets round trip only versioned settings and restore immutable values', () => {
  const json = serializeWidgetPreset({ ...settings, progress: 0.5, userPaused: true });
  assert.deepEqual(JSON.parse(json), { version: 1, ...settings });
  const restored = parseWidgetPreset(json);
  assert.deepEqual(restored, settings);
  assert.equal(Object.isFrozen(restored), true);
  assert.equal(Object.isFrozen(restored.timing), true);
  assert.notEqual(restored.timing, settings.timing);
});

test('malformed, oversized, incomplete, and invalid presets fail clearly', () => {
  for (const json of [
    '',
    '{broken',
    'null',
    '[]',
    '{}',
    JSON.stringify({ version: 2, ...settings }),
    JSON.stringify({ version: 1, timing: { entranceMs: 100 }, playbackRate: 2 }),
    JSON.stringify({ version: 1, ...settings, playbackRate: 0 }),
    JSON.stringify({ version: 1, ...settings, timing: { ...settings.timing, staggerMs: 0.5 } }),
  ])
    assert.throws(() => parseWidgetPreset(json), TypeError);
  assert.throws(() => parseWidgetPreset(' '.repeat(widgetPresetMaxLength + 1)), RangeError);
  assert.throws(() => parseWidgetPreset({}), TypeError);
  assert.throws(() => serializeWidgetPreset({ ...settings, playbackRate: Infinity }), TypeError);
});
