/**
 * Company: EonHive Inc. | Title: Video Proof Metadata
 * Purpose: Expose the runnable native video proof in the existing examples catalog.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import type { ExampleMeta } from '../types.js';

export const videoProofMeta: ExampleMeta = {
  id: 'video-proof',
  slug: 'video-proof',
  title: 'Video Proof',
  purpose: 'Two independent players. One small runtime.',
  summary:
    'Play, seek, caption, and release native video. Try the original Orbit clip or choose a local file without uploading it.',
  difficulty: 'intro',
  status: 'current',
  boundary:
    'The browser decodes media. The adapter exposes transport; the controller owns UI, sources, and experience pause policy.',
  teaches: [
    'Borrow application video elements safely.',
    'Cancel pending playback and release owned sources.',
    'Use native captions and event-driven snapshots without a frame loop.',
  ],
  adapters: ['video'],
  controllers: ['video-proof'],
  panels: ['preview', 'state', 'events', 'source'],
  schemaSource: JSON.stringify(
    { adapters: ['video'], frameMode: 'auto', players: 2, autoplay: false },
    null,
    2,
  ),
  sourceFiles: [
    {
      path: 'packages/examples/src/video-proof/mount.ts',
      label: 'Independent native video',
      language: 'ts',
      excerpt: `const video = ctx.require(VideoCapability);
const player = video.register({ id: 'intro', element });
ctx.scope.defer(() => video.unregister(player.id));
// Call directly from a user gesture:
await player.play();
player.seek(3);
player.pause();`,
    },
  ],
  explanation:
    'A standalone controller registers two borrowed elements and connects snapshots to accessible controls. Each player can use a sample or a local object URL. Controller scopes release subscriptions, media sources, object URLs, and surfaces. The shared UI also runs in the standalone proof host.',
  relatedDocs: [
    { title: 'Video integration', href: '/docs/examples/video-proof/' },
    { title: 'Adapters', href: '/docs/reference/adapters/' },
  ],
  nextExampleId: 'audio-proof',
};
