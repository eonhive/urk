/**
 * Company: EonHive Inc. | Title: Experience Time Source
 * Purpose: Let controllers use an application-selected timeline without a global clock.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

export interface TimeSample {
  time: number;
  kind: 'tick' | 'seek' | 'ended' | 'reset';
}

export interface TimeSource {
  getTime(): number;
  subscribe(listener: (sample: TimeSample) => void): () => void;
}

/** Push audio seconds, frame seconds, scroll progress, or external time explicitly. */
export function createTimeSource(initial = 0) {
  if (!Number.isFinite(initial) || initial < 0) throw new RangeError('Time must be finite and nonnegative.');
  let time = initial;
  const listeners = new Set<(sample: TimeSample) => void>();
  return {
    getTime: () => time,
    subscribe(listener: (sample: TimeSample) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(next: number, kind: TimeSample['kind'] = 'tick') {
      if (!Number.isFinite(next) || next < 0) throw new RangeError('Time must be finite and nonnegative.');
      time = next;
      for (const listener of [...listeners]) listener({ time, kind });
    },
  };
}
