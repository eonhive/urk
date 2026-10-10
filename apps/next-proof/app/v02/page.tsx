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
import type { ReactNode } from 'react';
import type { Kernel } from '@urk/core';
import { UrkNextProvider } from '@urk/next-urk';
import { V02Host } from '../../../../examples/v02/host';

export default function V02Page() {
  const renderProvider = (kernel: Kernel, children: ReactNode) =>
    <UrkNextProvider key={kernel.getContext().id} createKernel={() => kernel}>{children}</UrkNextProvider>;
  return <><V02Host renderProvider={renderProvider} /><Link href="/">Leave experience</Link></>;
}
