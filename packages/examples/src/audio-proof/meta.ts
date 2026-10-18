/**
 * Company: EonHive Inc.
 * Title: Audio Proof Metadata
 * Purpose: Describe the shared audio-analysis and reactive scene example.
 * Author: Stan Nesi
 * Created: 2026-09-21
 * Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const audioProofMeta: ExampleMeta = {
  id: 'audio-proof',
  slug: 'audio-proof',
  title: 'Audio Lab',
  purpose: 'Hear one sound drive plots, meters, and a reactive 3D scene.',
  summary:
    'One shared Audio Lab for standalone and website hosts: real waveform and spectrum analysis, frequency meters, a reactive Three scene, and scoped motion.',
  difficulty: 'intermediate',
  status: 'current',
  boundary:
    'Audio analysis provides measured signal data; the controller owns rendering and media policy. Three and motion remain optional adapters. These values are not beat detection.',
  teaches: [
    'Read one reusable analysis snapshot per temporary runtime frame.',
    'Start sound from a user gesture and surface playback failures locally.',
    'Combine direct audio reactivity with finite scene-layout tweens and scoped cleanup.',
  ],
  adapters: ['audio', 'motion', 'three (optional scene)'],
  controllers: ['audio-analysis-controller'],
  panels: ['preview', 'state', 'events', 'adapters', 'source', 'schema'],
  schemaSource: JSON.stringify(
    {
      surface: 'audio-proof',
      adapters: ['audio', 'motion', 'three (optional scene)'],
      controllers: ['audio-analysis-controller'],
      tracks: ['analysis', 'bed', 'pulse', 'confirm'],
      autoplay: false,
    },
    null,
    2,
  ),
  sourceFiles: [
    {
      path: 'packages/examples/src/audio-proof/mount.ts',
      label: 'Audio capability and lifecycle',
      language: 'ts',
      excerpt: `const audio = ctx.require(AudioCapability);
// Begin both calls in the user's click handler.
await Promise.all([
  audio.analysis.enable({ fftSize: 2048, smoothing: 0.8 }),
  audio.play(selectedTrackId),
]);

// Read once per runtime frame; all visuals consume this snapshot.
const release = ctx.registerFrameWork(() => {
  const snapshot = audio.analysis.read();
  renderPlots(snapshot);
  renderScene(snapshot);
});
ctx.scope.defer(release);`,
    },
  ],
  explanation:
    'Both hosts mount the same private Audio Lab. One AnalyserNode supplies waveform, spectrum, normalized RMS and frequency bands. A Three sculpture responds to bass, mids, and treble; Orbit/Row layout changes use finite numeric tweens. Disabling analysis preserves audio playback. Pause, hidden tabs, shutdown, and unmount stop owned work; Start fresh creates a new kernel without autoplay. Graphics failure leaves the audio controls and Canvas plots available.',
  relatedDocs: [
    { title: 'Audio Lab guide', href: '/docs/examples/audio-proof/' },
    { title: 'Adapters', href: '/docs/reference/adapters/' },
    { title: 'Controllers', href: '/docs/concepts/controllers/' },
  ],
  nextExampleId: 'controller-orchestration',
};
