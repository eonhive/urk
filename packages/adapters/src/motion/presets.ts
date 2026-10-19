/**
 * Company: EonHive Inc. | Title: Motion Presets
 * Purpose: Compose reusable numeric motion definitions without acquiring playback or DOM ownership.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { validateTimeline } from './timeline.js';
import type { TimelineEntry } from './types.js';

export interface MotionPresetOptions extends Omit<TimelineEntry, 'from' | 'to' | 'durationMs'> {
  from?: number;
  to?: number;
  durationMs?: number;
}

function preset(
  options: MotionPresetOptions,
  from: number,
  to: number,
  durationMs: number,
): TimelineEntry {
  const entry = {
    ...options,
    from: options.from ?? from,
    to: options.to ?? to,
    durationMs: options.durationMs ?? durationMs,
    easing: options.easing ?? 'ease-out',
  };
  validateTimeline({ tweens: [entry] });
  return entry;
}

/** Opacity from zero to one; the caller binds the value to its renderer. */
export function fade(options: MotionPresetOptions): TimelineEntry {
  const entry = preset(options, 0, 1, 300);
  if (entry.from < 0 || entry.from > 1 || entry.to < 0 || entry.to > 1)
    throw new RangeError('Fade endpoints must be between zero and one.');
  return entry;
}

/** Position from 24 to zero, in units chosen by the caller. */
export function slide(options: MotionPresetOptions): TimelineEntry {
  return preset(options, 24, 0, 400);
}

/** Nonnegative scale from 0.9 to one. */
export function scale(options: MotionPresetOptions): TimelineEntry {
  const entry = preset(options, 0.9, 1, 350);
  if (entry.from < 0 || entry.to < 0) throw new RangeError('Scale endpoints must be nonnegative.');
  return entry;
}

/** Add an index-based gap to authored offsets without changing the input entries. */
export function stagger(entries: readonly TimelineEntry[], gapMs = 100): TimelineEntry[] {
  if (!Number.isFinite(gapMs) || gapMs < 0)
    throw new RangeError('Stagger gapMs must be finite and nonnegative.');
  validateTimeline({ tweens: entries });
  const scheduled = entries.map((entry, index) => ({
    ...entry,
    atMs: (entry.atMs ?? 0) + index * gapMs,
  }));
  validateTimeline({ tweens: scheduled });
  return scheduled;
}
