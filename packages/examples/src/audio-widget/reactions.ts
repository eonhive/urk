/**
 * Company: EonHive Inc. | Title: Audio Reaction Controls
 * Purpose: Tune example visuals without changing audio playback or measured analysis.
 * Author: Stan Nesi | Created: 2026-10-19 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';

export interface AudioReactionSettings {
  intensity: number;
  bass: number;
  mids: number;
  treble: number;
}

export function resolveAudioReactions(initial: Partial<AudioReactionSettings> = {}): Readonly<AudioReactionSettings> {
  if (!initial || typeof initial !== 'object' || Array.isArray(initial))
    throw new TypeError('Audio reactions must be an object.');
  const settings: AudioReactionSettings = { intensity: 1, bass: 1, mids: 1, treble: 1 };
  for (const key of ['intensity', 'bass', 'mids', 'treble'] as const) {
    const value = initial[key] === undefined ? 1 : initial[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 2)
      throw new RangeError(`Audio reaction ${key} must be between zero and two.`);
    settings[key] = value;
  }
  return Object.freeze(settings);
}

/** Keep amplified reactions within each renderer's existing visual range. */
export function scaleAudioReaction(value: number, intensity: number, response: number): number {
  return Math.min(1, value * intensity * response);
}

export function mountAudioReactions(
  host: HTMLElement,
  ctx: RuntimeContext,
  redraw: (settings: Readonly<AudioReactionSettings>) => void,
  options: {
    initial?: Partial<AudioReactionSettings>;
    onChange?: (settings: Readonly<AudioReactionSettings>) => void;
  } = {},
): Readonly<AudioReactionSettings> {
  const settings = { ...resolveAudioReactions(options.initial) };
  const fields = [
    ['intensity', 'Overall intensity'], ['bass', 'Bass pulse'],
    ['mids', 'Mids color'], ['treble', 'Treble detail'],
  ] as const;
  const root = document.createElement('fieldset');
  root.className = 'urk-audio-reactions';
  root.innerHTML = `
    <legend>Visual response</legend>
    <div class="urk-audio-reaction-fields">
      ${fields.map(([key, label]) => `<label>${label}
        <input data-audio-reaction="${key}" type="range" min="0" max="2" step="0.05" value="1" aria-valuetext="100%" />
        <output>100%</output></label>`).join('')}
    </div>
    <button type="button" data-audio-reaction="reset">Reset reactions</button>
    <p>Visuals only. Audio volume and measurements stay unchanged.</p>`;
  const style = document.createElement('style');
  style.textContent = `
    .urk-audio-reactions { min-width:0; margin:20px 0; padding:16px; border:1px solid #394762; border-radius:12px; }
    .urk-audio-reactions legend { padding:0 6px; font-size:13px; }
    .urk-audio-reactions .urk-audio-reaction-fields { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr)); gap:14px; margin-bottom:16px; }
    .urk-audio-reactions .urk-audio-reaction-fields label { display:grid; grid-template-columns:1fr auto; gap:6px; min-width:0; }
    .urk-audio-reactions .urk-audio-reaction-fields input { grid-column:1/-1; grid-row:2; width:100%; margin:0; }
    .urk-audio-reactions output { font-variant-numeric:tabular-nums; }
    .urk-audio-reactions p { margin:10px 0 0; font-size:12px; }
    .urk-audio-reactions:disabled { opacity:.6; }
  `;
  root.prepend(style);
  host.append(root);
  const events = new AbortController();
  ctx.scope.defer(() => { events.abort(); root.remove(); });
  const live = () => !ctx.signal.aborted && !document.hidden &&
    ctx.getLifecycleSnapshot().state === 'running';
  const controls = fields.map(([key]) => ({
    key,
    input: root.querySelector<HTMLInputElement>(`[data-audio-reaction="${key}"]`)!,
    output: root.querySelector<HTMLOutputElement>(`[data-audio-reaction="${key}"] + output`)!,
  }));
  const showValues = () => {
    for (const { key, input, output } of controls) {
      input.value = String(settings[key]);
      output.value = `${Math.round(settings[key] * 100)}%`;
      input.setAttribute('aria-valuetext', output.value);
    }
  };
  const notify = () => {
    try { options.onChange?.(Object.freeze({ ...settings })); }
    catch {
      // Host observers must not interrupt already committed visual settings.
    }
  };
  for (const { key, input } of controls) {
    const update = () => {
      if (!live() || !Number.isFinite(input.valueAsNumber)) return false;
      settings[key] = Math.max(0, Math.min(2, input.valueAsNumber));
      showValues();
      redraw(settings);
      return true;
    };
    input.addEventListener('input', update, { signal: events.signal });
    input.addEventListener('change', () => {
      if (update()) notify();
    }, { signal: events.signal });
  }
  root.querySelector<HTMLButtonElement>('[data-audio-reaction="reset"]')!
    .addEventListener('click', () => {
      if (!live()) return;
      for (const { key } of controls) settings[key] = 1;
      showValues();
      redraw(settings);
      notify();
    }, { signal: events.signal });
  const sync = () => { root.disabled = !live(); };
  ctx.scope.defer(ctx.subscribeLifecycle(sync));
  document.addEventListener('visibilitychange', sync, { signal: events.signal });
  ctx.signal.addEventListener('abort', sync, { once: true, signal: events.signal });
  showValues();
  sync();
  return settings;
}
