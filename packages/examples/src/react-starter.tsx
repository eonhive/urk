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
  type KernelEvent,
  type RuntimeContext,
  type RuntimeSnapshot,
} from '@urk/core';
import { createLoadingAdapter, type LoadingAdapterApi, type LoadingSnapshot } from '@urk/adapters/dom';
import { UrkProvider, useEventBus, useKernel, useRuntimeSnapshot } from '@urk/react-urk';

type ProofActionPayload = {
  message: string;
};

type TickPayload = {
  frameTick: number;
};

const STAGES = [
  { id: 'bootstrap-react', label: 'Bootstrap React' },
  { id: 'bind-runtime', label: 'Bind Runtime' },
  { id: 'activate-react', label: 'Activate React' },
] as const;

const STYLE_ID = 'urk-react-starter-styles';

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

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.16), transparent 36%),
        radial-gradient(circle at bottom right, rgba(34, 197, 94, 0.12), transparent 38%),
        #f4f7fb;
      color: #0f172a;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
    }

    button {
      font: inherit;
      cursor: pointer;
    }

    #app {
      min-height: 100vh;
      padding: 28px;
    }

    .react-proof {
      width: min(1120px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 22px;
    }

    .react-proof__hero,
    .react-proof__panel,
    .react-proof__transport {
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 28px;
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(18px);
    }

    .react-proof__hero {
      padding: 24px 26px;
      display: grid;
      gap: 12px;
    }

    .react-proof__hero h1,
    .react-proof__transport h2 {
      margin: 0;
      font-size: clamp(2.1rem, 4vw, 3rem);
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .react-proof__hero p,
    .react-proof__transport p,
    .react-proof__meta-card p {
      margin: 0;
      color: #475569;
      line-height: 1.6;
    }

    .react-proof__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px;
      align-items: start;
    }

    .react-proof__panel,
    .react-proof__transport {
      padding: 24px;
      display: grid;
      gap: 18px;
    }

    .react-proof__metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .react-proof__meta-card {
      padding: 16px 18px;
      border-radius: 20px;
      background: linear-gradient(145deg, rgba(241, 245, 249, 0.95), rgba(255, 255, 255, 0.96));
      border: 1px solid rgba(148, 163, 184, 0.16);
      display: grid;
      gap: 8px;
    }

    .react-proof__meta-card span {
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748b;
    }

    .react-proof__meta-card strong {
      font-size: 1.2rem;
      line-height: 1.2;
      color: #0f172a;
    }

    .react-proof__progress {
      display: grid;
      gap: 10px;
    }

    .react-proof__progress-copy {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      color: #0f172a;
      font-weight: 700;
    }

    .react-proof__progress-track {
      height: 14px;
      border-radius: 999px;
      background: rgba(226, 232, 240, 0.9);
      overflow: hidden;
    }

    .react-proof__progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #0ea5e9, #14b8a6, #22c55e);
      transition: width 160ms linear;
    }

    .react-proof__controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .react-proof__controls button {
      border: 0;
      border-radius: 999px;
      padding: 11px 16px;
      font-weight: 700;
      color: #f8fafc;
      background: #0f172a;
      transition: transform 140ms ease, opacity 140ms ease;
    }

    .react-proof__controls button[data-tone="active"] {
      background: #0f766e;
    }

    .react-proof__controls button[data-tone="danger"] {
      background: #b91c1c;
    }

    .react-proof__controls button:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .react-proof__controls button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }

    .react-proof__status {
      display: inline-flex;
      align-items: center;
      width: max-content;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.86);
      color: #f8fafc;
      font-weight: 700;
      font-size: 0.9rem;
    }

    .react-proof__transport {
      min-height: 100%;
      align-content: start;
    }

    .react-proof__transport strong {
      font-size: 1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f766e;
    }

    @media (max-width: 900px) {
      #app {
        padding: 18px;
      }

      .react-proof__grid,
      .react-proof__metrics {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.append(style);
}

function emitAction(ctx: RuntimeContext, message: string): void {
  ctx.events.emit({
    type: 'react-starter:action',
    source: 'react-starter-controller',
    payload: { message } satisfies ProofActionPayload,
    timestamp: Date.now(),
  });
}

