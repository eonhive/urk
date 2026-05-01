/**
 * Company: EonHive Inc.
 * Title: URK React Starter Proof
 * Purpose: Prove that URK can be consumed cleanly through a thin React wrapper.
 * Author: Stan Nesi
 * Created: 2026-04-23
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createKernel,
  type ControllerRegistration,
  type FrameInfo,
  type RuntimeContext,
  type RuntimeInspectorSnapshot,
  type RuntimeSnapshot,
} from '@urk/core';
import { createLoadingAdapter, type LoadingAdapterApi, type LoadingSnapshot } from '@urk/adapters/dom';
import {
  UrkProvider,
  useKernel,
  useKernelEvent,
  useRuntimeInspectorSnapshot,
  useRuntimePhase,
  useRuntimeSnapshot,
} from '@urk/react-urk';

type ProofActionPayload = {
  message: string;
};

const STAGES = [
  { id: 'bootstrap-react', label: 'Bootstrap React' },
  { id: 'bind-runtime', label: 'Bind Runtime' },
  { id: 'activate-react', label: 'Activate React' },
] as const;

const HEARTBEAT_INTERVAL_MS = 1200;
const MAX_INSPECTOR_EVENT_ROWS = 8;

function createEmptyLoadingSnapshot(): LoadingSnapshot {
  return {
    active: false,
    complete: false,
    progress: 0,
    message: 'Waiting to start',
    stageId: null,
    stageLabel: null,
    stages: [],
    updatedAt: Date.now(),
  };
}

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
  inspectorSnapshot: RuntimeInspectorSnapshot,
): RuntimeInspectorSnapshot['recentEvents'] {
  return [...inspectorSnapshot.recentEvents]
    .slice(-MAX_INSPECTOR_EVENT_ROWS)
    .reverse();
}

function emitAction(ctx: RuntimeContext, message: string): void {
  ctx.events.emit({
    type: 'react-starter:action',
    source: 'react-starter-controller',
    payload: { message } satisfies ProofActionPayload,
    timestamp: Date.now(),
  });
}

function emitHeartbeat(ctx: RuntimeContext, count: number): void {
  ctx.events.emit({
    type: 'react-starter:heartbeat',
    source: 'react-starter-controller',
    payload: { count },
    timestamp: Date.now(),
  });
}

function createReactStarterController(): ControllerRegistration {
  let elapsedMs = 0;
  let heartbeatElapsedMs = 0;
  let heartbeatCount = 0;
  let completed = false;

  return {
    id: 'react-starter-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      loading.begin([...STAGES], 'Initializing React wrapper proof');
      emitAction(ctx, 'Started staged React loading');
    },
    update(frame: FrameInfo, ctx) {
      const deltaMs = frame.deltaMs === 0 ? 16 : frame.deltaMs;

      if (completed) {
        if (ctx.state.getSnapshot().phase === 'ready') {
          heartbeatElapsedMs += deltaMs;

          if (heartbeatElapsedMs >= HEARTBEAT_INTERVAL_MS) {
            heartbeatElapsedMs = 0;
            heartbeatCount += 1;
            emitHeartbeat(ctx, heartbeatCount);
          }
        }

        return;
      }

      elapsedMs += deltaMs;
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');

      if (elapsedMs < 700) {
        loading.setStage(
          'bootstrap-react',
          elapsedMs / 700,
          'Creating the React proof shell and provider wiring',
        );
        return;
      }

      if (elapsedMs < 1450) {
        loading.setStage(
          'bind-runtime',
          (elapsedMs - 700) / 750,
          'Binding runtime snapshots and event subscriptions into React',
        );
        return;
      }

      if (elapsedMs < 2300) {
        loading.setStage(
          'activate-react',
          (elapsedMs - 1450) / 850,
          'Activating React lifecycle controls and visible runtime metrics',
        );
        return;
      }

      loading.complete('React starter ready');
      ctx.state.setPhase('ready', 'react-starter:ready');
      emitAction(ctx, 'React starter reached ready state');
      completed = true;
    },
    onStateChange(next: RuntimeSnapshot, previous: RuntimeSnapshot, ctx) {
      if (next.phase === 'paused') {
        emitAction(ctx, 'React starter paused');
      }

      if (next.phase === 'ready' && previous.phase === 'paused') {
        emitAction(ctx, 'React starter resumed');
      }

      if (next.phase === 'error') {
        emitAction(ctx, next.reason ?? 'React starter runtime error');
      }
    },
    dispose(ctx) {
      emitAction(ctx, 'React starter disposed');
    },
  };
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
      return loading.subscribe((next: LoadingSnapshot) => {
        setLoadingSnapshot(next);
      });
    } catch {
      return () => undefined;
    }
  }, [kernel, runtimeSnapshot.phase]);

  return loadingSnapshot;
}

function ReactStarterApp() {
  const kernel = useKernel();
  const runtimeSnapshot = useRuntimeSnapshot();
  const inspectorSnapshot = useRuntimeInspectorSnapshot();
  const runtimePhase = useRuntimePhase();
  const loadingSnapshot = useLoadingSnapshot();
  const [lastAction, setLastAction] = useState('Booting React starter proof');
  const [shutdownRequested, setShutdownRequested] = useState(false);

  useKernelEvent('runtime:shutdown', () => {
    setShutdownRequested(true);
    setLastAction('React starter shut down');
  });
  useKernelEvent<{ message?: string }>('runtime:error', (event) => {
    setLastAction(event.payload?.message ?? 'React starter runtime error');
  });
  useKernelEvent<ProofActionPayload>('react-starter:action', (event) => {
    setLastAction(event.payload?.message ?? 'React starter action');
  });

  const progressPercent = Math.round(loadingSnapshot.progress * 100);
  const visibleEventHistory = getVisibleInspectorEvents(inspectorSnapshot);
  const latestEvent = visibleEventHistory[0]?.type ?? 'kernel:init';
  const isShutdown = shutdownRequested || inspectorSnapshot.disposed;
  const pauseDisabled = isShutdown || runtimePhase !== 'ready';
  const resumeDisabled = isShutdown || runtimePhase !== 'paused';
  const shutdownDisabled = isShutdown;

  const phaseStatus =
    runtimePhase === 'loading'
      ? 'React starter loading'
      : runtimePhase === 'paused'
        ? 'React starter paused'
        : runtimePhase === 'ready'
          ? 'React starter ready'
          : runtimePhase === 'error'
            ? 'React starter error'
            : 'Booting React starter';

  return (
    <main className="react-proof">
      <section className="react-proof__hero">
        <h1>URK React Starter</h1>
        <p>
          Thin React bindings around an existing URK kernel instance. This proof keeps the flow
          DOM-first and loading-focused so runtime state, event routing, and lifecycle behavior stay
          obvious.
        </p>
        <div className="react-proof__status">{phaseStatus}</div>
      </section>

      <section className="react-proof__grid">
        <section className="react-proof__panel">
          <div className="react-proof__metrics">
            <article className="react-proof__meta-card">
              <span>Phase</span>
              <strong>{runtimeSnapshot.phase}</strong>
              <p>Canonical runtime phase from the shared RuntimeStore.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Reason</span>
              <strong>{runtimeSnapshot.reason ?? 'None'}</strong>
              <p>Current runtime reason as observed by useRuntimeSnapshot().</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Loading Stage</span>
              <strong>{loadingSnapshot.stageLabel ?? 'Waiting'}</strong>
              <p>Staged loading still comes from the loading adapter, not React state alone.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Latest Event</span>
              <strong>{latestEvent}</strong>
              <p>Recent event state is now driven by the wrapper-facing inspector snapshot.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Latest Action</span>
              <strong>{lastAction}</strong>
              <p>Controller activity and lifecycle actions stay visible in the React shell.</p>
            </article>
          </div>

          <section className="react-proof__progress" aria-label="Loading progress">
            <div className="react-proof__progress-copy">
              <strong>{loadingSnapshot.stageLabel ?? 'Waiting'}</strong>
              <span>{progressPercent}%</span>
            </div>
            <div className="react-proof__progress-track">
              <div
                className="react-proof__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p>{loadingSnapshot.message}</p>
          </section>

          <div className="react-proof__controls">
            <button
              type="button"
              data-tone="active"
              disabled={pauseDisabled}
              onClick={() => kernel.pause('react-starter:pause')}
            >
              Pause
            </button>
            <button
              type="button"
              data-tone="active"
              disabled={resumeDisabled}
              onClick={() => kernel.resume('react-starter:resume')}
            >
              Resume
            </button>
            <button
              type="button"
              data-tone="danger"
              disabled={shutdownDisabled}
              onClick={() => {
                setShutdownRequested(true);
                setLastAction('React starter shutting down');
                void kernel.shutdown('react-starter:shutdown').catch((error: unknown) => {
                  const message =
                    error instanceof Error ? error.message : 'React starter shutdown failed';
                  setLastAction(message);
                });
              }}
            >
              Shutdown
            </button>
          </div>

        </section>

        <section className="react-proof__transport">
          <strong>React wrapper proof</strong>
          <h2>{runtimeSnapshot.phase === 'ready' ? 'Inspector parity ready' : 'Preparing inspector view'}</h2>
          <p>
            React still consumes an existing kernel instance, but it can now subscribe to the
            bounded runtime inspector directly instead of rebuilding diagnostics state in the
            component tree.
          </p>

          <div className="react-proof__inspector-grid">
            <article className="react-proof__meta-card">
              <span>Runtime ID</span>
              <strong>{inspectorSnapshot.runtimeId}</strong>
              <p>Stable kernel identity exposed through the wrapper layer.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Booted / Disposed</span>
              <strong>
                {inspectorSnapshot.booted ? 'yes' : 'no'} / {inspectorSnapshot.disposed ? 'yes' : 'no'}
              </strong>
              <p>Lifecycle ownership stays in the kernel while React only observes it.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Scheduler</span>
              <strong>{inspectorSnapshot.schedulerRunning ? 'running' : 'stopped'}</strong>
              <p>Pause and shutdown stop scheduler-driven activity at the source.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Frame Count</span>
              <strong>{inspectorSnapshot.frameCount}</strong>
              <p>The visible tick is now the kernel frame count from the inspector snapshot.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Total Events</span>
              <strong>{inspectorSnapshot.totalEvents}</strong>
              <p>Bounded recent events are preserved without a React-owned event mirror.</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Registry Counts</span>
              <strong>
                {inspectorSnapshot.adapters.length} / {inspectorSnapshot.controllers.length} /{' '}
                {inspectorSnapshot.services.length}
              </strong>
              <p className="react-proof__registry-summary">
                adapters / controllers / services
              </p>
            </article>
          </div>

          <section className="react-proof__event-history" aria-label="Inspector recent events">
            <h3>Inspector recent events</h3>
            <ol>
              {visibleEventHistory.map((event) => (
                <li key={`${event.timestamp}-${event.type}-${event.source}`}>
                  <strong>{event.type}</strong>
                  <div className="react-proof__event-meta">
                    <small>{event.source}</small>
                    <small>{formatEventTime(event.timestamp)}</small>
                  </div>
                  <span className="react-proof__event-payload">{summarizePayload(event.payload)}</span>
                </li>
              ))}
            </ol>
          </section>

          <p>
            Reload the page to confirm that a fresh kernel instance boots cleanly through the same
            wrapper path with a fresh inspector snapshot.
          </p>
        </section>
      </section>
    </main>
  );
}

function ReactStarterRoot() {
  const kernel = useMemo(() => {
    return createKernel({
      id: 'urk-react-starter',
      adapters: [createLoadingAdapter()],
      controllers: [createReactStarterController()],
    });
  }, []);

  return (
    <UrkProvider kernel={kernel}>
      <ReactStarterApp />
    </UrkProvider>
  );
}

function main(): void {

  const app = document.getElementById('app');

  if (!app) {
    throw new Error('Missing #app root for the React starter proof.');
  }

  createRoot(app).render(<ReactStarterRoot />);
}

main();
