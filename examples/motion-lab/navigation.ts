/**
 * Company: EonHive Inc. | Title: Experience View Navigation
 * Purpose: Compose cancellable outgoing/incoming timelines with ordered experience phases.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import type {
  MotionHandle,
  MotionResult,
  ScopedMotion,
  TimelineOptions,
} from '@urk/adapters/motion';

export interface ViewBindings<View> {
  show(view: View): void;
  outgoing(current: View, destination: View): TimelineOptions;
  incoming(destination: View): TimelineOptions;
  activated(view: View): void;
}

/** Application policy: latest request wins; cancellation restores the last committed view. */
export function createViewNavigation<View>(
  ctx: RuntimeContext,
  motion: ScopedMotion,
  initialView: View,
  bindings: ViewBindings<View>,
) {
  let active = initialView;
  let requested = initialView;
  let generation = 0;
  let timeline: MotionHandle | undefined;
  let transitioning = false;
  const alive = () =>
    !ctx.signal.aborted &&
    ['starting', 'running', 'paused'].includes(ctx.getLifecycleSnapshot().state);
  const cancelled: MotionResult = { status: 'cancelled', reason: 'superseded' };

  function restore(): void {
    requested = active;
    transitioning = false;
    bindings.show(active);
  }

  async function ready(ticket: number): Promise<void> {
    if (ticket === generation && alive()) await ctx.state.transition('ready', 'view:ready');
  }

  const navigation = {
    get currentView() {
      return active;
    },
    get requestedView() {
      return requested;
    },
    get activeTimeline() {
      return timeline;
    },
    get transitioning() {
      return transitioning;
    },
    async navigate(destination: View): Promise<MotionResult> {
      if (!alive()) return cancelled;
      const ticket = ++generation;
      requested = destination;
      transitioning = true;
      timeline?.cancel('superseded');
      bindings.show(active);
      try {
        // Called from user/controller work, never from a queued state-change handler.
        await ctx.state.transition('transition', 'view:navigate');
        if (ticket !== generation || !alive()) return cancelled;
        timeline = motion.timeline(bindings.outgoing(active, destination));
        let result = await timeline.finished;
        if (ticket !== generation || !alive()) return cancelled;
        if (result.status === 'completed') {
          bindings.show(destination);
          timeline = motion.timeline(bindings.incoming(destination));
          result = await timeline.finished;
        }
        if (ticket !== generation || !alive()) return cancelled;
        if (result.status === 'completed') {
          active = destination;
          requested = destination;
          transitioning = false;
          bindings.show(active);
        } else restore();
        timeline = undefined;
        await ready(ticket);
        if (ticket === generation && alive()) bindings.activated(active);
        return result;
      } catch (error) {
        if (ticket !== generation || !alive()) return cancelled;
        timeline?.cancel('navigation-failed');
        timeline = undefined;
        restore();
        await ready(ticket);
        throw error;
      }
    },
    async cancel(): Promise<void> {
      const ticket = ++generation;
      timeline?.cancel('user');
      timeline = undefined;
      if (!alive()) return;
      restore();
      await ready(ticket);
    },
  };
  // Kernel resume restores its saved legacy phase. Reconcile application commands
  // made while paused after that operation finishes, without awaiting in a handler.
  ctx.scope.defer(
    ctx.subscribeLifecycle((snapshot) => {
      if (snapshot.state !== 'running') return;
      const ticket = generation;
      void Promise.resolve()
        .then(async () => {
          if (ticket !== generation || !alive()) return;
          const desired = transitioning ? 'transition' : 'ready';
          if (ctx.state.getSnapshot().phase !== desired)
            await ctx.state.transition(desired, 'view:resume');
        })
        .catch(() => {
          /* Shutdown closes queued phase commands. */
        });
    }),
  );
  ctx.scope.defer(() => {
    generation++;
    timeline?.cancel('owner-disposed');
    timeline = undefined;
  });
  return navigation;
}
