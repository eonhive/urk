/**
 * Company: EonHive Inc. | Title: Orbit Sound Reaction
 * Purpose: Pull optional soundtrack analysis only while an owned gallery can use it.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { AudioMixerCapability } from '@urk/adapters/audio/mixer';
import type { createMediaView } from './view.js';

export function mountSoundReaction(
  ctx: RuntimeContext,
  view: ReturnType<typeof createMediaView>,
  apply: (level: number, bass: number) => void,
) {
  const mixer = ctx.require(AudioMixerCapability);
  const channels = ['explore', 'create'].map(name => mixer.channel(name));
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const supported = typeof AudioContext !== 'undefined';
  const pending = new Set<Promise<void>>();
  let requested = false;
  let enabling = false;
  let suspended = false;
  let generation = 0;
  let message = '';
  let releaseFrame: (() => void) | undefined;

  const active = () => !ctx.signal.aborted && !suspended && !document.hidden &&
    !preference.matches && ctx.getLifecycleSnapshot().state === 'running';
  const playing = () => channels.some(channel => {
    const snapshot = channel.getSnapshot();
    return !snapshot.muted && (snapshot.status === 'playing' || snapshot.status === 'loading');
  });
  const audible = () => {
    const group = mixer.getGroupSnapshot('music');
    return group.volume > 0 && group.level > 0 && channels.some(channel => {
      const snapshot = channel.getSnapshot();
      return snapshot.status === 'playing' && !snapshot.muted && snapshot.volume > 0;
    });
  };
  function rest() {
    releaseFrame?.();
    releaseFrame = undefined;
    view.reactionLevel.value = 0;
    apply(0, 0);
  }
  function render() {
    view.reaction.textContent = requested ? 'Stop sound reaction' : 'React to sound';
    view.reaction.setAttribute('aria-pressed', String(requested));
    view.reaction.disabled = !supported || !active() || !playing();
    view.reactionStatus.textContent = !supported ? 'Audio reaction is unavailable. Sound still works.'
      : preference.matches ? 'Sound reaction is off for reduced motion.'
      : suspended ? 'Sound reaction is resting while graphics are paused.'
      : message || (enabling ? 'Connecting the soundtrack…'
        : requested ? releaseFrame ? 'The gallery is responding to your soundtrack.' : 'Sound is silent. The gallery is resting.'
        : playing() ? 'Let the soundtrack shape the gallery.' : 'Enable sound to animate the gallery.');
  }
  function disable(reason = '') {
    generation++;
    requested = enabling = false;
    message = reason;
    // Captured media keeps its original audio context; disable bypasses analysis only.
    for (const channel of channels) channel.analysis.disable();
    rest();
    render();
  }
  function sample() {
    if (!active() || !audible()) { sync(); return; }
    try {
      let level = 0, bass = 0;
      for (const channel of channels) {
        const snapshot = channel.analysis.read();
        level += snapshot.level;
        bass += snapshot.bass;
      }
      // Bound both channels during a crossfade; these are visual magnitudes, not beat detection.
      level = Math.min(1, level * 6);
      bass = Math.min(1, bass);
      view.reactionLevel.value = level;
      apply(level, bass);
    } catch {
      disable('Audio reaction is unavailable. Your soundtrack can keep playing.');
    }
  }
  function sync() {
    if (requested && (!active() || !playing())) { disable(); return; }
    if (requested && !enabling && audible()) releaseFrame ??= ctx.registerFrameWork(sample);
    else rest();
    render();
  }
  function toggle() {
    if (requested) { disable(); return; }
    if (!supported || !active() || !playing()) return;
    requested = enabling = true;
    message = '';
    const current = ++generation;
    render();
    // Resume both independent music contexts in this gesture, including the next crossfade channel.
    const task = Promise.allSettled(channels.map(channel =>
      channel.analysis.enable({ fftSize: 1024, smoothing: 0.75 }))).then(results => {
      if (current !== generation || ctx.signal.aborted) return;
      if (results.some(result => result.status === 'rejected')) {
        disable('Audio reaction is unavailable. Your soundtrack can keep playing.');
        return;
      }
      enabling = false;
      sync();
    });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  }
  for (const channel of channels) ctx.scope.defer(channel.subscribe(sync));
  view.reaction.addEventListener('click', toggle);
  preference.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  const abort = () => disable();
  ctx.signal.addEventListener('abort', abort, { once: true });
  ctx.scope.defer(async () => {
    abort();
    view.reaction.removeEventListener('click', toggle);
    preference.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync);
    ctx.signal.removeEventListener('abort', abort);
    view.reaction.disabled = true;
    view.reactionStatus.textContent = 'Enter the 3D gallery to use sound reaction.';
    await Promise.allSettled([...pending]);
  });
  render();
  return { suspend(value: boolean) { suspended = value; sync(); } };
}
