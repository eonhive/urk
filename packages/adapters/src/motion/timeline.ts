/**
 * Company: EonHive Inc. | Title: Motion Timelines
 * Purpose: Schedule owned value tweens through temporary runtime frame work.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { sampleValueTween, validateValueTween } from './tween.js';
import type { FrameInfo } from '@urk/core';
import { ease } from './timing.js';
import type { MotionResult, TimelineEntry, TimelineHandle, TimelineOptions } from './types.js';

export function validateTimeline(options: TimelineOptions): void {
  if (!Array.isArray(options.tweens)) throw new TypeError('Timeline tweens must be an array.');
  const delay = options.delayMs ?? 0;
  const iterations = options.iterations ?? 1;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 100)
    throw new RangeError('Timeline iterations must be an integer from 1 through 100.');
  if (options.yoyo !== undefined && typeof options.yoyo !== 'boolean')
    throw new TypeError('Timeline yoyo must be a boolean.');
  if (!Number.isFinite(delay) || delay < 0)
    throw new RangeError('Timeline delayMs must be finite and nonnegative.');
  let cycleMs = 0;
  for (const entry of options.tweens) {
    validateValueTween(entry);
    const at = entry.atMs ?? 0;
    if (
      !Number.isFinite(at) ||
      at < 0 ||
      !Number.isFinite(delay + at + (entry.delayMs ?? 0) + entry.durationMs)
    ) {
      throw new RangeError('Timeline offsets and total duration must be finite and nonnegative.');
    }
    cycleMs = Math.max(cycleMs, at + (entry.delayMs ?? 0) + entry.durationMs);
  }
  if (!Number.isFinite(delay + cycleMs * iterations))
    throw new RangeError('Repeated timeline duration must be finite.');
  for (const callback of [options.onUpdate, options.onComplete]) {
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Timeline callbacks must be functions.');
  }
}

function schedulePasses(options: TimelineOptions, cycleMs: number): TimelineEntry[] {
  // Bounded passes become ordinary offsets, so the existing executor retains
  // ownership, boundary ordering, seeking, and callback cancellation.
  if ((options.iterations ?? 1) === 1) return [...options.tweens];
  const entries: TimelineEntry[] = [];
  const notified = new Set<number>();
  for (let pass = 0; pass < (options.iterations ?? 1); pass++) {
    const reverse = Boolean(options.yoyo && pass % 2 === 1);
    for (const [index, entry] of options.tweens.entries()) {
      const start = (entry.atMs ?? 0) + (entry.delayMs ?? 0);
      entries.push({
        ...entry,
        atMs: pass * cycleMs + (reverse ? Math.max(0, cycleMs - start - entry.durationMs) : start),
        delayMs: 0,
        from: reverse ? entry.to : entry.from,
        to: reverse ? entry.from : entry.to,
        // Reversing endpoints alone would play the original easing forward.
        easing: reverse
          ? (progress) => 1 - ease(1 - progress, entry.easing ?? 'linear')
          : entry.easing,
        onUpdate: reverse
          ? (value, progress) => entry.onUpdate(value, 1 - progress)
          : entry.onUpdate,
        onComplete: entry.onComplete
          ? () => {
              if (notified.has(index)) return;
              notified.add(index);
              entry.onComplete!();
            }
          : undefined,
      });
    }
  }
  return entries;
}

export function createTimeline(
  options: TimelineOptions,
  release: () => void,
  demandChanged: () => void,
) {
  const delay = options.delayMs ?? 0;
  const cycleMs = options.tweens.reduce(
    (end, entry) => Math.max(end, (entry.atMs ?? 0) + (entry.delayMs ?? 0) + entry.durationMs),
    0,
  );
  const entries = schedulePasses(options, cycleMs).sort(
    (a, b) => (a.atMs ?? 0) + (a.delayMs ?? 0) - (b.atMs ?? 0) - (b.delayMs ?? 0),
  );
  const children = entries.map((entry) => {
    const startMs = delay + (entry.atMs ?? 0) + (entry.delayMs ?? 0);
    return {
      options: entry,
      startMs,
      endMs: startMs + entry.durationMs,
      notified: false,
      progress: undefined as number | undefined,
    };
  });
  const boundaries = [
    ...new Set(
      entries.flatMap((entry) => {
        const start = delay + (entry.atMs ?? 0) + (entry.delayMs ?? 0);
        return [start, start + entry.durationMs];
      }),
    ),
  ].sort((a, b) => a - b);
  const duration = delay + cycleMs * (options.iterations ?? 1);
  let elapsed = 0;
  let playbackRate = 1;
  let paused = false;
  let suspended = false;
  let started = false;
  let terminal: MotionResult | undefined;
  let finishing = false;
  let revision = 0;
  let rendered = false;
  let lastTimeMs: number | undefined;
  const runnable = () => started && !terminal && !paused && !suspended;
  let resolve!: (result: MotionResult) => void;
  const finished = new Promise<MotionResult>((done) => {
    resolve = done;
  });

  function settle(result: MotionResult): void {
    if (terminal) return;
    terminal = result;
    revision++;
    options.signal?.removeEventListener('abort', abort);
    try {
      release();
      if (result.status === 'completed') options.onComplete?.();
    } catch (error) {
      terminal = { status: 'failed', error };
    }
    resolve(Object.freeze(terminal));
    if (terminal.status === 'failed') throw terminal.error;
  }

  function guarded(action: () => void): void {
    try {
      action();
    } catch (error) {
      if (!terminal) settle({ status: 'failed', error });
      throw error;
    }
  }

  function changePause(change: () => void): void {
    if (terminal) return;
    const wasRunnable = runnable();
    change();
    if (wasRunnable !== runnable()) lastTimeMs = undefined;
    guarded(demandChanged);
  }

  const current = (ticket: number) => !terminal && revision === ticket;

  function renderChild(child: (typeof children)[number], progress: number): void {
    child.progress = progress;
    rendered = true;
    sampleValueTween(child.options, progress);
  }

  function completeChild(child: (typeof children)[number]): void {
    if (child.notified) return;
    child.notified = true;
    child.options.onComplete?.();
  }

  function progressAt(child: (typeof children)[number], time: number): number {
    if (time < child.startMs) return 0;
    return child.options.durationMs === 0
      ? 1
      : Math.min(1, (time - child.startMs) / child.options.durationMs);
  }

  const handle: TimelineHandle = {
    finished,
    get durationMs() {
      return duration;
    },
    get currentTimeMs() {
      return elapsed;
    },
    seek(timeMs) {
      if (!Number.isFinite(timeMs)) throw new RangeError('Timeline seek time must be finite.');
      if (terminal || finishing) return;
      const ticket = ++revision;
      elapsed = Math.max(0, Math.min(duration, timeMs));
      lastTimeMs = undefined;
      rendered = true;
      guarded(() => {
        // Reset future bindings first, then render started children in start order.
        // This keeps later clips' initial values from covering earlier active clips.
        for (const child of [...children].reverse()) {
          if (!current(ticket)) return;
          if (elapsed < child.startMs) renderChild(child, 0);
        }
        for (const child of children) {
          if (!current(ticket)) return;
          if (elapsed >= child.startMs) renderChild(child, progressAt(child, elapsed));
        }
        if (current(ticket)) options.onUpdate?.(handle.progress);
      });
    },
    get status() {
      return (
        terminal?.status ??
        (paused || suspended ? 'paused' : elapsed < delay || !started ? 'pending' : 'running')
      );
    },
    get progress() {
      return duration === 0
        ? terminal?.status === 'completed' || rendered
          ? 1
          : 0
        : Math.min(1, elapsed / duration);
    },
    pause() {
      changePause(() => { paused = true; });
    },
    resume() {
      changePause(() => { paused = false; });
    },
    cancel(reason) {
      settle({ status: 'cancelled', reason });
    },
    finish() {
      if (terminal || finishing) return;
      finishing = true;
      guarded(() => {
        for (const child of children) {
          if (terminal) return;
          if (child.progress !== 1) renderChild(child, 1);
          if (terminal) return;
          completeChild(child);
        }
        if (terminal) return;
        elapsed = duration;
        options.onUpdate?.(1);
        if (!terminal) settle({ status: 'completed' });
      });
    },
  };
  function abort() {
    handle.cancel('aborted');
  }

  const playback = {
    handle,
    setPlaybackRate(rate: number) {
      if (!terminal) playbackRate = rate;
    },
    get activeCount() {
      if (terminal) return 0;
      return children.filter((child) => !child.notified || elapsed < child.endMs).length;
    },
    runnable,
    suspend(value: boolean) {
      changePause(() => { suspended = value; });
    },
    start(skip: boolean) {
      if (terminal) return;
      if (options.signal?.aborted) {
        abort();
        return;
      }
      options.signal?.addEventListener('abort', abort, { once: true });
      started = true;
      if (skip) handle.finish();
      else guarded(demandChanged);
    },
    advance(deltaMs: number) {
      if (!started || terminal || paused || suspended) return;
      const ticket = revision;
      guarded(() => {
        const destination = Math.min(duration, elapsed + deltaMs * playbackRate);
        // Visit crossed boundaries in order; seeking from a callback invalidates
        // the old frame so it cannot overwrite the newly selected position.
        const stops = boundaries.filter((time) => time > elapsed && time <= destination);
        if (elapsed === 0) stops.unshift(0);
        if (stops[stops.length - 1] !== destination) stops.push(destination);
        for (const time of stops) {
          if (paused || suspended || !current(ticket)) return;
          elapsed = time;
          for (const child of children) {
            if (!current(ticket)) return;
            if (time < child.startMs) continue;
            const progress = progressAt(child, time);
            if (child.progress !== 1 || progress !== 1) renderChild(child, progress);
            if (!current(ticket)) return;
            if (time >= child.endMs) completeChild(child);
          }
          if (paused || suspended) return;
        }
        if (!current(ticket)) return;
        rendered = true;
        options.onUpdate?.(handle.progress);
        if (current(ticket) && elapsed >= duration) settle({ status: 'completed' });
      });
    },
    tick(frame: FrameInfo): void {
      if (!runnable()) return;
      guarded(() => {
        if (!Number.isFinite(frame.timeMs)) throw new RangeError('Timeline frame time must be finite.');
        const deltaMs = lastTimeMs === undefined ? 0 : Math.max(0, frame.timeMs - lastTimeMs);
        lastTimeMs = frame.timeMs;
        playback.advance(deltaMs);
      });
    },
  };
  return playback;
}
