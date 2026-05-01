/**
 * Company: EonHive Inc.
 * Title: URK Audio Proof
 * Purpose: Prove DOM-first audio transport orchestration with the URK audio adapter.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type ControllerRegistration, type RuntimeSnapshot } from '@urk/core';
import {
  createAudioAdapter,
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
  createUiWidgetsAdapter,
  type AudioAdapterApi,
  type AudioTransportSnapshot,
  type InputAdapterApi,
  type LoadingAdapterApi,
  type LoadingSnapshot,
  type PointerAdapterApi,
  type PointerTargetEventPayload,
  type UiWidgetsAdapterApi,
} from '@urk/adapters';

const TRACK_IDS = ['bed', 'pulse', 'confirm'] as const;
const AUDIO_BASE_URL = new URL('../audio/', window.location.href).toString();

type TrackId = (typeof TRACK_IDS)[number];

type ProofState = {
  activeTrackId: TrackId | null;
  lastAction: string;
  frameTick: number;
  resumeTrackId: TrackId | null;
  resumeWasPlaying: boolean;
  isShutdown: boolean;
};

type PointerActionMeta =
  | { scope: 'audio-proof'; action: 'track'; trackId: TrackId }
  | { scope: 'audio-proof'; action: 'play' }
  | { scope: 'audio-proof'; action: 'pause-track' }
  | { scope: 'audio-proof'; action: 'stop' }
  | { scope: 'audio-proof'; action: 'mute' }
  | { scope: 'audio-proof'; action: 'pause-kernel' }
  | { scope: 'audio-proof'; action: 'resume-kernel' }
  | { scope: 'audio-proof'; action: 'shutdown' };

type AppElements = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  activeTrackValue: HTMLElement;
  transportValue: HTMLElement;
  volumeValue: HTMLElement;
  mutedValue: HTMLElement;
  eventValue: HTMLElement;
  frameValue: HTMLElement;
  actionValue: HTMLElement;
  loadingStageValue: HTMLElement;
  loadingProgressValue: HTMLElement;
  loadingProgressFill: HTMLElement;
  transportTitle: HTMLElement;
  transportBody: HTMLElement;
  volumeSliderValue: HTMLElement;
  volumeSlider: HTMLInputElement;
  playButton: HTMLButtonElement;
  pauseTrackButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
  loadingVeil: HTMLElement;
  loadingTitle: HTMLElement;
  loadingBody: HTMLElement;
  proofStage: HTMLElement;
  uiHost: HTMLElement;
  trackButtons: Record<TrackId, HTMLButtonElement>;
  trackStatusValues: Record<TrackId, HTMLElement>;
};

type ProofActions = {
  pauseKernel: () => void;
  resumeKernel: () => void;
  shutdown: () => void;
  render: () => void;
};

const PROOF_TRACKS = [
  {
    id: 'bed',
    label: 'Bed Track',
    src: `${AUDIO_BASE_URL}bed.wav`,
    description: 'Steady low bed loop for ambient transport state.',
    accent: 'Ambient bed',
    volume: 0.75,
    loop: true,
  },
  {
    id: 'pulse',
    label: 'Pulse Cue',
    src: `${AUDIO_BASE_URL}pulse.wav`,
    description: 'Rhythmic pulse cue for active transport feedback.',
    accent: 'Pulse cue',
    volume: 0.85,
  },
  {
    id: 'confirm',
    label: 'Confirm Cue',
    src: `${AUDIO_BASE_URL}confirm.wav`,
    description: 'Short confirmation cue for completed transport actions.',
    accent: 'Confirm cue',
    volume: 0.9,
  },
] as const;

function assertElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Missing DOM element: ${label}`);
  }

  return value;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(value, max));
}

function trackLabel(trackId: TrackId | null): string {
  if (!trackId) {
    return 'None';
  }

  return PROOF_TRACKS.find((track) => track.id === trackId)?.label ?? 'Unknown track';
}

function createEmptyLoadingSnapshot(): LoadingSnapshot {
  return {
    active: false,
    complete: false,
    progress: 0,
    message: 'Waiting to start',
    stageId: null,
    stageLabel: null,
    stages: [],
    updatedAt: Date.now(),
  };
}

function createEmptyAudioSnapshot(): AudioTransportSnapshot {
  return {
    activeTrackId: null,
    status: 'idle',
    muted: false,
    volume: 1,
    loadedTrackIds: [],
  };
}

function createInitialState(): ProofState {
  return {
    activeTrackId: null,
    lastAction: 'Booting audio proof',
    frameTick: 0,
    resumeTrackId: null,
    resumeWasPlaying: false,
    isShutdown: false,
  };
}

function phaseStatus(snapshot: RuntimeSnapshot): string {
  switch (snapshot.phase) {
    case 'loading':
      return 'Loading audio proof';
    case 'ready':
      return 'Audio proof ready';
    case 'paused':
      return 'Audio proof paused';
    case 'error':
      return 'Audio proof error';
    case 'transition':
      return 'Audio proof transition';
    default:
      return 'Booting audio proof';
  }
}

function formatTransportStatus(status: AudioTransportSnapshot['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function renderTrackCards(container: HTMLElement): void {
  container.innerHTML = PROOF_TRACKS.map((track) => {
    return `
      <button
        type="button"
        class="audio-track-card"
        data-role="track-${track.id}"
        data-active="false"
      >
        <span class="audio-track-card__eyebrow">${track.accent}</span>
        <strong>${track.label}</strong>
        <p>${track.description}</p>
        <span class="audio-track-card__status" data-role="track-${track.id}-status">
          Waiting
        </span>
      </button>
    `;
  }).join('');
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');



  const trackGrid = assertElement(
    app.querySelector<HTMLElement>('[data-role="track-grid"]'),
    'track grid',
  );
  renderTrackCards(trackGrid);

  return {
    phaseValue: assertElement(app.querySelector('[data-role="phase-value"]'), 'phase value'),
    reasonValue: assertElement(app.querySelector('[data-role="reason-value"]'), 'reason value'),
    activeTrackValue: assertElement(
      app.querySelector('[data-role="active-track-value"]'),
      'active track value',
    ),
    transportValue: assertElement(
      app.querySelector('[data-role="transport-value"]'),
      'transport value',
    ),
    volumeValue: assertElement(app.querySelector('[data-role="volume-value"]'), 'volume value'),
    mutedValue: assertElement(app.querySelector('[data-role="muted-value"]'), 'muted value'),
    eventValue: assertElement(app.querySelector('[data-role="event-value"]'), 'event value'),
    frameValue: assertElement(app.querySelector('[data-role="frame-value"]'), 'frame value'),
    actionValue: assertElement(app.querySelector('[data-role="action-value"]'), 'action value'),
    loadingStageValue: assertElement(
      app.querySelector('[data-role="loading-stage-value"]'),
      'loading stage value',
    ),
    loadingProgressValue: assertElement(
      app.querySelector('[data-role="loading-progress-value"]'),
      'loading progress value',
    ),
    loadingProgressFill: assertElement(
      app.querySelector('[data-role="loading-progress-fill"]'),
      'loading progress fill',
    ),
    transportTitle: assertElement(
      app.querySelector('[data-role="transport-title"]'),
      'transport title',
    ),
    transportBody: assertElement(
      app.querySelector('[data-role="transport-body"]'),
      'transport body',
    ),
    volumeSliderValue: assertElement(
      app.querySelector('[data-role="volume-slider-value"]'),
      'volume slider value',
    ),
    volumeSlider: assertElement(
      app.querySelector<HTMLInputElement>('[data-role="volume-slider"]'),
      'volume slider',
    ),
    playButton: assertElement(app.querySelector('[data-role="play-button"]'), 'play button'),
    pauseTrackButton: assertElement(
      app.querySelector('[data-role="pause-track-button"]'),
      'pause track button',
    ),
    stopButton: assertElement(app.querySelector('[data-role="stop-button"]'), 'stop button'),
    muteButton: assertElement(app.querySelector('[data-role="mute-button"]'), 'mute button'),
    pauseButton: assertElement(app.querySelector('[data-role="pause-button"]'), 'pause button'),
    resumeButton: assertElement(app.querySelector('[data-role="resume-button"]'), 'resume button'),
    shutdownButton: assertElement(
      app.querySelector('[data-role="shutdown-button"]'),
      'shutdown button',
    ),
    loadingVeil: assertElement(app.querySelector('[data-role="loading-veil"]'), 'loading veil'),
    loadingTitle: assertElement(
      app.querySelector('[data-role="loading-title"]'),
      'loading title',
    ),
    loadingBody: assertElement(app.querySelector('[data-role="loading-body"]'), 'loading body'),
    proofStage: assertElement(app.querySelector('[data-role="proof-stage"]'), 'proof stage'),
    uiHost: assertElement(app.querySelector('[data-role="ui-host"]'), 'ui host'),
    trackButtons: {
      bed: assertElement(app.querySelector('[data-role="track-bed"]'), 'bed track button'),
      pulse: assertElement(app.querySelector('[data-role="track-pulse"]'), 'pulse track button'),
      confirm: assertElement(app.querySelector('[data-role="track-confirm"]'), 'confirm track button'),
    },
    trackStatusValues: {
      bed: assertElement(
        app.querySelector('[data-role="track-bed-status"]'),
        'bed track status',
      ),
      pulse: assertElement(
        app.querySelector('[data-role="track-pulse-status"]'),
        'pulse track status',
      ),
      confirm: assertElement(
        app.querySelector('[data-role="track-confirm-status"]'),
        'confirm track status',
      ),
    },
  };
}

function setButtonDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
}

function getTrackCardStatus(trackId: TrackId, audioSnapshot: AudioTransportSnapshot): string {
  if (audioSnapshot.activeTrackId === trackId) {
    switch (audioSnapshot.status) {
      case 'playing':
        return 'Playing';
      case 'paused':
        return 'Paused';
      case 'loading':
        return 'Loading';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  }

  return audioSnapshot.loadedTrackIds.includes(trackId) ? 'Loaded' : 'Waiting';
}

function syncControls(
  elements: AppElements,
  snapshot: RuntimeSnapshot,
  state: ProofState,
  audioSnapshot: AudioTransportSnapshot,
): void {
  const readyInteractive = snapshot.phase === 'ready' && !state.isShutdown;

  for (const trackId of TRACK_IDS) {
    setButtonDisabled(elements.trackButtons[trackId], !readyInteractive);
  }

  setButtonDisabled(elements.playButton, !readyInteractive);
  setButtonDisabled(
    elements.pauseTrackButton,
    !readyInteractive || audioSnapshot.status !== 'playing',
  );
  setButtonDisabled(elements.stopButton, !readyInteractive || !audioSnapshot.activeTrackId);
  setButtonDisabled(elements.muteButton, !readyInteractive);
  elements.volumeSlider.disabled = !readyInteractive;
  setButtonDisabled(elements.pauseButton, state.isShutdown || snapshot.phase !== 'ready');
  setButtonDisabled(elements.resumeButton, state.isShutdown || snapshot.phase !== 'paused');
  setButtonDisabled(elements.shutdownButton, state.isShutdown);
}

function syncAudioView(
  elements: AppElements,
  state: ProofState,
  snapshot: RuntimeSnapshot,
  loadingSnapshot: LoadingSnapshot,
  audioSnapshot: AudioTransportSnapshot,
  latestEvent: string,
): void {
  state.activeTrackId = (audioSnapshot.activeTrackId as TrackId | null) ?? null;

  elements.phaseValue.textContent = snapshot.phase;
  elements.reasonValue.textContent = snapshot.reason ?? 'n/a';
  elements.activeTrackValue.textContent = trackLabel(state.activeTrackId);
  elements.transportValue.textContent = formatTransportStatus(audioSnapshot.status);
  elements.volumeValue.textContent = `${Math.round(audioSnapshot.volume * 100)}%`;
  elements.mutedValue.textContent = audioSnapshot.muted ? 'Yes' : 'No';
  elements.eventValue.textContent = latestEvent;
  elements.frameValue.textContent = String(state.frameTick);
  elements.actionValue.textContent = state.lastAction;
  elements.loadingStageValue.textContent = loadingSnapshot.stageLabel ?? 'Waiting';
  elements.loadingProgressValue.textContent = `${Math.round(loadingSnapshot.progress * 100)}%`;
  elements.loadingProgressFill.style.width = `${loadingSnapshot.progress * 100}%`;
  elements.volumeSlider.value = String(audioSnapshot.volume);
  elements.volumeSliderValue.textContent = `${Math.round(audioSnapshot.volume * 100)}%`;

  for (const trackId of TRACK_IDS) {
    const active = state.activeTrackId === trackId;
    elements.trackButtons[trackId].dataset.active = active ? 'true' : 'false';
    elements.trackStatusValues[trackId].textContent = getTrackCardStatus(trackId, audioSnapshot);
  }

  if (!state.activeTrackId) {
    elements.transportTitle.textContent = 'No active track';
    elements.transportBody.textContent =
      snapshot.phase === 'ready'
        ? 'Select a track or use 1, 2, and 3 to begin playback.'
        : 'The proof is staging audio transport services and local proof tracks.';
  } else {
    elements.transportTitle.textContent = trackLabel(state.activeTrackId);
    elements.transportBody.textContent =
      audioSnapshot.status === 'playing'
        ? 'Playback is active. Use Pause Track, Stop, or mute and volume controls to exercise the transport.'
        : audioSnapshot.status === 'paused'
          ? 'Playback is paused. Resume with Play or Space.'
          : audioSnapshot.status === 'error'
            ? audioSnapshot.errorMessage ?? 'Playback hit an audio transport error.'
            : 'Track is loaded and ready. Use Play to start or restart transport.';
  }

  if (snapshot.phase === 'loading') {
    elements.loadingVeil.hidden = false;
    elements.loadingTitle.textContent = 'Preparing audio proof';
    elements.loadingBody.textContent = loadingSnapshot.stageLabel
      ? `${loadingSnapshot.stageLabel}: ${loadingSnapshot.message}`
      : loadingSnapshot.message;
  } else {
    elements.loadingVeil.hidden = true;
    elements.loadingTitle.textContent = 'Preparing audio proof';
    elements.loadingBody.textContent =
      'The proof is staging the runtime shell, preloading local tracks, and activating transport controls.';
  }
}

function createAudioLoadingController(state: ProofState): ControllerRegistration {
  const stages = [
    { id: 'bootstrap-audio', label: 'Bootstrap audio', weight: 1 },
    { id: 'preload-audio', label: 'Preload audio', weight: 1 },
    { id: 'activate-audio', label: 'Activate audio', weight: 1 },
  ];

  let elapsedMs = 0;
  let loadingActive = false;
  let preloadStarted = false;
  let preloadComplete = false;

  return {
    id: 'audio-loading-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const audio = ctx.adapters.require<AudioAdapterApi>('audio');

      elapsedMs = 0;
      loadingActive = true;
      preloadStarted = false;
      preloadComplete = false;
      state.lastAction = 'Started staged audio loading';

      for (const track of PROOF_TRACKS) {
        audio.registerTrack(track);
      }

      loading.begin(stages, 'Registering proof tracks and transport state');

      if (ctx.state.getSnapshot().phase !== 'loading') {
        ctx.state.setPhase('loading', 'audio-proof:boot');
      }
    },
    update(frame, ctx) {
      if (!loadingActive || ctx.state.getSnapshot().phase !== 'loading') {
        return;
      }

      elapsedMs += frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const audio = ctx.adapters.require<AudioAdapterApi>('audio');

      if (elapsedMs < 700) {
        loading.setStage(
          'bootstrap-audio',
          elapsedMs / 700,
          'Creating audio shell and registering local proof tracks',
        );
        return;
      }

      if (!preloadStarted) {
        preloadStarted = true;

        void Promise.all(PROOF_TRACKS.map((track) => audio.preload(track.id)))
          .then(() => {
            preloadComplete = true;
          })
          .catch((error) => {
            loadingActive = false;
            state.lastAction =
              error instanceof Error ? error.message : 'Audio preload failed';
            ctx.state.setPhase('error', state.lastAction);
          });
      }

      if (!preloadComplete || elapsedMs < 1700) {
        const loadedRatio = audio.getSnapshot().loadedTrackIds.length / PROOF_TRACKS.length;
        const elapsedRatio = clamp((elapsedMs - 700) / 1000);

        loading.setStage(
          'preload-audio',
          Math.max(loadedRatio, elapsedRatio),
          'Preloading local transport audio into browser media elements',
        );
        return;
      }

      if (elapsedMs < 2500) {
        loading.setStage(
          'activate-audio',
          (elapsedMs - 1700) / 800,
          'Enabling transport cards, keyboard controls, and overlay status',
        );
        return;
      }

      loading.complete('Audio proof ready');
      loadingActive = false;
      state.lastAction = 'Audio proof reached ready state';
      ctx.state.setPhase('ready', 'audio-proof:ready');
    },
  };
}

function createAudioTransportController(
  state: ProofState,
  elements: AppElements,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];

  const withActions = (
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
  ): ProofActions => {
    return {
      pauseKernel: ctx.services.require<() => void>('audio-proof:pause-kernel'),
      resumeKernel: ctx.services.require<() => void>('audio-proof:resume-kernel'),
      shutdown: ctx.services.require<() => void>('audio-proof:shutdown'),
      render: ctx.services.require<() => void>('audio-proof:render'),
    };
  };

  const setVolumeFromDelta = (
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
    delta: number,
    source: 'pointer' | 'keyboard',
  ): void => {
    if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
      return;
    }

    const audio = ctx.adapters.require<AudioAdapterApi>('audio');
    const nextVolume = clamp(audio.getSnapshot().volume + delta);
    audio.setVolume(nextVolume);
    state.lastAction = `${source === 'pointer' ? 'Adjusted' : 'Keyed'} volume to ${Math.round(
      nextVolume * 100,
    )}%`;
    withActions(ctx).render();
  };

  const playTrack = async (
    trackId: TrackId,
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
    source: 'pointer' | 'keyboard' | 'system',
  ): Promise<void> => {
    if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
      return;
    }

    const audio = ctx.adapters.require<AudioAdapterApi>('audio');

    try {
      await audio.play(trackId);
      state.lastAction = `${source === 'pointer' ? 'Clicked' : source === 'keyboard' ? 'Keyed' : 'Resumed'} ${trackLabel(trackId)}`;
    } catch (error) {
      state.lastAction = error instanceof Error ? error.message : 'Audio playback failed';
    }

    withActions(ctx).render();
  };

  const toggleCurrentTrack = async (
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
  ): Promise<void> => {
    if (ctx.state.getSnapshot().phase !== 'ready' || state.isShutdown) {
      return;
    }

    const audio = ctx.adapters.require<AudioAdapterApi>('audio');
    const snapshot = audio.getSnapshot();

    if (!snapshot.activeTrackId) {
      return;
    }

    if (snapshot.status === 'playing') {
      audio.pause();
      state.lastAction = `Paused ${trackLabel(snapshot.activeTrackId as TrackId)}`;
      withActions(ctx).render();
      return;
    }

    await playTrack(snapshot.activeTrackId as TrackId, ctx, 'keyboard');
  };

  const handleAction = (
    meta: PointerActionMeta,
    ctx: Parameters<NonNullable<ControllerRegistration['init']>>[0],
    source: 'pointer' | 'keyboard',
  ): void => {
    const snapshot = ctx.state.getSnapshot();
    const actions = withActions(ctx);
    const audio = ctx.adapters.require<AudioAdapterApi>('audio');

    switch (meta.action) {
      case 'shutdown':
        if (!state.isShutdown) {
          state.lastAction = 'Requested kernel shutdown';
          actions.shutdown();
        }
        return;
      case 'resume-kernel':
        if (snapshot.phase === 'paused' && !state.isShutdown) {
          state.lastAction = 'Resumed audio runtime';
          actions.resumeKernel();
        }
        return;
      case 'pause-kernel':
        if (snapshot.phase === 'ready' && !state.isShutdown) {
          state.lastAction = 'Paused audio runtime';
          actions.pauseKernel();
        }
        return;
      default:
        break;
    }

    if (snapshot.phase !== 'ready' || state.isShutdown) {
      return;
    }

    switch (meta.action) {
      case 'track':
        void playTrack(meta.trackId, ctx, source);
        return;
      case 'play': {
        const activeTrackId = audio.getSnapshot().activeTrackId as TrackId | null;
        void playTrack(activeTrackId ?? 'bed', ctx, source);
        return;
      }
      case 'pause-track': {
        const activeTrackId = audio.getSnapshot().activeTrackId as TrackId | null;

        if (!activeTrackId) {
          return;
        }

        audio.pause();
        state.lastAction = `${source === 'pointer' ? 'Clicked' : 'Keyed'} pause for ${trackLabel(activeTrackId)}`;
        actions.render();
        return;
      }
      case 'stop': {
        const activeTrackId = audio.getSnapshot().activeTrackId as TrackId | null;

        if (!activeTrackId) {
          return;
        }

        audio.stop();
        state.lastAction = `${source === 'pointer' ? 'Clicked' : 'Keyed'} stop for ${trackLabel(activeTrackId)}`;
        actions.render();
        return;
      }
      case 'mute': {
        const muted = !audio.getSnapshot().muted;
        audio.setMuted(muted);
        state.lastAction = `${source === 'pointer' ? 'Clicked' : 'Keyed'} ${muted ? 'mute on' : 'mute off'}`;
        actions.render();
        return;
      }
      default:
        return;
    }
  };

  return {
    id: 'audio-transport-controller',
    init(ctx) {
      const pointer = ctx.adapters.require<PointerAdapterApi>('pointer');
      const input = ctx.adapters.require<InputAdapterApi>('input');

      const pointerTargets: Array<{
        id: string;
        element: HTMLButtonElement;
        meta: PointerActionMeta;
      }> = [
        {
          id: 'track-bed',
          element: elements.trackButtons.bed,
          meta: { scope: 'audio-proof', action: 'track', trackId: 'bed' },
        },
        {
          id: 'track-pulse',
          element: elements.trackButtons.pulse,
          meta: { scope: 'audio-proof', action: 'track', trackId: 'pulse' },
        },
        {
          id: 'track-confirm',
          element: elements.trackButtons.confirm,
          meta: { scope: 'audio-proof', action: 'track', trackId: 'confirm' },
        },
        {
          id: 'play-track',
          element: elements.playButton,
          meta: { scope: 'audio-proof', action: 'play' },
        },
        {
          id: 'pause-track',
          element: elements.pauseTrackButton,
          meta: { scope: 'audio-proof', action: 'pause-track' },
        },
        {
          id: 'stop-track',
          element: elements.stopButton,
          meta: { scope: 'audio-proof', action: 'stop' },
        },
        {
          id: 'mute-track',
          element: elements.muteButton,
          meta: { scope: 'audio-proof', action: 'mute' },
        },
        {
          id: 'pause-kernel',
          element: elements.pauseButton,
          meta: { scope: 'audio-proof', action: 'pause-kernel' },
        },
        {
          id: 'resume-kernel',
          element: elements.resumeButton,
          meta: { scope: 'audio-proof', action: 'resume-kernel' },
        },
        {
          id: 'shutdown-kernel',
          element: elements.shutdownButton,
          meta: { scope: 'audio-proof', action: 'shutdown' },
        },
      ];

      for (const target of pointerTargets) {
        cleanups.push(
          pointer.bindTarget({
            id: target.id,
            element: target.element,
            meta: target.meta,
          }),
        );
      }

      cleanups.push(
        ctx.events.on('pointer:select', (event) => {
          const payload = event.payload as PointerTargetEventPayload | undefined;
          const meta = payload?.meta as PointerActionMeta | undefined;

          if (!payload || !meta || meta.scope !== 'audio-proof') {
            return;
          }

          handleAction(meta, ctx, 'pointer');
        }),
      );

      const onVolumeInput = (): void => {
        const snapshot = ctx.state.getSnapshot();

        if (snapshot.phase !== 'ready' || state.isShutdown) {
          withActions(ctx).render();
          return;
        }

        const audio = ctx.adapters.require<AudioAdapterApi>('audio');
        const nextVolume = clamp(Number(elements.volumeSlider.value));
        audio.setVolume(nextVolume);
        state.lastAction = `Adjusted volume to ${Math.round(nextVolume * 100)}%`;
        withActions(ctx).render();
      };

      elements.volumeSlider.addEventListener('input', onVolumeInput);
      cleanups.push(() => {
        elements.volumeSlider.removeEventListener('input', onVolumeInput);
      });

      cleanups.push(
        input.bindKey({
          code: 'Digit1',
          handler: () => {
            handleAction(
              { scope: 'audio-proof', action: 'track', trackId: 'bed' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit2',
          handler: () => {
            handleAction(
              { scope: 'audio-proof', action: 'track', trackId: 'pulse' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Digit3',
          handler: () => {
            handleAction(
              { scope: 'audio-proof', action: 'track', trackId: 'confirm' },
              ctx,
              'keyboard',
            );
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'Space',
          handler: (event) => {
            event.nativeEvent.preventDefault();
            void toggleCurrentTrack(ctx);
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'KeyM',
          handler: () => {
            handleAction({ scope: 'audio-proof', action: 'mute' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'KeyS',
          handler: () => {
            handleAction({ scope: 'audio-proof', action: 'stop' }, ctx, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'ArrowUp',
          handler: (event) => {
            event.nativeEvent.preventDefault();
            setVolumeFromDelta(ctx, 0.1, 'keyboard');
          },
        }),
      );
      cleanups.push(
        input.bindKey({
          code: 'ArrowDown',
          handler: (event) => {
            event.nativeEvent.preventDefault();
            setVolumeFromDelta(ctx, -0.1, 'keyboard');
          },
        }),
      );
    },
    dispose() {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
    },
  };
}

function createAudioChromeController(
  state: ProofState,
  elements: AppElements,
  setForceRender: (render: (() => void) | null) => void,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let latestEvent = 'kernel:init';
  let latestLoadingSnapshot = createEmptyLoadingSnapshot();
  let latestAudioSnapshot = createEmptyAudioSnapshot();
  let render: (() => void) | null = null;

  return {
    id: 'audio-chrome-controller',
    init(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const audio = ctx.adapters.require<AudioAdapterApi>('audio');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      latestLoadingSnapshot = loading.getSnapshot();
      latestAudioSnapshot = audio.getSnapshot();

      render = (): void => {
        const snapshot = ctx.state.getSnapshot();
        syncControls(elements, snapshot, state, latestAudioSnapshot);
        syncAudioView(
          elements,
          state,
          snapshot,
          latestLoadingSnapshot,
          latestAudioSnapshot,
          latestEvent,
        );
      };

      setForceRender(render);
      render();

      cleanups.push(
        loading.subscribe((snapshot) => {
          latestLoadingSnapshot = snapshot;
          latestEvent = 'loading:changed';
          render?.();
        }),
      );

      cleanups.push(
        audio.subscribe((snapshot) => {
          latestAudioSnapshot = snapshot;
          state.activeTrackId = (snapshot.activeTrackId as TrackId | null) ?? null;
          latestEvent = 'audio:changed';
          render?.();
        }),
      );

      for (const eventType of [
        'runtime:phase-changed',
        'runtime:paused',
        'runtime:resumed',
        'runtime:error',
        'audio:ended',
        'audio:error',
        'pointer:select',
        'input:key-down',
      ]) {
        cleanups.push(
          ctx.events.on(eventType, (event) => {
            latestEvent = event.type;

            if (event.type === 'audio:ended') {
              const payload = event.payload as { trackId?: string; label?: string } | undefined;
              state.lastAction = `${payload?.label ?? trackLabel(state.activeTrackId)} completed playback`;
            }

            if (event.type === 'audio:error') {
              const payload = event.payload as { message?: string } | undefined;
              state.lastAction = payload?.message ?? 'Audio transport error';
            }

            render?.();
          }),
        );
      }

      ui.setStatus('Booting audio proof');
    },
    update(_frame, ctx) {
      if (state.isShutdown) {
        return;
      }

      const snapshot = ctx.state.getSnapshot();
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      state.frameTick += 1;

      syncControls(elements, snapshot, state, latestAudioSnapshot);
      syncAudioView(
        elements,
        state,
        snapshot,
        latestLoadingSnapshot,
        latestAudioSnapshot,
        latestEvent,
      );

      ui.setStatus(phaseStatus(snapshot));

      if (snapshot.phase === 'loading') {
        ui.showCallout({
          title: 'Audio loading',
          body: latestLoadingSnapshot.stageLabel
            ? `${latestLoadingSnapshot.stageLabel}: ${latestLoadingSnapshot.message}`
            : latestLoadingSnapshot.message,
          tone: 'active',
        });
        return;
      }

      if (snapshot.phase === 'paused') {
        ui.showCallout({
          title: 'Audio proof paused',
          body: state.resumeTrackId
            ? `Resume to continue ${trackLabel(state.resumeTrackId)}.`
            : 'Resume to continue the active audio transport state.',
          tone: 'neutral',
        });
        return;
      }

      if (snapshot.phase === 'ready') {
        ui.showCallout({
          title: state.activeTrackId ? trackLabel(state.activeTrackId) : 'Audio transport ready',
          body: state.activeTrackId
            ? `${formatTransportStatus(latestAudioSnapshot.status)} at ${Math.round(
                latestAudioSnapshot.volume * 100,
              )}% volume${latestAudioSnapshot.muted ? ', muted' : ''}.`
            : 'Choose a track or use 1, 2, and 3 to start playback.',
          tone: 'selected',
        });
        return;
      }

      if (snapshot.phase === 'error') {
        ui.showCallout({
          title: 'Audio proof error',
          body:
            latestAudioSnapshot.errorMessage ??
            snapshot.reason ??
            'Unknown audio proof runtime error.',
          tone: 'neutral',
        });
        return;
      }

      ui.hideCallout();
    },
    onStateChange(next) {
      if (next.phase === 'ready') {
        elements.proofStage.focus();
      }

      render?.();
    },
    dispose(ctx) {
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }

      ui.hideCallout();
      ui.setStatus('Audio proof stopped');
    },
  };
}

async function main(): Promise<void> {
  const elements = createLayout();
  const state = createInitialState();
  let forceRender: (() => void) | null = null;

  const proofActions: ProofActions = {
    pauseKernel() {},
    resumeKernel() {},
    shutdown() {},
    render() {
      forceRender?.();
    },
  };

  const kernel = createKernel({
    id: 'urk-audio-proof',
    services: {
      'ui:host': elements.uiHost,
      'audio-proof:pause-kernel': () => proofActions.pauseKernel(),
      'audio-proof:resume-kernel': () => proofActions.resumeKernel(),
      'audio-proof:shutdown': () => proofActions.shutdown(),
      'audio-proof:render': () => proofActions.render(),
    },
    adapters: [
      createLoadingAdapter(),
      createUiWidgetsAdapter(),
      createPointerAdapter(),
      createInputAdapter(),
      createAudioAdapter(),
    ],
    controllers: [
      createAudioLoadingController(state),
      createAudioTransportController(state, elements),
      createAudioChromeController(state, elements, (render) => {
        forceRender = render;
      }),
    ],
  });

  proofActions.pauseKernel = () => {
    if (state.isShutdown || kernel.getState().phase !== 'ready') {
      return;
    }

    const audio = kernel.getContext().adapters.require<AudioAdapterApi>('audio');
    const snapshot = audio.getSnapshot();

    state.resumeTrackId = null;
    state.resumeWasPlaying = false;

    if (snapshot.status === 'playing' && snapshot.activeTrackId) {
      state.resumeTrackId = snapshot.activeTrackId as TrackId;
      state.resumeWasPlaying = true;
      audio.pause();
    }

    state.lastAction = 'Paused audio runtime';
    proofActions.render();
    kernel.pause('audio-proof:pause');
  };

  proofActions.resumeKernel = () => {
    if (state.isShutdown || kernel.getState().phase !== 'paused') {
      return;
    }

    state.lastAction = 'Resumed audio runtime';
    kernel.resume('audio-proof:resume');

    if (state.resumeWasPlaying && state.resumeTrackId) {
      const audio = kernel.getContext().adapters.require<AudioAdapterApi>('audio');
      const resumeTrackId = state.resumeTrackId;

      state.resumeWasPlaying = false;
      state.resumeTrackId = null;

      void audio.play(resumeTrackId).catch((error) => {
        state.lastAction = error instanceof Error ? error.message : 'Failed to resume audio track';
        proofActions.render();
      });
    }
  };

  proofActions.shutdown = () => {
    if (state.isShutdown) {
      return;
    }

    state.isShutdown = true;
    state.resumeWasPlaying = false;
    state.resumeTrackId = null;

    const audio = kernel.getContext().adapters.require<AudioAdapterApi>('audio');
    audio.stop();

    state.lastAction = 'Kernel shut down';
    proofActions.render();

    void kernel.shutdown('audio-proof:shutdown').catch((error) => {
      state.lastAction = error instanceof Error ? error.message : 'Shutdown failed';
      proofActions.render();
    });
  };

  await kernel.boot();

  window.addEventListener(
    'beforeunload',
    () => {
      state.isShutdown = true;
      const audio = kernel.getContext().adapters.require<AudioAdapterApi>('audio');
      audio.stop();
      void kernel.shutdown('audio-proof:unload');
    },
    { once: true },
  );
}

void main().catch((error) => {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `
      <main style="padding: 32px; font-family: IBM Plex Sans, sans-serif;">
        <h1 style="margin: 0 0 12px;">URK audio proof failed</h1>
        <p style="margin: 0; line-height: 1.6; color: #475569;">
          ${error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </main>
    `;
  }

  throw error;
});
