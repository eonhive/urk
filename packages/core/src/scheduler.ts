/**
 * Company: EonHive Inc.
 * Title: Browser Frame Scheduler
 * Purpose: Provide a small scheduler contract for frame-driven runtime work.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-12
 * Notes: Vibe coded with Codex.
 */

import type { FrameCallback, FrameScheduler } from './types';

export class BrowserFrameScheduler implements FrameScheduler {
  private callback: FrameCallback | null = null;
  private frameHandle: number | null = null;
  private lastTimeMs = 0;
  private frame = 0;
  private running = false;

  start(callback: FrameCallback): void {
    if (this.running) {
      return;
    }

    this.callback = callback;
    this.running = true;
    this.frame = 0;
    this.lastTimeMs = this.now();
    this.frameHandle = this.requestFrame(this.tick);
  }

  stop(): void {
    if (this.frameHandle !== null) {
      this.cancelFrame(this.frameHandle);
    }

    this.frameHandle = null;
    this.callback = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private tick = (timeMs: number): void => {
    if (!this.running || !this.callback) {
      return;
    }

    const deltaMs = this.frame === 0 ? 0 : Math.max(0, timeMs - this.lastTimeMs);
    this.lastTimeMs = timeMs;
    this.frame += 1;

    this.callback({
      timeMs,
      deltaMs,
      deltaSeconds: deltaMs / 1000,
      frame: this.frame,
    });

    if (this.running) {
      this.frameHandle = this.requestFrame(this.tick);
    }
  };

  private now(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    return Date.now();
  }

  private requestFrame(callback: (timeMs: number) => void): number {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }

    return setTimeout(() => callback(this.now()), 16) as unknown as number;
  }

  private cancelFrame(handle: number): void {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle);
      return;
    }

    clearTimeout(handle);
  }
}
