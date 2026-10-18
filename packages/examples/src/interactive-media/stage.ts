/**
 * Company: EonHive Inc. | Title: Orbit Stage Composition
 * Purpose: Coordinate chapter motion and interruptible film-to-ending handoffs within the existing controller.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { MotionCapability, type MotionKeyframe, type MotionOptions } from '@urk/adapters/motion';
import { createTransitions } from '../media/index.js';
import type { Branch } from './bookmarks.js';
import type { createMediaView } from './view.js';

type Scene = 'film' | 'ending' | 'gallery';
export function createStoryStage(
  ctx: RuntimeContext,
  view: ReturnType<typeof createMediaView>,
  report: (error: unknown) => void,
) {
  const motion = ctx.require(MotionCapability).scoped(ctx.scope);
  const transitions = createTransitions(ctx.signal);
  ctx.scope.defer(() => transitions.dispose());
  const panels = { film: view.film, ending: view.ending, gallery: view.gallery };
  let visible: Scene = 'film';
  let requested: Scene = 'film';
  let suspended = false;
  let chapterKey: string | undefined;
  let revision = 0;
  view.screen.dataset.scene = visible;

  async function play(element: Element, frames: MotionKeyframe[], options: MotionOptions) {
    const result = await motion.animate(element, frames, options).finished;
    if (result.status === 'failed') throw result.error;
    // Interrupted presentation must not commit the next scene or move focus.
    if (result.status === 'cancelled') throw new DOMException('Motion cancelled.', 'AbortError');
  }

  function observe(task: Promise<void>) {
    void task.catch((error) => {
      if (!ctx.signal.aborted && error?.name !== 'AbortError') report(error);
    });
  }
  function publish(state: Scene) {
    ctx.events.emit({
      type: 'media:stage',
      source: 'interactive-media',
      payload: { state },
      timestamp: Date.now(),
    });
  }
  function show(next: Scene) {
    requested = next;
    const version = ++revision;
    if (ctx.signal.aborted || suspended) return;
    view.screen.dataset.transition = next;
    observe(
      transitions
        .run(async (signal) => {
          const outgoing = panels[visible];
          if (visible !== next) {
            motion.cancel(view.overlay);
            await play(
              outgoing,
              [{ opacity: 1 }, { opacity: 0 }],
              { durationMs: 160, easing: 'ease-in', signal },
            );
            if (signal.aborted) return;
            const transferFocus = outgoing.contains(document.activeElement);
            outgoing.hidden = true;
            visible = next;
            panels[next].hidden = false;
            view.screen.dataset.scene = next;
            if (transferFocus) panels[next].focus({ preventScroll: true });
          }
          await play(
            panels[next],
            [
              { opacity: 0.3, transform: 'translateY(10px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            { durationMs: 260, easing: 'ease-out', signal },
          );
          if (!signal.aborted) publish(next);
        })
        .finally(() => {
          if (revision === version) delete view.screen.dataset.transition;
        }),
    );
  }

  return {
    gallery() { show('gallery'); },
    reveal(key: string) {
      const changed = chapterKey !== undefined && chapterKey !== key;
      chapterKey = key;
      if (!changed || visible !== 'film') return;
      observe(
        play(
          view.overlay,
          [
            { opacity: 0.35, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { durationMs: 360, easing: 'ease-out' },
        ),
      );
    },
    film() {
      // A new film command also cancels an ending that has not committed yet.
      if (requested !== 'film' || visible !== 'film') show('film');
    },
    ending(branch: Branch) {
      view.endingTitle.textContent =
        branch === 'create'
          ? 'Make the next beginning.'
          : branch === 'explore'
            ? 'Keep following your curiosity.'
            : 'Every ending is an invitation.';
      view.endingDescription.textContent =
        branch === 'create'
          ? 'You chose to create. Return with a new idea, or try another direction.'
          : branch === 'explore'
            ? 'You chose to explore. There is always more beyond the familiar.'
            : 'Replay the film and choose the direction that speaks to you.';
      show('ending');
    },
    suspend(value: boolean) {
      if (suspended === value) return;
      suspended = value;
      if (value) {
        revision++;
        transitions.cancel();
        delete view.screen.dataset.transition;
        motion.pause();
      } else {
        motion.resume();
        if (requested !== visible) show(requested);
      }
    },
  };
}
