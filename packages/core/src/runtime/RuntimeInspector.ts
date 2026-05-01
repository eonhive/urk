/**
 * Company: EonHive Inc.
 * Title: Runtime Inspector
 * Purpose: Expose a small read-only diagnostics snapshot for the URK kernel.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

import type { KernelEvent, RuntimeContext, RuntimeSnapshot } from '../types.js';

export interface InspectableAdapter {
  id: string;
  capability: string;
}

export interface InspectableController {
  id: string;
  initialized: boolean;
  started: boolean;
}

export interface InspectableService {
  name: string;
  kind: string;
}

export interface RuntimeInspectorSnapshot {
  runtimeId: string;
  runtime: RuntimeSnapshot;
  booted: boolean;
  disposed: boolean;
  schedulerRunning: boolean;
  frameCount: number;
  updatedAt: number;
  totalEvents: number;
  recentEvents: KernelEvent[];
  adapters: InspectableAdapter[];
  controllers: InspectableController[];
  services: InspectableService[];
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
};

const DEFAULT_RECENT_EVENT_LIMIT = 60;

function cloneEvent(event: KernelEvent): KernelEvent {
  return {
    ...event,
  };
}

function describeServiceKind(value: unknown): string {
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

    if (constructorName && constructorName !== 'Object') {
      return constructorName;
    }

    return 'object';
  }

  return 'unknown';
}

class KernelRuntimeInspector implements RuntimeInspectorInternal {
  private snapshot: RuntimeInspectorSnapshot;
  private readonly listeners: Set<RuntimeInspectorListener> = new Set();
  private readonly recentEvents: KernelEvent[] = [];
  private totalEvents = 0;

  constructor(
    private readonly ctx: RuntimeContext,
    private readonly getStatus: () => RuntimeInspectorStatus,
    private readonly maxRecentEvents = DEFAULT_RECENT_EVENT_LIMIT,
  ) {
    this.snapshot = this.buildSnapshot();

    this.ctx.state.subscribe(() => {
      this.publish();
    });

    this.ctx.events.onAny((event) => {
      this.totalEvents += 1;
      this.recentEvents.push(cloneEvent(event));

      if (this.recentEvents.length > this.maxRecentEvents) {
        this.recentEvents.shift();
      }

      this.publish();
    });

    this.publish();
  }

  getSnapshot(): RuntimeInspectorSnapshot {
    return {
      ...this.snapshot,
      runtime: { ...this.snapshot.runtime },
      recentEvents: this.snapshot.recentEvents.map((event) => cloneEvent(event)),
      adapters: this.snapshot.adapters.map((adapter) => ({ ...adapter })),
      controllers: this.snapshot.controllers.map((controller) => ({ ...controller })),
      services: this.snapshot.services.map((service) => ({ ...service })),
    };
  }

  subscribe(listener: RuntimeInspectorListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(): void {
    this.snapshot = this.buildSnapshot();
    const next = this.getSnapshot();

    for (const listener of [...this.listeners]) {
      listener(next);
    }
  }

  private buildSnapshot(): RuntimeInspectorSnapshot {
    const status = this.getStatus();

    return {
      runtimeId: this.ctx.id,
      runtime: this.ctx.state.getSnapshot(),
      booted: status.booted,
      disposed: status.disposed,
      schedulerRunning: status.schedulerRunning,
      frameCount: status.frameCount,
      updatedAt: Date.now(),
      totalEvents: this.totalEvents,
      recentEvents: this.recentEvents.map((event) => cloneEvent(event)),
      adapters: this.ctx.adapters.list().map((record) => ({
        id: record.id,
        capability: record.capability,
      })),
      controllers: this.ctx.controllers.list().map((record) => ({
        id: record.id,
        initialized: record.initialized,
        started: record.started,
      })),
      services: this.ctx.services.list().map((record) => ({
        name: record.name,
        kind: describeServiceKind(record.value),
      })),
    };
  }
}

export function createRuntimeInspector(
  ctx: RuntimeContext,
  getStatus: () => RuntimeInspectorStatus,
  maxRecentEvents = DEFAULT_RECENT_EVENT_LIMIT,
): RuntimeInspectorInternal {
  return new KernelRuntimeInspector(ctx, getStatus, maxRecentEvents);
}
