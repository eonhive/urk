/**
 * Company: EonHive Inc.
 * Title: URK React Hooks
 * Purpose: Provide thin React hooks for consuming an existing URK kernel instance.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { useContext, useSyncExternalStore } from 'react';
import type { RuntimeSnapshot } from '@urk/core';
import { KernelContext } from './provider.js';

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

  return useSyncExternalStore(
    (onStoreChange: () => void) =>
      store.subscribe(() => {
        onStoreChange();
      }),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
}

export function useEventBus() {
  return useKernel().getEventBus();
}
