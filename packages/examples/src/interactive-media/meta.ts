/**
 * Company: EonHive Inc. | Title: Interactive Media Metadata
 * Purpose: Publish the shared cue-driven story in the existing examples catalog.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import type { ExampleMeta } from '../types.js';

export const interactiveMediaMeta: ExampleMeta = {
  id: 'interactive-media',
  slug: 'interactive-media',
  title: 'Interactive Media',
  purpose: 'One film. Two directions. Your story to shape.',
  summary:
    'Explore a short original film with timed chapters, branching overlays, keyboard-accessible choices, native captions, saved playback progress, and an optional 3D video gallery.',
  difficulty: 'intermediate',
  status: 'current',
  boundary:
    'Video exposes transport. Private application helpers coordinate cues; the controller owns branches, overlays, and bookmarks.',
  teaches: [
    'Coordinate timestamp, ended, state, and interaction cues.',
    'Seek without replaying skipped side effects.',
    'Restore a bookmark without automatically playing media.',
  ],
  adapters: ['video', 'audio/mixer', 'motion', 'storage', 'three'],
  controllers: ['interactive-media'],
  panels: ['preview', 'source', 'events'],
  schemaSource: JSON.stringify(
    {
      adapters: ['video', 'audio/mixer', 'motion', 'storage', 'three'],
      timeSource: 'video',
      chapters: [0, 2, 5],
      branches: ['explore', 'create'],
      frameMode: 'auto',
    },
    null,
    2,
  ),
  sourceFiles: [
    {
      path: 'packages/examples/src/interactive-media/mount.ts',
      label: 'Media cues and choices',
      language: 'ts',
      excerpt: `const source = createVideoTimeSource(player);
const cues = createCues({ source, signal: ctx.signal, onError: report,
  cues: [{ id: 'title', when: { at: 2 }, run: showTitle }],
});
ctx.scope.defer(() => cues.dispose());
// Branching stays inside your controller.
cues.trigger('choice', { branch: 'explore' });`,
    },
  ],
  explanation:
    'The same controller mounts in standalone and website hosts. Timed actions use native video time; visual overlays derive from the current position, including seeks. Repeating cues re-arm on replay. Kernel scopes cancel actions and release native listeners, storage subscriptions, media sources, and DOM. Cue helpers are internal examples, not a new public runtime.',
  relatedDocs: [
    { title: 'Interactive media', href: '/docs/examples/interactive-media/' },
    { title: 'Video adapter', href: '/docs/examples/video-proof/' },
  ],
  nextExampleId: 'experience-showcase',
};
