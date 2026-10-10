/**
 * Company: EonHive Inc.
 * Title: Ownership Integration Runtime
 * Purpose: Measure actual kernel resources and control asynchronous hooks in private browser proofs.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import { BrowserFrameScheduler, createKernel, type Kernel, type RuntimeSnapshot } from '@urk/core';

export interface ProbeOptions {
  id?: string;
  blocked?: 'setup' | 'start';
}

export interface RuntimeProbe {
  kernel: Kernel;
  setupEntered: number;
  startEntered: number;
  startCompleted: number;
  disposals: number;
  ownedListeners: number;
  stateSubscriptions: number;
  stateSubscriptionStarts: number;
  eventSubscriptions: number;
  snapshotVersion: number;
  lastSnapshot: RuntimeSnapshot | null;
  wrapperEvents: string[];
  committed: boolean;
  release(): void;
}

const probes = new WeakMap<Kernel, RuntimeProbe>();
const committedProbes: RuntimeProbe[] = [];
const pendingFrames = new Map<number, RuntimeProbe>();
const pendingIntervals = new Map<number, RuntimeProbe>();
let activeProbe: RuntimeProbe | null = null;
let trackingInstalled = false;

function withProbe<T>(probe: RuntimeProbe | null, action: () => T): T {
  const previous = activeProbe;
  activeProbe = probe;
  try {
    return action();
  } finally {
    activeProbe = previous;
  }
}

function installPlatformTracking(): void {
  if (trackingInstalled) {
    return;
  }
  trackingInstalled = true;
  // Use DOM-only signatures; the Next proof also loads Node's ambient timer types.
  const browserWindow: Window = window;
  const requestFrame = browserWindow.requestAnimationFrame.bind(browserWindow);
  const cancelFrame = browserWindow.cancelAnimationFrame.bind(browserWindow);
  const setInterval = browserWindow.setInterval.bind(browserWindow);
  const clearInterval = browserWindow.clearInterval.bind(browserWindow);

  browserWindow.requestAnimationFrame = (callback) => {
    const probe = activeProbe;
    const handle = requestFrame((time) => {
      pendingFrames.delete(handle);
      withProbe(probe, () => callback(time));
    });
    if (probe) {
      pendingFrames.set(handle, probe);
    }
    return handle;
  };
  browserWindow.cancelAnimationFrame = (handle) => {
    pendingFrames.delete(handle);
    cancelFrame(handle);
  };
  browserWindow.setInterval = (callback, delay, ...args) => {
    const handle = setInterval(callback, delay, ...args);
    if (activeProbe) {
      pendingIntervals.set(handle, activeProbe);
    }
    return handle;
  };
  browserWindow.clearInterval = (handle) => {
    if (handle !== undefined) {
      pendingIntervals.delete(handle);
    }
    clearInterval(handle);
  };
}

export function createProbeKernel(options: ProbeOptions = {}): Kernel {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const scheduler = new BrowserFrameScheduler();
  let probe!: RuntimeProbe;
  const kernel = createKernel({
    id: options.id,
    scheduler: {
      start: (callback) => withProbe(probe, () => scheduler.start(callback)),
      stop: () => scheduler.stop(),
      isRunning: () => scheduler.isRunning(),
    },
    adapters: [{
      id: 'probe-adapter', capability: 'probe',
      async setup(ctx) {
        probe.setupEntered += 1;
        const listener = () => undefined;
        window.addEventListener('urk:probe', listener);
        probe.ownedListeners += 1;
        ctx.scope.defer(() => {
          window.removeEventListener('urk:probe', listener);
          probe.ownedListeners -= 1;
        });
        if (options.blocked === 'setup') {
          await gate;
        }
        return {};
      },
      dispose() { probe.disposals += 1; },
    }],
    controllers: [{
      id: 'probe-controller',
      async start(ctx) {
        probe.startEntered += 1;
        const timer = withProbe(probe, () => window.setInterval(() => undefined, 1000));
        ctx.scope.defer(() => { window.clearInterval(timer); });
        if (options.blocked === 'start') {
          await gate;
        }
        probe.startCompleted += 1;
      },
      update() {},
    }],
  });
  probe = {
    kernel, release, setupEntered: 0, startEntered: 0, startCompleted: 0,
    disposals: 0, ownedListeners: 0, stateSubscriptions: 0, stateSubscriptionStarts: 0, eventSubscriptions: 0,
    snapshotVersion: 0, lastSnapshot: null, wrapperEvents: [], committed: false,
  };
  probes.set(kernel, probe);
  return kernel;
}

export function getProbe(kernel: Kernel): RuntimeProbe {
  const probe = probes.get(kernel);
  if (!probe) {
    throw new Error('Missing integration runtime probe.');
  }
  return probe;
}

export function commitProbe(kernel: Kernel): void {
  const probe = getProbe(kernel);
  if (probe.committed) {
    return;
  }
  installPlatformTracking();
  probe.committed = true;
  committedProbes.push(probe);
  const ctx = kernel.getContext();
  const subscribeState = ctx.state.subscribe.bind(ctx.state);
  ctx.state.subscribe = (listener) => {
    probe.stateSubscriptions += 1;
    probe.stateSubscriptionStarts += 1;
    const unsubscribe = subscribeState(listener);
    let attached = true;
    return () => {
      if (attached) {
        attached = false;
        probe.stateSubscriptions -= 1;
        unsubscribe();
      }
    };
  };
  const subscribeEvents = ctx.events.onAny.bind(ctx.events);
  ctx.events.onAny = (listener) => {
    probe.eventSubscriptions += 1;
    const unsubscribe = subscribeEvents(listener);
    let attached = true;
    return () => {
      if (attached) {
        attached = false;
        probe.eventSubscriptions -= 1;
        unsubscribe();
      }
    };
  };
  const inspector = kernel.getInspector();
  const subscribeInspector = inspector.subscribe.bind(inspector);
  inspector.subscribe = (listener) => withProbe(probe, () => subscribeInspector(listener));
  const emit = ctx.events.emit.bind(ctx.events);
  ctx.events.emit = (event) => {
    if (event.source === 'react-urk') {
      probe.wrapperEvents.push(event.type);
    }
    emit(event);
  };
}

export function reports() {
  return committedProbes.map((probe) => {
    const ctx = probe.kernel.getContext();
    return {
      id: ctx.id,
      cancelled: ctx.signal.aborted,
      setupEntered: probe.setupEntered,
      startEntered: probe.startEntered,
      startCompleted: probe.startCompleted,
      disposals: probe.disposals,
      ownedListeners: probe.ownedListeners,
      stateSubscriptions: probe.stateSubscriptions,
      stateSubscriptionStarts: probe.stateSubscriptionStarts,
      eventSubscriptions: probe.eventSubscriptions,
      snapshotVersion: probe.snapshotVersion,
      wrapperEvents: [...probe.wrapperEvents],
      frames: [...pendingFrames.values()].filter((owner) => owner === probe).length,
      intervals: [...pendingIntervals.values()].filter((owner) => owner === probe).length,
      schedulerRunning: ctx.scheduler.isRunning(),
      adapters: ctx.adapters.list().length,
      controllers: ctx.controllers.list().length,
    };
  });
}
