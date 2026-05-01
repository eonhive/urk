/**
 * Company: EonHive Inc.
 * Title: URK React Hooks
 * Purpose: Provide thin React hooks for consuming an existing URK kernel instance.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type {
  KernelEvent,
  RuntimeInspector,
  RuntimeInspectorSnapshot,
  RuntimePhase,
  RuntimeSnapshot,
} from '@urk/core';
import { KernelContext } from './provider.js';

export type KernelEventListener<TPayload = unknown> = (
  event: KernelEvent & { payload?: TPayload },
) => void;

export function useKernel() {
  const kernel = useContext(KernelContext);

  if (!kernel) {
    throw new Error('URK React hooks must be used inside an UrkProvider.');
  }

  return kernel;
}

export function useRuntimeSnapshot(): RuntimeSnapshot {
  const kernel = useKernel();
  const store = kernel.getContext().state;
  const snapshotRef = useRef<RuntimeSnapshot>(store.getSnapshot());

  const getStableSnapshot = (): RuntimeSnapshot => {
    const next = store.getSnapshot();
    const previous = snapshotRef.current;

    if (
      previous.phase === next.phase &&
      previous.reason === next.reason &&
      previous.updatedAt === next.updatedAt
    ) {
      return previous;
    }

    snapshotRef.current = next;
    return next;
  };

  return useSyncExternalStore(
    (onStoreChange: () => void) =>
      store.subscribe(() => {
        onStoreChange();
      }),
    getStableSnapshot,
    getStableSnapshot,
  );
}

export function useRuntimePhase(): RuntimePhase {
  return useRuntimeSnapshot().phase;
}

export function useRuntimeInspector(): RuntimeInspector {
  return useKernel().getInspector();
}

export function useRuntimeInspectorSnapshot(): RuntimeInspectorSnapshot {
  const inspector = useRuntimeInspector();
  const snapshotRef = useRef<RuntimeInspectorSnapshot>(inspector.getSnapshot());

  const getStableSnapshot = (): RuntimeInspectorSnapshot => {
    const next = inspector.getSnapshot();
    const previous = snapshotRef.current;

    if (previous.updatedAt === next.updatedAt) {
      return previous;
    }

    snapshotRef.current = next;
    return next;
  };

  return useSyncExternalStore(
    (onStoreChange: () => void) =>
      inspector.subscribe(() => {
        onStoreChange();
      }),
    getStableSnapshot,
    getStableSnapshot,
  );
}

export function useEventBus() {
  return useKernel().getEventBus();
}

export function useKernelEvent<TPayload = unknown>(
  type: string,
  listener: KernelEventListener<TPayload>,
): void {
  const eventBus = useEventBus();
  const listenerRef = useRef(listener);

  listenerRef.current = listener;

  useEffect(() => {
    return eventBus.on(type, (event) => {
      listenerRef.current(event as KernelEvent & { payload?: TPayload });
    });
  }, [eventBus, type]);
}
