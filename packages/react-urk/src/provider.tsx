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
  const bootRequestedRef = useRef(false);
  const bootOwnedByProviderRef = useRef(false);

  if (stableKernelRef.current !== kernel) {
    throw new Error('UrkProvider does not support replacing the kernel instance after mount.');
  }

  useEffect(() => {
    let disposed = false;
    const currentKernel = stableKernelRef.current;

    if (!autoBoot || bootRequestedRef.current) {
      return () => undefined;
    }

    bootRequestedRef.current = true;
    const bootOwnedByProvider = currentKernel.getState().phase === 'boot';
    emitLifecycleEvent(currentKernel, 'react-urk:boot-requested', bootReason);

    void currentKernel
      .boot()
      .then(() => {
        if (disposed) {
          if (bootOwnedByProvider) {
            emitLifecycleEvent(currentKernel, 'react-urk:shutdown-requested', shutdownReason);
            void currentKernel.shutdown(shutdownReason).catch((error: unknown) => {
              reportLifecycleError('shutdown', error);
            });
          }

          return;
        }

        bootOwnedByProviderRef.current = bootOwnedByProvider;
        emitLifecycleEvent(currentKernel, 'react-urk:booted', bootReason);
      })
      .catch((error: unknown) => {
        const bootError: unknown = error;
        bootRequestedRef.current = false;
        reportLifecycleError('boot', bootError);
      });

    return () => {
      disposed = true;

      if (!bootOwnedByProviderRef.current) {
        return;
      }

      bootOwnedByProviderRef.current = false;
      emitLifecycleEvent(currentKernel, 'react-urk:shutdown-requested', shutdownReason);
      void currentKernel.shutdown(shutdownReason).catch((error: unknown) => {
        reportLifecycleError('shutdown', error);
      });
    };
  }, [autoBoot, bootReason, shutdownReason]);

  return <KernelContext.Provider value={stableKernelRef.current}>{children}</KernelContext.Provider>;
}
