/**
 * Company: EonHive Inc. | Title: Orbit Sound Controller
 * Purpose: Coordinate opt-in sound, branch crossfades, and narration ducking with owned cancellation.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { AudioMixerCapability } from '@urk/adapters/audio/mixer';
import type { Bookmark, Branch } from './bookmarks.js';
import type { createMediaView } from './view.js';

export function createStorySound(
  ctx: RuntimeContext,
  view: ReturnType<typeof createMediaView>,
  preferences: Bookmark,
  getBranch: () => Branch,
  save: () => void,
) {
  const mixer = ctx.require(AudioMixerCapability);
  const music = {
    explore: mixer.channel('explore'),
    create: mixer.channel('create'),
  };
  const guide = mixer.channel('guide');
  const pending = new Set<Promise<void>>();
  let registered = false;
  let enabled = false;
  let generation = 0;
  let transition = new AbortController();
  let removeCueAbort = () => {};
  let message = 'Sound is off. Enable it when you’re ready.';
  view.musicVolume.value = String(preferences.musicVolume ?? 0.35);
  view.narrationVolume.value = String(preferences.narrationVolume ?? 0.8);
  mixer.setGroupVolume('music', Number(view.musicVolume.value));
  mixer.setGroupVolume('narration', Number(view.narrationVolume.value));
  mixer.setMuted(true);

  function render() {
    view.soundToggle.textContent = enabled ? 'Disable sound' : 'Enable sound';
    view.soundToggle.setAttribute('aria-pressed', String(enabled));
    view.narrate.disabled = !enabled;
    view.soundStatus.textContent = message;
  }
  function track(task: Promise<void>) {
    const settled = task.catch((error) => {
      if (ctx.signal.aborted || error?.name === 'AbortError') return;
      stop('Sound unavailable. Try enabling it again.');
    });
    pending.add(settled);
    void settled.then(() => pending.delete(settled));
    return settled;
  }
  function releaseNarration() {
    removeCueAbort();
    removeCueAbort = () => {};
    guide.stop();
    if (!ctx.signal.aborted) track(mixer.fadeGroup('music', 1, enabled ? 250 : 0));
  }
  function stop(reason = 'Sound is off. Enable it to listen again.') {
    enabled = false;
    generation++;
    transition.abort();
    removeCueAbort();
    removeCueAbort = () => {};
    // Muting immediately also silences a native play request whose promise is still pending.
    if (!ctx.signal.aborted) mixer.setMuted(true);
    mixer.stop();
    message = reason;
    render();
  }
  function register() {
    if (registered) return;
    for (const name of ['explore', 'create'] as const) {
      music[name].registerTrack({
        id: name,
        label: `${name} soundtrack`,
        src: `/audio/orbit-${name}.wav`,
        loop: true,
      });
    }
    guide.registerTrack({
      id: 'guide',
      label: 'Orbit spoken guide',
      src: '/audio/orbit-guide.wav',
    });
    registered = true;
  }
  function choose(branch: Branch) {
    if (!enabled || ctx.signal.aborted) return;
    transition.abort();
    transition = new AbortController();
    const signal = transition.signal;
    const current = ++generation;
    releaseNarration();
    const next = branch === 'create' ? 'create' : 'explore';
    const previous = next === 'create' ? 'explore' : 'create';
    // Call play synchronously inside the interaction; native playback handles loading.
    const playback = music[next].play(next);
    message = `${next === 'create' ? 'Create' : 'Explore'} soundtrack`;
    render();
    return track(
      (async () => {
        await playback;
        if (!enabled || current !== generation || signal.aborted) return;
        await Promise.all([
          mixer.fadeChannel(next, 1, 450, signal),
          mixer.fadeChannel(previous, 0, 450, signal),
        ]);
        if (current === generation && !signal.aborted) music[previous].stop();
      })(),
    );
  }
  function narrate(signal?: AbortSignal) {
    if (!enabled || ctx.signal.aborted || signal?.aborted) return;
    releaseNarration();
    const cancel = () => releaseNarration();
    signal?.addEventListener('abort', cancel, { once: true });
    removeCueAbort = () => signal?.removeEventListener('abort', cancel);
    const playback = guide.play('guide');
    return track(Promise.all([playback, mixer.fadeGroup('music', 0.22, 160)]).then(() => {}));
  }
  const listen = (element: HTMLElement, type: string, action: () => void) => {
    element.addEventListener(
      type,
      () => {
        try {
          action();
        } catch {
          stop('Sound unavailable. Try enabling it again.');
        }
      },
      { signal: ctx.signal },
    );
  };
  listen(view.soundToggle, 'click', () => {
    if (enabled) {
      stop();
      return;
    }
    register();
    music.explore.setVolume(0);
    music.create.setVolume(0);
    enabled = true;
    mixer.setMuted(false);
    void mixer.fadeGroup('music', 1, 0);
    void choose(getBranch());
  });
  listen(view.narrate, 'click', () => {
    void narrate();
  });
  for (const [input, group] of [
    [view.musicVolume, 'music'],
    [view.narrationVolume, 'narration'],
  ] as const) {
    listen(input, 'input', () => {
      mixer.setGroupVolume(group, Number(input.value));
      save();
    });
  }
  ctx.scope.defer(
    ctx.events.on('audio:ended', (event) => {
      if (event.source === 'audio-mixer:guide' && enabled) releaseNarration();
    }),
  );
  ctx.scope.defer(
    ctx.events.on('audio:error', (event) => {
      if (event.source?.startsWith('audio-mixer:') && enabled)
        stop('Sound unavailable. Try enabling it again.');
    }),
  );
  ctx.signal.addEventListener('abort', () => stop(), { once: true });
  ctx.scope.defer(async () => {
    stop();
    // Native media cancellation is cooperative; retain ownership until late play results settle.
    await Promise.allSettled([...pending]);
  });
  render();
  return { stop, choose, narrate };
}
