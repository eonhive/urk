/**
 * Company: EonHive Inc. | Title: Numeric Tween Playback
 * Purpose: Interpolate selected numeric properties with cancellable, pause-safe frame timing.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import type { FrameInfo } from '@urk/core';
import { ease, validateTiming } from './timing.js';
import type {
  MotionHandle,
  MotionResult,
  TweenOptions,
  ValueTweenOptions,
  ValueTweenHandle,
} from './types.js';

interface Track {
  key: string;
  from: number;
  to: number;
}

function interpolate(from: number, to: number, progress: number): number {
  // Weighted endpoints avoid overflowing the difference between large finite numbers.
  const value = progress === 1 ? to : progress === 0 ? from : from * (1 - progress) + to * progress;
  if (!Number.isFinite(value))
    throw new RangeError('Motion interpolation must produce a finite number.');
  return value;
}

/** Shared sampling for timeline playback and explicit seeks; callbacks own rendering. */
export function sampleValueTween(options: ValueTweenOptions, progress: number): void {
  const eased = ease(progress, options.easing ?? 'linear');
  options.onUpdate(interpolate(options.from, options.to, eased), progress);
}

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
  return keys.map((key) => {
    const source = Object.getOwnPropertyDescriptor(target, key);
    const destination = Object.getOwnPropertyDescriptor(properties, key);
    if (
      typeof key !== 'string' ||
      !source?.writable ||
      !Number.isFinite(source.value) ||
      !destination ||
      !Number.isFinite(destination.value)
    ) {
      throw new TypeError(
        'Tween properties must be finite, own numeric data properties on a writable target.',
      );
    }
    return {
      key,
      from: source.value as number,
      to: destination.value as number,
    };
  });
}

export function createTween(
  target: object,
  tracks: Track[],
  options: TweenOptions,
  release: () => void,
  demandChanged: () => void,
  behavior?: {
    easing?: ValueTweenOptions['easing'];
    onComplete?: () => void;
    fatal?: boolean;
  },
) {
  let terminal = false;
  let outcome: MotionResult | undefined;
  let progress = 0;
  let written = false;
  let started = false;
  let paused = false;
  let suspended = false;
  let elapsedMs = 0;
  let playbackRate = 1;
  let lastTimeMs: number | undefined;
  let revision = 0;
  let resolve!: (result: MotionResult) => void;
  const finished = new Promise<MotionResult>((done) => {
    resolve = done;
  });
  const runnable = () => started && !terminal && !paused && !suspended;

  function apply(position: number): void {
    const ticket = revision;
    progress = position;
    written = true;
    const eased = ease(position, behavior?.easing ?? options.easing ?? 'linear');
    if (ticket !== revision) return;
    for (const { key, from, to } of tracks) {
      (target as Record<string, number>)[key] = interpolate(from, to, eased);
    }
    options.onUpdate?.();
  }

  function settle(result: MotionResult): void {
    if (terminal) return;
    terminal = true;
    revision++;
    options.signal?.removeEventListener('abort', abort);
    try {
      release();
      if (result.status === 'completed') {
        apply(1);
        behavior?.onComplete?.();
      }
    } catch (error) {
      result = { status: 'failed', error };
    }
    outcome = result;
    resolve(Object.freeze(result));
    if (result.status === 'failed' && behavior?.fatal) throw result.error;
  }

  function changePause(change: () => void): void {
    if (terminal) return;
    const wasRunnable = runnable();
    change();
    if (wasRunnable !== runnable()) lastTimeMs = undefined;
    try {
      demandChanged();
    } catch (error) {
      settle({ status: 'failed', error });
    }
  }

  function advanceTime(deltaMs: number): void {
    try {
      elapsedMs += deltaMs * playbackRate;
      const time = elapsedMs - (options.delayMs ?? 0);
      if (time < 0) return;
      if (time >= options.durationMs) {
        handle.finish();
        return;
      }
      apply(time / options.durationMs);
    } catch (error) {
      if (!terminal) settle({ status: 'failed', error });
      if (behavior?.fatal) throw error;
    }
  }

  const handle: MotionHandle = {
    finished,
    get status() {
      return outcome?.status ?? (paused || suspended ? 'paused' : written ? 'running' : 'pending');
    },
    get progress() {
      return progress;
    },
    pause() {
      changePause(() => {
        paused = true;
      });
    },
    resume() {
      changePause(() => {
        paused = false;
      });
    },
    finish() {
      settle({ status: 'completed' });
    },
    cancel(reason) {
      settle({ status: 'cancelled', reason });
    },
  };
  function abort() {
    handle.cancel('aborted');
  }

  return {
    handle,
    runnable,
    restart() {
      if (terminal) return false;
      revision++;
      elapsedMs = 0;
      progress = 0;
      written = false;
      lastTimeMs = undefined;
      return true;
    },
    setPlaybackRate(rate: number) {
      if (!terminal) playbackRate = rate;
    },
    advance(deltaMs: number) {
      if (!runnable()) return;
      advanceTime(deltaMs);
    },
    suspend(value: boolean) {
      changePause(() => {
        suspended = value;
      });
    },
    start(skip: boolean) {
      if (terminal) return;
      if (options.signal?.aborted) {
        abort();
        return;
      }
      options.signal?.addEventListener('abort', abort, { once: true });
      if (skip) {
        handle.finish();
        return;
      }
      started = true;
      try {
        demandChanged();
      } catch (error) {
        if (!terminal) settle({ status: 'failed', error });
        if (behavior?.fatal) throw error;
      }
    },
    tick(frame: FrameInfo) {
      if (!runnable()) return;
      try {
        if (!Number.isFinite(frame.timeMs))
          throw new RangeError('Tween frame time must be finite.');
        const deltaMs = lastTimeMs === undefined ? 0 : Math.max(0, frame.timeMs - lastTimeMs);
        lastTimeMs = frame.timeMs;
        advanceTime(deltaMs);
      } catch (error) {
        if (!terminal) settle({ status: 'failed', error });
        if (behavior?.fatal) throw error;
      }
    },
  };
}

