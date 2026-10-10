/**
 * Company: EonHive Inc.
 * Title: Kernel Lifecycle Store
 * Purpose: Publish immutable operational lifecycle snapshots without observing application phases.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-04
 * Notes: Vibe coded with Codex.
 */

import type { LifecycleListener, LifecycleSnapshot, LifecycleState } from '../types.js';

export class LifecycleStore {
  private snapshot: LifecycleSnapshot = Object.freeze({
    state: 'created', revision: 0, updatedAt: Date.now(),
  });
  private readonly listeners = new Set<LifecycleListener>();
  private publishedRevision = 0;

  getSnapshot(): LifecycleSnapshot {
    return this.snapshot;
  }

  subscribe(listener: LifecycleListener): () => void {
    if (this.snapshot.state === 'disposed') {
      return () => {};
    }
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  commit(state: LifecycleState, reason?: string): void {
    const previous = this.snapshot;
    if (previous.state === state || previous.state === 'disposed') {
      return;
    }
    // Observer callbacks can request shutdown while another transition is publishing.
    if (previous.state === 'disposing' && state !== 'disposed') {
      return;
    }
    if (previous.state === 'failed' && state !== 'disposing') {
      return;
    }
    this.snapshot = Object.freeze({
      state, reason, revision: previous.revision + 1, updatedAt: Date.now(),
    });
  }

  transition(state: LifecycleState, reason?: string): void {
    const previous = this.snapshot;
    this.commit(state, reason);
    if (previous !== this.snapshot) {
      this.publish();
    }
  }

  publish(): void {
    const next = this.snapshot;
    if (next.revision <= this.publishedRevision) {
      return;
    }
    this.publishedRevision = next.revision;
    for (const listener of [...this.listeners]) {
      // A nested transition already delivered its newer snapshot to these listeners.
      if (this.snapshot !== next) {
        break;
      }
      if (!this.listeners.has(listener)) {
        continue;
      }
      try {
        listener(next);
      } catch {
        // Lifecycle observers cannot interrupt startup, cancellation, or other observers.
      }
    }
    if (this.snapshot.state === 'disposed') {
      this.listeners.clear();
    }
  }
}
