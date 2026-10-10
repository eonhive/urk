/**
 * Company: EonHive Inc.
 * Title: Runtime Store
 * Purpose: Keep URK runtime phase explicit and observable.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-12
 * Notes: Vibe coded with Codex.
 */

import type { RuntimePhase, RuntimeSnapshot, RuntimeStateListener } from '../types.js';

interface PhaseTransition {
  phase: RuntimePhase;
  reason?: string;
  resolve(snapshot: RuntimeSnapshot): void;
  reject(error: unknown): void;
}

export class RuntimeStore {
  private snapshot: RuntimeSnapshot;
  private listeners: Set<RuntimeStateListener> = new Set();
  private revision = 0;
  private transitions: PhaseTransition[] = [];
  private activeTransition?: PhaseTransition;
  private transitionDrain?: Promise<void>;
  private transitionsClosed = false;
  private transitionError: unknown;

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

  getRevision(): number {
    return this.revision;
  }

  setPhase(nextPhase: RuntimePhase, reason?: string): RuntimeSnapshot {
    const change = this.commit(nextPhase, reason);
    if (!change) return this.getSnapshot();

    for (const listener of [...this.listeners]) {
      // Legacy writes remain synchronous and do not await asynchronous observers.
      void Promise.resolve(listener(change.next, change.previous)).catch(() => {});
    }
    return change.next;
  }

  transition(nextPhase: RuntimePhase, reason?: string): Promise<RuntimeSnapshot> {
    if (this.transitionsClosed) return Promise.reject(this.transitionError);

    const result = new Promise<RuntimeSnapshot>((resolve, reject) => {
      this.transitions.push({ phase: nextPhase, reason, resolve, reject });
    });
    this.startTransitions();
    return result;
  }

  private startTransitions(): void {
    // Install the drain before any observer can enqueue another command.
    this.transitionDrain ??= Promise.resolve().then(() => this.drainTransitions()).finally(() => {
      this.transitionDrain = undefined;
      if (this.transitions.length > 0) this.startTransitions();
    });
  }

  /** Reject commands immediately; completion still waits for active notifications. */
  cancelTransitions(error: unknown = new Error('Phase transitions have been cancelled.')): Promise<void> {
    if (!this.transitionsClosed) {
      this.transitionsClosed = true;
      this.transitionError = error;
      this.activeTransition?.reject(error);
      for (const transition of this.transitions) transition.reject(error);
      this.transitions.length = 0;
    }
    return this.transitionDrain ?? Promise.resolve();
  }

  private async drainTransitions(): Promise<void> {
    while (!this.transitionsClosed && this.transitions.length > 0) {
      const transition = this.transitions.shift()!;
      this.activeTransition = transition;
      try {
        const change = this.commit(transition.phase, transition.reason);
        if (change) {
          // Notify synchronously, then await every handler before committing the next phase.
          const results = await Promise.allSettled([...this.listeners].map(async listener => {
            if (!this.transitionsClosed) await listener(change.next, change.previous);
          }));
          const failure = results.find(result => result.status === 'rejected');
          if (failure?.status === 'rejected') throw failure.reason;
        }
        if (!this.transitionsClosed) transition.resolve(change?.next ?? this.getSnapshot());
      } catch (error) {
        void this.cancelTransitions(error);
      } finally {
        this.activeTransition = undefined;
      }
    }
  }

  private commit(nextPhase: RuntimePhase, reason?: string): { next: RuntimeSnapshot; previous: RuntimeSnapshot } | undefined {
    const previous = this.getSnapshot();

    if (previous.phase === nextPhase && previous.reason === reason) {
      return undefined;
    }

    this.snapshot = {
      phase: nextPhase,
      reason,
      updatedAt: Date.now(),
    };
    this.revision += 1;

    return { next: this.getSnapshot(), previous };
  }

  subscribe(listener: RuntimeStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
