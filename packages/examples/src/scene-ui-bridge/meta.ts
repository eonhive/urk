/**
 * Company: EonHive Inc.
 * Title: Scene UI Bridge Metadata
 * Purpose: Describe the public URK example for scene and User Interface coordination.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const sceneUiBridgeMeta: ExampleMeta = {
  id: 'scene-ui-bridge', slug: 'scene-ui-bridge', title: 'Scene/UI Bridge',
  purpose: 'Select a scene node, load its details, and change its appearance.',
  summary: 'A scene-like DOM surface coordinates selection, cancellable details, and an owned nonmodal panel through URK.',
  difficulty: 'intermediate', status: 'current',
  boundary: 'Selection and actions stay in the controller; the overlay owns its shell and content cleanup.',
  teaches: [
    'Selection remains when details close or the host changes size.',
    'A stale details request cannot replace a newer selection.',
    'Panel controls change the actual node without activating the scene underneath.',
    'Themes and compact layouts adapt without remounting active content.',
  ],
  adapters: ['ui-overlay', 'loading', 'pointer'], controllers: ['selection-details'],
  panels: ['source', 'preview'],
  schemaSource: JSON.stringify({ adapters: ['ui-overlay', 'loading', 'pointer'], controller: 'selection-details', frameMode: 'auto' }, null, 2),
  sourceFiles: [{ path: 'packages/examples/src/selection-details/controller.ts', label: 'Shared selection pattern', language: 'ts',
    excerpt: `const panel = overlay.open({
  id: 'selection-details', kind: 'panel', title: item.title,
  mount(container) {
    // The application owns content and cancels pending requests on close.
    return () => { request.abort(); container.replaceChildren(); };
  },
});` }],
  explanation: 'Native scene-node buttons emit pointer selection events. The controller owns selection and loads a separate content module into an overlay panel. Highlight node changes the selected node. The same pattern powers Project Selection without a scene renderer. Closing details cancels pending work and retains selection.',
  relatedDocs: [{ title: 'Scene/UI bridge', href: '/docs/concepts/scene-ui-bridge/' }, { title: 'UI Overlay adapter', href: '/docs/reference/adapters/' }],
  nextExampleId: 'project-selection',
};
