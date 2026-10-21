/**
 * Company: EonHive Inc.
 * Title: Audio Adapter
 * Purpose: Provide a small browser-native audio transport capability for URK.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */

import { token, type AdapterRegistration } from '@urk/core';
import { createAudioAnalysis, type AudioAnalysisApi } from './analysis.js';
export type { AudioAnalysisApi, AudioAnalysisOptions, AudioAnalysisSnapshot } from './analysis.js';

export interface AudioTrackDefinition {
  id: string;
  src: string;
  label: string;
  loop?: boolean;
  volume?: number;
  /** Set before loading remote audio that permits CORS analysis. */
  crossOrigin?: 'anonymous' | 'use-credentials';
}

export type AudioPlaybackStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface AudioTransportSnapshot {
  activeTrackId: string | null;
  status: AudioPlaybackStatus;
  currentTime: number;
  /** Seconds; null until known, Infinity for an unbounded source. */
  duration: number | null;
  muted: boolean;
  volume: number;
  loadedTrackIds: string[];
  errorMessage?: string;
}

export type AudioListener = (snapshot: AudioTransportSnapshot) => void;

export interface AudioAdapterApi {
  readonly analysis: AudioAnalysisApi;
  registerTrack(track: AudioTrackDefinition): void;
  /** Replace a registered source on its existing element and select it paused. */
  setSource(trackId: string, src: string): void;
  preload(trackId: string): Promise<void>;
  play(trackId?: string): Promise<void>;
  pause(): void;
  stop(): void;
  /** Seek the active track after metadata loads; never starts playback. */
  seek(seconds: number): void;
  setMuted(next: boolean): void;
  setVolume(next: number): void;
  getSnapshot(): AudioTransportSnapshot;
  subscribe(listener: AudioListener): () => void;
}

type RegisteredTrack = {
  definition: AudioTrackDefinition;
  element: HTMLAudioElement;
  onEnded: () => void;
  onError: () => void;
  source: AbortController;
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Audio volume must be finite.');
  return Math.max(0, Math.min(value, 1));
}

function cloneSnapshot(snapshot: AudioTransportSnapshot): AudioTransportSnapshot {
  return {
    ...snapshot,
    loadedTrackIds: [...snapshot.loadedTrackIds],
  };
}

function createEmptySnapshot(): AudioTransportSnapshot {
  return {
    activeTrackId: null,
    status: 'idle',
    currentTime: 0,
    duration: null,
    muted: false,
    volume: 1,
    loadedTrackIds: [],
  };
}

function formatTrackError(track: AudioTrackDefinition, action: 'preload' | 'playback'): string {
  return `Failed ${action} for audio track: ${track.label}`;
}

export const AudioCapability = token<AudioAdapterApi>('audio');

