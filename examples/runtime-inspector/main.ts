/**
 * Company: EonHive Inc.
 * Title: Runtime Inspector Proof
 * Purpose: Prove the thin URK runtime inspector surface through a standalone DOM-first example.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

import { createKernel, type ControllerRegistration, type KernelEvent, type RuntimeInspectorSnapshot } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  type InputAdapterApi,
  type LoadingAdapterApi,
  type LoadingSnapshot,
  type LoadingStage,
} from '@urk/adapters/dom';

type MarkerTrigger = 'button' | 'keyboard';

type InspectorFlowState = {
  loadingElapsedMs: number;
  loadingComplete: boolean;
  lastLoadingBucket: string | null;
  heartbeatElapsedMs: number;
  heartbeatCount: number;
  shutdownRequested: boolean;
};

type ProofActionService = {
  emitMarker: (trigger: MarkerTrigger) => void;
  pause: () => void;
  resume: () => void;
  shutdown: () => void;
};

type InspectorElements = {
  shell: HTMLDivElement;
  runtimeIdValue: HTMLSpanElement;
  phaseValue: HTMLSpanElement;
  reasonValue: HTMLSpanElement;
  bootedValue: HTMLSpanElement;
  disposedValue: HTMLSpanElement;
  schedulerValue: HTMLSpanElement;
  frameCountValue: HTMLSpanElement;
  loadingStageValue: HTMLSpanElement;
  loadingProgressValue: HTMLSpanElement;
  eventCountValue: HTMLSpanElement;
  adaptersList: HTMLUListElement;
  controllersList: HTMLUListElement;
  servicesList: HTMLUListElement;
  eventsList: HTMLUListElement;
  emitMarkerButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
};

const HEARTBEAT_INTERVAL_MS = 1400;

const LOADING_STAGES: Array<LoadingStage & { durationMs: number }> = [
  { id: 'bootstrap-inspector', label: 'Bootstrap inspector', durationMs: 760 },
  { id: 'bind-input', label: 'Bind input controls', durationMs: 860 },
  { id: 'activate-inspector', label: 'Activate diagnostics surface', durationMs: 720 },
];

function assertElement<TElement extends Element>(
  element: TElement | null,
  description: string,
): TElement {
  if (!element) {
    throw new Error(`Missing ${description}.`);
  }

  return element;
}

function createInitialLoadingSnapshot(): LoadingSnapshot {
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value: string): string {
  return value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&#39;');
}

function formatPercent(value: number): string {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBoolean(next: boolean): string {
  return next ? 'yes' : 'no';
}

function summarizePayload(value: unknown): string {
  if (value === undefined) {
    return 'none';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value.length > 96 ? `${value.slice(0, 93)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof window !== 'undefined' && value === window) {
    return 'Window';
  }

  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return `HTMLElement(<${value.tagName.toLowerCase()}>)`;
  }

  if (typeof value === 'function') {
    return 'function';
  }

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 4)
      .map(([key, next]) => `${key}: ${summarizePayloadLeaf(next)}`);
    const suffix = Object.keys(value as Record<string, unknown>).length > 4 ? ', ...' : '';

    return `{ ${entries.join(', ')}${suffix} }`;
  }

  return typeof value;
}

function summarizePayloadLeaf(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value.length > 36 ? `${value.slice(0, 33)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === 'function') {
    return 'function';
  }

  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return `HTMLElement(<${value.tagName.toLowerCase()}>)`;
  }

  if (typeof value === 'object') {
    const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
    return constructorName && constructorName !== 'Object' ? constructorName : 'object';
  }

  return typeof value;
}

function getLoadingProgressState(elapsedMs: number): {
  complete: boolean;
  stageId: string;
  stageLabel: string;
  progressWithinStage: number;
} {
  let remainingMs = elapsedMs;

  for (const stage of LOADING_STAGES) {
    if (remainingMs <= stage.durationMs) {
      return {
        complete: false,
        stageId: stage.id,
        stageLabel: stage.label,
        progressWithinStage: clamp(remainingMs / stage.durationMs, 0, 1),
      };
    }

    remainingMs -= stage.durationMs;
  }

  const finalStage = LOADING_STAGES[LOADING_STAGES.length - 1];

  return {
    complete: true,
    stageId: finalStage.id,
    stageLabel: finalStage.label,
    progressWithinStage: 1,
  };
}

function createLayout(): InspectorElements {
  const app = assertElement(document.querySelector<HTMLDivElement>('#app'), '#app root');

  return {
    shell: assertElement(app.querySelector<HTMLDivElement>('.inspector-shell'), 'inspector shell'),
    runtimeIdValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="runtime-id"]'),
      'runtime id metric',
    ),
    phaseValue: assertElement(app.querySelector<HTMLSpanElement>('[data-role="phase"]'), 'phase metric'),
    reasonValue: assertElement(app.querySelector<HTMLSpanElement>('[data-role="reason"]'), 'reason metric'),
    bootedValue: assertElement(app.querySelector<HTMLSpanElement>('[data-role="booted"]'), 'booted metric'),
    disposedValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="disposed"]'),
      'disposed metric',
    ),
    schedulerValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="scheduler"]'),
      'scheduler metric',
    ),
    frameCountValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="frame-count"]'),
      'frame count metric',
    ),
    loadingStageValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="loading-stage"]'),
      'loading stage metric',
    ),
    loadingProgressValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="loading-progress"]'),
      'loading progress metric',
    ),
    eventCountValue: assertElement(
      app.querySelector<HTMLSpanElement>('[data-role="event-count"]'),
      'event count metric',
    ),
    adaptersList: assertElement(
      app.querySelector<HTMLUListElement>('[data-role="adapters-list"]'),
      'adapters list',
    ),
    controllersList: assertElement(
      app.querySelector<HTMLUListElement>('[data-role="controllers-list"]'),
      'controllers list',
    ),
    servicesList: assertElement(
      app.querySelector<HTMLUListElement>('[data-role="services-list"]'),
      'services list',
    ),
    eventsList: assertElement(
      app.querySelector<HTMLUListElement>('[data-role="events-list"]'),
      'events list',
    ),
    emitMarkerButton: assertElement(
      app.querySelector<HTMLButtonElement>('[data-role="emit-marker"]'),
      'emit marker button',
    ),
    pauseButton: assertElement(app.querySelector<HTMLButtonElement>('[data-role="pause"]'), 'pause button'),
    resumeButton: assertElement(
      app.querySelector<HTMLButtonElement>('[data-role="resume"]'),
      'resume button',
    ),
    shutdownButton: assertElement(
      app.querySelector<HTMLButtonElement>('[data-role="shutdown"]'),
      'shutdown button',
    ),
  };
}

function renderRegistryList(items: Array<{ title: string; meta: string }>): string {
  if (items.length === 0) {
    return '<li><strong>None</strong><span class="inspector-list__meta">No entries registered.</span></li>';
  }

  return items
    .map((item) => {
      return `
        <li>
          <strong>${escapeHtml(item.title)}</strong>
          <span class="inspector-list__meta">${escapeHtml(item.meta)}</span>
        </li>
      `;
    })
    .join('');
}

function renderEvents(events: KernelEvent[]): string {
  if (events.length === 0) {
    return '<li><strong>No events yet</strong><span class="inspector-events__meta">The inspector will populate as the kernel boots.</span></li>';
  }

  return [...events]
    .reverse()
    .slice(0, 14)
    .map((event) => {
      return `
        <li>
          <strong>${escapeHtml(event.type)}</strong>
          <span class="inspector-events__meta">
            <span>source: ${escapeHtml(event.source)}</span>
            <span>time: ${escapeHtml(formatTimestamp(event.timestamp))}</span>
          </span>
          <span class="inspector-events__payload">${escapeHtml(summarizePayload(event.payload))}</span>
        </li>
      `;
    })
    .join('');
}

function syncControls(elements: InspectorElements, snapshot: RuntimeInspectorSnapshot): void {
  const phase = snapshot.runtime.phase;
  const disposed = snapshot.disposed;
  const interactive = phase === 'ready';
  const paused = phase === 'paused';

  elements.emitMarkerButton.disabled = disposed || (!interactive && !paused);
  elements.pauseButton.disabled = disposed || !interactive;
  elements.resumeButton.disabled = disposed || !paused;
  elements.shutdownButton.disabled = disposed;
}

function renderProof(
  elements: InspectorElements,
  inspectorSnapshot: RuntimeInspectorSnapshot,
  loadingSnapshot: LoadingSnapshot,
): void {
  elements.shell.dataset.phase = inspectorSnapshot.runtime.phase;
  elements.runtimeIdValue.textContent = inspectorSnapshot.runtimeId;
  elements.phaseValue.textContent = inspectorSnapshot.runtime.phase;
  elements.reasonValue.textContent = inspectorSnapshot.runtime.reason ?? 'n/a';
  elements.bootedValue.textContent = formatBoolean(inspectorSnapshot.booted);
  elements.disposedValue.textContent = formatBoolean(inspectorSnapshot.disposed);
  elements.schedulerValue.textContent = inspectorSnapshot.schedulerRunning ? 'running' : 'stopped';
  elements.frameCountValue.textContent = String(inspectorSnapshot.frameCount);
  elements.loadingStageValue.textContent =
    loadingSnapshot.complete && !loadingSnapshot.active
      ? 'Loading complete'
      : (loadingSnapshot.stageLabel ?? 'Waiting to start');
  elements.loadingProgressValue.textContent = formatPercent(loadingSnapshot.progress);
  elements.eventCountValue.textContent = String(inspectorSnapshot.totalEvents);

  elements.adaptersList.innerHTML = renderRegistryList(
    inspectorSnapshot.adapters.map((adapter) => ({
      title: adapter.id,
      meta: `capability: ${adapter.capability}`,
    })),
  );
  elements.controllersList.innerHTML = renderRegistryList(
    inspectorSnapshot.controllers.map((controller) => ({
      title: controller.id,
      meta: `initialized: ${controller.initialized ? 'yes' : 'no'} • started: ${
        controller.started ? 'yes' : 'no'
      }`,
    })),
  );
  elements.servicesList.innerHTML = renderRegistryList(
    inspectorSnapshot.services.map((service) => ({
      title: service.name,
      meta: `kind: ${service.kind}`,
    })),
  );
  elements.eventsList.innerHTML = renderEvents(inspectorSnapshot.recentEvents);

  syncControls(elements, inspectorSnapshot);
}

function createInspectorLoadingController(flowState: InspectorFlowState): ControllerRegistration {
  return {
    id: 'inspector-loading-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      ctx.state.setPhase('loading', 'runtime-inspector:loading');
      loading.begin(
        LOADING_STAGES.map(({ durationMs: _durationMs, ...stage }) => stage),
        'Preparing runtime inspector',
      );
      ctx.events.emit({
        type: 'inspector:loading-started',
        source: 'inspector-loading-controller',
        payload: {
          stages: LOADING_STAGES.map(({ id, label }) => ({ id, label })),
        },
        timestamp: Date.now(),
      });
    },
    update(frame, ctx) {
      if (flowState.shutdownRequested) {
        return;
      }

      const phase = ctx.state.getSnapshot().phase;

      if (phase === 'loading' && !flowState.loadingComplete) {
        const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

        flowState.loadingElapsedMs += frame.deltaMs === 0 ? 16 : frame.deltaMs;

        const progressState = getLoadingProgressState(flowState.loadingElapsedMs);
        const bucket = `${progressState.stageId}:${Math.floor(progressState.progressWithinStage * 16)}`;

        if (bucket !== flowState.lastLoadingBucket) {
          flowState.lastLoadingBucket = bucket;
          loading.setStage(
            progressState.stageId,
            progressState.progressWithinStage,
            `Running ${progressState.stageLabel.toLowerCase()}`,
          );
        }

        if (progressState.complete) {
          flowState.loadingComplete = true;
          loading.complete('Runtime inspector ready');
          ctx.state.setPhase('ready', 'runtime-inspector:ready');
          ctx.events.emit({
            type: 'inspector:ready',
            source: 'inspector-loading-controller',
            payload: {
              totalDurationMs: Math.round(flowState.loadingElapsedMs),
            },
            timestamp: Date.now(),
          });
        }

        return;
      }

      if (phase === 'ready') {
        flowState.heartbeatElapsedMs += frame.deltaMs === 0 ? 16 : frame.deltaMs;

        if (flowState.heartbeatElapsedMs >= HEARTBEAT_INTERVAL_MS) {
          flowState.heartbeatElapsedMs = 0;
          flowState.heartbeatCount += 1;
          ctx.events.emit({
            type: 'inspector:heartbeat',
            source: 'inspector-loading-controller',
            payload: {
              index: flowState.heartbeatCount,
            },
            timestamp: Date.now(),
          });
        }
      }
    },
  };
}

function createInspectorInputController(): ControllerRegistration {
  let cleanup: Array<() => void> = [];

  return {
    id: 'inspector-input-controller',
    start(ctx) {
      const input = ctx.adapters.require<InputAdapterApi>('input');
      const emitMarker = ctx.services.require<ProofActionService['emitMarker']>(
        'runtime-inspector:emit-marker',
      );
      const pause = ctx.services.require<ProofActionService['pause']>('runtime-inspector:pause');
      const resume = ctx.services.require<ProofActionService['resume']>('runtime-inspector:resume');

      cleanup = [
        input.bindKey({
          code: 'KeyM',
          handler(event) {
            const phase = ctx.state.getSnapshot().phase;

            if (phase !== 'ready' && phase !== 'paused') {
              return;
            }

            event.nativeEvent.preventDefault();
            emitMarker('keyboard');
          },
        }),
        input.bindKey({
          code: 'KeyP',
          handler(event) {
            if (ctx.state.getSnapshot().phase !== 'ready') {
              return;
            }

            event.nativeEvent.preventDefault();
            pause();
          },
        }),
        input.bindKey({
          code: 'KeyR',
          handler(event) {
            if (ctx.state.getSnapshot().phase !== 'paused') {
              return;
            }

            event.nativeEvent.preventDefault();
            resume();
          },
        }),
      ];

      ctx.events.emit({
        type: 'inspector:input-bound',
        source: 'inspector-input-controller',
        payload: {
          keys: ['KeyM', 'KeyP', 'KeyR'],
        },
        timestamp: Date.now(),
      });
    },
    dispose() {
      for (const unsubscribe of cleanup) {
        unsubscribe();
      }

      cleanup = [];
    },
  };
}

async function main(): Promise<void> {

  const elements = createLayout();
  const flowState: InspectorFlowState = {
    loadingElapsedMs: 0,
    loadingComplete: false,
    lastLoadingBucket: null,
    heartbeatElapsedMs: 0,
    heartbeatCount: 0,
    shutdownRequested: false,
  };

  const kernel = createKernel({
    id: 'urk-runtime-inspector-proof',
    adapters: [createLoadingAdapter(), createInputAdapter()],
    controllers: [
      createInspectorLoadingController(flowState),
      createInspectorInputController(),
    ],
  });

  const actions: ProofActionService = {
    emitMarker(trigger) {
      if (kernel.getInspector().getSnapshot().disposed) {
        return;
      }

      kernel.getEventBus().emit({
        type: 'inspector:marker',
        source: `runtime-inspector:${trigger}`,
        payload: {
          trigger,
          phase: kernel.getState().phase,
          frameCount: kernel.getInspector().getSnapshot().frameCount,
        },
        timestamp: Date.now(),
      });
    },
    pause() {
      if (kernel.getState().phase !== 'ready') {
        return;
      }

      kernel.pause('runtime-inspector:pause');
    },
    resume() {
      if (kernel.getState().phase !== 'paused') {
        return;
      }

      kernel.resume('runtime-inspector:resume');
    },
    shutdown() {
      if (flowState.shutdownRequested) {
        return;
      }

      flowState.shutdownRequested = true;
      syncControls(elements, kernel.getInspector().getSnapshot());

      void kernel.shutdown('runtime-inspector:shutdown').catch((error) => {
        window.console.error(error);
      });
    },
  };

  kernel.registerService('runtime-inspector:emit-marker', actions.emitMarker);
  kernel.registerService('runtime-inspector:pause', actions.pause);
  kernel.registerService('runtime-inspector:resume', actions.resume);
  kernel.registerService('runtime-inspector:shutdown', actions.shutdown);

  let inspectorSnapshot = kernel.getInspector().getSnapshot();
  let loadingSnapshot = createInitialLoadingSnapshot();

  renderProof(elements, inspectorSnapshot, loadingSnapshot);

  const unsubscribeInspector = kernel.getInspector().subscribe((next) => {
    inspectorSnapshot = next;
    renderProof(elements, inspectorSnapshot, loadingSnapshot);
  });

  const unsubscribeLoading = kernel.getEventBus().on('loading:changed', (event) => {
    loadingSnapshot = event.payload as LoadingSnapshot;
    renderProof(elements, inspectorSnapshot, loadingSnapshot);
  });

  elements.emitMarkerButton.addEventListener('click', () => {
    actions.emitMarker('button');
  });
  elements.pauseButton.addEventListener('click', () => {
    actions.pause();
  });
  elements.resumeButton.addEventListener('click', () => {
    actions.resume();
  });
  elements.shutdownButton.addEventListener('click', () => {
    actions.shutdown();
  });

  await kernel.boot();

  window.addEventListener(
    'beforeunload',
    () => {
      flowState.shutdownRequested = true;
      unsubscribeInspector();
      unsubscribeLoading();
      void kernel.shutdown('runtime-inspector:unload');
    },
    { once: true },
  );
}

void main().catch((error) => {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (app) {
    app.innerHTML = `<pre>${escapeHtml(
      error instanceof Error ? error.message : 'Failed to start runtime inspector proof.',
    )}</pre>`;
  }

  throw error;
});
