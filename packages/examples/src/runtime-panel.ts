/**
 * Company: EonHive Inc.
 * Title: Runtime Panel Helper
 * Purpose: Share private website runtime-panel wiring across internal URK examples.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-14
 * Notes: Vibe coded with Codex.
 */

import type { LoadingAdapterApi, LoadingSnapshot } from '@urk/adapters/dom';
import type {
  Kernel,
  RuntimeInspectorSnapshot,
  RuntimeSnapshot,
} from '@urk/core';
import type { ExampleMountResult } from './types.js';

export type RuntimePanelElements = {
  error: HTMLElement;
  phase: HTMLElement;
  stage: HTMLElement;
  frame: HTMLElement;
  latestEvent: HTMLElement;
  scheduler: HTMLElement;
  previewSurface: HTMLElement;
  previewPhase: HTMLElement;
  previewReason: HTMLElement;
  previewMessage: HTMLElement;
  previewTrackFill: HTMLElement;
  progressValue: HTMLElement;
  previewProgressLabel: HTMLElement;
  booted: HTMLElement;
  runtimeId: HTMLElement;
  runtimeReason: HTMLElement;
  runtimeUpdatedAt: HTMLElement;
  totalEvents: HTMLElement;
  controllers: HTMLElement;
  adapters: HTMLElement;
  services: HTMLElement;
  adapterList: HTMLUListElement;
  controllerList: HTMLUListElement;
  serviceList: HTMLUListElement;
  eventList: HTMLOListElement;
  pauseButton: HTMLButtonElement;
  resumeButton: HTMLButtonElement;
  shutdownButton: HTMLButtonElement;
};

export interface RuntimePanelMountConfig {
  elements: RuntimePanelElements;
  kernel: Kernel;
  exampleLabel: string;
  pauseReason: string;
  resumeReason: string;
  shutdownReason: string;
  teardownReason: string;
  mountFailureMessage: string;
  previewFailureMessage: string;
  recentEventLimit?: number;
  onTeardown?: () => Promise<void> | void;
}

const DEFAULT_RECENT_EVENT_LIMIT = 8;

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