function emitTick(ctx: RuntimeContext, frameTick: number): void {
  ctx.events.emit({
    type: 'react-starter:tick',
    source: 'react-starter-controller',
    payload: { frameTick } satisfies TickPayload,
    timestamp: Date.now(),
  });
}

function createReactStarterController(): ControllerRegistration {
  let elapsedMs = 0;
  let frameTick = 0;
  let completed = false;

  return {
    id: 'react-starter-controller',
    start(ctx) {
      const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
      loading.begin([...STAGES], 'Initializing React wrapper proof');
      emitAction(ctx, 'Started staged React loading');
    },
    update(frame: FrameInfo, ctx) {
      frameTick += 1;
      emitTick(ctx, frameTick);

      if (completed) {
        return;
      }

      elapsedMs += frame.deltaMs;
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
  const loadingSnapshot = useLoadingSnapshot();
  const eventBus = useEventBus();

  const [frameTick, setFrameTick] = useState(0);
  const [latestEvent, setLatestEvent] = useState('kernel:init');
  const [lastAction, setLastAction] = useState('Booting React starter proof');
  const [isShutdown, setIsShutdown] = useState(false);

  useEffect(() => {
    const trackedEvents = [
      'loading:changed',
      'runtime:booted',
      'runtime:phase-changed',
      'runtime:paused',
      'runtime:resumed',
      'runtime:shutdown',
      'runtime:error',
      'react-starter:tick',
      'react-starter:action',
    ] as const;

    const unsubscribers = trackedEvents.map((eventType) =>
      eventBus.on(eventType, (event: KernelEvent) => {
        setLatestEvent(event.type);

        if (event.type === 'react-starter:tick') {
          const payload = event.payload as TickPayload | undefined;
          setFrameTick(payload?.frameTick ?? 0);
        }

        if (event.type === 'react-starter:action') {
          const payload = event.payload as ProofActionPayload | undefined;
          setLastAction(payload?.message ?? 'React starter action');
        }

        if (event.type === 'runtime:shutdown') {
          setIsShutdown(true);
          setLastAction('React starter shut down');
        }

        if (event.type === 'runtime:error') {
          const payload = event.payload as { message?: string } | undefined;
          setLastAction(payload?.message ?? 'React starter runtime error');
        }
      }),
    );

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [eventBus]);

  const progressPercent = Math.round(loadingSnapshot.progress * 100);
  const pauseDisabled = isShutdown || runtimeSnapshot.phase !== 'ready';
  const resumeDisabled = isShutdown || runtimeSnapshot.phase !== 'paused';
  const shutdownDisabled = isShutdown;

  const phaseStatus =
    runtimeSnapshot.phase === 'loading'
      ? 'React starter loading'
      : runtimeSnapshot.phase === 'paused'
        ? 'React starter paused'
        : runtimeSnapshot.phase === 'ready'
          ? 'React starter ready'
          : runtimeSnapshot.phase === 'error'
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
              <p>React consumes the kernel event bus directly through useEventBus().</p>
            </article>

            <article className="react-proof__meta-card">
              <span>Frame Tick</span>
              <strong>{frameTick}</strong>
              <p>Scheduler-driven updates stop in paused and after shutdown.</p>
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
                setIsShutdown(true);
                setLastAction('React starter shutting down');
                void kernel.shutdown('react-starter:shutdown').catch((error: unknown) => {
                  const message =
                    error instanceof Error ? error.message : 'React starter shutdown failed';
                  setLastAction(message);
                  setLatestEvent('runtime:error');
                });
              }}
            >
              Shutdown
            </button>
          </div>
        </section>

        <section className="react-proof__transport">
          <strong>React wrapper proof</strong>
          <h2>{runtimeSnapshot.phase === 'ready' ? 'Runtime ready' : 'Preparing runtime'}</h2>
          <p>
            The kernel still owns lifecycle, runtime state, scheduler activity, and controller flow.
            React is only subscribing to that state and projecting it into a component tree.
          </p>
          <p>
            Reload the page to confirm that a fresh kernel instance boots cleanly through the same
            wrapper path.
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
  installStyles();

  const app = document.getElementById('app');

  if (!app) {
    throw new Error('Missing #app root for the React starter proof.');
  }

  createRoot(app).render(<ReactStarterRoot />);
}

main();
