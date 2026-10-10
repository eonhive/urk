/**
 * Company: EonHive Inc.
 * Title: Ownership Snapshot Probe
 * Purpose: Commit browser instrumentation and observe the public React hooks in test hosts.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import { useLayoutEffect } from 'react';
import { useKernel, useRuntimeInspectorSnapshot, useRuntimeSnapshot } from '@urk/react-urk';
import { commitProbe, getProbe } from './runtime';

export function ProbeView() {
  const kernel = useKernel();
  const runtime = useRuntimeSnapshot();
  const inspector = useRuntimeInspectorSnapshot();
  useLayoutEffect(() => { commitProbe(kernel); }, [kernel]);
  const probe = getProbe(kernel);
  if (probe.lastSnapshot !== runtime) {
    probe.lastSnapshot = runtime;
    probe.snapshotVersion += 1;
  }
  return <output data-probe-id={kernel.getContext().id}>
    {runtime.phase} / {inspector.booted ? 'booted' : 'starting'}
  </output>;
}
