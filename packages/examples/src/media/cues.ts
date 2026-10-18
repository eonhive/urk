/**
 * Company: EonHive Inc. | Title: Media Cues
 * Purpose: Coordinate small cancellable actions from media time and application events.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import type { TimeSource, TimeSample } from './time-source.js';

export interface Cue {
  id: string;
  group?: string;
  when: { at: number } | { event: string };
  /** Once per controller lifetime, until an explicit reset. Others repeat on replay/events. */
  once?: boolean;
  run(context: { signal: AbortSignal; time: number; payload?: unknown }): void | Promise<void>;
}

export function createCues(options: {
  source: TimeSource;
  cues: readonly Cue[];
  signal?: AbortSignal;
  onError(error: unknown, id: string): void;
}) {
  const entries = options.cues.map((cue) => ({ ...cue, when: { ...cue.when }, active: true, fired: false }));
  const ids = new Set<string>();
  for (const cue of entries) {
    if (!cue.id || ids.has(cue.id)) throw new Error(`Duplicate or empty cue id: ${cue.id}`);
    if ('at' in cue.when && (!Number.isFinite(cue.when.at) || cue.when.at < 0))
      throw new RangeError('Cue time must be finite and nonnegative.');
    ids.add(cue.id);
  }
  const timed = entries
    .filter((cue) => 'at' in cue.when)
    .sort((a, b) => (a.when as { at: number }).at - (b.when as { at: number }).at);
  const pending = new Map<AbortController, { id: string; done: Promise<void> }>();
  let previous = options.source.getTime();
  let includeBoundary = true;
  let generation = 0;
  let closed = false;
  let suspended = false;
  let unsubscribe = () => {};
  let completion: Promise<void> | undefined;

  const cancel = (id?: string) => {
    for (const [controller, work] of pending) if (id === undefined || work.id === id) controller.abort();
  };
  const fire = (cue: (typeof entries)[number], payload?: unknown) => {
    if (closed || suspended || !cue.active || (cue.once && cue.fired)) return;
    cue.fired = true;
    cancel(cue.id);
    const controller = new AbortController();
    // Register before invoking user code so reentrant cancellation sees this action.
    let settle!: () => void;
    const done = new Promise<void>((resolve) => {
      settle = resolve;
    });
    pending.set(controller, { id: cue.id, done });
    const report = (error: unknown) => {
      if (controller.signal.aborted) return;
      try {
        options.onError(error, cue.id);
      } catch {
        /* Error reporting must not leak rejected promises. */
      }
    };
    const finish = () => {
      pending.delete(controller);
      settle();
    };
    try {
      Promise.resolve(cue.run({ signal: controller.signal, time: options.source.getTime(), payload }))
        .catch(report)
        .then(finish);
    } catch (error) {
      report(error);
      finish();
    }
  };
  const trigger = (event: string, payload?: unknown) => {
    for (const cue of entries) if ('event' in cue.when && cue.when.event === event) fire(cue, payload);
  };
  const rewind = (time: number, resetOnce = false) => {
    generation++;
    cancel();
    for (const cue of entries) {
      if (resetOnce || (!cue.once && 'at' in cue.when && cue.when.at >= time)) cue.fired = false;
    }
    previous = time;
    includeBoundary = true;
  };
  const sample = ({ time, kind }: TimeSample) => {
    if (closed || !Number.isFinite(time) || time < 0) return;
    if (kind === 'seek' || kind === 'reset') {
      rewind(time);
      return;
    }
    if (suspended) {
      previous = time;
      return;
    }
    if (time < previous) rewind(time);
    const from = previous;
    const includeStart = includeBoundary;
    const current = generation;
    includeBoundary = false;
    previous = time;
    for (const cue of timed) {
      if (current !== generation) return;
      const at = (cue.when as { at: number }).at;
      if (!cue.fired && (at > from || (includeStart && at === from)) && at <= time) fire(cue);
    }
    if (kind === 'ended' && current === generation) trigger('ended');
  };
  const stop = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    options.signal?.removeEventListener('abort', stop);
    cancel();
  };
  if (options.signal?.aborted) closed = true;
  else {
    unsubscribe = options.source.subscribe(sample);
    options.signal?.addEventListener('abort', stop, { once: true });
  }
  return {
    trigger,
    cancel,
    setActive(idOrGroup: string, active: boolean) {
      for (const cue of entries)
        if (cue.id === idOrGroup || cue.group === idOrGroup) {
          cue.active = active;
          if (!active) cancel(cue.id);
        }
    },
    suspend(value: boolean) {
      suspended = value;
      if (value) cancel();
    },
    reset() {
      rewind(options.source.getTime(), true);
    },
    dispose() {
      stop();
      return (completion ??= Promise.all([...pending.values()].map((work) => work.done)).then(() => {}));
    },
  };
}
