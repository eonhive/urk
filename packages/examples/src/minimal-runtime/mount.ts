/**
 * Company: EonHive Inc.
 * Title: Minimal Runtime Mount
 * Purpose: Mount the first public URK runtime proof into the website without depending on any framework wrapper.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
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

type MinimalRuntimeActionPayload = {
  message: string;
};

const STAGES = [
  { id: 'create-context', label: 'Create Runtime Context' },
  { id: 'register-adapters', label: 'Register Adapter Capabilities' },
  { id: 'mount-preview', label: 'Mount Browser Surface' },
] as const;

const HEARTBEAT_INTERVAL_MS = 1100;
const MAX_EVENTS = 8;

function emitAction(ctx: RuntimeContext, message: string): void {
  ctx.events.emit({
    type: 'minimal-runtime:action',
    source: 'minimal-runtime-controller',
    payload: { message } satisfies MinimalRuntimeActionPayload,
    timestamp: Date.now(),
  });
}

function emitHeartbeat(ctx: RuntimeContext, count: number): void {
  ctx.events.emit({
    type: 'minimal-runtime:heartbeat',
    source: 'minimal-runtime-controller',
    payload: { count },
    timestamp: Date.now(),
  });
}

function createMinimalRuntimeController(): ControllerRegistration {
  let elapsedMs = 0;
  let heartbeatMs = 0;
  let heartbeatCount = 0;
  let completed = false;

  return {
    id: 'minimal-runtime-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      loading.begin([...STAGES], 'Booting the URK runtime kernel');
      emitAction(ctx, 'Started the minimal runtime boot sequence');
    },
    update(frame: FrameInfo, ctx) {
      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;

      if (completed) {
        if (ctx.state.getSnapshot().phase === 'ready') {
          heartbeatMs += deltaMs;

          if (heartbeatMs >= HEARTBEAT_INTERVAL_MS) {
            heartbeatMs = 0;
            heartbeatCount += 1;
            emitHeartbeat(ctx, heartbeatCount);
          }
        }

        return;
      }

      elapsedMs += deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      if (elapsedMs < 650) {
        loading.setStage(
          'create-context',
          elapsedMs / 650,
          'Creating the runtime context and scheduling loop',
        );
        return;
      }

      if (elapsedMs < 1450) {
        loading.setStage(
          'register-adapters',
          (elapsedMs - 650) / 800,
          'Registering the loading capability and explicit runtime listeners',
        );
        return;
      }

      if (elapsedMs < 2350) {
        loading.setStage(
          'mount-preview',
          (elapsedMs - 1450) / 900,
          'Mounting the browser-facing preview panel and event telemetry',
        );
        return;
      }

      loading.complete('Minimal runtime ready');
      ctx.state.setPhase('ready', 'minimal-runtime:ready');
      emitAction(ctx, 'Minimal runtime reached the ready phase');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitAction(ctx, 'Runtime paused by the preview controls');
      }

      if (next.phase === 'ready' && previous.phase === 'paused') {
        emitAction(ctx, 'Runtime resumed and returned to ready');
      }

      if (next.phase === 'error') {
        emitAction(ctx, next.reason ?? 'Runtime error');
      }
    },
    dispose(ctx) {
      emitAction(ctx, 'Minimal runtime disposed');
    },
  };
}

function createKernelInstance() {
  return createKernel({
    id: 'urk-www-minimal-runtime',
    adapters: [createLoadingAdapter()],
    controllers: [createMinimalRuntimeController()],
  });
}

export async function mountMinimalRuntimeExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'minimal runtime');
  const kernel = createKernelInstance();

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'minimal runtime',
    pauseReason: 'minimal-runtime:pause',
    resumeReason: 'minimal-runtime:resume',
    shutdownReason: 'minimal-runtime:shutdown',
    teardownReason: 'minimal-runtime:teardown',
    mountFailureMessage: 'The minimal runtime example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the runtime example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
  });
}
