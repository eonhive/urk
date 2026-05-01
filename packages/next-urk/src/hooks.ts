/**
 * Company: EonHive Inc.
 * Title: URK Next Hooks
 * Purpose: Provide the thin Next-specific client hook for creating a stable kernel instance.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

'use client';

import { useRef } from 'react';
import type { Kernel } from '@urk/core';

export type KernelFactory = () => Kernel;

export function useClientKernel(createKernel: KernelFactory): Kernel {
  const stableFactoryRef = useRef(createKernel);
  const kernelRef = useRef<Kernel | null>(null);

  if (stableFactoryRef.current !== createKernel) {
    throw new Error('useClientKernel does not support replacing the kernel factory after mount.');
  }

  if (!kernelRef.current) {
    kernelRef.current = createKernel();
  }

  return kernelRef.current;
}
