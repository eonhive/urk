/**
 * Company: EonHive Inc. | Title: Motion Timing
 * Purpose: Share timing validation and CSS-compatible easing across DOM and numeric motion.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */
import type { MotionEasing, MotionOptions } from './types.js';

const curves = {
  linear: [0, 1],
  'ease-in': [0.42, 1],
  'ease-out': [0, 0.58],
  'ease-in-out': [0.42, 0.58],
} as const;

export function validateTiming(options: MotionOptions): void {
  if (!Number.isFinite(options.durationMs) || options.durationMs < 0 ||
      !Number.isFinite(options.delayMs ?? 0) || (options.delayMs ?? 0) < 0) {
    throw new RangeError('Motion durationMs and delayMs must be finite and nonnegative.');
  }
  if (!Object.prototype.hasOwnProperty.call(curves, options.easing ?? 'linear')) throw new TypeError('Unsupported motion easing.');
}

export function ease(progress: number, easing: MotionEasing): number {
  if (easing === 'linear' || progress === 0 || progress === 1) return progress;
  const [x1, x2] = curves[easing];
  let low = 0;
  let high = 1;
  // CSS time is the curve's x coordinate. Invert it before evaluating y.
  for (let index = 0; index < 24; index++) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
    if (x < progress) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  return 3 * (1 - t) * t ** 2 + t ** 3;
}
