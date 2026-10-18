/**
 * Company: EonHive Inc. | Title: Motion Contracts
 * Purpose: Define scoped DOM and numeric motion with terminal playback outcomes.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { ResourceScope } from '@urk/core';

export type MotionEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface MotionKeyframe {
  opacity?: number;
  transform?: string;
  offset?: number;
}

export interface MotionOptions {
  durationMs: number;
  delayMs?: number;
  easing?: MotionEasing;
  signal?: AbortSignal;
}

export type NumericProperties<T extends object> = {
  [K in keyof T as T[K] extends number ? K : never]?: number;
};

export interface TweenOptions extends MotionOptions {
  /** Redraw after numeric values change, including finish and reduced-motion completion. */
  onUpdate?: () => void;
}

export type MotionResult =
  | { readonly status: 'completed' }
  | { readonly status: 'cancelled'; readonly reason?: string }
  | { readonly status: 'failed'; readonly error: unknown };

export interface MotionPlayback {
  readonly finished: Promise<MotionResult>;
  pause(): void;
  resume(): void;
  /** Complete numeric destinations, or release DOM effects to UI-owned stable styles. */
  finish(): void;
  cancel(reason?: string): void;
}

export interface ScopedMotion {
  readonly activeCount: number;
  animate(element: Element, keyframes: readonly MotionKeyframe[], options: MotionOptions): MotionPlayback;
  tween<T extends object>(target: T, properties: NumericProperties<T>, options: TweenOptions): MotionPlayback;
  pause(): void;
  resume(): void;
  cancel(target?: object): void;
}

export interface MotionAdapterApi {
  /** Reusing a scope returns its existing group and registers no additional cleanup. */
  scoped(scope: ResourceScope): ScopedMotion;
}
