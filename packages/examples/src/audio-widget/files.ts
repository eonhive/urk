/**
 * Company: EonHive Inc. | Title: Local Audio File Control
 * Purpose: Reuse a registered source and own one local object URL within the host scope.
 * Author: Stan Nesi | Created: 2026-10-19 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { AudioCapability } from '@urk/adapters/audio';

export function mountAudioFiles(
  host: HTMLElement,
  ctx: RuntimeContext,
  options: { trackId: string; defaultSource: string; onChange?: (file: File | null) => void },
  report: (error: unknown) => void,
): void {
  if (!options.defaultSource.trim()) throw new TypeError('Local audio needs a default source.');
  const audio = ctx.require(AudioCapability);
  const root = document.createElement('div');
  root.className = 'urk-audio-files';
  root.innerHTML = `
    <style>
      .urk-audio-files { display:grid; gap:10px; margin:16px 0; min-width:0; }
      .urk-audio-files > label { display:grid; gap:8px; }
      .urk-audio-files input[type=file] { width:100%; min-width:0; font:inherit; }
      .urk-audio-files > button { justify-self:start; }
      .urk-audio-files > p { font-size:12px; overflow-wrap:anywhere; margin:0; }
    </style>
    <label>Choose audio file <input data-audio-file type="file" accept="audio/*" /></label>
    <button data-audio-file type="button" disabled>Use demo audio</button>
    <p role="status">Demo audio selected. Chosen files play locally in this browser.</p>`;
  const input = root.querySelector('input')!;
  const reset = root.querySelector('button')!;
  const status = root.querySelector('p')!;
  let objectUrl: string | undefined;
  let closed = false;
  const live = () => !closed && !ctx.signal.aborted &&
    ctx.getLifecycleSnapshot().state === 'running';
  const sync = () => {
    input.disabled = !live();
    reset.disabled = !live() || !objectUrl;
  };
  const replace = (src: string, file: File | null) => {
    try { audio.setSource(options.trackId, src); }
    catch (error) {
      if (file) URL.revokeObjectURL(src);
      throw error;
    }
    const previous = objectUrl;
    objectUrl = file ? src : undefined;
    if (previous) URL.revokeObjectURL(previous);
    status.textContent = file ? `${file.name} selected. Press Play.` : 'Demo audio selected. Press Play.';
    options.onChange?.(file);
    sync();
  };
  const chooseFile = () => {
    const file = input.files?.[0];
    input.value = '';
    if (!live() || !file) return;
    try {
      if (file.size === 0) throw new Error('Choose a non-empty audio file.');
      replace(URL.createObjectURL(file), file);
    } catch (error) { report(error); }
  };
  const useDemo = () => {
    if (!live()) return;
    try { replace(options.defaultSource, null); }
    catch (error) { report(error); }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    input.removeEventListener('change', chooseFile);
    reset.removeEventListener('click', useDemo);
    ctx.signal.removeEventListener('abort', close);
    const previous = objectUrl;
    objectUrl = undefined;
    try {
      // Early unmount leaves the borrowed track reusable; shutdown clears its element.
      if (previous && !ctx.signal.aborted) audio.setSource(options.trackId, options.defaultSource);
    } finally {
      if (previous) URL.revokeObjectURL(previous);
      root.remove();
    }
  };
  ctx.scope.defer(close);
  ctx.scope.defer(ctx.subscribeLifecycle(sync));
  host.append(root);
  input.addEventListener('change', chooseFile);
  reset.addEventListener('click', useDemo);
  ctx.signal.addEventListener('abort', close, { once: true });
  sync();
}