function assertElement<T extends Element>(
  host: ParentNode,
  selector: string,
  exampleLabel: string,
): T {
  const element = host.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing ${exampleLabel} element: ${selector}`);
  }

  return element;
}

function resolvePreviewSurface(
  previewMessage: HTMLElement,
  exampleLabel: string,
): HTMLElement {
  const surface = previewMessage.parentElement;

  if (!surface) {
    throw new Error(`Missing ${exampleLabel} preview surface.`);
  }

  return surface;
}

export function readRuntimePanelElements(
  host: HTMLElement,
  exampleLabel: string,
): RuntimePanelElements {
  const previewMessage = assertElement<HTMLElement>(
    host,
    '[data-role="preview-message"]',
    exampleLabel,
  );

  return {
    error: assertElement<HTMLElement>(host, '[data-role="example-error"]', exampleLabel),
    phase: assertElement<HTMLElement>(host, '[data-role="runtime-phase"]', exampleLabel),
    stage: assertElement<HTMLElement>(host, '[data-role="runtime-stage"]', exampleLabel),
    frame: assertElement<HTMLElement>(host, '[data-role="runtime-frame"]', exampleLabel),
    latestEvent: assertElement<HTMLElement>(
      host,
      '[data-role="runtime-latest-event"]',
      exampleLabel,
    ),
    scheduler: assertElement<HTMLElement>(host, '[data-role="runtime-scheduler"]', exampleLabel),
    previewSurface: resolvePreviewSurface(previewMessage, exampleLabel),
    previewPhase: assertElement<HTMLElement>(host, '[data-role="preview-phase"]', exampleLabel),
    previewReason: assertElement<HTMLElement>(host, '[data-role="preview-reason"]', exampleLabel),
    previewMessage,
    previewTrackFill: assertElement<HTMLElement>(
      host,
      '[data-role="preview-progress-fill"]',
      exampleLabel,
    ),
    progressValue: assertElement<HTMLElement>(host, '[data-role="runtime-progress"]', exampleLabel),
    previewProgressLabel: assertElement<HTMLElement>(
      host,
      '[data-role="preview-progress-label"]',
      exampleLabel,
    ),
    booted: assertElement<HTMLElement>(host, '[data-role="runtime-booted"]', exampleLabel),
    runtimeId: assertElement<HTMLElement>(host, '[data-role="runtime-id"]', exampleLabel),
    runtimeReason: assertElement<HTMLElement>(host, '[data-role="runtime-reason"]', exampleLabel),
    runtimeUpdatedAt: assertElement<HTMLElement>(
      host,
      '[data-role="runtime-updated-at"]',
      exampleLabel,
    ),
    totalEvents: assertElement<HTMLElement>(
      host,
      '[data-role="runtime-total-events"]',
      exampleLabel,
    ),
    controllers: assertElement<HTMLElement>(
      host,
      '[data-role="runtime-controllers"]',
      exampleLabel,
    ),
    adapters: assertElement<HTMLElement>(host, '[data-role="runtime-adapters"]', exampleLabel),
    services: assertElement<HTMLElement>(host, '[data-role="runtime-services"]', exampleLabel),
    adapterList: assertElement<HTMLUListElement>(
      host,
      '[data-role="runtime-adapter-list"]',
      exampleLabel,
    ),
    controllerList: assertElement<HTMLUListElement>(
      host,
      '[data-role="runtime-controller-list"]',
      exampleLabel,
    ),
    serviceList: assertElement<HTMLUListElement>(
      host,
      '[data-role="runtime-service-list"]',
      exampleLabel,
    ),
    eventList: assertElement<HTMLOListElement>(
      host,
      '[data-role="runtime-event-list"]',
      exampleLabel,
    ),
    pauseButton: assertElement<HTMLButtonElement>(host, '[data-role="pause-button"]', exampleLabel),
    resumeButton: assertElement<HTMLButtonElement>(
      host,
      '[data-role="resume-button"]',
      exampleLabel,
    ),
    shutdownButton: assertElement<HTMLButtonElement>(
      host,
      '[data-role="shutdown-button"]',
      exampleLabel,
    ),
  };
}

function summarizePayload(payload: unknown): string {
  if (payload === undefined) {
    return 'none';
  }

  if (payload === null) {
    return 'null';
  }

  if (typeof payload === 'string') {
    return payload.length > 56 ? `${payload.slice(0, 53)}...` : payload;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean' || typeof payload === 'bigint') {
    return String(payload);
  }

  if (Array.isArray(payload)) {
    return `Array(${payload.length})`;
  }

  if (typeof payload === 'object') {
    const entries = Object.entries(payload as Record<string, unknown>);
    const preview = entries
      .slice(0, 2)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : String(value)}`)
      .join(', ');

    return `{ ${preview}${entries.length > 2 ? ', ...' : ''} }`;
  }

  return typeof payload;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function syncLoading(elements: RuntimePanelElements, snapshot: LoadingSnapshot): void {
  const progressPercent = Math.round(snapshot.progress * 100);

  elements.stage.textContent = snapshot.stageLabel ?? 'Waiting';
  elements.progressValue.textContent = `${progressPercent}%`;
  elements.previewProgressLabel.textContent = `${progressPercent}%`;
  elements.previewTrackFill.style.width = `${progressPercent}%`;
  elements.previewTrackFill.setAttribute('aria-valuenow', String(progressPercent));
  elements.previewTrackFill.setAttribute('aria-valuetext', `${progressPercent}%`);
  elements.previewMessage.textContent = snapshot.message;
}

function renderEntityList(
  list: HTMLUListElement,
  items: string[],
  emptyLabel: string,
): void {
  if (items.length === 0) {
    list.innerHTML = `<li class="runtime-entity-list__empty">${emptyLabel}</li>`;
    return;
  }

  list.innerHTML = items
    .map((item) => `<li class="runtime-entity-pill">${escapeHtml(item)}</li>`)
    .join('');
}

function syncInspector(
  elements: RuntimePanelElements,
  snapshot: RuntimeInspectorSnapshot,
  recentEventLimit: number,
): void {
  const recentEvents = [...snapshot.recentEvents].slice(-recentEventLimit).reverse();
  const latestEvent = recentEvents[0]?.type ?? 'kernel:init';

  elements.phase.textContent = snapshot.runtime.phase;
  elements.frame.textContent = String(snapshot.frameCount);
  elements.latestEvent.textContent = latestEvent;
  elements.scheduler.textContent = snapshot.schedulerRunning ? 'Running' : 'Stopped';
  elements.previewPhase.textContent = snapshot.runtime.phase;
  elements.previewReason.textContent = snapshot.runtime.reason ?? 'kernel:init';
  elements.booted.textContent = snapshot.booted ? 'Yes' : 'No';
  elements.runtimeId.textContent = snapshot.runtimeId;
  elements.runtimeReason.textContent = snapshot.runtime.reason ?? 'kernel:init';
  elements.runtimeUpdatedAt.textContent = formatTime(snapshot.updatedAt);
  elements.totalEvents.textContent = String(snapshot.totalEvents);
  elements.controllers.textContent = String(snapshot.controllers.length);
  elements.adapters.textContent = String(snapshot.adapters.length);
  elements.services.textContent = String(snapshot.services.length);
  renderEntityList(
    elements.adapterList,
    snapshot.adapters.map((adapter) => `${adapter.capability}:${adapter.id}`),
    'No adapters registered.',
  );
  renderEntityList(
    elements.controllerList,
    snapshot.controllers.map((controller) => {
      if (controller.started) {
        return `${controller.id}:started`;
      }

      if (controller.initialized) {
        return `${controller.id}:init`;
      }

      return `${controller.id}:idle`;
    }),
    'No controllers registered.',
  );
  renderEntityList(
    elements.serviceList,
    snapshot.services.map((service) => `${service.name}:${service.kind}`),
    'No services registered.',
  );

  elements.eventList.innerHTML = recentEvents
    .map((event) => {
      return `
        <li class="runtime-log-item">
          <div class="runtime-log-item__meta">
            <span>${formatTime(event.timestamp)}</span>
            <span>${escapeHtml(event.source)}</span>
          </div>
          <strong>${escapeHtml(event.type)}</strong>
          <span>${escapeHtml(summarizePayload(event.payload))}</span>
        </li>
      `;
    })
    .join('');
}

