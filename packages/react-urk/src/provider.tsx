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

export interface UrkProviderProps {
  kernel: Kernel;
  autoBoot?: boolean;
  bootReason?: string;
  shutdownReason?: string;
  children?: ReactNode;
}

export const KernelContext = createContext<Kernel | null>(null);

function emitLifecycleEvent(kernel: Kernel, type: string, reason: string): void {
  kernel.getEventBus().emit({
    type,
    source: 'react-urk',
    payload: { reason },
    timestamp: Date.now(),
  });
}

function reportLifecycleError(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : `Unknown ${action} error`;
  console.error(`[react-urk] ${action} failed: ${message}`);
}

export function UrkProvider({
  kernel,
  autoBoot = true,
  bootReason = 'react-urk:auto-boot',
  shutdownReason = 'react-urk:auto-shutdown',
  children,
}: UrkProviderProps) {
  const stableKernelRef = useRef(kernel);
  const bootStartedRef = useRef(false);
  const bootOwnershipRef = useRef(false);
  const bootOwnedByProviderRef = useRef(false);
  const bootPromiseRef = useRef<Promise<void> | null>(null);
  const pendingShutdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (stableKernelRef.current !== kernel) {
    throw new Error('UrkProvider does not support replacing the kernel instance after mount.');
  }

  useEffect(() => {
    const currentKernel = stableKernelRef.current;

    if (pendingShutdownTimerRef.current) {
      clearTimeout(pendingShutdownTimerRef.current);
      pendingShutdownTimerRef.current = null;
    }

    if (!autoBoot) {
      return () => undefined;
    }

    if (!bootStartedRef.current) {
      bootStartedRef.current = true;
      bootOwnershipRef.current = currentKernel.getState().phase === 'boot';
      emitLifecycleEvent(currentKernel, 'react-urk:boot-requested', bootReason);

      const bootPromise = currentKernel.boot();
      bootPromiseRef.current = bootPromise;

      void bootPromise
        .then(() => {
          bootOwnedByProviderRef.current = bootOwnershipRef.current;
          emitLifecycleEvent(currentKernel, 'react-urk:booted', bootReason);
        })
        .catch((error: unknown) => {
          bootStartedRef.current = false;
          reportLifecycleError('boot', error);
        });
    }

    return () => {
      if (!bootOwnershipRef.current) {
        return;
      }

      pendingShutdownTimerRef.current = setTimeout(() => {
        pendingShutdownTimerRef.current = null;

        void (async () => {
          if (bootPromiseRef.current) {
            try {
              await bootPromiseRef.current;
            } catch {
              // Ignore boot errors here and still attempt shutdown for cleanup.
            }
          }

          bootOwnedByProviderRef.current = false;
          emitLifecycleEvent(currentKernel, 'react-urk:shutdown-requested', shutdownReason);
          await currentKernel.shutdown(shutdownReason);
        })().catch((error: unknown) => {
          reportLifecycleError('shutdown', error);
        });
      }, 0);
    };
  }, [autoBoot, bootReason, shutdownReason]);

  return <KernelContext.Provider value={stableKernelRef.current}>{children}</KernelContext.Provider>;
}