/** Validate the complete request before it can acquire ownership or invoke callbacks. */
export function validateValueTween(options: ValueTweenOptions): void {
  validateTiming(options, true);
  if (!Number.isFinite(options.from) || !Number.isFinite(options.to)) {
    throw new RangeError('Tween from and to must be finite.');
  }
  if (
    typeof options.onUpdate !== 'function' ||
    (options.onComplete !== undefined && typeof options.onComplete !== 'function')
  ) {
    throw new TypeError('Tween callbacks must be functions.');
  }
}

export function createValueTween(
  options: ValueTweenOptions,
  release: () => void,
  demandChanged: () => void,
) {
  const target = { value: options.from };
  const track = { key: 'value', from: options.from, to: options.to };
  const timing: TweenOptions = {
    durationMs: options.durationMs,
    delayMs: options.delayMs,
    signal: options.signal,
    onUpdate: () => options.onUpdate(target.value, tween.handle.progress),
  };
  const behavior = { easing: options.easing, onComplete: options.onComplete, fatal: true };
  const tween = createTween(target, [track], timing, release, demandChanged, behavior);
  const handle: ValueTweenHandle = {
    finished: tween.handle.finished,
    get value() {
      return target.value;
    },
    get status() {
      return tween.handle.status;
    },
    get progress() {
      return tween.handle.progress;
    },
    pause: tween.handle.pause,
    resume: tween.handle.resume,
    cancel: tween.handle.cancel,
    finish: tween.handle.finish,
    retarget(to, next = {}) {
      const durationMs = next.durationMs ?? timing.durationMs;
      const easing = next.easing ?? behavior.easing;
      validateValueTween({ ...options, from: target.value, to, durationMs, delayMs: 0, easing });
      if (!tween.restart()) return false;
      track.from = target.value;
      track.to = to;
      timing.durationMs = durationMs;
      timing.delayMs = 0;
      behavior.easing = easing;
      return true;
    },
  };
  return { ...tween, handle };
}
