/**
 * Company: EonHive Inc. | Title: Audio Analysis Plots
 * Purpose: Render borrowed audio samples without owning playback or frame scheduling.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import type { AudioAnalysisSnapshot } from '@urk/adapters/audio';

export interface AudioPlotOptions {
  mode?: 'both' | 'waveform' | 'spectrum';
  gain?: number;
  ink?: string;
  accent?: string;
}

export function createAudioPlots(canvas: HTMLCanvasElement) {
  const paint = canvas.getContext('2d');
  if (!paint) throw new Error('Canvas is unavailable.');
  return (snapshot: AudioAnalysisSnapshot, options: AudioPlotOptions = {}) => {
    const { waveform, spectrum } = snapshot;
    const mode = options.mode ?? 'both';
    const gain = options.gain ?? 1;
    // Keep the existing logical coordinates while supporting resized, dense canvases.
    paint.setTransform(canvas.width / 660, 0, 0, canvas.height / 360, 0, 0);
    paint.clearRect(0, 0, 660, 360);
    paint.font = '13px system-ui';
    paint.fillStyle = options.ink ?? '#94a9c9';
    if (mode !== 'spectrum') paint.fillText('WAVEFORM', 24, 30);
    if (mode !== 'waveform')
      paint.fillText('SPECTRUM · LOG FREQUENCY', 24, mode === 'both' ? 196 : 30);
    paint.strokeStyle = options.accent ?? '#7be3cd';
    paint.lineWidth = 2;
    paint.beginPath();
    // Keep drawing cost bounded when the user selects a larger FFT.
    for (let x = 0; mode !== 'spectrum' && x <= 600; x++) {
      const index = Math.min(waveform.length - 1, Math.floor((x / 600) * waveform.length));
      const sample = Math.max(-1, Math.min(1, (waveform[index] ?? 0) * gain));
      const y = (mode === 'both' ? 104 : 180) - sample * (mode === 'both' ? 64 : 108);
      if (x === 0) paint.moveTo(24, y);
      else paint.lineTo(x + 24, y);
    }
    paint.stroke();
    const binHz = snapshot.sampleRate / (waveform.length || 1);
    for (let bar = 0; mode !== 'waveform' && bar < 48; bar++) {
      const start = binHz ? Math.floor((20 * 1000 ** (bar / 48)) / binHz) : 0;
      const end = binHz
        ? Math.min(
            spectrum.length,
            Math.max(start + 1, Math.ceil((20 * 1000 ** ((bar + 1) / 48)) / binHz)),
          )
        : 0;
      let peak = 0;
      for (let i = start; i < end; i++) peak = Math.max(peak, spectrum[i]);
      const height = Math.min(1, (peak / 255) * gain) * (mode === 'both' ? 125 : 250);
      paint.fillStyle = options.accent ?? `hsl(${165 + bar * 1.9} 65% 65%)`;
      paint.fillRect(24 + bar * 12.5, 334 - height, 9, Math.max(2, height));
    }
  };
}
