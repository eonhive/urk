/**
 * Company: EonHive Inc.
 * Title: URK React Hooks
 * Purpose: Provide thin React hooks for consuming an existing URK kernel instance.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type {
  KernelEvent,
  LifecycleSnapshot,
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

export function useLifecycleSnapshot(): LifecycleSnapshot {
  const kernel = useKernel();
  const subscribe = useCallback((listener: () => void) => kernel.subscribeLifecycle(listener), [kernel]);
  const getSnapshot = useCallback(() => kernel.getLifecycleSnapshot(), [kernel]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRuntimeSnapshot(): RuntimeSnapshot {
  const kernel = useKernel();
  const store = kernel.getContext().state;
  const snapshotRef = useRef<{ revision: number; snapshot: RuntimeSnapshot } | null>(null);
  const getSnapshot = useCallback((): RuntimeSnapshot => {
    const revision = store.getRevision();
    if (!snapshotRef.current || snapshotRef.current.revision !== revision) {
      snapshotRef.current = { revision, snapshot: store.getSnapshot() };
    }
    return snapshotRef.current.snapshot;
  }, [store]);
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useRuntimePhase(): RuntimePhase {
  return useRuntimeSnapshot().phase;
}

export function useRuntimeInspector(): RuntimeInspector {
  return useKernel().getInspector();
}

export function useRuntimeInspectorSnapshot(): RuntimeInspectorSnapshot {
  const inspector = useRuntimeInspector();
  const getSnapshot = useCallback(() => inspector.getSnapshot(), [inspector]);
  const subscribe = useCallback(
    (onStoreChange: () => void) => inspector.subscribe(onStoreChange),
    [inspector],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
