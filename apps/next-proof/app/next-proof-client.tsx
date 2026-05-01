/**
 * Company: EonHive Inc.
 * Title: URK Next Proof Client
 * Purpose: Render the client-only proof that validates next-urk inside a real App Router app.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

'use client';

import { useEffect, useState } from 'react';
import { type LoadingAdapterApi, type LoadingSnapshot } from '@urk/adapters/dom';
import {
  UrkNextProvider,
  useKernel,
  useKernelEvent,
  useRuntimeInspectorSnapshot,
  useRuntimePhase,
  useRuntimeSnapshot,
} from '@urk/next-urk';
import {
  createEmptyLoadingSnapshot,
  createNextProofKernel,
  type ProofActionPayload,
} from './next-proof-runtime';

const MAX_INSPECTOR_EVENT_ROWS = 8;
type InspectorSnapshot = ReturnType<typeof useRuntimeInspectorSnapshot>;

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function summarizePayload(payload: unknown): string {
  if (payload === undefined) {
    return 'none';
  }

  if (payload === null) {
    return 'null';
  }

  if (typeof payload === 'string') {
    return payload.length > 64 ? `${payload.slice(0, 61)}...` : payload;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean' || typeof payload === 'bigint') {
    return String(payload);
  }

  if (Array.isArray(payload)) {
    return `Array(${payload.length})`;
  }

  if (typeof payload === 'function') {
    return 'function';
  }

  if (typeof payload === 'object') {
    const entries = Object.entries(payload as Record<string, unknown>)
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : String(value)}`);
    const suffix = Object.keys(payload as Record<string, unknown>).length > 3 ? ', ...' : '';

    return `{ ${entries.join(', ')}${suffix} }`;
  }

  return typeof payload;
}

function getVisibleInspectorEvents(
  inspectorSnapshot: InspectorSnapshot,
): InspectorSnapshot['recentEvents'] {
  return [...inspectorSnapshot.recentEvents]
    .slice(-MAX_INSPECTOR_EVENT_ROWS)
    .reverse();
}

function useLoadingSnapshot(): LoadingSnapshot {
  const kernel = useKernel();
  const runtimeSnapshot = useRuntimeSnapshot();
  const [loadingSnapshot, setLoadingSnapshot] = useState<LoadingSnapshot>(() =>
    createEmptyLoadingSnapshot(),
  );

  useEffect(() => {
    if (runtimeSnapshot.phase === 'boot') {
      return () => undefined;
    }

    try {
      const loading = kernel.getContext().adapters.require<LoadingAdapterApi>('loading');
      setLoadingSnapshot(loading.getSnapshot());
      return loading.subscribe((next) => {
        setLoadingSnapshot(next);
      });
    } catch {
      return () => undefined;
    }
  }, [kernel, runtimeSnapshot.phase]);

  return loadingSnapshot;
}

function NextProofShell() {
  const kernel = useKernel();
  const runtimeSnapshot = useRuntimeSnapshot();
  const inspectorSnapshot = useRuntimeInspectorSnapshot();
  const runtimePhase = useRuntimePhase();
  const loadingSnapshot = useLoadingSnapshot();

  const [lastAction, setLastAction] = useState('Booting the Next proof');
  const [shutdownRequested, setShutdownRequested] = useState(false);

  useKernelEvent('runtime:shutdown', () => {
    setShutdownRequested(true);
    setLastAction('Next proof shut down');
  });
  useKernelEvent<{ message?: string }>('runtime:error', (event) => {
    setLastAction(event.payload?.message ?? 'Next proof runtime error');
  });
  useKernelEvent<ProofActionPayload>('next-proof:action', (event) => {
    setLastAction(event.payload?.message ?? 'Next proof action');
  });

  const progressPercent = Math.round(loadingSnapshot.progress * 100);
  const visibleEventHistory = getVisibleInspectorEvents(inspectorSnapshot);
  const latestEvent = visibleEventHistory[0]?.type ?? 'kernel:init';
  const phaseStatus =
    runtimePhase === 'loading'
      ? 'Next proof loading'
      : runtimePhase === 'paused'
        ? 'Next proof paused'
        : runtimePhase === 'ready'
          ? 'Next proof ready'
          : runtimePhase === 'error'
            ? 'Next proof error'
            : 'Booting Next proof';

  const isShutdown = shutdownRequested || inspectorSnapshot.disposed;
  const pauseDisabled = isShutdown || runtimePhase !== 'ready';
  const resumeDisabled = isShutdown || runtimePhase !== 'paused';
  const shutdownDisabled = isShutdown;

  return (
    <main className="next-proof">
      <section className="next-proof__hero">
        <div className="next-proof__eyebrow">Next App Router wrapper proof</div>
        <h1>URK Next Proof</h1>
        <p>
          This proof keeps the kernel client-owned while Next only provides the App Router shell
          and client boundary. The runtime stays explicit, staged, and lifecycle-driven.
        </p>
        <div className="next-proof__status">{phaseStatus}</div>
      </section>

      <section className="next-proof__grid">
        <section className="next-proof__panel">
          <div className="next-proof__metrics">
            <article className="next-proof__meta-card">
              <span>Phase</span>
              <strong>{runtimeSnapshot.phase}</strong>
              <p>Canonical runtime phase from the shared RuntimeStore.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Reason</span>
              <strong>{runtimeSnapshot.reason ?? 'None'}</strong>
              <p>Current runtime reason projected from the kernel.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Loading Stage</span>
              <strong>{loadingSnapshot.stageLabel ?? 'Waiting'}</strong>
              <p>Staged progress still comes from the loading adapter.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Latest Event</span>
              <strong>{latestEvent}</strong>
              <p>Recent event state is now driven by the shared inspector snapshot.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Latest Action</span>
              <strong>{lastAction}</strong>
              <p>The proof keeps controller behavior visible in the shell.</p>
            </article>
          </div>

          <section className="next-proof__progress" aria-label="Loading progress">
            <div className="next-proof__progress-copy">
              <strong>{loadingSnapshot.stageLabel ?? 'Waiting'}</strong>
              <span>{progressPercent}%</span>
            </div>
            <div className="next-proof__progress-track">
              <div
                className="next-proof__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p>{loadingSnapshot.message}</p>
          </section>

          <div className="next-proof__controls">
            <button
              type="button"
              data-tone="active"
              disabled={pauseDisabled}
              onClick={() => kernel.pause('next-proof:pause')}
            >
              Pause
            </button>
            <button
              type="button"
              data-tone="active"
              disabled={resumeDisabled}
              onClick={() => kernel.resume('next-proof:resume')}
            >
              Resume
            </button>
            <button
              type="button"
              data-tone="danger"
              disabled={shutdownDisabled}
              onClick={() => {
                setShutdownRequested(true);
                setLastAction('Next proof shutting down');
                void kernel.shutdown('next-proof:shutdown').catch((error: unknown) => {
                  const message =
                    error instanceof Error ? error.message : 'Next proof shutdown failed';
                  setLastAction(message);
                });
              }}
            >
              Shutdown
            </button>
          </div>
        </section>

        <section className="next-proof__detail">
          <strong>Client-boundary only</strong>
          <h2>{runtimePhase === 'ready' ? 'Inspector parity ready' : 'Preparing inspector view'}</h2>
          <p>
            The kernel is created on the client and handed into the base React wrapper. Next still
            does not redefine runtime state or scheduler ownership, but it can now consume the same
            inspector surface through `@urk/next-urk`.
          </p>

          <div className="next-proof__inspector-grid">
            <article className="next-proof__meta-card">
              <span>Runtime ID</span>
              <strong>{inspectorSnapshot.runtimeId}</strong>
              <p>Stable kernel identity across the Next client boundary.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Booted / Disposed</span>
              <strong>
                {inspectorSnapshot.booted ? 'yes' : 'no'} / {inspectorSnapshot.disposed ? 'yes' : 'no'}
              </strong>
              <p>Lifecycle stays kernel-owned while the wrapper remains a subscriber.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Scheduler</span>
              <strong>{inspectorSnapshot.schedulerRunning ? 'running' : 'stopped'}</strong>
              <p>Pause and shutdown are reflected directly from kernel scheduler state.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Frame Count</span>
              <strong>{inspectorSnapshot.frameCount}</strong>
              <p>The visible activity counter now comes from the inspector snapshot.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Total Events</span>
              <strong>{inspectorSnapshot.totalEvents}</strong>
              <p>Bounded recent events are preserved without a Next-owned event mirror.</p>
            </article>
            <article className="next-proof__meta-card">
              <span>Registry Counts</span>
              <strong>
                {inspectorSnapshot.adapters.length} / {inspectorSnapshot.controllers.length} /{' '}
                {inspectorSnapshot.services.length}
              </strong>
              <p className="next-proof__registry-summary">adapters / controllers / services</p>
            </article>
          </div>

          <section className="next-proof__event-history" aria-label="Inspector recent events">
            <h2>Inspector recent events</h2>
            <ol>
              {visibleEventHistory.map((event) => (
                <li key={`${event.timestamp}-${event.type}-${event.source}`}>
                  <strong>{event.type}</strong>
                  <div className="next-proof__event-meta">
                    <small>{event.source}</small>
                    <small>{formatEventTime(event.timestamp)}</small>
                  </div>
                  <span className="next-proof__event-payload">{summarizePayload(event.payload)}</span>
                </li>
              ))}
            </ol>
          </section>

          <p>
            Reload the page to confirm that a fresh client mount creates a fresh kernel instance
            through the same `next-urk` path with a fresh inspector snapshot.
          </p>
        </section>
      </section>
    </main>
  );
}

export function NextProofClient() {
  return (
    <UrkNextProvider
      createKernel={createNextProofKernel}
      bootReason="next-urk:auto-boot"
      shutdownReason="next-urk:auto-shutdown"
    >
      <NextProofShell />
    </UrkNextProvider>
  );
}
