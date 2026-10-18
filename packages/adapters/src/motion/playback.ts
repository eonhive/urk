/**
 * Company: EonHive Inc. | Title: Native Motion Playback
 * Purpose: Settle browser animation controls consistently and release transient effects.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import type { MotionOptions, MotionPlayback, MotionResult } from './types.js';

export function createPlayback(element: Element, signal: AbortSignal | undefined, release: () => void) {
  let animation: Animation | undefined;
  let terminal = false;
  let paused = false;
  let suspended = false;
  let pending: (() => void) | undefined;
  let resolve!: (result: MotionResult) => void;
  const finished = new Promise<MotionResult>(done => { resolve = done; });

  function settle(result: MotionResult): void {
    if (terminal) return;
    terminal = true;
    pending = undefined;
    signal?.removeEventListener('abort', abort);
    release();
    try {
      animation?.cancel();
    } catch (error) {
      result = { status: 'failed', error };
    }
    animation = undefined;
    resolve(Object.freeze(result));
  }

  function control(action: () => void): void {
    if (terminal) return;
    try { action(); }
    catch (error) { settle({ status: 'failed', error }); }
  }

  function syncPause(): void {
    if (paused || suspended) animation?.pause();
    else if (pending) {
      const acquire = pending;
      pending = undefined;
      acquire();
    }
    else animation?.play();
  }

  const handle: MotionPlayback = {
    finished,
    pause() { control(() => { paused = true; syncPause(); }); },
    resume() { control(() => { paused = false; syncPause(); }); },
    finish() { settle({ status: 'completed' }); },
    cancel(reason) { settle({ status: 'cancelled', reason }); },
  };
  function abort() { handle.cancel('aborted'); }

  return {
    handle,
    suspend(value: boolean) {
      control(() => { suspended = value; syncPause(); });
    },
    start(frames: Keyframe[], options: MotionOptions, skip: boolean) {
      if (terminal) return;
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      if (skip || typeof element.animate !== 'function') { handle.finish(); return; }
      pending = () => {
        const native = element.animate(frames, {
          duration: options.durationMs,
          delay: options.delayMs ?? 0,
          easing: options.easing ?? 'linear',
          iterations: 1,
          fill: 'both',
        });
        // Observe completion before cancellation, including reentrant replacement during animate().
        void native.finished.then(
          () => handle.finish(),
          error => settle(error?.name === 'AbortError'
            ? { status: 'cancelled', reason: 'native-cancelled' }
            : { status: 'failed', error }),
        );
        if (terminal) { native.cancel(); return; }
        animation = native;
        if (paused || suspended) native.pause();
      };
      control(syncPause);
    },
  };
}
