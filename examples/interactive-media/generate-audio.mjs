/**
 * Company: EonHive Inc. | Title: Orbit Audio Assets
 * Purpose: Generate original chord loops and a formant-synthesized spoken guide for the media example.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex. Optional asset tool; not a build or runtime dependency.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const voiceModule = process.argv[2];
if (!voiceModule)
  throw new Error('Pass the path to @echogarden/espeak-ng-emscripten 0.3.5 espeak-ng.js.');
const destinations = [
  new URL('../public/audio/', import.meta.url),
  new URL('../../apps/www/public/audio/', import.meta.url),
];
async function save(name, samples, rate) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) =>
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2),
  );
  for (const destination of destinations) {
    await mkdir(destination, { recursive: true });
    await writeFile(new URL(name, destination), buffer);
  }
}
const rate = 22050;
for (const [name, notes] of [
  ['orbit-explore', [130.8128, 196, 261.6256]],
  ['orbit-create', [164.8138, 220, 329.6276]],
]) {
  const samples = new Float32Array(rate * 4);
  for (let i = 0; i < samples.length; i++) {
    const time = i / rate;
    const envelope = Math.min(1, time / 0.12, (4 - time) / 0.18);
    const pulse = 0.72 + 0.28 * Math.sin(Math.PI * time) ** 2;
    samples[i] =
      notes.reduce((sum, note) => sum + Math.sin(2 * Math.PI * note * time), 0) *
      0.13 *
      envelope *
      pulse;
  }
  await save(`${name}.wav`, samples, rate);
}
const { default: factory } = await import(pathToFileURL(voiceModule).href);
const module = await factory();
const voice = new module.eSpeakNGWorker();
try {
  voice.set_voice('en-us');
  voice.set_rate(170);
  const chunks = [];
  voice.synthesize('Follow the signal. Choose what comes next.', (pcm) => {
    chunks.push(...pcm);
    return false;
  });
  await save(
    'orbit-guide.wav',
    chunks.map((sample) => sample / 32768),
    voice.get_samplerate(),
  );
} finally {
  voice.__destroy__();
}
