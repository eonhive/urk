/**
 * Company: EonHive Inc.
 * Title: React Ownership Browser Fixture
 * Purpose: Exercise provider ownership and effect replay through a real React root.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { UrkProvider, type UrkProviderProps } from '@urk/react-urk';
import { createProbeKernel, commitProbe, getProbe, reports, type ProbeOptions } from './runtime';
import { ProbeView } from './ProbeView';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    return this.state.error ? <output data-error>{this.state.error}</output> : this.props.children;
  }
}

const host = document.getElementById('app');
if (!host) { throw new Error('Missing fixture root.'); }
const root = createRoot(host);
const runtimes = new Map<string, ReturnType<typeof createProbeKernel>>();
type ProviderSpec = Omit<UrkProviderProps, 'kernel' | 'children'> & { id: string; key?: string };

const api = {
  create(options: ProbeOptions & { id: string }) {
    const kernel = createProbeKernel(options);
    runtimes.set(options.id, kernel);
    commitProbe(kernel);
  },
  render(providers: ProviderSpec[], strict = false) {
    const children = providers.map(({ id, key = id, ...props }) => {
      const kernel = runtimes.get(id);
      if (!kernel) { throw new Error(`Missing fixture runtime: ${id}`); }
      return <ErrorBoundary key={key}><UrkProvider kernel={kernel} {...props}>
        <ProbeView />
      </UrkProvider></ErrorBoundary>;
    });
    flushSync(() => { root.render(strict ? <StrictMode>{children}</StrictMode> : <>{children}</>); });
  },
  release(id: string) { getProbe(runtimes.get(id)!).release(); },
  async boot(id: string) { await runtimes.get(id)!.boot(); },
  async shutdown(id: string) { await runtimes.get(id)!.shutdown(); },
  throwObserver(id: string, type: string) {
    runtimes.get(id)!.getEventBus().on(type, () => { throw new Error('Fixture observer failed.'); });
  },
  cycleSameTimestamp(id: string) {
    const ctx = runtimes.get(id)!.getContext();
    const snapshot = ctx.state.getSnapshot();
    const now = Date.now;
    Date.now = () => snapshot.updatedAt;
    try {
      ctx.state.setPhase('transition', 'test:intermediate');
      ctx.state.setPhase(snapshot.phase, snapshot.reason);
    } finally {
      Date.now = now;
    }
  },
  reports,
};

Object.assign(window, { urkOwnershipTest: api });

export type OwnershipTestApi = typeof api;
