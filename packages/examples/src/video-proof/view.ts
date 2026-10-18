/**
 * Company: EonHive Inc. | Title: Video Proof Player View
 * Purpose: Present accessible controls for one native video without owning transport behavior.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import type { VideoSnapshot } from '@urk/adapters/video';

export function createPlayerView(index: number) {
  const root = document.createElement('section');
  root.className = 'video-card';
  root.setAttribute('aria-label', `Player ${index + 1}`);
  root.innerHTML = `
    <header><span class="video-kicker">CHANNEL 0${index + 1}</span><output data-status>idle</output></header>
    <video playsinline preload="metadata" poster="/video/orbit.svg" aria-label="Player ${index + 1} video">
      <track kind="captions" label="English · Orbit" srclang="en" src="/video/orbit.vtt" />
    </video>
    <div class="video-card-body">
      <h3>${index === 0 ? 'Find your rhythm.' : 'Follow your own path.'}</h3>
      <p data-source>Orbit · original silent sample · 8 seconds</p>
      <fieldset><legend class="video-sr-only">Player ${index + 1} controls</legend>
        <div class="video-transport"><button data-play>Play</button><button data-pause>Pause</button><button data-stop>Stop</button><output data-time aria-live="off">0:00 / —</output></div>
        <label class="video-seek">Playback position <input data-seek type="range" min="0" max="0" step="0.1" value="0" disabled /></label>
        <div class="video-settings">
          <label>Volume <input data-volume type="range" min="0" max="1" step="0.05" value="1" /></label>
          <button data-mute aria-pressed="false">Mute</button>
          <label>Speed <select data-speed><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
          <label class="video-check"><input data-loop type="checkbox" /> Loop</label>
          <label>Captions <select data-captions><option value="">Off</option></select></label>
        </div>
        <div class="video-files"><label>Open local video <input data-file type="file" accept="video/*" /></label><label>Load WebVTT captions <input data-track-file type="file" accept=".vtt,text/vtt" /></label></div>
        <button data-sample class="video-text-button">Restore Orbit sample</button>
      </fieldset>
      <p data-message role="status">Press Play to begin. Files stay on your device.</p>
    </div>`;
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const view = {
    root,
    video: find<HTMLVideoElement>('video'),
    controls: find<HTMLFieldSetElement>('fieldset'),
    play: find<HTMLButtonElement>('[data-play]'),
    pause: find<HTMLButtonElement>('[data-pause]'),
    stop: find<HTMLButtonElement>('[data-stop]'),
    seek: find<HTMLInputElement>('[data-seek]'),
    volume: find<HTMLInputElement>('[data-volume]'),
    mute: find<HTMLButtonElement>('[data-mute]'),
    speed: find<HTMLSelectElement>('[data-speed]'),
    loop: find<HTMLInputElement>('[data-loop]'),
    captions: find<HTMLSelectElement>('[data-captions]'),
    file: find<HTMLInputElement>('[data-file]'),
    trackFile: find<HTMLInputElement>('[data-track-file]'),
    sample: find<HTMLButtonElement>('[data-sample]'),
    message: find<HTMLParagraphElement>('[data-message]'),
    source: find<HTMLParagraphElement>('[data-source]'),
  };
  let trackKey = '';
  const time = (value: number | null) =>
    value === null || !Number.isFinite(value)
      ? '—'
      : `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  const render = (state: VideoSnapshot) => {
    find<HTMLOutputElement>('[data-status]').textContent = state.status;
    find<HTMLOutputElement>('[data-time]').textContent =
      `${time(state.currentTime)} / ${time(state.duration)}`;
    const duration = state.duration !== null && Number.isFinite(state.duration) ? state.duration : 0;
    view.seek.max = String(duration);
    view.seek.value = String(Math.min(state.currentTime, duration));
    view.seek.disabled = state.readyState === 0 || duration === 0;
    view.pause.disabled = state.paused && state.status !== 'buffering' && state.status !== 'loading';
    view.stop.disabled = state.readyState === 0;
    view.play.textContent =
      state.status === 'ended' ? 'Replay' : state.status === 'playing' ? 'Playing' : 'Play';
    view.play.disabled = state.status === 'playing';
    view.volume.value = String(state.volume);
    view.mute.textContent = state.muted ? 'Unmute' : 'Mute';
    view.mute.setAttribute('aria-pressed', String(state.muted));
    view.speed.value = String(state.playbackRate);
    view.loop.checked = state.loop;
    const captions = state.textTracks.filter(
      (track) => track.kind === 'captions' || track.kind === 'subtitles',
    );
    const key = JSON.stringify(captions.map(({ index, label, language }) => [index, label, language]));
    if (key !== trackKey) {
      trackKey = key;
      view.captions.replaceChildren(new Option('Off', ''));
      for (const track of captions)
        view.captions.add(
          new Option(track.label || track.language || `Track ${track.index + 1}`, String(track.index)),
        );
    }
    view.captions.value = String(captions.find((track) => track.mode === 'showing')?.index ?? '');
    const messages = {
      idle: 'Press Play to begin. Files stay on your device.',
      loading: 'Loading video…',
      ready: 'Ready. Press Play to begin.',
      playing: 'Playing. Each channel has its own transport.',
      paused: 'Paused. Press Play when you are ready.',
      buffering: 'Waiting for video data…',
      ended: 'Finished. Replay or choose another video.',
      disposed: 'Player released.',
      error: 'Video unavailable.',
    };
    const message = state.error?.message ?? messages[state.status];
    if (view.message.textContent !== message) view.message.textContent = message;
  };
  return { ...view, render };
}
