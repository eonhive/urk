/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Next Page
 * Purpose: Run the shared experience in a real App Router client boundary.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

'use client';

import Link from 'next/link';
import { useCallback, type ReactNode } from 'react';
import type { Kernel } from '@urk/core';
import { UrkNextProvider } from '@urk/next';
import { V02Host } from '../../../../examples/v02/host';

function NextExperience({ kernel, children }: { kernel: Kernel; children: ReactNode }) {
  const createKernel = useCallback(() => kernel, [kernel]);
  return <UrkNextProvider createKernel={createKernel}>{children}</UrkNextProvider>;
}

export default function V02Page() {
  const renderProvider = (kernel: Kernel, children: ReactNode) =>
    <NextExperience key={kernel.getContext().id} kernel={kernel}>{children}</NextExperience>;
  return <><V02Host renderProvider={renderProvider} /><Link href="/">Leave experience</Link></>;
}
