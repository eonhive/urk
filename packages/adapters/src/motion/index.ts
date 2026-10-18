/**
 * Company: EonHive Inc. | Title: Motion Adapter
 * Purpose: Own finite DOM and numeric motion through existing scopes and frame scheduling.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */
import { token, type AdapterRegistration, type ResourceScope } from '@urk/core';
import { validateMotion } from './keyframes.js';
import { createPlayback } from './playback.js';
import { createTween, validateTween } from './tween.js';
import type { MotionAdapterApi, ScopedMotion } from './types.js';

export * from './types.js';
export const MotionCapability = token<MotionAdapterApi>('motion');
type NativePlayback = ReturnType<typeof createPlayback>;
type Tween = ReturnType<typeof createTween>;
type Operation = NativePlayback | Tween;

export function createMotionAdapter(id = 'motion-adapter'): AdapterRegistration<MotionAdapterApi> {
  return {
    id,
    capability: 'motion',
    token: MotionCapability,
    setup(ctx) {
      const preference = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
      const targets = new Map<Element, NativePlayback>();
      const numericTargets = new WeakMap<object, Map<string, Tween>>();
      const tweens = new Set<Tween>();
      const groups = new WeakMap<ResourceScope, ScopedMotion>();
      const disposers = new Set<(reason?: string) => void>();
      const suspensions = new Set<() => void>();
      let closed = ctx.signal.aborted;
      let releaseFrames: (() => void) | undefined;
      let registeringFrames = false;
      let unsubscribeLifecycle = () => {};
      const running = () => ctx.getLifecycleSnapshot().state === 'running';
      const needsFrames = () => !closed && running() && [...tweens].some(tween => tween.runnable());

      function syncFrames(): void {
        if (registeringFrames) return;
        if (!needsFrames()) {
          const release = releaseFrames;
          releaseFrames = undefined;
          release?.();
        } else if (!releaseFrames) {
          registeringFrames = true;
          try {
            releaseFrames = ctx.registerFrameWork(frame => {
              for (const tween of [...tweens]) tween.tick(frame);
            });
          } finally {
            registeringFrames = false;
          }
          // An injected scheduler may deliver synchronously during registration.
          if (!needsFrames()) syncFrames();
        }
      }

      const reduce = () => {
        if (preference?.matches) {
          for (const operation of [...targets.values(), ...tweens]) operation.handle.finish();
        }
      };
      const dispose = (reason = 'runtime-disposed') => {
        closed = true;
        unsubscribeLifecycle();
        preference?.removeEventListener('change', reduce);
        ctx.signal.removeEventListener('abort', abort);
        for (const release of [...disposers]) release(reason);
        syncFrames();
      };
      const abort = () => dispose();
      ctx.scope.defer(dispose);
      if (!closed) {
        preference?.addEventListener('change', reduce);
        ctx.signal.addEventListener('abort', abort, { once: true });
        unsubscribeLifecycle = ctx.subscribeLifecycle(() => {
          const state = ctx.getLifecycleSnapshot().state;
          if (state === 'failed' || state === 'disposing' || state === 'disposed') {
            dispose(state === 'failed' ? 'runtime-failed' : 'runtime-disposed');
            return;
          }
          for (const suspend of [...suspensions]) suspend();
          syncFrames();
        });
      }

      return {
        scoped(scope) {
          if (closed) throw new Error('Motion adapter is disposed.');
          const existing = groups.get(scope);
          if (existing) return existing;
          const active = new Map<Operation, object>();
          let disposed = false;
          let paused = false;
          const blocked = () => paused || !running();
          const suspend = () => {
            for (const operation of [...active.keys()]) operation.suspend(blocked());
          };
          const disposeGroup = (reason = 'owner-disposed') => {
            disposed = true;
            suspensions.delete(suspend);
            for (const operation of [...active.keys()]) operation.handle.cancel(reason);
            disposers.delete(disposeGroup);
          };
          const assertActive = () => {
            if (closed || disposed) throw new Error('Motion scope is disposed.');
          };
          // One cleanup per scope, rather than retaining every past operation.
          scope.defer(disposeGroup);
          disposers.add(disposeGroup);
          suspensions.add(suspend);
          const group: ScopedMotion = {
            get activeCount() { return active.size; },
            animate(element, keyframes, options) {
              assertActive();
              options = { ...options };
              const frames = validateMotion(keyframes, options);
              if (!element || typeof element !== 'object') throw new TypeError('Motion needs an element.');
              const playback = createPlayback(element, options.signal, () => {
                active.delete(playback);
                if (targets.get(element) === playback) targets.delete(element);
              });
              if (options.signal?.aborted) {
                playback.handle.cancel('aborted');
                return playback.handle;
              }
              // DOM replacement stays whole-element; supplied keyframes define its start.
              targets.get(element)?.handle.cancel('replaced');
              active.set(playback, element);
              targets.set(element, playback);
              playback.suspend(blocked());
              playback.start(frames, options, Boolean(preference?.matches) || options.durationMs === 0);
              return playback.handle;
            },
            tween(target, properties, options) {
              assertActive();
              options = { ...options };
              const tracks = validateTween(target, properties, options);
              let propertyOwners = numericTargets.get(target);
              const tween = createTween(target, tracks, options, () => {
                active.delete(tween);
                tweens.delete(tween);
                for (const { key } of tracks) {
                  if (propertyOwners?.get(key) === tween) propertyOwners.delete(key);
                }
                if (propertyOwners?.size === 0) numericTargets.delete(target);
                syncFrames();
              }, syncFrames);
              if (options.signal?.aborted) {
                tween.handle.cancel('aborted');
                return tween.handle;
              }
              // Cancel entire conflicting operations, leaving disjoint properties independent.
              for (const { key } of tracks) propertyOwners?.get(key)?.handle.cancel('replaced');
              propertyOwners = numericTargets.get(target) ?? new Map();
              numericTargets.set(target, propertyOwners);
              for (const { key } of tracks) propertyOwners.set(key, tween);
              active.set(tween, target);
              tweens.add(tween);
              tween.suspend(blocked());
              tween.start(Boolean(preference?.matches) || options.durationMs === 0);
              return tween.handle;
            },
            pause() { paused = true; suspend(); },
            resume() { paused = false; suspend(); },
            cancel(target) {
              for (const [operation, owner] of [...active]) {
                if (!target || owner === target) operation.handle.cancel();
              }
            },
          };
          groups.set(scope, group);
          return group;
        },
      };
    },
  };
}
