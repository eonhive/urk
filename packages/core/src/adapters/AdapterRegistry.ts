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
import { CleanupError, ResourceScope } from '../resources/ResourceScope.js';
import type { CapabilityToken } from '../capabilities/token.js';

export interface RegisteredAdapter<TApi = unknown> {
  id: string;
  capability: string;
  api: TApi;
  registration: AdapterRegistration<TApi>;
}

interface OwnedAdapter extends RegisteredAdapter {
  context: RuntimeContext;
  order: number;
}

export class AdapterRegistry {
  private readonly adapters: OwnedAdapter[] = [];
  private readonly adaptersByKey = new Map<string | symbol, OwnedAdapter>();
  private readonly reservedAliases: Set<string> = new Set();
  private readonly pending: Set<Promise<unknown>> = new Set();
  private readonly cleanupErrors: unknown[] = [];
  private closed = false;
  private disposePromise: Promise<void> | null = null;
  private revision = 0;
  private nextOrder = 0;

  constructor(
    private readonly reservedTokens = new Set<symbol>(),
    private readonly assertKernelActive?: () => void,
    private readonly onSetupFailure?: (error: unknown) => void,
  ) {}

  isReserved(key: string | CapabilityToken<unknown>): boolean {
    return typeof key === 'string' ? this.reservedAliases.has(key) : this.reservedTokens.has(key.key);
  }

  getRevision(): number {
    return this.revision;
  }

  register<TApi>(registration: AdapterRegistration<TApi>, ctx: RuntimeContext): Promise<TApi> {
    const { id, capability, token } = registration;
    const tokenKey = token?.key;

    try {
      this.assertOpen(ctx);

      for (const alias of [id, capability]) {
        if (this.reservedAliases.has(alias)) {
          throw new Error(`Adapter ID or capability already registered: ${alias}`);
        }
      }

      if (token && this.reservedTokens.has(token.key)) {
        throw new Error(`Adapter token already registered: ${token.name}`);
      }

      for (const dependency of registration.dependsOn ?? []) {
        const service = typeof dependency === 'string' ? undefined : ctx.services?.get(dependency);
        if (!this.resolveRecord(dependency) && service === undefined) {
          const name = typeof dependency === 'string' ? dependency : dependency.name;
          throw new Error(`Adapter ${id} is missing dependency: ${name}`);
        }
      }
    } catch (error) {
      return Promise.reject(error);
    }

    this.reservedAliases.add(id);
    this.reservedAliases.add(capability);
    if (tokenKey !== undefined) {
      this.reservedTokens.add(tokenKey);
    }
    const context: RuntimeContext = {
      ...ctx,
      scope: new ResourceScope(),
      signal: ctx.signal,
    };
    const order = this.nextOrder++;

    // Track the operation before any user hook can request shutdown reentrantly.
    const operation = Promise.resolve()
      .then(() => this.setupOne(registration, context, id, capability, order, tokenKey))
      .finally(() => { this.pending.delete(operation); });
    this.pending.add(operation);

    return operation;
  }

  beginShutdown(): void {
    this.closed = true;
  }

  get<TApi = unknown>(key: string | CapabilityToken<TApi>): TApi | undefined {
    return this.resolveRecord(key)?.api as TApi | undefined;
  }

  has(key: string | CapabilityToken<unknown>): boolean {
    return this.resolveRecord(key) !== undefined;
  }

  require<TApi = unknown>(key: string | CapabilityToken<TApi>): TApi {
    const api = this.get<TApi>(key);

    if (api === undefined) {
      const name = typeof key === 'string' ? key : key.name;
      throw new Error(`Missing required adapter: ${name}`);
    }

    return api;
  }

  list(): RegisteredAdapter[] {
    return this.adapters.map(({ id, capability, api, registration }) => ({
      id,
      capability,
      api,
      registration,
    }));
  }

  disposeAll(_ctx: RuntimeContext): Promise<void> {
    this.beginShutdown();

    if (!this.disposePromise) {
      this.disposePromise = Promise.resolve().then(() => this.disposeAdapters());
    }

    return this.disposePromise;
  }

  private async setupOne<TApi>(
    registration: AdapterRegistration<TApi>,
    context: RuntimeContext,
    id: string,
    capability: string,
    order: number,
    tokenKey?: symbol,
  ): Promise<TApi> {
    let completed: RegisteredAdapter<TApi> | undefined;

    try {
      this.assertOpen(context);

      if (registration.isSupported && !registration.isSupported(context)) {
        throw new Error(`Adapter is not supported in this environment: ${id}`);
      }

      this.assertOpen(context);
      const api = await registration.setup(context);
      completed = { id, capability, api, registration };
      this.assertOpen(context);

      const record = { ...completed, context, order };
      // Completion timing must not change the cleanup order of parallel siblings.
      let index = this.adapters.length;
      while (index > 0 && this.adapters[index - 1].order > order) index--;
      this.adapters.splice(index, 0, record);
      this.adaptersByKey.set(id, record);
      this.adaptersByKey.set(capability, record);
      if (tokenKey !== undefined) {
        this.adaptersByKey.set(tokenKey, record);
      }
      this.revision += 1;
      return api;
    } catch (error) {
      this.onSetupFailure?.(error);
      await this.cleanup(context, completed);
      this.reservedAliases.delete(id);
      this.reservedAliases.delete(capability);
      if (tokenKey !== undefined) {
        this.reservedTokens.delete(tokenKey);
      }
      // Cleanup errors remain available to shutdown without replacing the initiating failure.
      throw error;
    }
  }

  private async disposeAdapters(): Promise<void> {
    await Promise.allSettled([...this.pending]);

    for (let index = this.adapters.length - 1; index >= 0; index--) {
      const record = this.adapters[index];
      await this.cleanup(record.context, record);
    }

    if (this.adapters.length > 0) {
      this.revision += 1;
    }
    this.adapters.length = 0;
    for (const key of this.adaptersByKey.keys()) {
      if (typeof key === 'symbol') this.reservedTokens.delete(key);
    }
    this.adaptersByKey.clear();
    this.reservedAliases.clear();

    if (this.cleanupErrors.length > 0) {
      throw new CleanupError(this.cleanupErrors, 'Adapter cleanup failed');
    }
  }

  private async cleanup(context: RuntimeContext, record?: RegisteredAdapter): Promise<void> {
    try {
      await record?.registration.dispose?.(context, record.api);
    } catch (error) {
      this.cleanupErrors.push(error);
    }

    try {
      await context.scope.dispose();
    } catch (error) {
      if (error instanceof CleanupError) {
        this.cleanupErrors.push(...error.errors);
      } else {
        this.cleanupErrors.push(error);
      }
    }
  }

  private assertOpen(context: RuntimeContext): void {
    if (this.closed || context.signal.aborted) {
      throw new Error('Cannot register an adapter after runtime shutdown begins.');
    }
    this.assertKernelActive?.();
  }

  private resolveRecord(key: string | CapabilityToken<unknown>): RegisteredAdapter | undefined {
    return this.adaptersByKey.get(typeof key === 'string' ? key : key.key);
  }
}