export function createAudioAdapter(id = 'audio-adapter'): AdapterRegistration<AudioAdapterApi> {
  return {
    id,
    capability: 'audio',
    token: AudioCapability,
    isSupported() {
      return typeof window !== 'undefined' && typeof Audio !== 'undefined';
    },
    setup(ctx) {
      const tracks = new Map<string, RegisteredTrack>();
      const loadedTrackIds = new Set<string>();
      const nativePlays = new Map<string, number>();
      const listeners = new Set<AudioListener>();
      ctx.scope.defer(() => {
        tracks.clear();
        loadedTrackIds.clear();
        listeners.clear();
        nativePlays.clear();
      });
      let snapshot = createEmptySnapshot();
      const analysis = createAudioAnalysis(() =>
        snapshot.activeTrackId ? tracks.get(snapshot.activeTrackId)?.element : undefined);
      ctx.scope.defer(() => analysis.dispose());
      let generation = 0;
      let requestedTrack: string | null = null;
      let pendingPlay: { id: string; promise: Promise<void> } | undefined;
      const cancelled = () => new DOMException('Audio playback cancelled.', 'AbortError');
      const invalidate = () => {
        generation++;
        requestedTrack = null;
        pendingPlay = undefined;
      };
      const cancelPlayback = () => {
        invalidate();
        // Settle gesture-blocked enables before controller cleanup may await them.
        analysis.api.disable();
        for (const record of tracks.values()) {
          record.element.muted = true;
          record.element.pause();
        }
      };
      ctx.signal.addEventListener('abort', cancelPlayback, { once: true });
      ctx.scope.defer(() => ctx.signal.removeEventListener('abort', cancelPlayback));

      const readPosition = (trackId: string | null) => {
        const element = trackId ? tracks.get(trackId)?.element : undefined;
        const time = element?.currentTime;
        const duration = element?.duration;
        return {
          currentTime: typeof time === 'number' && Number.isFinite(time) ? Math.max(0, time) : 0,
          duration: typeof duration === 'number' && !Number.isNaN(duration) && duration >= 0
            ? duration : null,
        };
      };

      const publish = (
        partial: Partial<AudioTransportSnapshot> = {},
        extraEvent?:
          | {
              type: 'audio:ended' | 'audio:error';
              payload: unknown;
            }
          | undefined,
      ): AudioTransportSnapshot => {
        snapshot = {
          ...snapshot,
          ...partial,
          ...readPosition(partial.activeTrackId === undefined ? snapshot.activeTrackId : partial.activeTrackId),
          loadedTrackIds: [...loadedTrackIds],
        };

        if (snapshot.status !== 'playing' && snapshot.status !== 'loading') analysis.stop();

        const next = cloneSnapshot(snapshot);

        if (ctx.signal.aborted) return next;

        try {
          ctx.events.emit({
            type: 'audio:changed',
            source: id,
            payload: next,
            timestamp: Date.now(),
          });
        } catch {
          /* Observers cannot interrupt audio transport. */
        }

        if (extraEvent) {
          try {
            ctx.events.emit({
              type: extraEvent.type,
              source: id,
              payload: extraEvent.payload,
              timestamp: Date.now(),
            });
          } catch {
            /* Keep native transport independent of diagnostics. */
          }
        }

        for (const listener of [...listeners]) {
          try {
            listener(next);
          } catch {
            /* Isolate observation failures. */
          }
        }

        return next;
      };

      const requireTrack = (trackId: string): RegisteredTrack => {
        const record = tracks.get(trackId);

        if (!record) {
          throw new Error(`Unknown audio track: ${trackId}`);
        }

        return record;
      };

      const applyElementSettings = (record: RegisteredTrack): void => {
        record.element.loop = record.definition.loop ?? false;
        record.element.muted = snapshot.muted;
        record.element.volume = clampVolume(snapshot.volume * (record.definition.volume ?? 1));
      };

      const stopElement = (record: RegisteredTrack): void => {
        record.element.pause();

        try {
          record.element.currentTime = 0;
        } catch {
          // Some browsers can reject currentTime writes if metadata is unavailable.
        }
      };

      const preloadElement = async (record: RegisteredTrack): Promise<void> => {
        if (ctx.signal.aborted) throw new Error('Audio adapter is disposed.');
        const source = record.source.signal;
        if (loadedTrackIds.has(record.definition.id) || record.element.readyState >= 3) {
          loadedTrackIds.add(record.definition.id);
          return;
        }

        await new Promise<void>((resolve, reject) => {
          const onReady = (): void => {
            cleanup();
            loadedTrackIds.add(record.definition.id);
            resolve();
          };

          const onError = (): void => {
            cleanup();
            reject(new Error(formatTrackError(record.definition, 'preload')));
          };

          const onAbort = (): void => {
            cleanup();
            reject(new DOMException('Audio preload cancelled.', 'AbortError'));
          };

          const cleanup = (): void => {
            ctx.signal.removeEventListener('abort', onAbort);
            source.removeEventListener('abort', onAbort);
            record.element.removeEventListener('canplaythrough', onReady);
            record.element.removeEventListener('loadeddata', onReady);
            record.element.removeEventListener('error', onError);
          };

          ctx.signal.addEventListener('abort', onAbort, { once: true });
          source.addEventListener('abort', onAbort, { once: true });
          record.element.addEventListener('canplaythrough', onReady, {
            once: true,
          });
          record.element.addEventListener('loadeddata', onReady, {
            once: true,
          });
          record.element.addEventListener('error', onError, { once: true });
          try {
            record.element.load();
          } catch (error) {
            // No native event will settle a failed load call and release these listeners.
            cleanup();
            reject(error);
          }
        });
      };

      const preloadTrack = async (
        record: RegisteredTrack,
        shouldSetLoading: boolean,
      ): Promise<void> => {
        const started = generation;
        const source = record.source;
        if (shouldSetLoading) {
          publish({
            status: 'loading',
            errorMessage: undefined,
          });
        }

        try {
          if (source !== record.source) throw cancelled();
          await preloadElement(record);
          if (source !== record.source) throw cancelled();
          if (started !== generation) {
            publish();
            return;
          }
          publish({
            status:
              shouldSetLoading && started === generation && snapshot.status === 'loading'
                ? 'ready'
                : snapshot.status,
            errorMessage: undefined,
          });
        } catch (error) {
          if (ctx.signal.aborted || source !== record.source || started !== generation) throw error;
          const message =
            error instanceof Error ? error.message : formatTrackError(record.definition, 'preload');

          publish(
            {
              status: 'error',
              errorMessage: message,
            },
            {
              type: 'audio:error',
              payload: {
                trackId: record.definition.id,
                label: record.definition.label,
                message,
              },
            },
          );

          throw new Error(message);
        }
      };

      return {
        analysis: analysis.api,
        registerTrack(track) {
          track = { ...track };
          if (ctx.signal.aborted) throw new Error('Audio adapter is disposed.');
          if (tracks.has(track.id)) {
            throw new Error(`Audio track already registered: ${track.id}`);
          }

          const element = new Audio();
          if (track.crossOrigin) element.crossOrigin = track.crossOrigin;
          element.src = track.src;
          ctx.scope.defer(() => {
            element.pause();
            element.src = '';
            element.load();
          });
          element.preload = 'auto';

          const onEnded = (): void => {
            if (ctx.signal.aborted || snapshot.activeTrackId !== track.id || !element.ended) {
              return;
            }

            publish(
              {
                status: 'ready',
                errorMessage: undefined,
              },
              {
                type: 'audio:ended',
                payload: {
                  trackId: track.id,
                  label: track.label,
                },
              },
            );
          };

          const onPosition = () => {
            if (!ctx.signal.aborted && snapshot.activeTrackId === track.id) publish();
          };
          // Native media events keep progress useful even when analysis requests no frames.
          for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'seeked', 'emptied']) {
            ctx.scope.defer(() => element.removeEventListener(event, onPosition));
            element.addEventListener(event, onPosition);
          }

          const onError = (): void => {
            // load() clears native errors; ignore queued errors from a replaced source.
            if (ctx.signal.aborted || element.error === null) return;
            const message = formatTrackError(track, 'playback');

            if (snapshot.status === 'error' && snapshot.errorMessage === message) {
              return;
            }

            publish(
              {
                activeTrackId: snapshot.activeTrackId ?? track.id,
                status: 'error',
                errorMessage: message,
              },
              {
                type: 'audio:error',
                payload: {
                  trackId: track.id,
                  label: track.label,
                  message,
                },
              },
            );
          };

          const record: RegisteredTrack = {
            definition: {
              ...track,
              volume: clampVolume(track.volume ?? 1),
            },
            element,
            onEnded,
            onError,
            source: new AbortController(),
          };

          ctx.scope.defer(() => record.source.abort());
          ctx.scope.defer(() => element.removeEventListener('ended', onEnded));
          ctx.scope.defer(() => element.removeEventListener('error', onError));
          element.addEventListener('ended', onEnded);
          element.addEventListener('error', onError);
          applyElementSettings(record);
          tracks.set(track.id, record);
        },
        setSource(trackId, src) {
          if (ctx.signal.aborted) throw new Error('Audio adapter is disposed.');
          if (!src.trim()) throw new TypeError('Audio source must not be empty.');
          const record = requireTrack(trackId);
          const previous = snapshot.activeTrackId && tracks.get(snapshot.activeTrackId);
          invalidate();
          record.source.abort();
          record.source = new AbortController();
          analysis.stop();
          if (previous && previous !== record) {
            if (nativePlays.has(previous.definition.id)) previous.element.muted = true;
            stopElement(previous);
          }
          record.element.muted = true;
          record.element.pause();
          loadedTrackIds.delete(trackId);
          record.definition.src = src;
          try {
            // Reuse the element: captured Web Audio source nodes cannot be rebound.
            record.element.src = src;
            record.element.load();
            applyElementSettings(record);
            if (nativePlays.has(trackId)) record.element.muted = true;
          } finally {
            publish({ activeTrackId: trackId, status: 'paused', errorMessage: undefined });
          }
        },
        async preload(trackId) {
          const record = requireTrack(trackId);
          const shouldSetLoading =
            snapshot.status === 'idle' ||
            snapshot.status === 'loading' ||
            snapshot.status === 'ready';

          await preloadTrack(record, shouldSetLoading);
        },
        play(trackId) {
          if (ctx.signal.aborted) return Promise.reject(cancelled());
          const nextTrackId = trackId ?? snapshot.activeTrackId;
          if (!nextTrackId) return Promise.resolve();
          if (pendingPlay?.id === nextTrackId) return pendingPlay.promise;
          let record: RegisteredTrack;
          try {
            record = requireTrack(nextTrackId);
          } catch (error) {
            return Promise.reject(error);
          }
          const previous = snapshot.activeTrackId;
          const current = ++generation;
          requestedTrack = nextTrackId;
          if (previous && previous !== nextTrackId) {
            const outgoing = requireTrack(previous);
            if (nativePlays.has(previous)) outgoing.element.muted = true;
            stopElement(outgoing);
          }
          if (previous !== nextTrackId || record.element.ended) {
            try {
              record.element.currentTime = 0;
            } catch {
              /* Metadata can arrive later. */
            }
          }
          applyElementSettings(record);
          // Native play initiates loading itself. Call in the original user gesture,
          // so callers do not lose autoplay permission while awaiting preload.
          nativePlays.set(nextTrackId, (nativePlays.get(nextTrackId) ?? 0) + 1);
          let native: Promise<void>;
          let ready: Promise<void> | undefined;
          try {
            const contextReady = analysis.prepare(record.element);
            let contextFailed = false;
            ready = contextReady?.catch(error => {
              contextFailed = true;
              if (current === generation) record.element.pause();
              throw error;
            });
            native = record.element.play();
            if (ready) {
              const playing = native.then(() => {
                // A delayed native play must not restart audio after context failure.
                if (contextFailed && (current === generation || requestedTrack !== nextTrackId || ctx.signal.aborted))
                  record.element.pause();
              });
              native = Promise.all([playing, ready]).then(() => undefined);
            }
          } catch (error) {
            void ready?.catch(() => {});
            native = Promise.reject(error);
          }
          const promise = Promise.resolve(native)
            .then(
              () => {
                if (ctx.signal.aborted || current !== generation) {
                  // A stale result must not pause a newer request for the same element.
                  if (requestedTrack !== nextTrackId || ctx.signal.aborted) {
                    // Pausing a cancelled active request must preserve a later seek.
                    if (!ctx.signal.aborted && snapshot.activeTrackId === nextTrackId)
                      record.element.pause();
                    else stopElement(record);
                  }
                  throw cancelled();
                }
                loadedTrackIds.add(nextTrackId);
                publish({
                  activeTrackId: nextTrackId,
                  status: 'playing',
                  errorMessage: undefined,
                });
              },
              (error) => {
                if (ctx.signal.aborted || current !== generation) throw cancelled();
                const message =
                  error instanceof Error
                    ? error.message
                    : formatTrackError(record.definition, 'playback');
                requestedTrack = null;
                analysis.stop();
                record.element.pause();
                publish(
                  { status: 'error', errorMessage: message },
                  {
                    type: 'audio:error',
                    payload: {
                      trackId: nextTrackId,
                      label: record.definition.label,
                      message,
                    },
                  },
                );
                throw error instanceof Error ? error : new Error(message);
              },
            )
            .finally(() => {
              const remaining = (nativePlays.get(nextTrackId) ?? 1) - 1;
              if (remaining > 0) nativePlays.set(nextTrackId, remaining);
              else nativePlays.delete(nextTrackId);
              if (pendingPlay?.promise === promise) pendingPlay = undefined;
            });
          if (current === generation && !ctx.signal.aborted)
            pendingPlay = { id: nextTrackId, promise };
          publish({
            activeTrackId: nextTrackId,
            status: 'loading',
            errorMessage: undefined,
          });
          return promise;
        },
        pause() {
          if (ctx.signal.aborted) return;
          const loading = Boolean(pendingPlay);
          invalidate();
          if (!snapshot.activeTrackId) {
            return;
          }

          const record = requireTrack(snapshot.activeTrackId);
          if (loading) record.element.muted = true;
          record.element.pause();

          publish({
            status: 'paused',
            errorMessage: undefined,
          });
        },
        stop() {
          if (ctx.signal.aborted) return;
          const loading = Boolean(pendingPlay);
          invalidate();
          if (!snapshot.activeTrackId) {
            return;
          }

          const record = requireTrack(snapshot.activeTrackId);
          if (loading) record.element.muted = true;
          stopElement(record);

          publish({
            status: 'ready',
            errorMessage: undefined,
          });
        },
        setMuted(next) {
          if (ctx.signal.aborted) return;
          const muted = Boolean(next);

          for (const record of tracks.values()) {
            // Keep invalidated native requests silent until they settle, even if
            // another channel or track is enabled in the meantime.
            record.element.muted =
              muted ||
              (nativePlays.has(record.definition.id) && requestedTrack !== record.definition.id);
          }

          publish({
            muted,
            errorMessage: undefined,
          });
        },
        seek(seconds) {
          if (ctx.signal.aborted) throw new Error('Audio adapter is disposed.');
          if (!Number.isFinite(seconds) || seconds < 0)
            throw new RangeError('Seek time must be finite and nonnegative.');
          if (!snapshot.activeTrackId)
            throw new DOMException('Select an audio track before seeking.', 'InvalidStateError');
          const { element } = requireTrack(snapshot.activeTrackId);
          if (element.readyState === 0)
            throw new DOMException('Load audio metadata before seeking.', 'InvalidStateError');
          if (Number.isFinite(element.duration) && seconds > element.duration)
            throw new RangeError('Seek time exceeds audio duration.');

          const interrupted = snapshot.status === 'loading' && Boolean(pendingPlay);
          if (interrupted) {
            // A late native play result must not make a scrub start sound unexpectedly.
            invalidate();
            element.muted = true;
            element.pause();
          }
          try {
            element.currentTime = seconds;
          } finally {
            // Report cancellation even if the browser refuses the native seek.
            publish({ status: interrupted ? 'paused' : snapshot.status, errorMessage: undefined });
          }
        },
        setVolume(next) {
          if (ctx.signal.aborted) return;
          const volume = clampVolume(next);

          for (const record of tracks.values()) {
            record.element.volume = clampVolume(volume * (record.definition.volume ?? 1));
          }

          publish({
            volume,
            errorMessage: undefined,
          });
        },
        getSnapshot() {
          return cloneSnapshot({ ...snapshot, ...readPosition(snapshot.activeTrackId) });
        },
        subscribe(listener) {
          if (ctx.signal.aborted) throw new Error('Audio adapter is disposed.');
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
      };
    },
  };
}
