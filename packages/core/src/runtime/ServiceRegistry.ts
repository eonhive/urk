/**
 * Company: EonHive Inc.
 * Title: Service Registry
 * Purpose: Hold shared URK runtime services behind explicit named lookups.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import type { CapabilityToken } from '../capabilities/token.js';

export interface RegisteredService<TValue = unknown> {
  name: string;
  value: TValue;
}

export class ServiceRegistry {
  private services: Map<string, unknown> = new Map();
  private closed = false;
  private revision = 0;
  private readonly namesByToken = new Map<symbol, string>();

  constructor(
    private readonly reservedTokens = new Set<symbol>(),
    private readonly assertKernelActive?: () => void,
  ) {}

  getRevision(): number {
    return this.revision;
  }

  register<TValue>(key: string | CapabilityToken<TValue>, value: TValue): TValue {
    const name = typeof key === 'string' ? key : key.name;
    if (this.closed) {
      throw new Error('Cannot register a service after disposal begins.');
    }
    this.assertKernelActive?.();

    if (this.services.has(name)) {
      throw new Error(`Service already registered: ${name}`);
    }

    if (typeof key !== 'string') {
      if (this.reservedTokens.has(key.key)) {
        throw new Error(`Capability token already registered: ${key.name}`);
      }
      this.reservedTokens.add(key.key);
      this.namesByToken.set(key.key, name);
    }

    this.services.set(name, value);
    this.revision += 1;
    return value;
  }

  get<TValue = unknown>(key: string | CapabilityToken<TValue>): TValue | undefined {
    const name = typeof key === 'string' ? key : this.namesByToken.get(key.key);
    if (name === undefined) return undefined;
    return this.services.get(name) as TValue | undefined;
  }

  require<TValue = unknown>(key: string | CapabilityToken<TValue>): TValue {
    const value = this.get<TValue>(key);

    if (value === undefined) {
      const name = typeof key === 'string' ? key : key.name;
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

  beginShutdown(): void {
    this.closed = true;
  }

  clear(): void {
    // Services are borrowed. Release references without destroying their values.
    if (this.services.size > 0) {
      this.revision += 1;
    }
    this.services.clear();
    for (const key of this.namesByToken.keys()) this.reservedTokens.delete(key);
    this.namesByToken.clear();
  }
}
