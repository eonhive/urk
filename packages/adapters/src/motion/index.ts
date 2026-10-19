/**
 * Company: EonHive Inc. | Title: Motion Adapter
 * Purpose: Own finite DOM and numeric motion through existing scopes and frame scheduling.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import {
  token,
  type AdapterRegistration,
  type ControllerRegistration,
  type ResourceScope,
} from '@urk/core';
import { validateMotion } from './keyframes.js';
import { createPlayback } from './playback.js';
import { createTween, createValueTween, validateTween, validateValueTween } from './tween.js';
import { createTimeline, validateTimeline } from './timeline.js';
import type {
  MotionAdapterApi,
  ValueTweenHandle,
  MotionPlayback,
  NumericProperties,
  ScopedMotion,
  TweenOptions,
  ValueTweenOptions,
} from './types.js';

export * from './types.js';
export * from './presets.js';
export * from './dom-binding.js';
export const MotionCapability = token<MotionAdapterApi>('motion');
type NativePlayback = ReturnType<typeof createPlayback>;
type Tween = ReturnType<typeof createTween>;
type ClockOperation = Tween | ReturnType<typeof createTimeline>;
type Operation = NativePlayback | ClockOperation;

export function createMotionController(id = 'motion-controller'): ControllerRegistration {
  return {
    id,
    start(ctx) {
      // Keep existing registrations valid without retaining permanent frame demand.
      ctx.require(MotionCapability);
    },
  };
}

export function createMotionAdapter(id = 'motion-adapter'): AdapterRegistration<MotionAdapterApi> {
  return {
    id,
    capability: 'motion',
    token: MotionCapability,
    setup(ctx) {
      const preference =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : undefined;
      const targets = new Map<Element, NativePlayback>();
      const numericTargets = new WeakMap<object, Map<string, Tween>>();
      const tweens = new Set<Tween>();
      const clockWork = new Set<ClockOperation>();
      const groups = new WeakMap<ResourceScope, ScopedMotion>();
      const disposers = new Set<(reason?: string) => void>();
      const suspensions = new Set<() => void>();
      const preferenceListeners = new Set<(reduced: boolean) => void>();
      let closed = ctx.signal.aborted;
      let releaseFrames: (() => void) | undefined;
      let registeringFrames = false;
      let unsubscribeLifecycle = () => {};
      let reducedOverride: boolean | undefined;
      const reduced = () => reducedOverride ?? Boolean(preference?.matches);
      let lastReduced = reduced();
      let preferenceRevision = 0;
      const running = () => ctx.getLifecycleSnapshot().state === 'running';
      const needsFrames = () => {
        if (closed || !running()) return false;
        for (const operation of tweens) if (operation.runnable()) return true;
        for (const operation of clockWork) if (operation.runnable()) return true;
        return false;
      };

      function syncFrames(): void {
        if (registeringFrames) return;
        if (!needsFrames()) {
          const release = releaseFrames;
          releaseFrames = undefined;
          release?.();
        } else if (!releaseFrames) {
          registeringFrames = true;
          try {
            releaseFrames = ctx.registerFrameWork((frame) => {
              // Admit both forms together so callback-created work waits for the next frame.
              const admitted = [...tweens, ...clockWork];
              for (const operation of admitted) {
                if (closed || !running()) break;
                operation.tick(frame);
              }
            });
          } finally {
            registeringFrames = false;
          }
          // An injected scheduler may deliver synchronously during registration.
          if (!needsFrames()) syncFrames();
        }
      }

      const reduce = () => {
        if (closed) return;
        const next = reduced();
        const changed = next !== lastReduced;
        if (changed) preferenceRevision++;
        const ticket = preferenceRevision;
        lastReduced = next;
        if (changed) {
          for (const listener of [...preferenceListeners]) {
            if (closed || ticket !== preferenceRevision) return;
            if (!preferenceListeners.has(listener)) continue;
            // Observers cannot interrupt preference delivery or owned motion cleanup.
            try {
              listener(next);
            } catch {
              /* Match lifecycle observer isolation. */
            }
          }
        }
        if (next) {
          for (const operation of [...targets.values(), ...tweens, ...clockWork]) {
            if (closed || ticket !== preferenceRevision) return;
            operation.handle.finish();
          }
        }
      };
      const dispose = (reason = 'runtime-disposed') => {
        closed = true;
        preferenceRevision++;
        preferenceListeners.clear();
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

      const api: MotionAdapterApi = {
        get reducedMotion() {
          return reduced();
        },
        subscribeReducedMotion(listener) {
          if (typeof listener !== 'function')
            throw new TypeError('A motion preference listener must be a function.');
          if (closed) return () => {};
          preferenceListeners.add(listener);
          return () => {
            preferenceListeners.delete(listener);
          };
        },
        get activeCount() {
          return (
            targets.size +
            tweens.size +
            [...clockWork].reduce(
              (count, work) => count + ('activeCount' in work ? work.activeCount : 1),
              0,
            )
          );
        },
        tween(options) {
          return api.scoped(ctx.scope).tween(options);
        },
        timeline(options) {
          return api.scoped(ctx.scope).timeline(options);
        },
        setReducedMotion(value) {
          reducedOverride = value;
          reduce();
        },
        advance(deltaMs) {
          if (!Number.isFinite(deltaMs) || deltaMs < 0)
            throw new RangeError('Motion deltaMs must be finite and nonnegative.');
          if (closed || !running()) return;
          // Snapshot admission: work created by callbacks first advances on the next update.
          for (const operation of [...clockWork]) {
            if (closed || !running()) break;
            operation.advance(deltaMs);
          }
        },
        scoped(scope) {
          if (closed) throw new Error('Motion adapter is disposed.');
          const existing = groups.get(scope);
          if (existing) return existing;
          const active = new Map<Operation, object>();
          let disposed = false;
          let paused = false;
          let playbackRate = 1;
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
          const ownClock = <TOperation extends ClockOperation>(
            create: (release: () => void) => TOperation,
          ): TOperation['handle'] => {
            assertActive();
            const release = () => {
              active.delete(operation);
              clockWork.delete(operation);
              syncFrames();
            };
            const operation = create(release);
            active.set(operation, operation);
            clockWork.add(operation);
            operation.setPlaybackRate(playbackRate);
            operation.suspend(blocked());
            operation.start(reduced());
            return operation.handle;
          };
          function tween(options: ValueTweenOptions): ValueTweenHandle;
          function tween<T extends object>(
            target: T,
            properties: NumericProperties<T>,
            options: TweenOptions,
          ): MotionPlayback;
          function tween(
            target: object | ValueTweenOptions,
            properties?: object,
            options?: TweenOptions,
          ): MotionPlayback {
            if (properties === undefined) {
              const valueOptions = { ...target } as ValueTweenOptions;
              validateValueTween(valueOptions);
              return ownClock((release) => createValueTween(valueOptions, release, syncFrames));
            }
            assertActive();
            options = { ...options! };
            const tracks = validateTween(target, properties, options);
            let propertyOwners = numericTargets.get(target);
            const tween = createTween(
              target,
              tracks,
              options,
              () => {
                active.delete(tween);
                tweens.delete(tween);
                for (const { key } of tracks) {
                  if (propertyOwners?.get(key) === tween) propertyOwners.delete(key);
                }
                if (propertyOwners?.size === 0) numericTargets.delete(target);
                syncFrames();
              },
              syncFrames,
            );
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
            tween.setPlaybackRate(playbackRate);
            tween.suspend(blocked());
            tween.start(reduced() || options.durationMs === 0);
            return tween.handle;
          }
          // One cleanup per scope, rather than retaining every past operation.
          scope.defer(disposeGroup);
          disposers.add(disposeGroup);
          suspensions.add(suspend);
          const group: ScopedMotion = {
            get playbackRate() {
              return playbackRate;
            },
            setPlaybackRate(rate) {
              assertActive();
              if (!Number.isFinite(rate) || rate <= 0)
                throw new RangeError('Motion playback rate must be finite and positive.');
              playbackRate = rate;
              for (const operation of [...active.keys()]) operation.setPlaybackRate(rate);
            },
            get activeCount() {
              return [...active.keys()].reduce(
                (count, work) => count + ('activeCount' in work ? work.activeCount : 1),
                0,
              );
            },
            animate(element, keyframes, options) {
              assertActive();
              options = { ...options };
              const frames = validateMotion(keyframes, options);
              if (!element || typeof element !== 'object')
                throw new TypeError('Motion needs an element.');
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
              playback.setPlaybackRate(playbackRate);
              playback.suspend(blocked());
              playback.start(frames, options, reduced() || options.durationMs === 0);
              return playback.handle;
            },
            tween,
            timeline(options) {
              validateTimeline(options);
              const timelineOptions = {
                ...options,
                tweens: options.tweens.map((entry) => ({ ...entry })),
              };
              return ownClock((release) => createTimeline(timelineOptions, release, syncFrames));
            },
            pause() {
              paused = true;
              suspend();
            },
            resume() {
              paused = false;
              suspend();
            },
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
      return api;
    },
  };
}
