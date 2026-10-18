/**
 * Company: EonHive Inc. | Title: Audio Analysis Plots
 * Purpose: Render borrowed audio samples without owning playback or frame scheduling.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import type { AudioAnalysisSnapshot } from '@urk/adapters/audio';

export function createAudioPlots(canvas: HTMLCanvasElement) {
  const paint = canvas.getContext('2d');
  if (!paint) throw new Error('Canvas is unavailable.');
  return (snapshot: AudioAnalysisSnapshot) => {
    const { waveform, spectrum } = snapshot;
    paint.clearRect(0, 0, 660, 360);
    paint.font = '13px system-ui';
    paint.fillStyle = '#94a9c9';
    paint.fillText('WAVEFORM', 24, 30);
    paint.fillText('SPECTRUM · LOG FREQUENCY', 24, 196);
    paint.strokeStyle = '#7be3cd';
    paint.lineWidth = 2;
    paint.beginPath();
    // Keep drawing cost bounded when the user selects a larger FFT.
    for (let x = 0; x <= 600; x++) {
      const index = Math.min(waveform.length - 1, Math.floor(x / 600 * waveform.length));
      const y = 104 - (waveform[index] ?? 0) * 64;
      if (x === 0) paint.moveTo(24, y);
      else paint.lineTo(x + 24, y);
    }
    paint.stroke();
    const binHz = snapshot.sampleRate / (waveform.length || 1);
    for (let bar = 0; bar < 48; bar++) {
      const start = binHz ? Math.floor(20 * 1000 ** (bar / 48) / binHz) : 0;
      const end = binHz ? Math.min(spectrum.length, Math.max(start + 1,
        Math.ceil(20 * 1000 ** ((bar + 1) / 48) / binHz))) : 0;
      let peak = 0;
      for (let i = start; i < end; i++) peak = Math.max(peak, spectrum[i]);
      const height = peak / 255 * 125;
      paint.fillStyle = `hsl(${165 + bar * 1.9} 65% 65%)`;
      paint.fillRect(24 + bar * 12.5, 334 - height, 9, Math.max(2, height));
    }
  };
}
