/**
 * Company: EonHive Inc. | Title: Audio Position Control
 * Purpose: Share native-event playback progress and keyboard seeking without a render loop.
 * Author: Stan Nesi | Created: 2026-10-19 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { AudioCapability } from '@urk/adapters/audio';

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = String(total % 60).padStart(2, '0');
  if (minutes < 60) return `${minutes}:${remainder}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${remainder}`;
}

export function mountAudioPosition(
  host: HTMLElement,
  ctx: RuntimeContext,
  report: (error: unknown) => void,
): void {
  const audio = ctx.require(AudioCapability);
  const root = document.createElement('label');
  root.className = 'urk-audio-position';
  root.innerHTML = `
    <style>
      label.urk-audio-position { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px 12px; margin:16px 0; min-width:0; font-size:13px; }
      .urk-audio-position > .position-label { grid-column:1/-1; }
      .urk-audio-position input[type=range] { width:100%; min-width:0; }
      .urk-audio-position input:focus-visible { outline:3px solid #b0a8ff; outline-offset:3px; }
      .urk-audio-position .position-time { font-variant-numeric:tabular-nums; white-space:nowrap; }
    </style>
    <span class="position-label">Audio position</span>
    <input data-audio-position type="range" min="0" max="0" step="0.01" value="0" aria-label="Audio position" disabled />
    <span class="position-time" aria-hidden="true">0:00 / --:--</span>`;
  const input = root.querySelector('input')!;
  const time = root.querySelector<HTMLElement>('.position-time')!;
  let closed = false;
  const sync = () => {
    if (closed || ctx.signal.aborted) return;
    const snapshot = audio.getSnapshot();
    const duration = snapshot.duration;
    const known = duration !== null && Number.isFinite(duration) && duration > 0;
    input.max = String(known ? duration : 0);
    input.value = String(known ? Math.min(snapshot.currentTime, duration) : 0);
    input.disabled = !known || ctx.getLifecycleSnapshot().state !== 'running';
    const end = duration === Infinity ? 'Live' : duration === null ? '--:--' : formatTime(duration);
    const value = `${formatTime(snapshot.currentTime)} / ${end}`;
    time.textContent = value;
    input.setAttribute('aria-valuetext', value);
  };
  const seek = () => {
    if (closed || ctx.signal.aborted || input.disabled) return;
    try { audio.seek(Number(input.value)); }
    catch (error) { sync(); report(error); }
  };
  const close = () => { closed = true; input.disabled = true; };
  ctx.scope.defer(() => {
    close();
    input.removeEventListener('input', seek);
    ctx.signal.removeEventListener('abort', close);
    root.remove();
  });
  host.append(root);
  input.addEventListener('input', seek);
  ctx.signal.addEventListener('abort', close, { once: true });
  ctx.scope.defer(audio.subscribe(sync));
  ctx.scope.defer(ctx.subscribeLifecycle(sync));
  sync();
}
