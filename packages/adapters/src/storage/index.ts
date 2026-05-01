/**
 * Company: EonHive Inc.
 * Title: Storage Adapter
 * Purpose: Expose a small namespaced storage capability for local and session persistence.
 * Author: Stan Nesi
 * Created: 2026-04-21
 * Updated: 2026-04-21
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration, RuntimeContext } from '@urk/core';

export type StorageArea = 'local' | 'session';

export interface StorageAdapterOptions {
  id?: string;
  namespace?: string;
}

export interface StorageAdapterApi {
  getItem<T = unknown>(key: string, area?: StorageArea): T | null;
  setItem<T>(key: string, value: T, area?: StorageArea): void;
  removeItem(key: string, area?: StorageArea): void;
  listKeys(area?: StorageArea): string[];
  clear(area?: StorageArea): void;
}

type StorageBackendLike = {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const DEFAULT_NAMESPACE = 'urk';

function isStorageBackendLike(value: unknown): value is StorageBackendLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<StorageBackendLike>;

  return (
    typeof candidate.length === 'number' &&
    typeof candidate.key === 'function' &&
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function'
  );
}

function resolveServiceBackend(
  ctx: RuntimeContext,
  area: StorageArea,
): StorageBackendLike | null {
  const serviceName = area === 'local' ? 'storage:local' : 'storage:session';
  const value = ctx.services.get<unknown>(serviceName);

  if (value === undefined) {
    return null;
  }

  if (!isStorageBackendLike(value)) {
    throw new Error(
      `Service ${serviceName} must provide a Storage-compatible backend.`,
    );
  }

  return value;
}

function resolveWindowBackend(area: StorageArea): StorageBackendLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return area === 'local' ? window.localStorage : window.sessionStorage;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Unable to access ${area}Storage.`;

    throw new Error(`Storage adapter could not access ${area}Storage: ${message}`);
  }
}

function resolveBackend(ctx: RuntimeContext, area: StorageArea): StorageBackendLike {
  const serviceBackend = resolveServiceBackend(ctx, area);

  if (serviceBackend) {
    return serviceBackend;
  }

  const windowBackend = resolveWindowBackend(area);

  if (windowBackend) {
    return windowBackend;
  }

  throw new Error(`Storage adapter requires a ${area} storage backend.`);
}

function getStoragePrefix(namespace: string): string {
  return `${namespace}:`;
}

function getNamespacedKey(namespace: string, key: string): string {
  return `${getStoragePrefix(namespace)}${key}`;
}

function collectNamespacedKeys(
  backend: StorageBackendLike,
  namespace: string,
): string[] {
  const keys: string[] = [];
  const prefix = getStoragePrefix(namespace);

  for (let index = 0; index < backend.length; index += 1) {
    const key = backend.key(index);

    if (!key || !key.startsWith(prefix)) {
      continue;
    }

    keys.push(key.slice(prefix.length));
  }

  return keys;
}

export function createStorageAdapter(
  options: StorageAdapterOptions = {},
): AdapterRegistration<StorageAdapterApi> {
  const id = options.id ?? 'storage-adapter';
  const namespace = options.namespace?.trim() || DEFAULT_NAMESPACE;

  return {
    id,
    capability: 'storage',
    setup(ctx) {
      const backends: Record<StorageArea, StorageBackendLike> = {
        local: resolveBackend(ctx, 'local'),
        session: resolveBackend(ctx, 'session'),
      };

      const getBackend = (area: StorageArea = 'local'): StorageBackendLike => {
        return backends[area];
      };

      return {
        getItem<T = unknown>(key: string, area: StorageArea = 'local'): T | null {
          const raw = getBackend(area).getItem(getNamespacedKey(namespace, key));

          if (raw === null) {
            return null;
          }

          try {
            return JSON.parse(raw) as T;
          } catch {
            throw new Error(
              `Stored value for key "${key}" in ${area} storage is not valid JSON.`,
            );
          }
        },
        setItem<T>(key: string, value: T, area: StorageArea = 'local'): void {
          const serialized = JSON.stringify(value);

          if (serialized === undefined) {
            throw new Error(`Storage value for key "${key}" is not JSON serializable.`);
          }

          getBackend(area).setItem(getNamespacedKey(namespace, key), serialized);
        },
        removeItem(key: string, area: StorageArea = 'local'): void {
          getBackend(area).removeItem(getNamespacedKey(namespace, key));
        },
        listKeys(area: StorageArea = 'local'): string[] {
          return collectNamespacedKeys(getBackend(area), namespace);
        },
        clear(area: StorageArea = 'local'): void {
          const backend = getBackend(area);

          // Only remove keys owned by this adapter namespace.
          for (const key of collectNamespacedKeys(backend, namespace)) {
            backend.removeItem(getNamespacedKey(namespace, key));
          }
        },
      };
    },
  };
}
