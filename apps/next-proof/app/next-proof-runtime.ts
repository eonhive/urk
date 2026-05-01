/**
 * Company: EonHive Inc.
 * Title: URK Next Proof Runtime
 * Purpose: Define the local kernel factory, staged loading flow, and controller events for the Next proof.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type Kernel,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import { createLoadingAdapter, type LoadingAdapterApi, type LoadingSnapshot } from '@urk/adapters/dom';

export type ProofActionPayload = {
  message: string;
};

const STAGES = [
  { id: 'bootstrap-next', label: 'Bootstrap Next' },
  { id: 'bind-client', label: 'Bind Client Boundary' },
  { id: 'activate-next', label: 'Activate Next Proof' },
] as const;
const HEARTBEAT_INTERVAL_MS = 1200;

export function createEmptyLoadingSnapshot(): LoadingSnapshot {
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

function emitAction(ctx: RuntimeContext, message: string): void {
  ctx.events.emit({
    type: 'next-proof:action',
    source: 'next-proof-controller',
    payload: { message } satisfies ProofActionPayload,
    timestamp: Date.now(),
  });
}

function emitHeartbeat(ctx: RuntimeContext, count: number): void {
  ctx.events.emit({
    type: 'next-proof:heartbeat',
    source: 'next-proof-controller',
    payload: { count },
    timestamp: Date.now(),
  });
}

function createNextProofController(): ControllerRegistration {
  let elapsedMs = 0;
  let heartbeatElapsedMs = 0;
  let heartbeatCount = 0;
  let completed = false;

  return {
    id: 'next-proof-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      loading.begin([...STAGES], 'Initializing the Next App Router proof');
      emitAction(ctx, 'Started staged Next proof loading');
    },
    update(frame: FrameInfo, ctx) {
      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;

      if (completed) {
        if (ctx.state.getSnapshot().phase === 'ready') {
          heartbeatElapsedMs += deltaMs;

          if (heartbeatElapsedMs >= HEARTBEAT_INTERVAL_MS) {
            heartbeatElapsedMs = 0;
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
          'bootstrap-next',
          elapsedMs / 650,
          'Creating the client-only proof shell and staged loading metrics',
        );
        return;
      }

      if (elapsedMs < 1450) {
        loading.setStage(
          'bind-client',
          (elapsedMs - 650) / 800,
          'Binding runtime snapshots and kernel events into the Next client boundary',
        );
        return;
      }

      if (elapsedMs < 2350) {
        loading.setStage(
          'activate-next',
          (elapsedMs - 1450) / 900,
          'Activating pause, resume, and shutdown controls for the App Router proof',
        );
        return;
      }

      loading.complete('Next proof ready');
      ctx.state.setPhase('ready', 'next-proof:ready');
      emitAction(ctx, 'Next proof reached ready state');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitAction(ctx, 'Next proof paused');
      }

      if (next.phase === 'ready' && previous.phase === 'paused') {
        emitAction(ctx, 'Next proof resumed');
      }

      if (next.phase === 'error') {
        emitAction(ctx, next.reason ?? 'Next proof runtime error');
      }
    },
    dispose(ctx) {
      emitAction(ctx, 'Next proof disposed');
    },
  };
}

export function createNextProofKernel(): Kernel {
  return createKernel({
    id: 'urk-next-proof',
    adapters: [createLoadingAdapter()],
    controllers: [createNextProofController()],
  });
}
