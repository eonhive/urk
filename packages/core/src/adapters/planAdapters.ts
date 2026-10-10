/**
 * Company: EonHive Inc.
 * Title: Adapter Startup Plan
 * Purpose: Validate configured dependencies before acquisition and preserve stable sequential startup.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration, AdapterStartup, RuntimeContext } from '../types.js';

export function planAdapters(
  registrations: readonly AdapterRegistration<unknown>[],
  ctx: RuntimeContext,
  startup: AdapterStartup = 'sequential',
): AdapterRegistration<unknown>[][] {
  const aliases = new Map<string | symbol, AdapterRegistration<unknown>>();
  for (const registration of registrations) {
    for (const alias of new Set([registration.id, registration.capability])) {
      if (aliases.has(alias) || ctx.adapters.isReserved(alias)) {
        throw new Error(`Adapter ID or capability already registered: ${alias}`);
      }
      aliases.set(alias, registration);
    }
    if (registration.token) {
      const { key, name } = registration.token;
      if (aliases.has(key) || ctx.adapters.isReserved(registration.token)) {
        throw new Error(`Adapter token already registered: ${name}`);
      }
      aliases.set(key, registration);
    }
  }

  const ordered: AdapterRegistration<unknown>[] = [];
  const visited = new Set<AdapterRegistration<unknown>>();
  const levels = new Map<AdapterRegistration<unknown>, number>();
  const visiting: AdapterRegistration<unknown>[] = [];
  const visit = (registration: AdapterRegistration<unknown>): void => {
    if (visited.has(registration)) return;
    if (visiting.includes(registration)) {
      throw new Error(`Adapter dependency cycle: ${[...visiting, registration].map(item => item.id).join(' -> ')}`);
    }
    visiting.push(registration);
    let level = 0;
    for (const dependency of registration.dependsOn ?? []) {
      const key = typeof dependency === 'string' ? dependency : dependency.key;
      const provider = aliases.get(key);
      if (provider) {
        visit(provider);
        level = Math.max(level, levels.get(provider)! + 1);
      } else if (!ctx.adapters.has(dependency) &&
        (typeof dependency === 'string' || ctx.services.get(dependency) === undefined)) {
        const name = typeof dependency === 'string' ? dependency : dependency.name;
        throw new Error(`Adapter ${registration.id} is missing dependency: ${name}`);
      }
    }
    visiting.pop();
    visited.add(registration);
    levels.set(registration, level);
    ordered.push(registration);
  };
  for (const registration of registrations) visit(registration);
  if (startup === 'sequential') return ordered.map(registration => [registration]);

  const batches: AdapterRegistration<unknown>[][] = [];
  for (const registration of ordered) {
    const level = levels.get(registration)!;
    (batches[level] ??= []).push(registration);
  }
  return batches;
}
