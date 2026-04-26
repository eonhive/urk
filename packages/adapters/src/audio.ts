/**
 * Company: EonHive Inc.
 * Title: Audio Adapter
 * Purpose: Provide a small browser-native audio transport capability for URK.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration } from '@urk/core';

export interface AudioTrackDefinition {
  id: string;
  src: string;
  label: string;
  loop?: boolean;
  volume?: number;
}

export type AudioPlaybackStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface AudioTransportSnapshot {
  activeTrackId: string | null;
  status: AudioPlaybackStatus;
  muted: boolean;
  volume: number;
  loadedTrackIds: string[];
  errorMessage?: string;
}

export type AudioListener = (snapshot: AudioTransportSnapshot) => void;

export interface AudioAdapterApi {
  registerTrack(track: AudioTrackDefinition): void;
  preload(trackId: string): Promise<void>;
  play(trackId?: string): Promise<void>;
  pause(): void;
  stop(): void;
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
};

function clampVolume(value: number): number {
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
    muted: false,
    volume: 1,
    loadedTrackIds: [],
  };
}

function formatTrackError(track: AudioTrackDefinition, action: 'preload' | 'playback'): string {
  return `Failed ${action} for audio track: ${track.label}`;
}

export function createAudioAdapter(
  id = 'audio-adapter',
): AdapterRegistration<AudioAdapterApi> {
  let teardown: (() => void) | null = null;

  return {
    id,
    capability: 'audio',
    isSupported() {
      return typeof window !== 'undefined' && typeof Audio !== 'undefined';
    },
    setup(ctx) {
      const tracks = new Map<string, RegisteredTrack>();
      const loadedTrackIds = new Set<string>();
      const listeners = new Set<AudioListener>();
      let snapshot = createEmptySnapshot();

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
          loadedTrackIds: [...loadedTrackIds],
        };

        const next = cloneSnapshot(snapshot);

        ctx.events.emit({
          type: 'audio:changed',
          source: id,
          payload: next,
          timestamp: Date.now(),
        });

        if (extraEvent) {
          ctx.events.emit({
            type: extraEvent.type,
            source: id,
            payload: extraEvent.payload,
            timestamp: Date.now(),
          });
        }

        for (const listener of [...listeners]) {
          listener(next);
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

          const cleanup = (): void => {
            record.element.removeEventListener('canplaythrough', onReady);
            record.element.removeEventListener('loadeddata', onReady);
            record.element.removeEventListener('error', onError);
          };

          record.element.addEventListener('canplaythrough', onReady, { once: true });
          record.element.addEventListener('loadeddata', onReady, { once: true });
          record.element.addEventListener('error', onError, { once: true });
          record.element.load();
        });
      };

      const preloadTrack = async (
        record: RegisteredTrack,
        shouldSetLoading: boolean,
      ): Promise<void> => {
        if (shouldSetLoading) {
          publish({
            status: 'loading',
            errorMessage: undefined,
          });
        }

        try {
          await preloadElement(record);
          publish({
            status: shouldSetLoading ? 'ready' : snapshot.status,
            errorMessage: undefined,
          });
        } catch (error) {
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

      teardown = (): void => {
        for (const record of tracks.values()) {
          record.element.pause();
          record.element.removeEventListener('ended', record.onEnded);
          record.element.removeEventListener('error', record.onError);
          record.element.src = '';
          record.element.load();
        }

        tracks.clear();
        loadedTrackIds.clear();
        listeners.clear();
      };

      return {
        registerTrack(track) {
          if (tracks.has(track.id)) {
            throw new Error(`Audio track already registered: ${track.id}`);
          }

          const element = new Audio(track.src);
          element.preload = 'auto';

          const onEnded = (): void => {
            if (snapshot.activeTrackId !== track.id) {
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

          const onError = (): void => {
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
          };

          element.addEventListener('ended', onEnded);
          element.addEventListener('error', onError);
          applyElementSettings(record);
          tracks.set(track.id, record);
        },
        async preload(trackId) {
          const record = requireTrack(trackId);
          const shouldSetLoading =
            snapshot.status === 'idle' ||
            snapshot.status === 'loading' ||
            snapshot.status === 'ready';

          await preloadTrack(record, shouldSetLoading);
        },
        async play(trackId) {
          const nextTrackId = trackId ?? snapshot.activeTrackId;

          if (!nextTrackId) {
            return;
          }

          const nextRecord = requireTrack(nextTrackId);
          const previousTrackId = snapshot.activeTrackId;

          if (previousTrackId && previousTrackId !== nextTrackId) {
            stopElement(requireTrack(previousTrackId));
          }

          if (!loadedTrackIds.has(nextTrackId) && nextRecord.element.readyState < 3) {
            publish({
              activeTrackId: nextTrackId,
              status: 'loading',
              errorMessage: undefined,
            });

            await preloadTrack(nextRecord, false);
          }

          if (
            previousTrackId !== nextTrackId ||
            nextRecord.element.ended ||
            (nextRecord.element.duration > 0 &&
              nextRecord.element.currentTime >= nextRecord.element.duration)
          ) {
            try {
              nextRecord.element.currentTime = 0;
            } catch {
              // Ignore currentTime reset failures for browsers without loaded metadata yet.
            }
          }

          applyElementSettings(nextRecord);

          try {
            await nextRecord.element.play();
            publish({
              activeTrackId: nextTrackId,
              status: 'playing',
              errorMessage: undefined,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : formatTrackError(nextRecord.definition, 'playback');

            publish(
              {
                activeTrackId: nextTrackId,
                status: 'error',
                errorMessage: message,
              },
              {
                type: 'audio:error',
                payload: {
                  trackId: nextTrackId,
                  label: nextRecord.definition.label,
                  message,
                },
              },
            );

            throw new Error(message);
          }
        },
        pause() {
          if (!snapshot.activeTrackId) {
            return;
          }

          const record = requireTrack(snapshot.activeTrackId);
          record.element.pause();

          publish({
            status: 'paused',
            errorMessage: undefined,
          });
        },
        stop() {
          if (!snapshot.activeTrackId) {
            return;
          }

          stopElement(requireTrack(snapshot.activeTrackId));

          publish({
            status: 'ready',
            errorMessage: undefined,
          });
        },
        setMuted(next) {
          const muted = Boolean(next);

          for (const record of tracks.values()) {
            record.element.muted = muted;
          }

          publish({
            muted,
            errorMessage: undefined,
          });
        },
        setVolume(next) {
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
          return cloneSnapshot(snapshot);
        },
        subscribe(listener) {
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
      };
    },
    dispose() {
      teardown?.();
      teardown = null;
    },
  };
}
