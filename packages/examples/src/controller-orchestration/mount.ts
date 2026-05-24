/**
 * Company: EonHive Inc.
 * Title: Controller Orchestration Mount
 * Purpose: Mount the public URK example that proves controller lifecycle ordering and coordination.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import {
  createLoadingAdapter,
  createUiWidgetsAdapter,
  type LoadingAdapterApi,
  type UiWidgetsAdapterApi,
} from '@urk/adapters/dom';
import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type KernelEvent,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import {
  mountRuntimePanel,
  readRuntimePanelElements,
  type RuntimePanelElements,
} from '../runtime-panel.js';
import type { ExampleMountOptions, ExampleMountResult } from '../types.js';

type ControllerDemoEventPayload = {
  message: string;
  observer?: string;
};

const STAGES = [
  { id: 'init-controllers', label: 'Initialize Controllers' },
  { id: 'start-primary', label: 'Start Primary Flow' },
  { id: 'coordinate-telemetry', label: 'Coordinate Telemetry Controller' },
  { id: 'set-ready', label: 'Set Runtime Ready' },
] as const;

const MAX_EVENTS = 24;

function emitDemoEvent(
  ctx: RuntimeContext,
  type: string,
  source: string,
  payload: ControllerDemoEventPayload,
): void {
  ctx.events.emit({
    type,
    source,
    payload,
    timestamp: Date.now(),
  });
}

function getWidgets(ctx: RuntimeContext): UiWidgetsAdapterApi {
  return ctx.adapters.require<UiWidgetsAdapterApi>('ui-widgets');
}

function createPrimaryController(): ControllerRegistration {
  let elapsedMs = 0;
  let activeStageId: string | null = null;
  let completed = false;

  return {
    id: 'primary-controller',
    init(ctx) {
      emitDemoEvent(ctx, 'controller-demo:primary-init', 'primary-controller', {
        message: 'Primary controller initialized before runtime start.',
      });
    },
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const widgets = getWidgets(ctx);

      loading.begin([...STAGES], 'Primary controller is starting orchestration');
      widgets.setStatus('Primary controller starting');
      widgets.showCallout({
        title: 'Primary controller',
        body: 'init() and start() ran before the ready transition.',
        tone: 'active',
      });
      emitDemoEvent(ctx, 'controller-demo:primary-start', 'primary-controller', {
        message: 'Primary controller started loading and UI widget coordination.',
      });
    },
    update(frame: FrameInfo, ctx) {
      if (completed) {
        return;
      }

      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      elapsedMs += deltaMs;

      if (elapsedMs < 600) {
        if (activeStageId !== 'init-controllers') {
          activeStageId = 'init-controllers';
          loading.setStage(
            'init-controllers',
            0.3,
            'Both controllers are initialized before start hooks finish',
          );
        }

        return;
      }

      if (elapsedMs < 1150) {
        if (activeStageId !== 'start-primary') {
          activeStageId = 'start-primary';
          loading.setStage(
            'start-primary',
            0.55,
            'Primary controller owns the loading flow',
          );
        }

        return;
      }

      if (elapsedMs < 1700) {
        if (activeStageId !== 'coordinate-telemetry') {
          activeStageId = 'coordinate-telemetry';
          loading.setStage(
            'coordinate-telemetry',
            0.78,
            'Primary will emit a coordination event for telemetry',
          );
        }

        return;
      }

      if (elapsedMs < 2200) {
        if (activeStageId !== 'set-ready') {
          activeStageId = 'set-ready';
          loading.setStage(
            'set-ready',
            0.9,
            'Runtime state will move to ready after coordination',
          );
        }

        return;
      }

      loading.complete('Controller orchestration ready: primary and telemetry coordinated');
      getWidgets(ctx).setStatus('Controllers ready');
      emitDemoEvent(ctx, 'controller-demo:primary-ready', 'primary-controller', {
        message: 'Primary controller reached ready and notified telemetry.',
      });
      ctx.state.setPhase('ready', 'controller-orchestration:ready');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        getWidgets(ctx).showCallout({
          title: 'Runtime paused',
          body: 'Primary controller observed the paused state.',
          tone: 'neutral',
        });
        emitDemoEvent(ctx, 'controller-demo:primary-paused', 'primary-controller', {
          message: 'Primary controller observed pause.',
        });
      }

      if (next.phase === 'ready' && previous.phase === 'paused') {
        getWidgets(ctx).setStatus('Controllers resumed');
        emitDemoEvent(ctx, 'controller-demo:primary-resumed', 'primary-controller', {
          message: 'Primary controller observed resume.',
        });
      }

      if (next.phase === 'error') {
        getWidgets(ctx).showCallout({
          title: 'Runtime error',
          body: next.reason ?? 'Unknown controller orchestration error.',
          tone: 'neutral',
        });
        emitDemoEvent(ctx, 'controller-demo:primary-error', 'primary-controller', {
          message: next.reason ?? 'Runtime error',
        });
      }
    },
    dispose(ctx) {
      emitDemoEvent(ctx, 'controller-demo:primary-dispose', 'primary-controller', {
        message: 'Primary controller disposed after orchestration.',
      });
    },
  };
}

function createTelemetryController(): ControllerRegistration {
  let unsubscribePrimaryReady: (() => void) | null = null;

  return {
    id: 'telemetry-controller',
    init(ctx) {
      emitDemoEvent(ctx, 'controller-demo:telemetry-init', 'telemetry-controller', {
        message: 'Telemetry controller initialized and will observe primary readiness.',
      });
    },
    start(ctx) {
      unsubscribePrimaryReady = ctx.events.on(
        'controller-demo:primary-ready',
        (_event: KernelEvent) => {
          const widgets = ctx.adapters.get<UiWidgetsAdapterApi>('ui-widgets');

          widgets?.showCallout({
            title: 'Telemetry observed readiness',
            body: 'The telemetry controller reacted to controller-demo:primary-ready.',
            tone: 'selected',
          });
          emitDemoEvent(
            ctx,
            'controller-demo:telemetry-observed-primary',
            'telemetry-controller',
            {
              message: 'Telemetry observed the primary-ready coordination event.',
              observer: 'telemetry-controller',
            },
          );
        },
      );

      emitDemoEvent(ctx, 'controller-demo:telemetry-start', 'telemetry-controller', {
        message: 'Telemetry controller subscribed to primary readiness.',
      });
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitDemoEvent(ctx, 'controller-demo:telemetry-paused', 'telemetry-controller', {
          message: 'Telemetry controller observed pause.',
        });
      }

      if (next.phase === 'ready' && previous.phase === 'paused') {
        emitDemoEvent(ctx, 'controller-demo:telemetry-resumed', 'telemetry-controller', {
          message: 'Telemetry controller observed resume.',
        });
      }
    },
    dispose(ctx) {
      unsubscribePrimaryReady?.();
      unsubscribePrimaryReady = null;
      emitDemoEvent(ctx, 'controller-demo:telemetry-dispose', 'telemetry-controller', {
        message: 'Telemetry controller unsubscribed and disposed.',
      });
    },
  };
}

function preparePreviewHost(elements: RuntimePanelElements): () => void {
  const previousPosition = elements.previewSurface.style.position;
  const previousOverflow = elements.previewSurface.style.overflow;

  if (!previousPosition) {
    elements.previewSurface.style.position = 'relative';
  }

  elements.previewSurface.style.overflow = 'hidden';

  return () => {
    elements.previewSurface.style.position = previousPosition;
    elements.previewSurface.style.overflow = previousOverflow;
  };
}

function createKernelInstance(uiHost: HTMLElement) {
  return createKernel({
    id: 'urk-www-controller-orchestration',
    services: { 'ui:host': uiHost },
    adapters: [createLoadingAdapter(), createUiWidgetsAdapter()],
    controllers: [createPrimaryController(), createTelemetryController()],
  });
}

export async function mountControllerOrchestrationExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'controller orchestration');
  const restorePreviewHost = preparePreviewHost(elements);
  const kernel = createKernelInstance(elements.previewSurface);

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'controller orchestration',
    pauseReason: 'controller-orchestration:pause',
    resumeReason: 'controller-orchestration:resume',
    shutdownReason: 'controller-orchestration:shutdown',
    teardownReason: 'controller-orchestration:teardown',
    mountFailureMessage: 'The controller orchestration example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the controller orchestration example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
    onTeardown: restorePreviewHost,
  });
}
