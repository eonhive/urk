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
  id: 'scene-ui-bridge',
  slug: 'scene-ui-bridge',
  title: 'Scene/UI Bridge',
  purpose: 'Shows scene state connected to User Interface state.',
  summary:
    'A coordination proof for synchronizing a scene-like browser surface with User Interface overlay state through services, adapters, controllers, and events.',
  difficulty: 'advanced',
  boundary:
    'Scene surface coordination, overlay synchronization, pointer target selection, and the line between runtime orchestration and renderer ownership.',
  status: 'current',
  teaches: [
    'How scene-like state can live outside the kernel while staying visible to controllers.',
    'How the pointer adapter exposes scene target selection as runtime events.',
    'How a UI bridge controller synchronizes overlay state without owning renderer internals.',
    'How URK coordinates surfaces without becoming a renderer or game engine.',
  ],
  adapters: ['loading', 'ui-widgets', 'pointer'],
  controllers: ['ui-bridge-controller', 'scene-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "scene-ui-bridge",
  "kernel": {
    "services": ["ui:host", "scene:bridge"],
    "adapters": ["loading", "ui-widgets", "pointer"],
    "controllers": ["ui-bridge-controller", "scene-controller"]
  },
  "bridge": {
    "sceneState": "example-local object",
    "uiOverlay": "ui-widgets adapter",
    "selectionEvent": "scene-ui:node-selected"
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/scene-ui-bridge/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-scene-ui-bridge',
  services: {
    'ui:host': uiHost,
    'scene:bridge': sceneBridge,
  },
  adapters: [createLoadingAdapter(), createUiWidgetsAdapter(), createPointerAdapter()],
  controllers: [createUiBridgeController(), createSceneController()],
});`,
    },
    {
      path: 'packages/examples/src/scene-ui-bridge/mount.ts',
      label: 'Pointer target binding',
      language: 'ts',
      excerpt: `for (const node of scene.nodes) {
  cleanups.push(
    pointer.bindTarget({
      id: node.dataset.sceneNode ?? 'scene-node',
      element: node,
      meta: { label: node.dataset.sceneLabel },
    }),
  );
}`,
    },
    {
      path: 'packages/examples/src/scene-ui-bridge/mount.ts',
      label: 'Overlay sync',
      language: 'ts',
      excerpt: `unsubscribe.push(
  ctx.events.on('scene-ui:node-selected', (event) => {
    syncOverlay(ctx, widgets, scene.state, event.type);
  }),
);`,
    },
  ],
  explanation:
    'The Scene/UI Bridge example mounts a small scene-like surface inside the existing preview panel. The scene controller owns scene selection state and pointer target binding, while the UI bridge controller observes scene events and updates the UI widgets overlay. The kernel coordinates services, adapters, state, and events without taking ownership of rendering.',
  relatedDocs: [
    { title: 'Scene/User Interface bridge', href: '/docs/concepts/scene-ui-bridge/' },
    { title: 'Bridge scene and User Interface', href: '/docs/guides/scene-ui-bridge/' },
    { title: 'Event routing', href: '/docs/concepts/event-routing/' },
    { title: 'Adapter contracts', href: '/docs/concepts/adapters/' },
  ],
  nextExampleId: 'pointer-input-overlay',
};
