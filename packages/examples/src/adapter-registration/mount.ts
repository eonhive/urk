/**
 * Company: EonHive Inc.
 * Title: Adapter Registration Mount
 * Purpose: Mount the public URK example that proves adapter registration and capability lookup.
 * Author: Stan Nesi
 * Created: 2026-05-07
 * Updated: 2026-05-07
 * Notes: Vibe coded with Codex.
 */

import {
  createLoadingAdapter,
  createStorageAdapter,
  type LoadingAdapterApi,
  type StorageAdapterApi,
} from '@urk/adapters/dom';
import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import { mountRuntimePanel, readRuntimePanelElements } from '../runtime-panel.js';
import type { ExampleMountOptions, ExampleMountResult } from '../types.js';

type AdapterProofRecord = {
  checkedAt: string;
  requiredCapabilities: string[];
  optionalCapability: string;
  optionalAvailable: boolean;
};

type AdapterDemoEventPayload = {
  message: string;
  capabilities?: string[];
  key?: string;
  found?: boolean;
};

const STAGES = [
  { id: 'required-lookup', label: 'Resolve Required Capabilities' },
  { id: 'optional-lookup', label: 'Handle Optional Capability Miss' },
  { id: 'storage-roundtrip', label: 'Write And Read Storage' },
] as const;

const STORAGE_NAMESPACE = 'urk-adapter-registration';
const STORAGE_KEY = 'capability-proof';
const MAX_EVENTS = 12;

function emitDemoEvent(
  ctx: RuntimeContext,
  type: string,
  payload: AdapterDemoEventPayload,
): void {
  ctx.events.emit({
    type,
    source: 'adapter-demo-controller',
    payload,
    timestamp: Date.now(),
  });
}

function createAdapterDemoController(): ControllerRegistration {
  let elapsedMs = 0;
  let completed = false;
  let activeStageId: string | null = null;

  return {
    id: 'adapter-demo-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      const storage = ctx.adapters.require<StorageAdapterApi>('storage');
      const capabilities = ctx.adapters
        .list()
        .map((adapter) => `${adapter.capability}:${adapter.id}`);

      loading.begin([...STAGES], 'Resolving runtime adapter capabilities');
      emitDemoEvent(ctx, 'adapter-demo:adapters-registered', {
        message: 'Kernel registered the loading and storage adapter capabilities.',
        capabilities,
      });
      emitDemoEvent(ctx, 'adapter-demo:lookup-success', {
        message: 'Required lookups succeeded for loading and storage.',
        capabilities: ['loading', 'storage'],
      });

      const missing = ctx.adapters.get('missing-capability');

      emitDemoEvent(ctx, 'adapter-demo:optional-miss', {
        message:
          missing === undefined
            ? 'Optional missing-capability lookup returned undefined without crashing.'
            : 'Optional missing-capability unexpectedly resolved.',
        found: missing !== undefined,
      });

      const proofRecord: AdapterProofRecord = {
        checkedAt: new Date().toISOString(),
        requiredCapabilities: ['loading', 'storage'],
        optionalCapability: 'missing-capability',
        optionalAvailable: missing !== undefined,
      };

      storage.setItem(STORAGE_KEY, proofRecord);
      emitDemoEvent(ctx, 'adapter-demo:storage-written', {
        message: `Wrote ${STORAGE_KEY} through the namespaced storage adapter.`,
        key: STORAGE_KEY,
      });

      const storedRecord = storage.getItem<AdapterProofRecord>(STORAGE_KEY);

      emitDemoEvent(ctx, 'adapter-demo:storage-read', {
        message: storedRecord
          ? 'Read the proof record back through the storage adapter.'
          : 'Storage lookup returned no proof record.',
        key: STORAGE_KEY,
        found: storedRecord !== null,
      });
    },
    update(frame: FrameInfo, ctx) {
      if (completed) {
        return;
      }

      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      elapsedMs += deltaMs;

      if (elapsedMs < 650) {
        if (activeStageId !== 'required-lookup') {
          activeStageId = 'required-lookup';
          loading.setStage(
            'required-lookup',
            0.34,
            'Required loading and storage lookups succeeded',
          );
        }

        return;
      }

      if (elapsedMs < 1300) {
        if (activeStageId !== 'optional-lookup') {
          activeStageId = 'optional-lookup';
          loading.setStage(
            'optional-lookup',
            0.67,
            'Optional missing-capability lookup returned undefined without crashing',
          );
        }

        return;
      }

      if (elapsedMs < 2050) {
        if (activeStageId !== 'storage-roundtrip') {
          activeStageId = 'storage-roundtrip';
          loading.setStage(
            'storage-roundtrip',
            0.9,
            'Storage adapter wrote and read a namespaced proof record',
          );
        }

        return;
      }

      loading.complete(
        'Adapter registration proof ready: required adapters resolved, optional miss handled, storage round trip completed',
      );
      ctx.state.setPhase('ready', 'adapter-registration:ready');
      emitDemoEvent(ctx, 'adapter-demo:ready', {
        message: 'Adapter registration example reached the ready phase.',
      });
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitDemoEvent(ctx, 'adapter-demo:paused', {
          message: 'Runtime paused without losing registered adapter state.',
        });
      }

      if (next.phase === 'ready' && previous.phase === 'paused') {
        emitDemoEvent(ctx, 'adapter-demo:resumed', {
          message: 'Runtime resumed with loading and storage adapters still registered.',
        });
      }

      if (next.phase === 'error') {
        emitDemoEvent(ctx, 'adapter-demo:error', {
          message: next.reason ?? 'Runtime error',
        });
      }
    },
    dispose(ctx) {
      ctx.adapters.get<StorageAdapterApi>('storage')?.removeItem(STORAGE_KEY);
      emitDemoEvent(ctx, 'adapter-demo:disposed', {
        message: 'Adapter registration runtime disposed and storage proof record removed.',
        key: STORAGE_KEY,
      });
    },
  };
}

function createKernelInstance() {
  return createKernel({
    id: 'urk-www-adapter-registration',
    adapters: [
      createLoadingAdapter(),
      createStorageAdapter({ namespace: STORAGE_NAMESPACE }),
    ],
    controllers: [createAdapterDemoController()],
  });
}

export async function mountAdapterRegistrationExample(
  host: HTMLElement,
  _options: ExampleMountOptions = {},
): Promise<ExampleMountResult> {
  const elements = readRuntimePanelElements(host, 'adapter registration');
  const kernel = createKernelInstance();

  return mountRuntimePanel({
    elements,
    kernel,
    exampleLabel: 'adapter registration',
    pauseReason: 'adapter-registration:pause',
    resumeReason: 'adapter-registration:resume',
    shutdownReason: 'adapter-registration:shutdown',
    teardownReason: 'adapter-registration:teardown',
    mountFailureMessage: 'The adapter registration example failed to mount.',
    previewFailureMessage:
      'The site stayed responsive, but the adapter registration example did not finish mounting.',
    recentEventLimit: MAX_EVENTS,
  });
}
