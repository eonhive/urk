/**
 * Company: EonHive Inc.
 * Title: Runtime State Mount
 * Purpose: Mount the public URK example that proves explicit runtime phase state.
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
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import { mountRuntimePanel, readRuntimePanelElements } from '../runtime-panel.js';
import type { ExampleMountOptions, ExampleMountResult } from '../types.js';

type RuntimeStateDemoEventPayload = {
  message: string;
  phase?: string;
  previousPhase?: string;
  reason?: string;
  previousReason?: string;
};

const STAGES = [
  { id: 'read-snapshot', label: 'Read Runtime Snapshot' },
  { id: 'enter-transition', label: 'Enter Transition Phase' },
  { id: 'verify-reason', label: 'Verify Transition Reason' },
  { id: 'set-ready', label: 'Set Runtime Ready' },
] as const;

const MAX_EVENTS = 18;

function emitStateEvent(
  ctx: RuntimeContext,
  type: string,
  payload: RuntimeStateDemoEventPayload,
): void {
  ctx.events.emit({
    type,
    source: 'state-demo-controller',
    payload,
    timestamp: Date.now(),
  });
}

function emitSnapshotRead(ctx: RuntimeContext, message: string): void {
  const snapshot = ctx.state.getSnapshot();

  emitStateEvent(ctx, 'runtime-state:snapshot-read', {
    message,
    phase: snapshot.phase,
    reason: snapshot.reason,
  });
}

function createStateDemoController(): ControllerRegistration {
  let elapsedMs = 0;
  let activeStageId: string | null = null;
  let completed = false;

  return {
    id: 'state-demo-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      loading.begin([...STAGES], 'Reading the explicit runtime state snapshot');
      emitSnapshotRead(ctx, 'Controller read the kernel boot snapshot before changing state.');
    },
    update(frame: FrameInfo, ctx) {
      if (completed) {
        return;
      }

      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      elapsedMs += deltaMs;

      if (elapsedMs < 650) {
        if (activeStageId !== 'read-snapshot') {
          activeStageId = 'read-snapshot';
          loading.setStage(
            'read-snapshot',
            0.25,
            'Snapshot read shows phase and reason, not product data',
          );
        }

        return;
      }

      if (elapsedMs < 1250) {
        if (activeStageId !== 'enter-transition') {
          activeStageId = 'enter-transition';
          loading.setStage(
            'enter-transition',
            0.5,
            'Setting an explicit transition phase with a readable reason',
          );
          ctx.state.setPhase('transition', 'runtime-state:transition');
          emitStateEvent(ctx, 'runtime-state:transition-requested', {
            message: 'Controller requested the transition phase explicitly.',
            phase: 'transition',
            reason: 'runtime-state:transition',
          });
        }

        return;
      }

      if (elapsedMs < 1850) {
        if (activeStageId !== 'verify-reason') {
          activeStageId = 'verify-reason';
          loading.setStage(
            'verify-reason',
            0.76,
            'Reading the transition snapshot and reason back from the runtime store',
          );
          emitSnapshotRead(ctx, 'Controller read the transition snapshot back from the store.');
        }

        return;
      }

      if (elapsedMs < 2350) {
        if (activeStageId !== 'set-ready') {
          activeStageId = 'set-ready';
          loading.setStage('set-ready', 0.92, 'Finishing the state proof by entering ready');
        }

        return;
      }

      loading.complete('Runtime state proof ready: snapshots and transition reasons are visible');
      ctx.state.setPhase('ready', 'runtime-state:ready');
      emitStateEvent(ctx, 'runtime-state:ready', {
        message: 'Runtime moved to ready after explicit state transitions.',
        phase: 'ready',
        reason: 'runtime-state:ready',
      });
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      emitStateEvent(ctx, 'runtime-state:state-change-observed', {
        message: `${previous.phase} -> ${next.phase}`,
        phase: next.phase,
        previousPhase: previous.phase,
        reason: next.reason,
        previousReason: previous.reason,
      });

      if (next.phase === 'paused') {
        emitStateEvent(ctx, 'runtime-state:paused', {
          message: 'Runtime paused through preview controls; the reason stays visible.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (previous.phase === 'paused' && next.phase !== 'paused') {
        emitStateEvent(ctx, 'runtime-state:resumed', {
          message: 'Runtime resumed and returned to its prior phase.',
          phase: next.phase,
          reason: next.reason,
        });
      }

      if (next.phase === 'error') {
        emitStateEvent(ctx, 'runtime-state:error', {
          message: next.reason ?? 'Runtime error',
          phase: next.phase,
          reason: next.reason,
        });
      }
    },
    dispose(ctx) {
      emitStateEvent(ctx, 'runtime-state:disposed', {
        message: 'Runtime state example disposed cleanly.',
        phase: ctx.state.getSnapshot().phase,
        reason: ctx.state.getSnapshot().reason,
      });
    },
  };
}

function createKernelInstance() {
  return createKernel({
    id: 'urk-www-runtime-state',
    adapters: [createLoadingAdapter()],
    controllers: [createStateDemoController()],
  });
}

export async function mountRuntimeStateExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'runtime state');
  const kernel = createKernelInstance();

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'runtime state',
    pauseReason: 'runtime-state:pause',
    resumeReason: 'runtime-state:resume',
    shutdownReason: 'runtime-state:shutdown',
    teardownReason: 'runtime-state:teardown',
    mountFailureMessage: 'The runtime state example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the runtime state example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
  });
}
