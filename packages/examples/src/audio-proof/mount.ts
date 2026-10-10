/**
 * Company: EonHive Inc.
 * Title: Public Audio Proof Mount
 * Purpose: Coordinate the website audio deck through existing URK capabilities.
 * Author: Stan Nesi
 * Created: 2026-09-21
 * Updated: 2026-09-21
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type ControllerRegistration } from '@urk/core';
import { createAudioAdapter, type AudioAdapterApi } from '@urk/adapters';
import {
  createLoadingAdapter,
  type LoadingAdapterApi,
} from '@urk/adapters/dom';
import {
  mountRuntimePanel,
  readRuntimePanelElements,
} from '../runtime-panel.js';
import type { ExampleMountResult } from '../types.js';
import { readAudioView, type AudioView } from './view.js';

function createAudioController(view: AudioView): ControllerRegistration {
  let disposed = false;
  let busy = false;
  let selected = 'bed';
  let unsubscribe = () => {};
  const listeners = new AbortController();

  return {
    id: 'audio-demo-controller',
    start(ctx) {
      const audio = ctx.adapters.require<AudioAdapterApi>('audio');
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const render = () =>
        view.render(
          audio.getSnapshot(),
          selected,
          !disposed && ctx.state.getSnapshot().phase === 'ready',
          busy,
        );
      const emit = (type: string, message: string) => {
        view.message.textContent = message;
        ctx.events.emit({
          type: `audio-demo:${type}`,
          source: 'audio-demo-controller',
          payload: { message, trackId: selected },
          timestamp: Date.now(),
        });
      };

      loading.begin(
        [{ id: 'tracks', label: 'Register audio tracks' }],
        'Preparing the audio deck',
      );
      for (const track of view.tracks) {
        const { trackId, trackSrc, trackLabel, trackLoop } = track.dataset;
        if (!trackId || !trackSrc || !trackLabel)
          throw new Error('Incomplete audio track metadata.');
        audio.registerTrack({
          id: trackId,
          src: trackSrc,
          label: trackLabel,
          loop: trackLoop === 'true',
        });
      }
      audio.setVolume(0.35);
      unsubscribe = audio.subscribe((snapshot) => {
        if (snapshot.status === 'error') {
          view.message.textContent =
            snapshot.errorMessage ?? 'Playback failed. Try Play again.';
        } else if (snapshot.status === 'ready') {
          view.message.textContent =
            'Ready. Press Play to hear the selected sound again.';
        }
        render();
      });

      async function playTrack(trackId: string) {
        if (disposed || busy || ctx.state.getSnapshot().phase !== 'ready')
          return;
        selected = trackId;
        busy = true;
        emit('loading', 'Loading sound. Playback starts after your click.');
        render();
        try {
          await audio.play(selected);
          if (disposed) return;
          // A runtime pause may happen while the browser is loading media.
          if (ctx.state.getSnapshot().phase !== 'ready') {
            audio.pause();
            return;
          }
          emit(
            'playing',
            'Playing through the audio adapter. Try mute, volume, or runtime Pause.',
          );
        } catch (error) {
          if (!disposed)
            emit(
              'playback-error',
              error instanceof Error
                ? error.message
                : 'Playback failed. Try Play again.',
            );
        } finally {
          busy = false;
          if (!disposed) render();
        }
      }

      const signal = listeners.signal;
      for (const track of view.tracks) {
        track.addEventListener(
          'click',
          () => {
            void playTrack(track.dataset.trackId!);
          },
          { signal },
        );
      }
      view.play.addEventListener(
        'click',
        () => {
          if (audio.getSnapshot().status === 'playing') {
            audio.pause();
            emit(
              'paused',
              'Track paused. Play continues from the same position.',
            );
          } else {
            void playTrack(selected);
          }
        },
        { signal },
      );
      view.stop.addEventListener(
        'click',
        () => {
          audio.stop();
          emit('stopped', 'Track stopped and rewound.');
        },
        { signal },
      );
      view.mute.addEventListener(
        'click',
        () => audio.setMuted(!audio.getSnapshot().muted),
        { signal },
      );
      view.volume.addEventListener(
        'input',
        () => audio.setVolume(Number(view.volume.value)),
        { signal },
      );
      loading.complete(
        'Audio deck ready. Sound starts only when you press Play.',
      );
      ctx.state.setPhase('ready', 'audio-demo:ready');
      emit('ready', 'Choose a sound to begin. Nothing plays automatically.');
      render();
    },
    onStateChange(next, previous, ctx) {
      const audio = ctx.adapters.require<AudioAdapterApi>('audio');
      if (next.phase === 'paused' || next.phase === 'error') {
        audio.pause();
        view.message.textContent =
          'Runtime paused. Resume the runtime, then press Play to continue sound.';
      } else if (next.phase === 'ready' && previous.phase === 'paused') {
        view.message.textContent =
          'Runtime resumed. Press Play when you are ready to listen.';
      }
      view.render(
        audio.getSnapshot(),
        selected,
        next.phase === 'ready' && !disposed,
        busy,
      );
    },
    dispose(ctx) {
      disposed = true;
      listeners.abort();
      unsubscribe();
      const audio = ctx.adapters.require<AudioAdapterApi>('audio');
      audio.stop();
      view.render(audio.getSnapshot(), selected, false, false);
      view.message.textContent =
        'Audio released. Reset / restart creates a fresh deck.';
    },
  };
}

export async function mountAudioProofExample(
  host: HTMLElement,
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'audio proof');
  const view = readAudioView(host);
  const kernel = createKernel({
    id: 'urk-www-audio-proof',
    adapters: [createLoadingAdapter(), createAudioAdapter()],
    controllers: [createAudioController(view)],
  });

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'audio proof',
    recentEventLimit: 16,
    pauseReason: 'audio-demo:pause',
    resumeReason: 'audio-demo:resume',
    shutdownReason: 'audio-demo:shutdown',
    teardownReason: 'audio-demo:teardown',
    mountFailureMessage: 'The audio deck could not start.',
    previewFailureMessage:
      'Audio is unavailable. The rest of the page remains usable.',
    onTeardown: () => kernel.shutdown('audio-demo:cleanup'),
  });
}
