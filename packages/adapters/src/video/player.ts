/**
 * Company: EonHive Inc. | Title: Native Video Player
 * Purpose: Own native listeners, playback cancellation, and stable snapshots for one video.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import { CleanupError } from '@urk/core';
import type { VideoHandle, VideoRegistration, VideoSnapshot, VideoStatus } from './types.js';
import { observeVideoVisibility } from './visibility.js';

type PlayRequest = { promise: Promise<void>; resolve(): void; reject(error: unknown): void };

export function createVideoPlayer(
  options: VideoRegistration,
  element: HTMLVideoElement,
  signal: AbortSignal,
  emit: (snapshot: VideoSnapshot, event: string) => void,
  canPauseLatePlayback: () => boolean,
) {
  const listeners = new Set<(snapshot: VideoSnapshot, event: string) => void>();
  const removers: Array<() => void> = [];
  let disposed = false;
  let controlledPlayback = false;
  let wantsPlayback = false;
  let unsettledPlays = 0;
  let pending: PlayRequest | undefined;
  let visibility: ReturnType<typeof observeVideoVisibility> | undefined;
  let deferredSource = options.visibility?.loadWhenVisible ? options.src : undefined;
  let status: VideoStatus = element.error
    ? 'error'
    : element.ended
      ? 'ended'
      : !element.paused
        ? 'playing'
        : element.readyState >= 2
          ? 'ready'
          : 'idle';
  let error: VideoSnapshot['error'] = element.error
    ? {
        name: 'MediaError',
        message: element.error.message || 'Video could not load.',
        code: element.error.code,
      }
    : null;
  let revision = 0;
  let snapshot: VideoSnapshot;

  const active = () => !disposed && !signal.aborted;
  const cancelled = () => new DOMException('Video playback cancelled.', 'AbortError');
  const assertActive = () => {
    if (!active()) throw cancelled();
  };
  const read = (): VideoSnapshot =>
    Object.freeze({
      id: options.id,
      revision: revision++,
      status,
      currentTime: element.currentTime,
      duration: Number.isNaN(element.duration) ? null : element.duration,
      paused: element.paused,
      seeking: element.seeking,
      readyState: element.readyState,
      volume: element.volume,
      muted: element.muted,
      playbackRate: element.playbackRate,
      loop: element.loop,
      textTracks: Object.freeze(
        Array.from(element.textTracks, (track, index) =>
          Object.freeze({
            index,
            label: track.label,
            language: track.language,
            kind: track.kind,
            mode: track.mode,
          }),
        ),
      ),
      error: error && Object.freeze({ ...error }),
    });

  const publish = (event: string) => {
    snapshot = read();
    if (!active()) return;
    // Observation must not turn a successful native operation into a rejected command.
    for (const listener of [...listeners]) {
      if (!active()) break;
      try {
        listener(snapshot, event);
      } catch {
        /* Isolate observers. */
      }
    }
    if (active()) emit(snapshot, event);
  };

  const fail = (cause: unknown, event: string) => {
    const failure = cause instanceof Error ? cause : new Error(String(cause));
    error = { name: failure.name, message: failure.message };
    status = 'error';
    publish(event);
  };

  const cancelPending = () => {
    wantsPlayback = false;
    const request = pending;
    pending = undefined;
    request?.reject(cancelled());
  };

  const pause = () => {
    if (!active()) return;
    cancelPending();
    element.pause();
    status = 'paused';
    error = null;
    publish('pause');
  };

  const play = (): Promise<void> => {
    if (!active()) return Promise.reject(cancelled());
    if (visibility?.blocked()) return Promise.reject(cancelled());
    if (pending) return pending.promise;
    try {
      loadDeferredSource();
      assertActive();
    } catch (cause) {
      return Promise.reject(cause);
    }
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const request = { promise, resolve, reject };
    pending = request;
    controlledPlayback = true;
    wantsPlayback = true;
    error = null;
    // Call play in the original user gesture, without waiting for metadata or a preload.
    let nativePlay: Promise<void>;
    try {
      nativePlay = element.play();
    } catch (cause) {
      nativePlay = Promise.reject(cause);
    }
    unsettledPlays++;
    void Promise.resolve(nativePlay)
      .then(
        () => {
          if (pending !== request || !active()) {
            // An old completion must neither restart a cancelled player nor pause a newer request.
            if (!wantsPlayback && canPauseLatePlayback()) element.pause();
            return;
          }
          pending = undefined;
          status = element.paused ? 'paused' : 'playing';
          publish('playback');
          resolve();
        },
        (cause) => {
          if (pending !== request) return;
          pending = undefined;
          wantsPlayback = false;
          if (active()) fail(cause, 'playback-error');
          reject(cause);
        },
      )
      .then(
        () => {
          unsettledPlays--;
        },
        (cause) => {
          unsettledPlays--;
          reject(cause);
        },
      );
    if (pending === request && active()) {
      status = element.readyState < 2 ? 'loading' : 'buffering';
      publish('play-request');
    }
    return promise;
  };

  const command = (event: string, action: () => void) => {
    assertActive();
    try {
      action();
      error = null;
      publish(event);
    } catch (cause) {
      fail(cause, `${event}-error`);
      throw cause;
    }
  };

  const seek = (seconds: number) =>
    command('seek', () => {
      if (!Number.isFinite(seconds) || seconds < 0)
        throw new RangeError('Seek time must be finite and nonnegative.');
      if (element.readyState === 0)
        throw new DOMException('Load video metadata before seeking.', 'InvalidStateError');
      if (Number.isFinite(element.duration) && seconds > element.duration)
        throw new RangeError('Seek time exceeds video duration.');
      element.currentTime = seconds;
      status = element.paused ? 'paused' : 'buffering';
    });

  const setSource = (src: string) =>
    command('source', () => {
      if (!src.trim()) throw new TypeError('Video source must not be empty.');
      deferredSource = undefined;
      cancelPending();
      element.pause();
      element.src = src;
      status = 'loading';
      element.load();
    });

  const loadDeferredSource = () => {
    if (deferredSource !== undefined) setSource(deferredSource);
  };

  const onMediaEvent = (event: Event) => {
    if (!active()) return;
    switch (event.type) {
      case 'play':
      case 'playing':
        if (visibility?.blocked()) {
          pause();
          return;
        }
        if (controlledPlayback && !wantsPlayback && unsettledPlays > 0) {
          element.pause();
          return;
        }
        if (!element.paused) status = event.type === 'playing' ? 'playing' : 'buffering';
        break;
      case 'pause':
        if (element.paused && !element.ended) status = 'paused';
        break;
      case 'waiting':
        if (!element.paused) status = 'buffering';
        break;
      case 'loadstart':
      case 'emptied':
        status = 'loading';
        error = null;
        break;
      case 'loadeddata':
      case 'canplay':
      case 'seeked':
        status = element.ended ? 'ended' : element.paused ? 'ready' : 'playing';
        break;
      case 'ended':
        status = 'ended';
        wantsPlayback = false;
        break;
      case 'error':
        status = 'error';
        error = {
          name: 'MediaError',
          message: element.error?.message || 'Video source is unsupported or unavailable.',
          code: element.error?.code,
        };
        break;
    }
    publish(event.type);
  };

  const listen = (target: EventTarget, event: string) => {
    removers.push(() => target.removeEventListener(event, onMediaEvent));
    target.addEventListener(event, onMediaEvent);
  };

  const cancel = () => {
    visibility?.dispose();
    deferredSource = undefined;
    cancelPending();
    // Borrowed media already playing before registration belongs to its application.
    if (controlledPlayback || options.ownership === 'owned') element.pause();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    const errors: unknown[] = [];
    const release = (action: () => void) => {
      try {
        action();
      } catch (cause) {
        errors.push(cause);
      }
    };
    release(cancel);
    for (const remove of removers.splice(0)) release(remove);
    if (options.ownership === 'owned') {
      release(() => element.removeAttribute('src'));
      release(() => {
        element.srcObject = null;
      });
      release(() => {
        for (const source of element.querySelectorAll('source')) source.removeAttribute('src');
      });
      release(() => element.load());
      release(() => element.remove());
    }
    status = 'disposed';
    snapshot = read();
    // Bindings must release on unregister, even when the kernel remains alive.
    const terminalListeners = [...listeners];
    listeners.clear();
    for (const listener of terminalListeners) {
      try {
        listener(snapshot, 'disposed');
      } catch {
        /* Isolate observers, including during terminal cleanup. */
      }
    }
    if (errors.length) throw new CleanupError(errors, `Video cleanup failed: ${options.id}`);
  };

  const handle: VideoHandle = {
    id: options.id,
    element,
    play,
    resume: play,
    pause,
    seek,
    setSource,
    stop() {
      pause();
      if (active() && element.readyState > 0) seek(0);
    },
    setVolume(value) {
      command('volume', () => {
        if (!Number.isFinite(value) || value < 0 || value > 1)
          throw new RangeError('Volume must be between 0 and 1.');
        element.volume = value;
      });
    },
    setMuted(value) {
      command('mute', () => {
        element.muted = value;
      });
    },
    setPlaybackRate(value) {
      command('rate', () => {
        if (!Number.isFinite(value) || value <= 0) throw new RangeError('Playback rate must be positive.');
        element.playbackRate = value;
      });
    },
    setLoop(value) {
      command('loop', () => {
        element.loop = value;
      });
    },
    setTextTrack(index) {
      command('text-track', () => {
        const tracks = Array.from(element.textTracks);
        const isCaption = (track: TextTrack) => track.kind === 'captions' || track.kind === 'subtitles';
        if (index !== null && (!Number.isInteger(index) || !tracks[index] || !isCaption(tracks[index]))) {
          throw new RangeError('Unknown caption or subtitle track.');
        }
        tracks.forEach((track, position) => {
          if (isCaption(track)) track.mode = position === index ? 'showing' : 'disabled';
        });
      });
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      assertActive();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  try {
    for (const event of [
      'loadstart',
      'emptied',
      'loadedmetadata',
      'durationchange',
      'loadeddata',
      'canplay',
      'play',
      'playing',
      'pause',
      'waiting',
      'stalled',
      'seeking',
      'seeked',
      'timeupdate',
      'ended',
      'error',
      'volumechange',
      'ratechange',
    ]) {
      listen(element, event);
    }
    for (const event of ['change', 'addtrack', 'removetrack']) listen(element.textTracks, event);
    if (options.poster !== undefined) element.poster = options.poster;
    if (options.preload !== undefined) element.preload = options.preload;
    if (options.muted !== undefined) element.muted = options.muted;
    if (options.loop !== undefined) element.loop = options.loop;
    snapshot = read();
    if (options.src !== undefined && !options.src.trim()) throw new TypeError('Video source must not be empty.');
    if (options.visibility) {
      visibility = observeVideoVisibility(element, options.visibility, (blocked, visible) => {
        if (!active()) return;
        if (blocked && (pending || !element.paused)) pause();
        if (visible) {
          try {
            loadDeferredSource();
          } catch {
            // setSource already publishes a local error; observer callbacks cannot reject.
          }
        }
      });
      removers.push(visibility.dispose);
      visibility.refresh();
    }
    if (options.src !== undefined && !options.visibility?.loadWhenVisible) setSource(options.src);
  } catch (cause) {
    dispose();
    throw cause;
  }
  return { handle, cancel, dispose };
}
