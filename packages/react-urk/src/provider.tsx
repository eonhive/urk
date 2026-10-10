/**
 * Company: EonHive Inc.
 * Title: URK React Provider
 * Purpose: Expose a thin React provider around an existing URK kernel instance.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { createContext, useEffect, useRef, type ReactNode } from 'react';
import type { Kernel } from '@urk/core';

export type KernelOwnership = 'legacy' | 'external' | 'provider';

export interface UrkProviderProps {
  kernel: Kernel;
  ownership?: KernelOwnership;
  autoBoot?: boolean;
  bootReason?: string;
  shutdownReason?: string;
  children?: ReactNode;
}

export const KernelContext = createContext<Kernel | null>(null);

// A kernel has one terminal cleanup owner, even when several providers consume it.
const kernelOwners = new WeakMap<Kernel, object>();

function emitLifecycleEvent(kernel: Kernel, type: string, reason: string): void {
  try {
    kernel.getEventBus().emit({
      type,
      source: 'react-urk',
      payload: { reason },
      timestamp: Date.now(),
    });
  } catch {
    // Observer failures must not prevent startup or terminal cleanup.
  }
}

function reportLifecycleError(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : `Unknown ${action} error`;
  console.error(`[react-urk] ${action} failed: ${message}`);
}

export function UrkProvider({
  kernel,
  ownership = 'legacy',
  autoBoot = true,
  bootReason = 'react-urk:auto-boot',
  shutdownReason = 'react-urk:auto-shutdown',
  children,
}: UrkProviderProps) {
  const stableKernelRef = useRef(kernel);
  const stableOwnershipRef = useRef(ownership);
  const ownerTokenRef = useRef({});
  const ownsKernelRef = useRef(false);
  const mountedRef = useRef(false);
  const bootPromiseRef = useRef<Promise<void> | null>(null);
  const pendingShutdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootReasonRef = useRef(bootReason);
  const shutdownReasonRef = useRef(shutdownReason);
  bootReasonRef.current = bootReason;
  shutdownReasonRef.current = shutdownReason;

  if (stableKernelRef.current !== kernel) {
    throw new Error('UrkProvider does not support replacing the kernel instance after mount.');
  }
  if (stableOwnershipRef.current !== ownership) {
    throw new Error('UrkProvider does not support changing ownership after mount.');
  }

  const claimOwnership = (required: boolean): void => {
    const currentOwner = kernelOwners.get(kernel);
    if (currentOwner && currentOwner !== ownerTokenRef.current) {
      if (required) {
        throw new Error('This kernel already has a provider cleanup owner.');
      }
      return;
    }
    kernelOwners.set(kernel, ownerTokenRef.current);
    ownsKernelRef.current = true;
  };

  useEffect(() => {
    if (ownership === 'provider') {
      claimOwnership(true);
    }
    mountedRef.current = true;
    if (pendingShutdownTimerRef.current !== null) {
      clearTimeout(pendingShutdownTimerRef.current);
      pendingShutdownTimerRef.current = null;
    }

    return () => {
      mountedRef.current = false;
      if (!ownsKernelRef.current) {
        return;
      }
      // Effect replay reattaches synchronously; an actual unmount commits next task.
      pendingShutdownTimerRef.current = setTimeout(() => {
        pendingShutdownTimerRef.current = null;
        kernelOwners.delete(kernel);
        ownsKernelRef.current = false;
        const reason = shutdownReasonRef.current;
        // Signal cancellation now, including when boot is still waiting on a hook.
        const shutdown = kernel.shutdown(reason);
        emitLifecycleEvent(kernel, 'react-urk:shutdown-requested', reason);
        void shutdown.catch((error: unknown) => {
          reportLifecycleError('shutdown', error);
        });
      }, 0);
    };
  }, [kernel, ownership]);

  useEffect(() => {
    if (!autoBoot || bootPromiseRef.current) {
      return;
    }
    if (ownership === 'legacy' && kernel.getState().phase === 'boot') {
      claimOwnership(false);
    }
    const reason = bootReasonRef.current;
    emitLifecycleEvent(kernel, 'react-urk:boot-requested', reason);
    const bootPromise = kernel.boot();
    bootPromiseRef.current = bootPromise;
    void bootPromise.then(() => {
      if (mountedRef.current && !kernel.getContext().signal.aborted) {
        emitLifecycleEvent(kernel, 'react-urk:booted', reason);
      }
    }).catch((error: unknown) => {
      if (mountedRef.current && !kernel.getContext().signal.aborted) {
        reportLifecycleError('boot', error);
      }
    });
  }, [kernel, ownership, autoBoot]);

  return <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>;
}
