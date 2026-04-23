/**
 * Company: EonHive Inc.
 * Title: Runtime Store
 * Purpose: Keep URK runtime phase explicit and observable.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-12
 * Notes: Vibe coded with Codex.
 */

import type { RuntimePhase, RuntimeSnapshot, RuntimeStateListener } from './types';

export class RuntimeStore {
  private snapshot: RuntimeSnapshot;
  private listeners: Set<RuntimeStateListener> = new Set();

  constructor(initialPhase: RuntimePhase = 'boot', reason = 'kernel:init') {
    this.snapshot = {
      phase: initialPhase,
      reason,
      updatedAt: Date.now(),
    };
  }

  getSnapshot(): RuntimeSnapshot {
    return { ...this.snapshot };
  }

  setPhase(nextPhase: RuntimePhase, reason?: string): RuntimeSnapshot {
    const previous = this.getSnapshot();

    if (previous.phase === nextPhase && previous.reason === reason) {
      return previous;
    }

    this.snapshot = {
      phase: nextPhase,
      reason,
      updatedAt: Date.now(),
    };

    const next = this.getSnapshot();

    for (const listener of [...this.listeners]) {
      listener(next, previous);
    }

    return next;
  }

  subscribe(listener: RuntimeStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
