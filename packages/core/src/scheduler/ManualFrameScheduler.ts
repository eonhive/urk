/**
 * Company: EonHive Inc.
 * Title: Manual Frame Scheduler
 * Purpose: Drive runtime frames synchronously with explicit timestamps for deterministic tests.
 * Author: Stan Nesi
 * Created: 2026-10-03
 * Updated: 2026-10-03
 * Notes: Vibe coded with Codex.
 */

import type { FrameCallback, FrameScheduler } from '../types.js';

export class ManualFrameScheduler implements FrameScheduler {
  private callback: FrameCallback | null = null;
  private lastTimeMs = 0;
  private frame = 0;

  start(callback: FrameCallback): void {
    if (this.isRunning()) {
      return;
    }

    this.callback = callback;
    this.lastTimeMs = 0;
    this.frame = 0;
  }

  stop(): void {
    this.callback = null;
  }

  isRunning(): boolean {
    return this.callback !== null;
  }

  /** Deliver one synchronous frame while running; stopped steps do nothing. */
  step(timeMs: number): void {
    if (!this.callback) {
      return;
    }

    // Match browser timing: each start begins at frame one with a zero delta.
    const deltaMs = this.frame === 0 ? 0 : Math.max(0, timeMs - this.lastTimeMs);
    this.lastTimeMs = timeMs;
    this.frame += 1;
    this.callback({
      timeMs,
      deltaMs,
      deltaSeconds: deltaMs / 1000,
      frame: this.frame,
    });
  }
}
