/**
 * Company: EonHive Inc. | Title: Public Motion Release Contracts
 * Purpose: Verify numeric motion inference, playback controls, presets, and DOM bindings from packed exports.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { type RuntimeContext, type AdapterRegistration } from '@urk/core';
import {
  createMotionAdapter,
  createMotionController,
  MotionCapability,
  createDomMotionBinding,
  fade,
  slide,
  scale,
  stagger,
  type MotionAdapterApi,
  type MotionHandle,
  type ValueTweenHandle,
  type TimelineHandle,
  type MotionResult,
  type ValueTweenOptions,
} from '@urk/adapters/motion';

declare const ctx: RuntimeContext;
declare const element: HTMLElement;
const registration: AdapterRegistration<MotionAdapterApi> = createMotionAdapter();
const controller = createMotionController('compatible-motion-controller');
const motion: MotionAdapterApi = ctx.require(MotionCapability);
const group = motion.scoped(ctx.scope);
const options: ValueTweenOptions = {
  from: 0,
  to: 100,
  durationMs: 300,
  easing: (progress) => progress * progress,
  onUpdate(value, progress) {
    const numbers: number[] = [value, progress];
    void numbers;
  },
};
const value: ValueTweenHandle = group.tween(options);
const base: MotionHandle = value;
const retargeted: boolean = value.retarget(200, { durationMs: 200, easing: 'ease-out' });
const outcome: Promise<MotionResult> = value.finished;
outcome.then((result) => {
  if (result.status === 'failed') {
    const error: unknown = result.error;
    void error;
  }
});
group.setPlaybackRate(0.75);
const binding = createDomMotionBinding(element, ctx.scope, { opacity: 0, y: 20 });
const timeline: TimelineHandle = group.timeline({
  iterations: 2,
  yoyo: true,
  tweens: stagger(
    [
      fade({ onUpdate: binding.property('opacity') }),
      slide({ atMs: 100, onUpdate: binding.property('y') }),
      scale({ onUpdate: binding.property('scale') }),
    ],
    50,
  ),
});
timeline.pause();
timeline.seek(timeline.durationMs / 2);
timeline.resume();
const unsubscribe = motion.subscribeReducedMotion((reduced) => {
  const preference: boolean = reduced;
  void preference;
});
ctx.scope.defer(unsubscribe);
motion.setReducedMotion(undefined);
const target = { x: 0 };
group.tween(target, { x: 1 }, { durationMs: 100 });
group.animate(element, [{ opacity: 0 }, { opacity: 1 }], { durationMs: 100 });

// @ts-expect-error Scope playback speed is changed through its validated setter.
group.playbackRate = 2;
// @ts-expect-error Effective preference is read-only; use setReducedMotion.
motion.reducedMotion = true;
// @ts-expect-error Playback rates are numeric multipliers.
group.setPlaybackRate('2');
// @ts-expect-error Retargeting requires a numeric destination.
value.retarget('200');
// @ts-expect-error Timeline playheads use absolute numeric milliseconds.
timeline.seek('50%');
// @ts-expect-error Only value tween segments can be retargeted.
timeline.retarget(2);
// @ts-expect-error The binding exposes only its supported numeric properties.
binding.property('width');
// @ts-expect-error DOM binding values remain numeric.
binding.set({ opacity: '1' });
fade({
  // @ts-expect-error Callback presets receive numeric values.
  onUpdate(value: string) {
    void value;
  },
});
void [
  registration,
  controller,
  base,
  retargeted,
  outcome,
  binding.getSnapshot(),
  timeline.currentTimeMs,
];
