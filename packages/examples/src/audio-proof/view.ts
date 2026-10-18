/**
 * Company: EonHive Inc.
 * Title: Audio Proof View
 * Purpose: Own the shared audio controls, plots, and scene host in standalone and website examples.
 * Author: Stan Nesi
 * Created: 2026-09-21
 * Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { AudioAnalysisSnapshot } from '@urk/adapters/audio';
import { createAudioPlots } from './plots.js';
import { audioLabStyles } from './styles.js';

export function createAudioView(host: HTMLElement) {
  const root = document.createElement('section');
  root.className = 'urk-audio-lab';
  root.setAttribute('aria-label', 'Audio Lab');
  root.innerHTML = `
    <span class="audio-kicker">URK AUDIO LAB / ONE SOURCE, SHARED ANALYSIS</span>
    <h2>See what you hear.</h2>
    <p>One sound drives waveform, spectrum, meters, and a reactive 3D scene.</p>
    <div class="audio-row" aria-label="Audio controls">
      <label>Source <select data-audio="track"><option value="analysis">Three-band study</option><option value="bed">Ambient bed</option><option value="pulse">Pulse loop</option><option value="confirm">Confirmation</option></select></label>
      <button type="button" data-audio="play">Play</button><button type="button" data-audio="pause">Pause</button>
      <button type="button" data-audio="restart">Restart</button><button type="button" data-audio="stop">Stop</button>
      <button type="button" data-audio="mute" aria-pressed="false">Mute</button>
      <label>Volume <input data-audio="volume" type="range" min="0" max="1" step="0.01" value="0.6" /></label>
    </div>
    <div class="audio-visuals">
      <canvas class="audio-plots" data-audio="visual" width="660" height="360" role="img" aria-label="Live waveform and frequency spectrum"></canvas>
      <div class="audio-scene-wrap"><div data-audio="scene" role="img" aria-label="Reactive 3D sculpture: bass changes scale, mids change color, treble changes satellite size"></div>
        <p data-audio="scene-status">Preparing the scene…</p></div>
    </div>
    <div class="audio-meters" aria-label="Measured audio levels">
      ${['level', 'bass', 'mids', 'treble'].map(name => `<label>${name === 'level' ? 'Level (RMS)' : name[0].toUpperCase() + name.slice(1)} <output data-audio="${name}-value">0%</output><meter data-audio="${name}" min="0" max="1" value="0"></meter></label>`).join('')}
    </div>
    <div class="audio-row" aria-label="Analysis settings">
      <label><input data-audio="enabled" type="checkbox" checked /> Analysis enabled</label>
      <label>FFT <select data-audio="fft"><option>512</option><option selected>2048</option><option>8192</option></select></label>
      <label>Smoothing <input data-audio="smoothing" type="range" min="0" max="1" step="0.05" value="0.8" /></label>
      <label>Scene <select data-audio="layout"><option value="orbit">Orbit</option><option value="row">Row</option></select></label>
    </div>
    <div class="audio-row" aria-label="Experience controls">
      <button type="button" data-audio="runtime">Pause runtime</button>
      <button type="button" data-audio="shutdown">Shut down</button>
      <button type="button" data-audio="fresh">Start fresh</button>
      <button type="button" data-audio="inspect" disabled>Show diagnostics</button>
    </div>
    <p data-audio="status" role="status">Starting runtime…</p>
    <div class="audio-foot"><span>Frames: <strong data-audio="frames">idle</strong></span>
      <span>Runtime: <strong data-audio="lifecycle">starting</strong></span><span data-audio="format">2048 samples · 1024 bins</span></div>
    <p class="audio-note">Bass → scale · mids → color · treble → satellites. Scene changes use finite tweens. Reduced motion holds geometry still. Signal measurements are not beat detection. Audio pauses when this tab is hidden; returning never autoplays.</p>
    <div data-audio="inspector"></div>`;
  const style = document.createElement('style');
  style.textContent = audioLabStyles;
  root.prepend(style);
  host.append(root);
  const get = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-audio="${name}"]`)!;
  const plots = createAudioPlots(get<HTMLCanvasElement>('visual'));
  const meters = (['level', 'bass', 'mids', 'treble'] as const).map(name => ({
    name, meter: get<HTMLMeterElement>(name), output: get<HTMLOutputElement>(`${name}-value`),
  }));
  return {
    root, get,
    render(snapshot: AudioAnalysisSnapshot) {
      plots(snapshot);
      for (const { name, meter, output } of meters) {
        meter.value = snapshot[name];
        output.value = `${Math.round(snapshot[name] * 100)}%`;
      }
      get('format').textContent = `${snapshot.waveform.length} samples · ${snapshot.spectrum.length} bins`;
    },
    dispose() { root.remove(); },
  };
}
export type AudioView = ReturnType<typeof createAudioView>;
