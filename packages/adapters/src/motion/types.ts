/**
 * Company: EonHive Inc. | Title: Motion Contracts
 * Purpose: Define scoped DOM and numeric motion with terminal playback outcomes.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-18
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

/** A renderer-independent value tween, driven by temporary runtime frame work. */
export interface ValueTweenOptions extends Omit<MotionOptions, 'easing'> {
  from: number;
  to: number;
  easing?: MotionEasing | ((progress: number) => number);
  onUpdate(value: number, progress: number): void;
  onComplete?(): void;
}

export interface TimelineEntry extends Omit<ValueTweenOptions, 'signal'> {
  /** Offset from the timeline start; delayMs is added to this offset. */
  atMs?: number;
}

export interface TimelineOptions {
  tweens: readonly TimelineEntry[];
  /** Total passes, including the first; integer from 1 through 100. */
  iterations?: number;
  /** Mirror every other pass, including easing and child progress. */
  yoyo?: boolean;
  delayMs?: number;
  signal?: AbortSignal;
  onUpdate?(progress: number): void;
  onComplete?(): void;
}

export type MotionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';

export interface MotionHandle extends MotionPlayback {
  readonly status: MotionStatus;
  /** Uneased progress from zero to one, retained on cancellation. */
  readonly progress: number;
}

export interface RetargetOptions {
  durationMs?: number;
  easing?: ValueTweenOptions['easing'];
}

export interface ValueTweenHandle extends MotionHandle {
  readonly value: number;
  /** Start a new segment at the rendered value; settled handles return false. */
  retarget(to: number, options?: RetargetOptions): boolean;
}

export interface TimelineHandle extends MotionHandle {
  /** Total time across all passes, including the timeline's initial delay. */
  readonly durationMs: number;
  readonly currentTimeMs: number;
  /** Render a clamped absolute time without resuming or firing completion callbacks. */
  seek(timeMs: number): void;
}

export interface MotionClock {
  readonly activeCount: number;
  tween(options: ValueTweenOptions): ValueTweenHandle;
  timeline(options: TimelineOptions): TimelineHandle;
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
  readonly playbackRate: number;
  /** Apply a finite positive speed to this group's current and future playback. */
  setPlaybackRate(rate: number): void;
  animate(
    element: Element,
    keyframes: readonly MotionKeyframe[],
    options: MotionOptions,
  ): MotionPlayback;
  tween<T extends object>(
    target: T,
    properties: NumericProperties<T>,
    options: TweenOptions,
  ): MotionPlayback;
  tween(options: ValueTweenOptions): ValueTweenHandle;
  timeline(options: TimelineOptions): TimelineHandle;
  pause(): void;
  resume(): void;
  cancel(target?: object): void;
}

export interface MotionAdapterApi extends MotionClock {
  /** Effective reduced-motion mode, including an explicit override. */
  readonly reducedMotion: boolean;
  /** Observe effective mode changes; read reducedMotion for the initial value. */
  subscribeReducedMotion(listener: (reduced: boolean) => void): () => void;
  /** Reusing a scope returns its existing group and registers no additional cleanup. */
  scoped(scope: ResourceScope): ScopedMotion;
  /** Apply an explicit additional time step; normal playback already uses runtime frames. */
  advance(deltaMs: number): void;
  /** Override the system preference, or pass undefined to follow it again. */
  setReducedMotion(reduced: boolean | undefined): void;
}
