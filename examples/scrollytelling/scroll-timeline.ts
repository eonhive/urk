/**
 * Company: EonHive Inc. | Title: Story Scroll Timeline
 * Purpose: Sample an owned paused timeline from normalized native scroll progress.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import type { ScopedMotion, TimelineHandle, TimelineOptions } from '@urk/adapters/motion';

/** Application binding only: native scroll supplies position; motion supplies the pose. */
export function createScrollTimeline(
  ctx: RuntimeContext,
  motion: ScopedMotion,
  build: () => TimelineOptions,
) {
  let handle: TimelineHandle | undefined;
  let sampledProgress: number | undefined;
  let disposed = false;

  function reset(): void {
    handle?.cancel('scroll-binding-reset');
    handle = undefined;
    sampledProgress = undefined;
  }

  ctx.scope.defer(() => {
    disposed = true;
    reset();
  });

  return {
    get handle() {
      return handle;
    },
    reset,
    sample(progress: number): void {
      if (!Number.isFinite(progress)) throw new RangeError('Scroll progress must be finite.');
      if (disposed || ctx.signal.aborted || ctx.getLifecycleSnapshot().state !== 'running') return;
      const position = Math.max(0, Math.min(1, progress));
      if (!handle) {
        handle = motion.timeline(build());
        handle.pause();
      }
      // Reduced motion may have synchronously finished this handle. The caller
      // restores stable styles and resets it before enabling scroll motion again.
      if (handle.status !== 'paused' || sampledProgress === position) return;
      handle.seek(position * handle.durationMs);
      sampledProgress = position;
    },
  };
}
