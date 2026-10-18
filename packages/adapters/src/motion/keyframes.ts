/**
 * Company: EonHive Inc. | Title: Motion Input Validation
 * Purpose: Validate the supported DOM surface before interrupting existing playback.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import type { MotionKeyframe, MotionOptions } from './types.js';
import { validateTiming } from './timing.js';

const keys = new Set(['opacity', 'transform', 'offset']);

export function validateMotion(keyframes: readonly MotionKeyframe[], options: MotionOptions): Keyframe[] {
  validateTiming(options);
  if (!Array.isArray(keyframes) || keyframes.length < 2) {
    throw new TypeError('Motion requires at least two keyframes.');
  }
  let offset = 0;
  return keyframes.map(frame => {
    if (!frame || typeof frame !== 'object' || Object.keys(frame).some(key => !keys.has(key))) {
      throw new TypeError('Motion supports only opacity, transform, and offset.');
    }
    if (frame.opacity !== undefined &&
        (!Number.isFinite(frame.opacity) || frame.opacity < 0 || frame.opacity > 1)) {
      throw new RangeError('Motion opacity must be between zero and one.');
    }
    if (frame.transform !== undefined &&
        (typeof frame.transform !== 'string' || !frame.transform.trim())) {
      throw new TypeError('Motion transform must be a nonempty CSS transform.');
    }
    if (frame.opacity === undefined && frame.transform === undefined) {
      throw new TypeError('Each motion keyframe must specify opacity or transform.');
    }
    if (frame.offset !== undefined) {
      if (!Number.isFinite(frame.offset) || frame.offset < offset || frame.offset > 1) {
        throw new RangeError('Motion offsets must increase within zero and one.');
      }
      offset = frame.offset;
    }
    return { ...frame };
  });
}
