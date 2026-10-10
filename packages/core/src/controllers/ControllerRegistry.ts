/**
 * Company: EonHive Inc.
 * Title: Controller Registry
 * Purpose: Track URK controller lifecycle state and coordinate controller execution.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import type {
  ControllerRegistration,
  FrameInfo,
  RuntimeContext,
  RuntimeSnapshot,
} from '../types.js';
import { CleanupError, ResourceScope } from '../resources/ResourceScope.js';

export interface RegisteredController {
  id: string;
  initialized: boolean;
  started: boolean;
  registration: ControllerRegistration;
}

interface ControllerRecord extends RegisteredController {
  order: number;
  context?: RuntimeContext;
  initializing?: Promise<void>;
  starting?: Promise<void>;
}

interface ActiveUpdate {
  order: number;
  registration: ControllerRegistration;
  context: RuntimeContext;
}

export class ControllerRegistry {
  private controllers: Map<string, ControllerRecord> = new Map();
  private activeControllers: ActiveUpdate[] = [];
  private pending = new Set<Promise<void>>();
  private closed = false;
  private disposal: Promise<void> | null = null;
  private revision = 0;

  constructor(
    private readonly onUpdatePlanChanged?: () => void,
    private readonly assertKernelActive?: () => void,
  ) {}

  getActiveUpdateCount(): number {
    return this.activeControllers.length;
  }

  getRevision(): number {
    return this.revision;
  }

  hasPendingStarts(): boolean {
    for (const record of this.controllers.values()) {
      if (!record.started) return true;
    }
    return false;
  }

  register(registration: ControllerRegistration): void {
    this.assertActive();
    if (this.controllers.has(registration.id)) {
      throw new Error(`Controller already registered: ${registration.id}`);
    }

    this.controllers.set(registration.id, {
      id: registration.id,
      order: this.controllers.size,
      initialized: false,
      started: false,
      registration,
    });
    this.revision += 1;
  }

  get(id: string): ControllerRegistration | undefined {
    return this.controllers.get(id)?.registration;
  }

  require(id: string): ControllerRegistration {
    const registration = this.get(id);

    if (!registration) {
      throw new Error(`Missing required controller: ${id}`);
    }

    return registration;
  }

  list(): RegisteredController[] {
    return [...this.controllers.values()].map((record) => ({
      id: record.id,
      initialized: record.initialized,
      started: record.started,
      registration: record.registration,
    }));
  }

  async initializeAll(ctx: RuntimeContext): Promise<void> {
    for (const id of this.controllers.keys()) {
      await this.initializeOne(id, ctx);
    }
  }

  async startAll(ctx: RuntimeContext): Promise<void> {
    for (const id of this.controllers.keys()) {
      await this.startOne(id, ctx);
    }
  }

  async initializeOne(id: string, ctx: RuntimeContext): Promise<void> {
    this.assertActive(ctx);
    const record = this.requireRecord(id);

    if (record.initializing) {
      return record.initializing;
    }

    if (record.initialized) {
      return Promise.resolve();
    }

    const context = this.getContext(record, ctx);
    // Install the promise before entering user hooks, which may request shutdown.
    record.initializing = this.track(Promise.resolve().then(async () => {
      this.assertActive(context);
      await record.registration.init?.(context);
      this.assertActive(context);
      record.initialized = true;
      this.revision += 1;
    }));

    return record.initializing;
  }

  async startOne(id: string, ctx: RuntimeContext): Promise<void> {
    this.assertActive(ctx);
    const record = this.requireRecord(id);

    if (record.starting) {
      return record.starting;
    }

    if (record.started) {
      return Promise.resolve();
    }

    const context = this.getContext(record, ctx);
    record.starting = this.track(Promise.resolve().then(async () => {
      await this.initializeOne(id, ctx);
      this.assertActive(context);
      await record.registration.start?.(context);
      this.assertActive(context);
      record.started = true;
      this.revision += 1;

      if (record.registration.update) {
        // Sequential startup appends. Concurrent starts insert at their registration position.
        // Startup settles in a microtask, so this cannot change membership mid-frame.
        let index = this.activeControllers.length;
        while (index > 0 && this.activeControllers[index - 1].order > record.order) index--;
        this.activeControllers.splice(index, 0, { order: record.order, registration: record.registration, context });
        this.onUpdatePlanChanged?.();
      }
    }));

    return record.starting;
  }

  updateAll(frame: FrameInfo, ctx: RuntimeContext): void {
    if (this.closed || ctx.signal.aborted) return;
    this.assertKernelActive?.();
    // Membership is captured once per frame; only completed starts enter this list.
    const active = this.activeControllers;
    for (const record of active) {
      if (this.closed || ctx.signal.aborted) {
        break;
      }

      record.registration.update?.(frame, record.context);
    }
  }

  notifyStateChange(
    next: RuntimeSnapshot,
    previous: RuntimeSnapshot,
    ctx: RuntimeContext,
  ): Promise<void> {
    if (this.closed || ctx.signal.aborted) {
      return Promise.resolve();
    }

    // Track before delivering the first notification, preserving its synchronous timing.
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const operation = this.track(new Promise<void>((complete, fail) => {
      resolve = complete;
      reject = fail;
    }));
    void this.deliverStateChange(next, previous, ctx).then(resolve, reject);
    return operation;
  }

  beginShutdown(): void {
    this.closed = true;
    this.activeControllers = [];
  }

  disposeAll(ctx: RuntimeContext): Promise<void> {
    if (this.disposal) {
      return this.disposal;
    }

    this.beginShutdown();
    this.disposal = Promise.resolve().then(() => this.disposeRecords(ctx));
    return this.disposal;
  }

  private async deliverStateChange(
    next: RuntimeSnapshot,
    previous: RuntimeSnapshot,
    ctx: RuntimeContext,
  ): Promise<void> {
    for (const record of this.controllers.values()) {
      if (this.closed || ctx.signal.aborted) {
        break;
      }

      if (record.registration.onStateChange) {
        await record.registration.onStateChange(next, previous, this.getContext(record, ctx));
      }
    }
  }

  private async disposeRecords(ctx: RuntimeContext): Promise<void> {
    await Promise.allSettled([...this.pending]);
    const records = [...this.controllers.values()].reverse();
    const errors: unknown[] = [];

    for (const record of records) {
      const context = this.getContext(record, ctx);
      try {
        await record.registration.dispose?.(context);
      } catch (error) {
        errors.push(error);
      }

      try {
        await context.scope.dispose();
      } catch (error) {
        errors.push(error);
      }
    }

    if (this.controllers.size > 0) {
      this.revision += 1;
    }
    this.controllers.clear();

    if (errors.length > 0) {
      throw new CleanupError(errors, 'Failed to dispose controllers');
    }
  }

  private getContext(record: ControllerRecord, ctx: RuntimeContext): RuntimeContext {
    record.context ??= { ...ctx, scope: new ResourceScope() };
    return record.context;
  }

  private track(operation: Promise<void>): Promise<void> {
    this.pending.add(operation);
    void operation.then(
      () => { this.pending.delete(operation); },
      () => { this.pending.delete(operation); },
    );
    return operation;
  }

  private assertActive(ctx?: RuntimeContext): void {
    if (this.closed || ctx?.signal.aborted) {
      throw new Error('Cannot activate a controller after disposal begins.');
    }
    this.assertKernelActive?.();
  }

  private requireRecord(id: string): ControllerRecord {
    const record = this.controllers.get(id);

    if (!record) {
      throw new Error(`Missing required controller: ${id}`);
    }

    return record;
  }
}
