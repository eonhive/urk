/**
 * Company: EonHive Inc.
 * Title: URK Loading Transition Proof
 * Purpose: Prove runtime loading and transition handoff in a focused DOM-first shell.
 * Author: Stan Nesi
 * Created: 2026-04-22
 * Updated: 2026-04-22
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type ControllerRegistration, type RuntimePhase } from '@urk/core';
import {
  createLoadingAdapter,
  createUiWidgetsAdapter,
  type LoadingAdapterApi,
  type LoadingSnapshot,
  type UiWidgetsAdapterApi,
} from '@urk/adapters';

type AppElements = {
  phaseValue: HTMLElement;
  reasonValue: HTMLElement;
  frameValue: HTMLElement;
  eventValue: HTMLElement;
  stageValue: HTMLElement;
  countdownValue: HTMLElement;
  progressValue: HTMLElement;
  progressFill: HTMLElement;
  messageValue: HTMLElement;
  shellTitle: HTMLElement;
  shellBody: HTMLElement;
  transitionVeil: HTMLElement;
  transitionLabel: HTMLElement;
  readyPanel: HTMLElement;
  readyBody: HTMLElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  replayButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
  uiHost: HTMLElement;
};

type FlowState = {
  replayRequested: boolean;
  transitionRemainingMs: number;
  phaseBeforePause: RuntimePhase | null;
  isShutdown: boolean;
};

const TRANSITION_DURATION_MS = 1200;

function assertElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Missing DOM element: ${label}`);
  }

  return value;
}

function createLayout(): AppElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app');

  return {
    phaseValue: assertElement(app.querySelector('[data-role="phase-value"]'), 'phase value'),
    reasonValue: assertElement(app.querySelector('[data-role="reason-value"]'), 'reason value'),
    frameValue: assertElement(app.querySelector('[data-role="frame-value"]'), 'frame value'),
    eventValue: assertElement(app.querySelector('[data-role="event-value"]'), 'event value'),
    stageValue: assertElement(app.querySelector('[data-role="stage-value"]'), 'stage value'),
    countdownValue: assertElement(app.querySelector('[data-role="countdown-value"]'), 'countdown value'),
    progressValue: assertElement(app.querySelector('[data-role="progress-value"]'), 'progress value'),
    progressFill: assertElement(app.querySelector('[data-role="progress-fill"]'), 'progress fill'),
    messageValue: assertElement(app.querySelector('[data-role="message-value"]'), 'message value'),
    shellTitle: assertElement(app.querySelector('[data-role="shell-title"]'), 'shell title'),
    shellBody: assertElement(app.querySelector('[data-role="shell-body"]'), 'shell body'),
    transitionVeil: assertElement(app.querySelector('[data-role="transition-veil"]'), 'transition veil'),
    transitionLabel: assertElement(app.querySelector('[data-role="transition-label"]'), 'transition label'),
    readyPanel: assertElement(app.querySelector('[data-role="ready-panel"]'), 'ready panel'),
    readyBody: assertElement(app.querySelector('[data-role="ready-body"]'), 'ready body'),
    pauseButton: assertElement(app.querySelector('[data-role="pause-button"]'), 'pause button'),
    resumeButton: assertElement(app.querySelector('[data-role="resume-button"]'), 'resume button'),
    replayButton: assertElement(app.querySelector('[data-role="replay-button"]'), 'replay button'),
    shutdownButton: assertElement(app.querySelector('[data-role="shutdown-button"]'), 'shutdown button'),
    uiHost: assertElement(app.querySelector('[data-role="ui-host"]'), 'ui host'),
  };
}

function phaseStatus(phase: RuntimePhase): string {
  switch (phase) {
    case 'boot':
      return 'Booting kernel';
    case 'loading':
      return 'Loading staged shell';
    case 'transition':
      return 'Transition handoff active';
    case 'ready':
      return 'Ready';
    case 'paused':
      return 'Paused';
    case 'error':
      return 'Runtime error';
    default:
      return phase;
  }
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

function formatCountdownLabel(
  flowState: FlowState,
  snapshot: ReturnType<ReturnType<typeof createKernel>['getState']>,
): string {
  const effectivePhase =
    snapshot.phase === 'paused' ? flowState.phaseBeforePause : snapshot.phase;

  if (effectivePhase !== 'transition') {
    return 'n/a';
  }

  const seconds = Math.max(flowState.transitionRemainingMs, 0) / 1000;
  const suffix = snapshot.phase === 'paused' ? ' (paused)' : '';

  return `${seconds.toFixed(2)}s${suffix}`;
}

function syncControls(
  elements: AppElements,
  phase: RuntimePhase,
  flowState: FlowState,
): void {
  elements.pauseButton.disabled =
    flowState.isShutdown || phase === 'boot' || phase === 'paused' || phase === 'error';
  elements.resumeButton.disabled = flowState.isShutdown || phase !== 'paused';
  elements.replayButton.disabled = flowState.isShutdown || phase !== 'ready';
  elements.shutdownButton.disabled = flowState.isShutdown;
}

function syncShellView(
  elements: AppElements,
  flowState: FlowState,
  snapshot: ReturnType<ReturnType<typeof createKernel>['getState']>,
  loadingSnapshot: LoadingSnapshot,
): void {
  const effectivePhase =
    snapshot.phase === 'paused' ? flowState.phaseBeforePause ?? snapshot.phase : snapshot.phase;
  const showTransition = effectivePhase === 'transition';
  const showReady = effectivePhase === 'ready';

  elements.phaseValue.textContent = snapshot.phase;
  elements.reasonValue.textContent = snapshot.reason ?? 'n/a';
  elements.stageValue.textContent = loadingSnapshot.stageLabel ?? 'Waiting';
  elements.progressValue.textContent = `${Math.round(loadingSnapshot.progress * 100)}%`;
  elements.progressFill.setAttribute('style', `width: ${loadingSnapshot.progress * 100}%`);
  elements.messageValue.textContent = loadingSnapshot.message;
  elements.countdownValue.textContent = formatCountdownLabel(flowState, snapshot);

  elements.transitionVeil.dataset.visible = showTransition ? 'true' : 'false';
  elements.readyPanel.hidden = !showReady;

  if (showTransition) {
    elements.transitionLabel.textContent =
      snapshot.phase === 'paused'
        ? `Transition paused with ${formatCountdownLabel(flowState, snapshot)} remaining.`
        : `Ready handoff in ${formatCountdownLabel(flowState, snapshot)}.`;
  } else {
    elements.transitionLabel.textContent = 'Preparing the ready handoff.';
  }

  if (showReady) {
    elements.readyBody.textContent =
      snapshot.phase === 'paused'
        ? 'Ready is paused. Resume to continue the live shell.'
        : 'The shell reached ready. Use Replay Flow to run the handoff again without a refresh.';
  }

  switch (effectivePhase) {
    case 'loading':
      elements.shellTitle.textContent =
        snapshot.phase === 'paused' ? 'Loading paused' : 'Loading flow active';
      elements.shellBody.textContent =
        loadingSnapshot.stageLabel
          ? `${loadingSnapshot.stageLabel}: ${loadingSnapshot.message}`
          : loadingSnapshot.message;
      break;
    case 'transition':
      elements.shellTitle.textContent =
        snapshot.phase === 'paused' ? 'Transition paused' : 'Transition handoff';
      elements.shellBody.textContent =
        snapshot.phase === 'paused'
          ? 'Resume to continue the ready handoff from the current countdown.'
          : 'The veil is active while the shell prepares to expose the ready-state panel.';
      break;
    case 'ready':
      elements.shellTitle.textContent =
        snapshot.phase === 'paused' ? 'Ready paused' : 'Runtime ready';
      elements.shellBody.textContent =
        snapshot.phase === 'paused'
          ? 'Resume to keep the ready state live, or shut down to stop the proof.'
          : 'Replay Flow restarts the staged loading and transition handoff without refreshing the page.';
      break;
    case 'error':
      elements.shellTitle.textContent = 'Runtime error';
      elements.shellBody.textContent = snapshot.reason ?? 'Unknown runtime error.';
      break;
    default:
      elements.shellTitle.textContent = 'Booting kernel';
      elements.shellBody.textContent =
        'Waiting for controllers to start the staged loading flow.';
      break;
  }
}

function createLoadingController(flowState: FlowState): ControllerRegistration {
  const stages = [
    { id: 'bootstrap', label: 'Bootstrap shell', weight: 1 },
    { id: 'services', label: 'Attach runtime services', weight: 1.2 },
    { id: 'handoff', label: 'Prime transition handoff', weight: 0.8 },
  ];

  let elapsedMs = 0;
  let cycleActive = false;

  const beginCycle = (
    ctx: Parameters<NonNullable<ControllerRegistration['start']>>[0],
    reason: string,
    message: string,
  ): void => {
    const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

    elapsedMs = 0;
    cycleActive = true;
    flowState.replayRequested = false;
    flowState.transitionRemainingMs = 0;
    loading.begin(stages, message);

    if (ctx.state.getSnapshot().phase !== 'loading') {
      ctx.state.setPhase('loading', reason);
    }
  };

  return {
    id: 'loading-controller',
    start(ctx) {
      beginCycle(ctx, 'flow:start', 'Bootstrapping runtime shell');
    },
    update(frame, ctx) {
      const snapshot = ctx.state.getSnapshot();

      if (snapshot.phase === 'ready' && flowState.replayRequested) {
        beginCycle(ctx, 'flow:replay', 'Replaying staged loading flow');
        return;
      }

      if (!cycleActive || snapshot.phase !== 'loading') {
        return;
      }

      elapsedMs += frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      if (elapsedMs < 800) {
        loading.setStage(
          'bootstrap',
          elapsedMs / 800,
          'Creating shell metrics and runtime context',
        );
        return;
      }

      if (elapsedMs < 1800) {
        loading.setStage(
          'services',
          (elapsedMs - 800) / 1000,
          'Binding adapters and controller surfaces',
        );
        return;
      }

      if (elapsedMs < 2700) {
        loading.setStage(
          'handoff',
          (elapsedMs - 1800) / 900,
          'Preparing the transition overlay and ready handoff',
        );
        return;
      }

      loading.complete('Staged load complete');
      cycleActive = false;
    },
    onStateChange(next) {
      if (next.phase === 'error') {
        cycleActive = false;
      }
    },
  };
}

function createTransitionController(flowState: FlowState): ControllerRegistration {
  let elapsedMs = 0;
  let transitionActive = false;

  return {
    id: 'transition-controller',
    update(frame, ctx) {
      const snapshot = ctx.state.getSnapshot();
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      if (snapshot.phase === 'loading' && loading.getSnapshot().complete && !transitionActive) {
        transitionActive = true;
        elapsedMs = 0;
        flowState.transitionRemainingMs = TRANSITION_DURATION_MS;
        ctx.state.setPhase('transition', 'loading:handoff');
        return;
      }

      if (snapshot.phase !== 'transition') {
        return;
      }

      elapsedMs += frame.deltaMs;
      flowState.transitionRemainingMs = Math.max(TRANSITION_DURATION_MS - elapsedMs, 0);

      if (elapsedMs < TRANSITION_DURATION_MS) {
        return;
      }

      transitionActive = false;
      flowState.transitionRemainingMs = 0;
      ctx.state.setPhase('ready', 'transition:complete');
    },
    onStateChange(next) {
      if (next.phase === 'loading') {
        transitionActive = false;
        elapsedMs = 0;
        flowState.transitionRemainingMs = 0;
      }
    },
  };
}

function createShellController(
  elements: AppElements,
  flowState: FlowState,
): ControllerRegistration {
  const cleanups: Array<() => void> = [];
  let tickCount = 0;
  let latestLoadingSnapshot = createEmptyLoadingSnapshot();

  return {
    id: 'shell-controller',
    init(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      latestLoadingSnapshot = loading.getSnapshot();
      syncShellView(elements, flowState, ctx.state.getSnapshot(), latestLoadingSnapshot);
      syncControls(elements, ctx.state.getSnapshot().phase, flowState);

      cleanups.push(
        loading.subscribe((snapshot) => {
          latestLoadingSnapshot = snapshot;
          elements.eventValue.textContent = 'loading:changed';
          syncShellView(elements, flowState, ctx.state.getSnapshot(), latestLoadingSnapshot);
        }),
      );

      const registerEvent = (type: string): void => {
        cleanups.push(
          ctx.events.on(type, (event) => {
            elements.eventValue.textContent = event.type;
          }),
        );
      };

      registerEvent('runtime:phase-changed');
      registerEvent('runtime:paused');
      registerEvent('runtime:resumed');
      registerEvent('runtime:shutdown');
      registerEvent('runtime:error');

      ui.setStatus('Booting kernel');
    },
    update(_frame, ctx) {
      const snapshot = ctx.state.getSnapshot();
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');
      const effectivePhase =
        snapshot.phase === 'paused'
          ? flowState.phaseBeforePause ?? snapshot.phase
          : snapshot.phase;

      tickCount += 1;
      elements.frameValue.textContent = String(tickCount);
      syncControls(elements, snapshot.phase, flowState);
      syncShellView(elements, flowState, snapshot, latestLoadingSnapshot);

      if (snapshot.phase === 'boot') {
        ui.hideCallout();
        ui.setStatus('Booting kernel');
        return;
      }

      ui.setStatus(phaseStatus(snapshot.phase));

      if (effectivePhase === 'loading') {
        ui.showCallout({
          title: snapshot.phase === 'paused' ? 'Loading paused' : 'Loading active',
          body: latestLoadingSnapshot.stageLabel
            ? `${latestLoadingSnapshot.stageLabel}: ${latestLoadingSnapshot.message}`
            : latestLoadingSnapshot.message,
          tone: 'active',
        });
        return;
      }

      if (effectivePhase === 'transition') {
        ui.showCallout({
          title: snapshot.phase === 'paused' ? 'Transition paused' : 'Transition active',
          body:
            snapshot.phase === 'paused'
              ? `Resume to continue the handoff with ${formatCountdownLabel(flowState, snapshot)} remaining.`
              : `Ready handoff in ${formatCountdownLabel(flowState, snapshot)}.`,
          tone: 'active',
        });
        return;
      }

      if (effectivePhase === 'ready') {
        ui.showCallout({
          title: snapshot.phase === 'paused' ? 'Ready paused' : 'Ready state',
          body:
            snapshot.phase === 'paused'
              ? 'Resume to keep the ready shell live.'
              : 'Replay Flow reruns the staged handoff without refreshing the page.',
          tone: 'selected',
        });
        return;
      }

      if (snapshot.phase === 'error') {
        ui.showCallout({
          title: 'Runtime error',
          body: snapshot.reason ?? 'Unknown runtime error.',
          tone: 'neutral',
        });
        return;
      }

      ui.hideCallout();
    },
    onStateChange(next, previous) {
      if (next.phase === 'paused') {
        flowState.phaseBeforePause = previous.phase;
      } else {
        flowState.phaseBeforePause = next.phase;
      }

      syncControls(elements, next.phase, flowState);
      syncShellView(elements, flowState, next, latestLoadingSnapshot);
    },
    dispose(ctx) {
      const ui = ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');

      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }

      ui.hideCallout();
      ui.setStatus('Kernel shut down');
    },
  };
}

async function main(): Promise<void> {
  const elements = createLayout();
  const flowState: FlowState = {
    replayRequested: false,
    transitionRemainingMs: 0,
    phaseBeforePause: null,
    isShutdown: false,
  };

  const kernel = createKernel({
    id: 'urk-loading-transition-proof',
    services: {
      'ui:host': elements.uiHost,
    },
    adapters: [
      createLoadingAdapter(),
      createUiWidgetsAdapter(),
    ],
    controllers: [
      createLoadingController(flowState),
      createTransitionController(flowState),
      createShellController(elements, flowState),
    ],
  });

  elements.pauseButton.addEventListener('click', () => {
    kernel.pause('demo:pause');
  });

  elements.resumeButton.addEventListener('click', () => {
    kernel.resume('demo:resume');
  });

  elements.replayButton.addEventListener('click', () => {
    if (flowState.isShutdown || kernel.getState().phase !== 'ready') {
      return;
    }

    flowState.replayRequested = true;
  });

  elements.shutdownButton.addEventListener('click', () => {
    if (flowState.isShutdown) {
      return;
    }

    flowState.isShutdown = true;
    syncControls(elements, kernel.getState().phase, flowState);

    void kernel.shutdown('demo:shutdown').catch((error) => {
      elements.messageValue.textContent =
        error instanceof Error ? error.message : 'Shutdown failed';
    });
  });

  await kernel.boot();

  window.addEventListener(
    'beforeunload',
    () => {
      flowState.isShutdown = true;
      void kernel.shutdown('demo:unload');
    },
    { once: true },
  );
}

void main().catch((error) => {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `<pre>${error instanceof Error ? error.message : 'Failed to start example.'}</pre>`;
  }

  throw error;
});
