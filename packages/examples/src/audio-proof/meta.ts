/**
 * Company: EonHive Inc.
 * Title: Audio Proof Metadata
 * Purpose: Describe the public audio transport demonstration.
 * Author: Stan Nesi
 * Created: 2026-09-21
 * Updated: 2026-09-21
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const audioProofMeta: ExampleMeta = {
  id: 'audio-proof',
  slug: 'audio-proof',
  title: 'Audio Lab',
  purpose: 'Play three sounds and watch the runtime respond.',
  summary:
    'A visual audio deck adapted from the original repo proof, with real playback, track selection, volume, mute, and lifecycle controls.',
  difficulty: 'intermediate',
  status: 'current',
  boundary:
    'URK coordinates browser audio transport and lifecycle. The website owns the deck; the animation indicates playback, not measured audio levels.',
  teaches: [
    'Register audio and loading capabilities with a standalone kernel.',
    'Start sound from a user gesture and surface playback failures locally.',
    'Pause audio with the runtime and release media resources on teardown.',
  ],
  adapters: ['loading', 'audio'],
  controllers: ['audio-demo-controller'],
  panels: ['preview', 'state', 'events', 'adapters', 'source', 'schema'],
  schemaSource: JSON.stringify(
    {
      surface: 'audio-proof',
      adapters: ['loading', 'audio'],
      controllers: ['audio-demo-controller'],
      tracks: ['bed', 'pulse', 'confirm'],
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
      excerpt: `const kernel = createKernel({
  id: 'urk-www-audio-proof',
  adapters: [createLoadingAdapter(), createAudioAdapter()],
  controllers: [createAudioController(view)],
});

// Inside the controller, in response to a click:
const audio = ctx.adapters.require<AudioAdapterApi>('audio');
await audio.play(selectedTrackId);

// Controller disposal stops audio before adapters release their resources.
audio.stop();`,
    },
  ],
  explanation:
    'The original examples/audio-proof remains a local integration proof. This website version uses its three WAV assets with a smaller controller and a site-owned deck. Tracks load when played. Audio snapshots drive the transport display; the existing runtime panels remain available below the demo. Runtime Resume restores controls; press Play to resume sound explicitly.',
  relatedDocs: [
    { title: 'Audio Lab guide', href: '/docs/examples/audio-proof/' },
    { title: 'Adapters', href: '/docs/reference/adapters/' },
    { title: 'Controllers', href: '/docs/concepts/controllers/' },
  ],
  nextExampleId: 'controller-orchestration',
};
