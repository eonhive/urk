/**
 * Company: EonHive Inc. | Title: Numeric Tween Playback
 * Purpose: Interpolate selected numeric properties with cancellable, pause-safe frame timing.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */
import type { FrameInfo } from '@urk/core';
import { ease, validateTiming } from './timing.js';
import type { MotionPlayback, MotionResult, TweenOptions } from './types.js';

interface Track { key: string; from: number; to: number }

export function validateTween(target: object, properties: object, options: TweenOptions): Track[] {
  validateTiming(options);
  if (!target || typeof target !== 'object' || !properties || typeof properties !== 'object') {
    throw new TypeError('Tween needs a target and numeric properties.');
  }
  if (options.onUpdate !== undefined && typeof options.onUpdate !== 'function') {
    throw new TypeError('Tween onUpdate must be a function.');
  }
  const keys = Reflect.ownKeys(properties);
  if (!keys.length) throw new TypeError('Tween needs at least one numeric property.');
  return keys.map(key => {
    const source = Object.getOwnPropertyDescriptor(target, key);
    const destination = Object.getOwnPropertyDescriptor(properties, key);
    if (typeof key !== 'string' || !source?.writable || !Number.isFinite(source.value) ||
        !destination || !Number.isFinite(destination.value)) {
      throw new TypeError('Tween properties must be finite, own numeric data properties on a writable target.');
    }
    return { key, from: source.value as number, to: destination.value as number };
  });
}

export function createTween(
  target: object, tracks: Track[], options: TweenOptions,
  release: () => void, demandChanged: () => void,
) {
  let terminal = false;
  let started = false;
  let paused = false;
  let suspended = false;
  let elapsedMs = 0;
  let lastTimeMs: number | undefined;
  let resolve!: (result: MotionResult) => void;
  const finished = new Promise<MotionResult>(done => { resolve = done; });
  const runnable = () => started && !terminal && !paused && !suspended;

  function apply(progress: number): void {
    for (const { key, from, to } of tracks) {
      // Weighted endpoints avoid overflowing the difference between large finite numbers.
      (target as Record<string, number>)[key] = progress === 1 ? to : from * (1 - progress) + to * progress;
    }
    options.onUpdate?.();
  }

  function settle(result: MotionResult): void {
    if (terminal) return;
    terminal = true;
    options.signal?.removeEventListener('abort', abort);
    try {
      release();
      if (result.status === 'completed') apply(1);
    } catch (error) {
      result = { status: 'failed', error };
    }
    resolve(Object.freeze(result));
  }

  function changePause(change: () => void): void {
    if (terminal) return;
    const wasRunnable = runnable();
    change();
    if (wasRunnable !== runnable()) lastTimeMs = undefined;
    try { demandChanged(); }
    catch (error) { settle({ status: 'failed', error }); }
  }

  const handle: MotionPlayback = {
    finished,
    pause() { changePause(() => { paused = true; }); },
    resume() { changePause(() => { paused = false; }); },
    finish() { settle({ status: 'completed' }); },
    cancel(reason) { settle({ status: 'cancelled', reason }); },
  };
  function abort() { handle.cancel('aborted'); }

  return {
    handle,
    runnable,
    suspend(value: boolean) { changePause(() => { suspended = value; }); },
    start(skip: boolean) {
      if (terminal) return;
      if (options.signal?.aborted) { abort(); return; }
      options.signal?.addEventListener('abort', abort, { once: true });
      if (skip) { handle.finish(); return; }
      started = true;
      try { demandChanged(); }
      catch (error) { settle({ status: 'failed', error }); }
    },
    tick(frame: FrameInfo) {
      if (!runnable()) return;
      try {
        if (!Number.isFinite(frame.timeMs)) throw new RangeError('Tween frame time must be finite.');
        if (lastTimeMs !== undefined) elapsedMs += Math.max(0, frame.timeMs - lastTimeMs);
        lastTimeMs = frame.timeMs;
        const time = elapsedMs - (options.delayMs ?? 0);
        if (time < 0) return;
        if (time >= options.durationMs) { handle.finish(); return; }
        apply(ease(time / options.durationMs, options.easing ?? 'linear'));
      } catch (error) {
        settle({ status: 'failed', error });
      }
    },
  };
}
