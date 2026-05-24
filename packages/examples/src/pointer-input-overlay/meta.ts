/**
 * Company: EonHive Inc.
 * Title: Pointer Input Overlay Metadata
 * Purpose: Describe the public URK example for pointer and keyboard input overlay feedback.
 * Author: Stan Nesi
 * Created: 2026-05-09
 * Updated: 2026-05-09
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const pointerInputOverlayMeta: ExampleMeta = {
  id: 'pointer-input-overlay',
  slug: 'pointer-input-overlay',
  title: 'Pointer Input Overlay',
  purpose: 'Shows pointer/input behavior with a browser overlay.',
  summary:
    'An interaction proof for pointer and input adapters driving visible overlay feedback, target selection, keyboard shortcuts, and inspectable runtime events.',
  difficulty: 'advanced',
  boundary:
    'Pointer targets, pointer surface selection, keyboard bindings, overlay feedback, and inspectable interaction events.',
  status: 'current',
  teaches: [
    'How pointer targets and pointer surfaces expose browser interaction through adapters.',
    'How keyboard bindings can target a focused runtime surface.',
    'How overlay feedback can stay synchronized without coupling to a renderer.',
    'How interaction events remain visible without becoming product state.',
  ],
  adapters: ['loading', 'pointer', 'input', 'ui-widgets'],
  controllers: ['pointer-overlay-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "pointer-input-overlay",
  "kernel": {
    "services": ["ui:host", "input:target", "pointer-overlay:surface"],
    "adapters": ["loading", "pointer", "input", "ui-widgets"],
    "controllers": ["pointer-overlay-controller"]
  },
  "interaction": {
    "pointerTargets": ["focus-node", "route-node", "overlay-node"],
    "keyboardBindings": ["Space", "KeyR"]
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/pointer-input-overlay/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-pointer-input-overlay',
  services: {
    'ui:host': uiHost,
    'input:target': overlay.surface,
    'pointer-overlay:surface': overlay,
  },
  adapters: [
    createLoadingAdapter(),
    createPointerAdapter(),
    createInputAdapter(),
    createUiWidgetsAdapter(),
  ],
  controllers: [createPointerOverlayController()],
});`,
    },
    {
      path: 'packages/examples/src/pointer-input-overlay/mount.ts',
      label: 'Pointer bindings',
      language: 'ts',
      excerpt: `cleanups.push(
  pointer.bindSurface({ id: 'pointer-overlay-surface', element: overlay.surface }),
);

for (const target of overlay.targets) {
  cleanups.push(pointer.bindTarget({ id: target.dataset.pointerTarget, element: target }));
}`,
    },
    {
      path: 'packages/examples/src/pointer-input-overlay/mount.ts',
      label: 'Keyboard binding',
      language: 'ts',
      excerpt: `cleanups.push(
  input.bindKey({
    code: 'Space',
    phase: 'down',
    handler(event) {
      event.nativeEvent.preventDefault();
      activateKeyboardOverlay(ctx, overlay, widgets, event.code);
    },
  }),
);`,
    },
  ],
  explanation:
    'The Pointer Input Overlay example mounts a focusable browser surface inside the existing runtime preview. One controller binds pointer surfaces, pointer targets, and keyboard shortcuts through adapters, then updates the UI widgets overlay and emits explicit events. The renderer stays a small DOM surface; URK coordinates interaction state and visibility only.',
  relatedDocs: [
    { title: 'Adapter contracts', href: '/docs/concepts/adapters/' },
    { title: 'Event routing', href: '/docs/concepts/event-routing/' },
    { title: 'Scene/User Interface bridge', href: '/docs/concepts/scene-ui-bridge/' },
    { title: 'Bridge scene and User Interface', href: '/docs/guides/scene-ui-bridge/' },
  ],
  nextExampleId: 'embedded-docs-demo',
};
