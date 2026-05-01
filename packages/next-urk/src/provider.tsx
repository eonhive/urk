/**
 * Company: EonHive Inc.
 * Title: URK Next Provider
 * Purpose: Expose a thin Next client-boundary provider that composes the base React wrapper.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

'use client';

import { UrkProvider, type UrkProviderProps } from '@urk/react-urk';
import { useClientKernel, type KernelFactory } from './hooks.js';

export interface UrkNextProviderProps extends Omit<UrkProviderProps, 'kernel'> {
  createKernel: KernelFactory;
}

export function UrkNextProvider({
  createKernel,
  autoBoot,
  bootReason,
  shutdownReason,
  children,
}: UrkNextProviderProps) {
  const kernel = useClientKernel(createKernel);

  return (
    <UrkProvider
      kernel={kernel}
      autoBoot={autoBoot}
      bootReason={bootReason}
      shutdownReason={shutdownReason}
    >
      {children}
    </UrkProvider>
  );
}
