/**
 * Company: EonHive Inc.
 * Title: Next Ownership Integration Page
 * Purpose: Verify actual App Router mounts and navigation with the thin Next provider.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { UrkNextProvider } from '@urk/next-urk';
import { ProbeView } from '../../../../examples/tests/fixtures/ProbeView';
import { createProbeKernel, reports } from '../../../../examples/tests/fixtures/runtime';

function createRuntime() {
  return createProbeKernel({ id: 'next-ownership-probe' });
}

export default function OwnershipPage() {
  useEffect(() => { Object.assign(window, { urkNextOwnershipReports: reports }); }, []);
  return <main>
    <h1>Next ownership integration fixture</h1>
    <UrkNextProvider createKernel={createRuntime}><ProbeView /></UrkNextProvider>
    <Link href="/ownership/away">Leave runtime</Link>
  </main>;
}