function syncControls(
  elements: RuntimePanelElements,
  runtimeSnapshot: RuntimeSnapshot,
  disposed: boolean,
): void {
  elements.pauseButton.disabled = disposed || runtimeSnapshot.phase !== 'ready';
  elements.resumeButton.disabled = disposed || runtimeSnapshot.phase !== 'paused';
  elements.shutdownButton.disabled = disposed;
}

export async function mountRuntimePanel(
  config: RuntimePanelMountConfig,
): Promise<ExampleMountResult> {
  const recentEventLimit = config.recentEventLimit ?? DEFAULT_RECENT_EVENT_LIMIT;
  const kernel = config.kernel;
  const elements = config.elements;
  const loading = createEmptyLoadingSnapshot();
  let currentLoading = loading;
  let currentInspector = kernel.getInspector().getSnapshot();
  let disposed = false;
  let cleanedUp = false;

  const cleanup = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    await config.onTeardown?.();
  };

  const render = (): void => {
    syncLoading(elements, currentLoading);
    syncInspector(elements, currentInspector, recentEventLimit);
    syncControls(elements, currentInspector.runtime, disposed || currentInspector.disposed);
  };

  const loadingApi = (): LoadingAdapterApi => {
    return kernel.getContext().adapters.require<LoadingAdapterApi>('loading');
  };

  const handlePause = (): void => {
    kernel.pause(config.pauseReason);
  };

  const handleResume = (): void => {
    kernel.resume(config.resumeReason);
  };

  const handleShutdown = async (): Promise<void> => {
    if (disposed) {
      return;
    }

    disposed = true;
    await kernel.shutdown(config.shutdownReason);
    currentInspector = kernel.getInspector().getSnapshot();
    render();
  };

  const handleShutdownClick = (): void => {
    void handleShutdown();
  };

  const unsubscribeInspector = kernel.getInspector().subscribe((snapshot) => {
    currentInspector = snapshot;
    render();
  });

  const unsubscribePhase = kernel.getContext().state.subscribe((next) => {
    elements.previewPhase.textContent = next.phase;
  });

  elements.pauseButton.addEventListener('click', handlePause);
  elements.resumeButton.addEventListener('click', handleResume);
  elements.shutdownButton.addEventListener('click', handleShutdownClick);

  elements.error.hidden = true;

  try {
    await kernel.boot();
    currentLoading = loadingApi().getSnapshot();
    const unsubscribeLoading = loadingApi().subscribe((snapshot) => {
      currentLoading = snapshot;
      render();
    });

    currentInspector = kernel.getInspector().getSnapshot();
    render();

    return {
      async teardown() {
        unsubscribeLoading();
        unsubscribeInspector();
        unsubscribePhase();
        elements.pauseButton.removeEventListener('click', handlePause);
        elements.resumeButton.removeEventListener('click', handleResume);
        elements.shutdownButton.removeEventListener('click', handleShutdownClick);

        if (!disposed) {
          disposed = true;
          await kernel.shutdown(config.teardownReason);
        }

        await cleanup();
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : config.mountFailureMessage;

    elements.error.hidden = false;
    elements.error.textContent = message;
    elements.previewPhase.textContent = 'error';
    elements.previewReason.textContent = 'mount:failed';
    elements.previewMessage.textContent = config.previewFailureMessage;
    elements.pauseButton.disabled = true;
    elements.resumeButton.disabled = true;
    elements.shutdownButton.disabled = true;

    return {
      async teardown() {
        unsubscribeInspector();
        unsubscribePhase();
        elements.pauseButton.removeEventListener('click', handlePause);
        elements.resumeButton.removeEventListener('click', handleResume);
        elements.shutdownButton.removeEventListener('click', handleShutdownClick);
        await cleanup();
      },
    };
  }
}
