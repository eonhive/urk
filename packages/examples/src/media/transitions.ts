/**
 * Company: EonHive Inc. | Title: Cancellable Experience Transitions
 * Purpose: Replace interrupted application transitions and await cooperative cleanup.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
const cancelled = () => new DOMException('Transition cancelled.', 'AbortError');

export function createTransitions(signal: AbortSignal) {
  const pending = new Map<AbortController, Promise<void>>();
  let current: AbortController | undefined;
  let closed = signal.aborted;
  let disposal: Promise<void> | undefined;

  const cancel = () => {
    const previous = current;
    current = undefined;
    previous?.abort();
  };
  const abort = () => {
    closed = true;
    cancel();
  };
  if (!closed) signal.addEventListener('abort', abort, { once: true });

  return {
    run(action: (signal: AbortSignal) => void | Promise<void>): Promise<void> {
      if (closed) return Promise.reject(cancelled());
      const previous = current;
      const controller = new AbortController();
      current = controller;
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const done = new Promise<void>((ok, fail) => {
        resolve = ok;
        reject = fail;
      });
      // Register before aborting the old action: cancellation callbacks can reenter.
      pending.set(controller, done);
      const finish = (failed: boolean, error?: unknown) => {
        pending.delete(controller);
        if (current === controller) current = undefined;
        if (controller.signal.aborted) reject(cancelled());
        else if (failed) reject(error);
        else resolve();
      };
      previous?.abort();
      if (controller.signal.aborted) finish(true, cancelled());
      else {
        try {
          Promise.resolve(action(controller.signal)).then(
            () => finish(false),
            (error) => finish(true, error),
          );
        } catch (error) {
          finish(true, error);
        }
      }
      return done;
    },
    cancel,
    dispose(): Promise<void> {
      if (!disposal) {
        abort();
        signal.removeEventListener('abort', abort);
        disposal = Promise.allSettled([...pending.values()]).then(() => {});
      }
      return disposal;
    },
  };
}
