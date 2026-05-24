/**
 * Company: EonHive Inc.
 * Title: Event Routing Mount
 * Purpose: Mount the public URK example that proves visible runtime event routing.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import { createLoadingAdapter, type LoadingAdapterApi } from '@urk/adapters/dom';
import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type KernelEvent,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import { mountRuntimePanel, readRuntimePanelElements } from '../runtime-panel.js';
import type { ExampleMountOptions, ExampleMountResult } from '../types.js';

type EventDemoPayload = {
  message: string;
  observedType?: string;
  observedSource?: string;
  topic?: string;
  sequence?: number;
  phase?: string;
  reason?: string;
};

const STAGES = [
  { id: 'emit-started', label: 'Emit Started Event' },
  { id: 'targeted-listener', label: 'Route To Targeted Listener' },
  { id: 'debug-listener', label: 'Observe With onAny()' },
  { id: 'complete-route', label: 'Complete Event Route' },
] as const;

const MAX_DEBUG_OBSERVATIONS = 4;
const MAX_EVENTS = 28;

function emitSourceEvent(ctx: RuntimeContext, type: string, payload: EventDemoPayload): void {
  ctx.events.emit({
    type,
    source: 'event-source-controller',
    payload,
    timestamp: Date.now(),
  });
}

function emitListenerEvent(ctx: RuntimeContext, type: string, payload: EventDemoPayload): void {
  ctx.events.emit({
    type,
    source: 'event-listener-controller',
    payload,
    timestamp: Date.now(),
  });
}

function summarizeObservedEvent(event: KernelEvent): EventDemoPayload {
  return {
    message: `Observed ${event.type} from ${event.source}.`,
    observedType: event.type,
    observedSource: event.source,
  };
}

function createEventListenerController(): ControllerRegistration {
  let unsubscribeCheckpoint: (() => void) | null = null;
  let unsubscribeAny: (() => void) | null = null;
  let debugObservations = 0;

  return {
    id: 'event-listener-controller',
    start(ctx) {
      unsubscribeCheckpoint = ctx.events.on('event-demo:checkpoint', (event) => {
        emitListenerEvent(ctx, 'event-demo:checkpoint-observed', {
          ...summarizeObservedEvent(event),
          message: 'Targeted on() listener observed event-demo:checkpoint.',
        });
      });

      unsubscribeAny = ctx.events.onAny((event) => {
        if (!event.type.startsWith('event-demo:')) {
          return;
        }

        if (event.source === 'event-listener-controller') {
          return;
        }

        if (debugObservations >= MAX_DEBUG_OBSERVATIONS) {
          return;
        }

        debugObservations += 1;
        emitListenerEvent(ctx, 'event-demo:any-observed', {
          ...summarizeObservedEvent(event),
          message: 'Guarded onAny() debug listener observed a source-controller event.',
          sequence: debugObservations,
        });
      });

      emitListenerEvent(ctx, 'event-demo:listener-ready', {
        message: 'Listener controller subscribed with on() and guarded onAny().',
      });
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitListenerEvent(ctx, 'event-demo:listener-paused', {
          message: 'Listener controller observed pause without dropping subscriptions.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        emitListenerEvent(ctx, 'event-demo:listener-resumed', {
          message: 'Listener controller observed resume with subscriptions still active.',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      unsubscribeCheckpoint?.();
      unsubscribeAny?.();
      unsubscribeCheckpoint = null;
      unsubscribeAny = null;
      emitListenerEvent(ctx, 'event-demo:listener-disposed', {
        message: 'Listener controller unsubscribed from event routing.',
      });
    },
  };
}

function createEventSourceController(): ControllerRegistration {
  let elapsedMs = 0;
  let activeStageId: string | null = null;
  let completed = false;

  return {
    id: 'event-source-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      loading.begin([...STAGES], 'Routing controller events through the runtime event bus');
      emitSourceEvent(ctx, 'event-demo:started', {
        message: 'Source controller emitted the first event after listener setup.',
        topic: 'boot',
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
        if (activeStageId !== 'emit-started') {
          activeStageId = 'emit-started';
          loading.setStage('emit-started', 0.25, 'event-demo:started entered the event log');
        }

        return;
      }

      if (elapsedMs < 1250) {
        if (activeStageId !== 'targeted-listener') {
          activeStageId = 'targeted-listener';
          loading.setStage(
            'targeted-listener',
            0.52,
            'Emitting event-demo:checkpoint for the targeted listener',
          );
          emitSourceEvent(ctx, 'event-demo:checkpoint', {
            message: 'Source emitted a checkpoint for the targeted on() listener.',
            topic: 'targeted-listener',
            sequence: 1,
          });
        }

        return;
      }

      if (elapsedMs < 1850) {
        if (activeStageId !== 'debug-listener') {
          activeStageId = 'debug-listener';
          loading.setStage(
            'debug-listener',
            0.78,
            'Emitting a payload sample for guarded onAny() debug visibility',
          );
          emitSourceEvent(ctx, 'event-demo:payload-sample', {
            message: 'Source emitted a payload sample for debug observation.',
            topic: 'debug-listener',
            sequence: 2,
          });
        }

        return;
      }

      if (elapsedMs < 2350) {
        if (activeStageId !== 'complete-route') {
          activeStageId = 'complete-route';
          loading.setStage('complete-route', 0.92, 'Completing the event routing proof');
        }

        return;
      }

      emitSourceEvent(ctx, 'event-demo:completed', {
        message: 'Source completed the route through event emitters and listeners.',
        topic: 'complete-route',
        sequence: 3,
      });
      loading.complete('Event routing proof ready: emit, on(), and guarded onAny() are visible');
      ctx.state.setPhase('ready', 'event-routing:ready');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitSourceEvent(ctx, 'event-demo:source-paused', {
          message: 'Source controller observed pause through runtime state.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        emitSourceEvent(ctx, 'event-demo:source-resumed', {
          message: 'Source controller observed resume through runtime state.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (next.phase === 'error') {
        emitSourceEvent(ctx, 'event-demo:source-error', {
          message: next.reason ?? 'Runtime error',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      emitSourceEvent(ctx, 'event-demo:source-disposed', {
        message: 'Source controller disposed after event routing proof.',
        phase: ctx.state.getSnapshot().phase,
        reason: ctx.state.getSnapshot().reason,
      });
    },
  };
}

function createKernelInstance() {
  return createKernel({
    id: 'urk-www-event-routing',
    adapters: [createLoadingAdapter()],
    controllers: [createEventListenerController(), createEventSourceController()],
  });
}

export async function mountEventRoutingExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'event routing');
  const kernel = createKernelInstance();

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'event routing',
    pauseReason: 'event-routing:pause',
    resumeReason: 'event-routing:resume',
    shutdownReason: 'event-routing:shutdown',
    teardownReason: 'event-routing:teardown',
    mountFailureMessage: 'The event routing example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the event routing example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
  });
}
