/**
 * Company: EonHive Inc.
 * Title: Runtime Inspector
 * Purpose: Expose a small read-only diagnostics snapshot for the URK kernel.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import type { KernelEvent, RuntimeContext, RuntimeSnapshot } from '../types.js';

export interface InspectableAdapter {
  readonly id: string;
  readonly capability: string;
}

export interface InspectableController {
  readonly id: string;
  readonly initialized: boolean;
  readonly started: boolean;
}

export interface InspectableService {
  readonly name: string;
  readonly kind: string;
}

export interface RuntimeInspectorSnapshot {
  readonly runtimeId: string;
  readonly revision: number;
  readonly runtime: Readonly<RuntimeSnapshot>;
  readonly booted: boolean;
  readonly disposed: boolean;
  readonly schedulerRunning: boolean;
  readonly frameCount: number;
  readonly updatedAt: number;
  readonly totalEvents: number;
  readonly recentEvents: readonly Readonly<KernelEvent>[];
  readonly adapters: readonly InspectableAdapter[];
  readonly controllers: readonly InspectableController[];
  readonly services: readonly InspectableService[];
}

export type RuntimeInspectorListener = (snapshot: RuntimeInspectorSnapshot) => void;

export interface RuntimeInspector {
  getSnapshot(): RuntimeInspectorSnapshot;
  subscribe(listener: RuntimeInspectorListener): () => void;
}

type RuntimeInspectorStatus = {
  booted: boolean;
  disposed: boolean;
  schedulerRunning: boolean;
  frameCount: number;
};

type RuntimeInspectorInternal = RuntimeInspector & {
  publish(): void;
  dispose(): void;
};

const DEFAULT_RECENT_EVENT_LIMIT = 60;
const SAMPLE_INTERVAL_MS = 200;
const EVENT_LABEL_LIMIT = 200;

function describeServiceKind(value: unknown): string {
  try {
    return readServiceKind(value);
  } catch {
    // Borrowed values can expose throwing getters or revoked proxies.
    return 'object';
  }
}

function readServiceKind(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof window !== 'undefined' && value === window) {
    return 'Window';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return `HTMLElement(<${value.tagName.toLowerCase()}>)`;
  }

  const primitiveType = typeof value;

  if (
    primitiveType === 'string' ||
    primitiveType === 'number' ||
    primitiveType === 'boolean' ||
    primitiveType === 'function' ||
    primitiveType === 'bigint' ||
    primitiveType === 'symbol'
  ) {
    return primitiveType;
  }

  if (primitiveType === 'object') {
    const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;

    if (typeof constructorName === 'string' && constructorName !== 'Object') {
      return constructorName.slice(0, EVENT_LABEL_LIMIT);
    }

    return 'object';
  }

  return 'unknown';
}

class KernelRuntimeInspector implements RuntimeInspectorInternal {
  private snapshot: RuntimeInspectorSnapshot | null = null;
  private lastPublishedSnapshot: RuntimeInspectorSnapshot | null = null;
  private readonly listeners: Set<RuntimeInspectorListener> = new Set();
  private readonly recentEvents: Readonly<KernelEvent>[] = [];
  private totalEvents = 0;
  private unsubscribeState: (() => void) | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private stateRevision = -1;
  private adapterRevision = -1;
  private controllerRevision = -1;
  private serviceRevision = -1;
  private disposed = false;
  private readonly maxRecentEvents: number;

  constructor(
    private readonly ctx: RuntimeContext,
    private readonly getStatus: () => RuntimeInspectorStatus,
    maxRecentEvents = DEFAULT_RECENT_EVENT_LIMIT,
  ) {
    this.maxRecentEvents = Number.isFinite(maxRecentEvents)
      ? Math.max(0, Math.floor(maxRecentEvents))
      : DEFAULT_RECENT_EVENT_LIMIT;
  }

  getSnapshot(): RuntimeInspectorSnapshot {
    if (!this.disposed || !this.snapshot) {
      this.snapshot = this.readSnapshot();
    }
    return this.snapshot;
  }

  subscribe(listener: RuntimeInspectorListener): () => void {
    if (this.disposed) {
      return () => undefined;
    }
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.attach();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.detach();
      }
    };
  }

  publish(): void {
    if (this.disposed || this.listeners.size === 0) {
      return;
    }
    const next = this.getSnapshot();
    if (next === this.lastPublishedSnapshot) {
      return;
    }
    this.lastPublishedSnapshot = next;

    for (const listener of [...this.listeners]) {
      // Reentrant publication already delivers the newer value to remaining listeners.
      if (next !== this.lastPublishedSnapshot) {
        break;
      }
      if (this.disposed || !this.listeners.has(listener)) {
        continue;
      }
      try {
        listener(next);
      } catch {
        // Diagnostics observers cannot interrupt runtime or sibling notifications.
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    // Preserve terminal values even if a caller later mutates a captured context.
    this.snapshot = this.readSnapshot();
    this.disposed = true;
    this.detach();
    this.listeners.clear();
  }

  private attach(): void {
    if (this.unsubscribeState) {
      return;
    }
    this.unsubscribeState = this.ctx.state.subscribe(() => { this.publish(); });
    this.unsubscribeEvents = this.ctx.events.onAny((event) => {
      this.totalEvents += 1;
      if (this.maxRecentEvents > 0) {
        // Event payloads can own entire resource graphs; diagnostics keep metadata only.
        this.recentEvents.push(Object.freeze({
          type: event.type.slice(0, EVENT_LABEL_LIMIT),
          source: event.source.slice(0, EVENT_LABEL_LIMIT),
          timestamp: event.timestamp,
        }));
        if (this.recentEvents.length > this.maxRecentEvents) {
          this.recentEvents.shift();
        }
      }
      this.publish();
    });
    this.sampleTimer = setInterval(() => { this.publish(); }, SAMPLE_INTERVAL_MS);
  }

  private detach(): void {
    this.unsubscribeState?.();
    this.unsubscribeEvents?.();
    this.unsubscribeState = null;
    this.unsubscribeEvents = null;
    if (this.sampleTimer !== null) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    this.lastPublishedSnapshot = null;
  }

  private readSnapshot(): RuntimeInspectorSnapshot {
    const status = this.getStatus();
    const stateRevision = this.ctx.state.getRevision();
    const adapterRevision = this.ctx.adapters.getRevision();
    const controllerRevision = this.ctx.controllers.getRevision();
    const serviceRevision = this.ctx.services.getRevision();
    const previous = this.snapshot;
    if (previous && this.stateRevision === stateRevision &&
      this.adapterRevision === adapterRevision && this.controllerRevision === controllerRevision &&
      this.serviceRevision === serviceRevision && previous.totalEvents === this.totalEvents &&
      previous.booted === status.booted && previous.disposed === status.disposed &&
      previous.schedulerRunning === status.schedulerRunning && previous.frameCount === status.frameCount) {
      return previous;
    }

    const next: RuntimeInspectorSnapshot = Object.freeze({
      runtimeId: this.ctx.id,
      revision: (previous?.revision ?? -1) + 1,
      runtime: previous && this.stateRevision === stateRevision
        ? previous.runtime
        : Object.freeze(this.ctx.state.getSnapshot()),
      ...status,
      updatedAt: Date.now(),
      totalEvents: this.totalEvents,
      recentEvents: previous && previous.totalEvents === this.totalEvents
        ? previous.recentEvents
        : Object.freeze([...this.recentEvents]),
      adapters: previous && this.adapterRevision === adapterRevision
        ? previous.adapters
        : Object.freeze(this.ctx.adapters.list().map((record) => Object.freeze({
          id: record.id,
          capability: record.capability,
        }))),
      controllers: previous && this.controllerRevision === controllerRevision
        ? previous.controllers
        : Object.freeze(this.ctx.controllers.list().map((record) => Object.freeze({
          id: record.id,
          initialized: record.initialized,
          started: record.started,
        }))),
      services: previous && this.serviceRevision === serviceRevision
        ? previous.services
        : Object.freeze(this.ctx.services.list().map((record) => Object.freeze({
          name: record.name,
          kind: describeServiceKind(record.value),
        }))),
    });
    this.stateRevision = stateRevision;
    this.adapterRevision = adapterRevision;
    this.controllerRevision = controllerRevision;
    this.serviceRevision = serviceRevision;
    return next;
  }
}

export function createRuntimeInspector(
  ctx: RuntimeContext,
  getStatus: () => RuntimeInspectorStatus,
  maxRecentEvents = DEFAULT_RECENT_EVENT_LIMIT,
): RuntimeInspectorInternal {
  return new KernelRuntimeInspector(ctx, getStatus, maxRecentEvents);
}
