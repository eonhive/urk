/**
 * Company: EonHive Inc.
 * Title: Adapter Registry
 * Purpose: Register and dispose URK adapter capabilities through one explicit runtime registry.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration, RuntimeContext } from '../types.js';

export interface RegisteredAdapter<TApi = unknown> {
  id: string;
  capability: string;
  api: TApi;
  registration: AdapterRegistration<TApi>;
}

function normalizeError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
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
