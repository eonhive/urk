/**
 * Company: EonHive Inc. | Title: Story Scroll Motion
 * Purpose: Bind cancellable section scrolling to the public motion capability and experience phases.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import type { MotionHandle, MotionResult, ScopedMotion } from '@urk/adapters/motion';

interface ScrollBinding {
  read(): number;
  write(position: number): void;
}

/** Latest destination wins; interruption retains the position already rendered. */
export function createScrollMotion(
  ctx: RuntimeContext,
  motion: ScopedMotion,
  binding: ScrollBinding,
) {
  let generation = 0;
  let navigating = false;
  let handle: MotionHandle | undefined;
  let lifecycle = ctx.getLifecycleSnapshot().state;
  const alive = () =>
    !ctx.signal.aborted && ['running', 'paused'].includes(ctx.getLifecycleSnapshot().state);
  const cancelled: MotionResult = { status: 'cancelled', reason: 'superseded' };

  async function ready(ticket: number): Promise<void> {
    if (ticket !== generation || !alive()) return;
    try {
      await ctx.state.transition('ready', 'story:scroll-settled');
    } catch (error) {
      if (alive()) throw error;
    }
  }

  const scroll = {
    get activeHandle() {
      return handle;
    },
    get navigating() {
      return navigating;
    },
    async navigate(to: number): Promise<MotionResult> {
      if (!Number.isFinite(to) || to < 0)
        throw new RangeError('Story scroll destination must be finite and nonnegative.');
      if (!alive()) return cancelled;
      const ticket = ++generation;
      handle?.cancel('superseded');
      navigating = true;
      try {
        await ctx.state.transition('transition', 'story:scroll');
        if (ticket !== generation || !alive()) return cancelled;
        handle = motion.tween({
          from: binding.read(),
          to,
          durationMs: 720,
          easing: 'ease-in-out',
          onUpdate: binding.write,
        });
        const result = await handle.finished;
        if (ticket !== generation || !alive()) return cancelled;
        navigating = false;
        handle = undefined;
        await ready(ticket);
        return ticket === generation && alive() ? result : cancelled;
      } catch (error) {
        if (ticket !== generation || !alive()) return cancelled;
        handle?.cancel('scroll-failed');
        handle = undefined;
        navigating = false;
        await ready(ticket);
        throw error;
      }
    },
    async cancel(reason = 'user'): Promise<void> {
      if (!navigating) return;
      const ticket = ++generation;
      handle?.cancel(reason);
      handle = undefined;
      navigating = false;
      await ready(ticket);
    },
  };

  // Resume restores the kernel's saved legacy phase before lifecycle publication.
  // Reconcile scroll commands issued during pause outside the state-change handler.
  ctx.scope.defer(
    ctx.subscribeLifecycle((snapshot) => {
      const resumed = lifecycle === 'paused' && snapshot.state === 'running';
      lifecycle = snapshot.state;
      if (!resumed) return;
      const ticket = generation;
      void Promise.resolve()
        .then(async () => {
          if (ticket !== generation || !alive()) return;
          if (!['ready', 'transition', 'paused'].includes(ctx.state.getSnapshot().phase)) return;
          const desired = navigating ? 'transition' : 'ready';
          if (ctx.state.getSnapshot().phase !== desired)
            await ctx.state.transition(desired, 'story:scroll-resume');
        })
        .catch(() => {
          /* Shutdown closes outstanding phase commands. */
        });
    }),
  );
  ctx.scope.defer(() => {
    generation++;
    navigating = false;
    handle?.cancel('owner-disposed');
    handle = undefined;
  });
  return scroll;
}
