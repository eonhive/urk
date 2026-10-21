/**
 * Company: EonHive Inc. | Title: Audio Widget View
 * Purpose: Render shared audio plots, normalized meters, and a coordinated Canvas pulse.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import type { AudioAnalysisSnapshot } from '@urk/adapters/audio';
import { createAudioPlots } from './plots.js';
import { audioWidgetStyles } from './styles.js';
import { scaleAudioReaction, type AudioReactionSettings } from './reactions.js';

export function createAudioWidgetView(title: string) {
  const root = document.createElement('section');
  root.className = 'uaw';
  root.setAttribute('aria-label', `${title} audio widget`);
  root.innerHTML = `
    <h2></h2>
    <div class="uaw-controls" aria-label="Audio controls">
      <button type="button" data-audio="play">Play</button>
      <button type="button" data-audio="pause">Pause</button>
      <button type="button" data-audio="restart">Restart audio</button>
      <button type="button" data-audio="mute" aria-pressed="false">Mute</button>
      <label>Volume <input data-audio="volume" type="range" min="0" max="1" step="0.01" /></label>
    </div>
    <div data-audio="position"></div>
    <div data-audio="files"></div>
    <canvas class="uaw-plots" data-audio="plots" width="660" height="360" role="img" aria-label="Live waveform and frequency spectrum"></canvas>
    <canvas class="uaw-pulse" data-audio="pulse" width="220" height="220" aria-hidden="true"></canvas>
    <div class="uaw-meters" aria-label="Measured audio levels">
      ${(['level', 'bass', 'mids', 'treble'] as const).map(name => `<label>${name === 'level' ? 'Level' : name[0].toUpperCase() + name.slice(1)} <output data-audio="${name}-value">0%</output><meter data-audio="${name}" min="0" max="1" value="0"></meter></label>`).join('')}
    </div>
    <div data-audio="reactions"></div>
    <div class="uaw-settings">
      <label><input data-audio="analysis" type="checkbox" checked /> Audio analysis</label>
      <label>FFT <select data-audio="fft"><option>512</option><option selected>2048</option><option>8192</option></select></label>
      <label>Smoothing <input data-audio="smoothing" type="range" min="0" max="1" step="0.05" value="0.8" /></label>
    </div>
    <p data-audio="status" role="status">Ready. Press Play to start sound and analysis.</p>
    <p class="uaw-note">Bass → size · mids → color · treble → satellites. Reduced motion holds the pulse still. Measurements are not beat detection. Pause, hidden tabs, and removal stop sound; returning never autoplays.</p>`;
  root.querySelector('h2')!.textContent = title;
  const style = document.createElement('style');
  style.textContent = audioWidgetStyles;
  root.prepend(style);
  const get = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-audio="${name}"]`)!;
  const plots = createAudioPlots(get<HTMLCanvasElement>('plots'));
  const pulse = get<HTMLCanvasElement>('pulse').getContext('2d');
  if (!pulse) throw new Error('Canvas is unavailable.');
  const meters = (['level', 'bass', 'mids', 'treble'] as const).map(name => ({
    name, meter: get<HTMLMeterElement>(name), output: get<HTMLOutputElement>(`${name}-value`),
  }));
  return {
    root, get,
    render(snapshot: AudioAnalysisSnapshot, reducedMotion: boolean, reactions: Readonly<AudioReactionSettings>) {
      plots(snapshot);
      for (const { name, meter, output } of meters) {
        meter.value = snapshot[name];
        output.value = `${Math.round(snapshot[name] * 100)}%`;
      }
      pulse.clearRect(0, 0, 220, 220);
      const bass = reducedMotion ? 0 : scaleAudioReaction(snapshot.bass, reactions.intensity, reactions.bass);
      const mids = reducedMotion ? 0 : scaleAudioReaction(snapshot.mids, reactions.intensity, reactions.mids);
      const treble = reducedMotion ? 0 : scaleAudioReaction(snapshot.treble, reactions.intensity, reactions.treble);
      pulse.fillStyle = `hsl(${165 + mids * 80} 65% 65%)`;
      pulse.beginPath();
      pulse.arc(110, 110, 48 * (1 + bass * 0.35), 0, Math.PI * 2);
      pulse.fill();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        pulse.beginPath();
        pulse.arc(110 + Math.cos(angle) * 86, 110 + Math.sin(angle) * 86,
          3 + treble * 7, 0, Math.PI * 2);
        pulse.fill();
      }
    },
  };
}
