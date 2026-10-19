/**
 * Company: EonHive Inc. | Title: Portable Widget Presets
 * Purpose: Serialize and validate small timing/speed presets using the existing settings contract.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { readWidgetSettings, type MotionWidgetSettings } from './preferences.js';

export const widgetPresetMaxLength = 4096;

export function parseWidgetPreset(json: string): MotionWidgetSettings {
  if (typeof json !== 'string') throw new TypeError('Preset must be JSON text.');
  if (json.length > widgetPresetMaxLength)
    throw new RangeError('Preset JSON must be 4,096 characters or fewer.');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new TypeError('Preset must be valid JSON.');
  }
  const settings = readWidgetSettings(value);
  if (!settings)
    throw new TypeError(
      'Use version 1, complete timing (0–10,000 whole milliseconds), and a finite positive playbackRate.',
    );
  return settings;
}

export function serializeWidgetPreset(settings: MotionWidgetSettings): string {
  const value = readWidgetSettings({
    version: 1,
    timing: settings.timing,
    playbackRate: settings.playbackRate,
  });
  if (!value) throw new TypeError('Cannot export invalid widget settings.');
  return JSON.stringify({ version: 1, ...value }, null, 2);
}
