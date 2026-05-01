/**
 * Company: EonHive Inc.
 * Title: Service Registry
 * Purpose: Hold shared URK runtime services behind explicit named lookups.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

export interface RegisteredService<TValue = unknown> {
  name: string;
  value: TValue;
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
