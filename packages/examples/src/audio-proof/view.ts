/**
 * Company: EonHive Inc.
 * Title: Audio Proof View
 * Purpose: Bind site-owned audio controls and render transport snapshots.
 * Author: Stan Nesi
 * Created: 2026-09-21
 * Updated: 2026-09-21
 * Notes: Vibe coded with Codex.
 */

import type { AudioTransportSnapshot } from '@urk/adapters';

export function readAudioView(host: HTMLElement) {
  function requireElement<T extends HTMLElement>(role: string): T {
    const element = host.querySelector<T>(`[data-role="${role}"]`);
    if (!element) throw new Error(`Missing audio surface element: ${role}`);
    return element;
  }

  const surface = requireElement<HTMLElement>('audio-surface');
  const tracks = Array.from(
    surface.querySelectorAll<HTMLButtonElement>('[data-track-id]'),
  );
  if (!tracks.length) throw new Error('Audio surface requires tracks.');

  const play = requireElement<HTMLButtonElement>('audio-play');
  const stop = requireElement<HTMLButtonElement>('audio-stop');
  const mute = requireElement<HTMLButtonElement>('audio-mute');
  const volume = requireElement<HTMLInputElement>('audio-volume');
  const volumeValue = requireElement<HTMLElement>('audio-volume-value');
  const title = requireElement<HTMLElement>('audio-title');
  const status = requireElement<HTMLElement>('audio-status');
  const message = requireElement<HTMLElement>('audio-message');

  function render(
    snapshot: AudioTransportSnapshot,
    selected: string,
    enabled: boolean,
    busy: boolean,
  ) {
    surface.dataset.playing = String(enabled && snapshot.status === 'playing');
    surface.dataset.muted = String(snapshot.muted);
    title.textContent =
      tracks.find((track) => track.dataset.trackId === selected)?.dataset
        .trackLabel ?? 'Audio Lab';
    status.textContent = enabled
      ? busy
        ? 'Loading sound'
        : snapshot.status
      : 'Runtime stopped';
    play.textContent =
      snapshot.status === 'playing' ? 'Pause track' : 'Play track';
    mute.textContent = snapshot.muted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-pressed', String(snapshot.muted));
    volume.value = String(snapshot.volume);
    volumeValue.textContent = `${Math.round(snapshot.volume * 100)}%`;
    play.disabled = stop.disabled = !enabled || busy;
    mute.disabled = volume.disabled = !enabled;
    for (const track of tracks) {
      track.disabled = !enabled || busy;
      track.setAttribute(
        'aria-pressed',
        String(track.dataset.trackId === selected),
      );
    }
  }

  return { surface, tracks, play, stop, mute, volume, message, render };
}

export type AudioView = ReturnType<typeof readAudioView>;
