/**
 * Adapter, controller, and service registries.
 */

import type { RegisteredAdapter, RegisteredController, RegisteredService } from './registry.types.js';
import type {
  AdapterRegistration,
  ControllerRegistration,
  FrameInfo,
  RuntimeContext,
  RuntimeSnapshot,
} from './types.js';

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}

export class ServiceRegistry {
  private services: Map<string, unknown> = new Map();

  register<TValue>(name: string, value: TValue): TValue {
    if (this.services.has(name)) {
      throw new Error(`Service already registered: ${name}`);
    }

    this.services.set(name, value);
    return value;
  }

  get<TValue>(name: string): TValue | undefined {
    return this.services.get(name) as TValue | undefined;
  }

  require<TValue>(name: string): TValue {
    const value = this.get<TValue>(name);

    if (value === undefined) {
      throw new Error(`Missing required service: ${name}`);
    }

    return value;
  }

  list(): RegisteredService[] {
    return [...this.services.entries()].map(([name, value]) => ({
      name,
      value,
    }));
  }
}

export class AdapterRegistry {
  private adaptersById: Map<string, RegisteredAdapter> = new Map();
  private adapterIdsByCapability: Map<string, string> = new Map();

  async register<TApi>(registration: AdapterRegistration<TApi>, ctx: RuntimeContext): Promise<TApi> {
    if (this.adaptersById.has(registration.id)) {
      throw new Error(`Adapter already registered: ${registration.id}`);
    }

    if (this.adapterIdsByCapability.has(registration.capability)) {
      throw new Error(`Adapter capability already registered: ${registration.capability}`);
    }

    for (const dependency of registration.dependsOn ?? []) {
      if (!this.resolveRecord(dependency)) {
        throw new Error(`Adapter ${registration.id} is missing dependency: ${dependency}`);
      }
    }

    if (registration.isSupported && !registration.isSupported(ctx)) {
      throw new Error(`Adapter is not supported in this environment: ${registration.id}`);
    }

    const api = await registration.setup(ctx);
    const record: RegisteredAdapter<TApi> = {
      id: registration.id,
      capability: registration.capability,
      api,
      registration,
    };

    this.adaptersById.set(registration.id, record);
    this.adapterIdsByCapability.set(registration.capability, registration.id);

    return api;
  }

  get<TApi>(key: string): TApi | undefined {
    return this.resolveRecord(key)?.api as TApi | undefined;
  }

  require<TApi>(key: string): TApi {
    const api = this.get<TApi>(key);

    if (api === undefined) {
      throw new Error(`Missing required adapter: ${key}`);
    }

    return api;
  }

  list(): RegisteredAdapter[] {
    return [...this.adaptersById.values()].map((record) => ({
      ...record,
    }));
  }

  async disposeAll(ctx: RuntimeContext): Promise<void> {
    const records = [...this.adaptersById.values()].reverse();
    let firstError: Error | null = null;

    for (const record of records) {
      try {
        if (record.registration.dispose) {
          await record.registration.dispose(ctx, record.api);
        }
      } catch (error) {
        if (!firstError) {
          firstError = normalizeError(error, `Failed to dispose adapter: ${record.id}`);
        }
      }
    }

    this.adaptersById.clear();
    this.adapterIdsByCapability.clear();

    if (firstError) {
      throw firstError;
    }
  }

  private resolveRecord(key: string): RegisteredAdapter | undefined {
    const byId = this.adaptersById.get(key);

    if (byId) {
      return byId;
    }

    const adapterId = this.adapterIdsByCapability.get(key);

    if (!adapterId) {
      return undefined;
    }

    return this.adaptersById.get(adapterId);
  }
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

export * from './registry.types.js';
