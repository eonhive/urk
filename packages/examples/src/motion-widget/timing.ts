/**
 * Company: EonHive Inc. | Title: Widget Timing Configuration
 * Purpose: Validate per-widget timing and describe its finite sequence duration.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
export interface MotionWidgetTiming {
  entranceMs: number;
  staggerMs: number;
  revealMs: number;
}

export const defaultWidgetTiming: Readonly<MotionWidgetTiming> = Object.freeze({
  entranceMs: 700,
  staggerMs: 140,
  revealMs: 320,
});

export function resolveWidgetTiming(
  patch: Partial<MotionWidgetTiming> = {},
  previous: Readonly<MotionWidgetTiming> = defaultWidgetTiming,
): MotionWidgetTiming {
  const next = { ...previous };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.prototype.hasOwnProperty.call(defaultWidgetTiming, key))
      throw new TypeError(`Unknown widget timing: ${key}`);
    if (!Number.isInteger(value) || value < 0 || value > 10000)
      throw new RangeError(`${key} must be a whole number from 0 through 10,000 milliseconds.`);
    next[key as keyof MotionWidgetTiming] = value;
  }
  return next;
}

export function widgetDurationMs(timing: Readonly<MotionWidgetTiming>): number {
  return timing.entranceMs + timing.staggerMs * 2 + timing.revealMs;
}
