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

export interface RegisteredController {
  id: string;
  initialized: boolean;
  started: boolean;
  registration: ControllerRegistration;
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}

export class ControllerRegistry {
  private controllers: Map<string, RegisteredController> = new Map();

  register(registration: ControllerRegistration): void {
    if (this.controllers.has(registration.id)) {
      throw new Error(`Controller already registered: ${registration.id}`);
    }

    this.controllers.set(registration.id, {
      id: registration.id,
      initialized: false,
      started: false,
      registration,
    });
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
      ...record,
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
    const record = this.requireRecord(id);

    if (record.initialized) {
      return;
    }

    if (record.registration.init) {
      await record.registration.init(ctx);
    }

    record.initialized = true;
  }

  async startOne(id: string, ctx: RuntimeContext): Promise<void> {
    const record = this.requireRecord(id);

    if (record.started) {
      return;
    }

    if (!record.initialized) {
      await this.initializeOne(id, ctx);
    }

    if (record.registration.start) {
      await record.registration.start(ctx);
    }

    record.started = true;
  }

  updateAll(frame: FrameInfo, ctx: RuntimeContext): void {
    for (const record of this.controllers.values()) {
      record.registration.update?.(frame, ctx);
    }
  }

  async notifyStateChange(
    next: RuntimeSnapshot,
    previous: RuntimeSnapshot,
    ctx: RuntimeContext,
  ): Promise<void> {
    for (const record of this.controllers.values()) {
      if (record.registration.onStateChange) {
        await record.registration.onStateChange(next, previous, ctx);
      }
    }
  }

  async disposeAll(ctx: RuntimeContext): Promise<void> {
    const records = [...this.controllers.values()].reverse();
    let firstError: Error | null = null;

    for (const record of records) {
      try {
        if (record.registration.dispose) {
          await record.registration.dispose(ctx);
        }
      } catch (error) {
        if (!firstError) {
          firstError = normalizeError(error, `Failed to dispose controller: ${record.id}`);
        }
      }
    }

    this.controllers.clear();

    if (firstError) {
      throw firstError;
    }
  }

  private requireRecord(id: string): RegisteredController {
    const record = this.controllers.get(id);

    if (!record) {
      throw new Error(`Missing required controller: ${id}`);
    }

    return record;
  }
}
