/**
 * Company: EonHive Inc.
 * Title: Minimal Runtime Metadata
 * Purpose: Describe the first public URK runtime proof for the website examples surface.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const minimalRuntimeMeta: ExampleMeta = {
  id: 'minimal-runtime',
  slug: 'minimal-runtime',
  title: 'Minimal Runtime',
  purpose: 'Shows the smallest working URK runtime.',
  summary:
    'A small live URK surface that proves kernel lifecycle, loading state, controller orchestration, and event visibility without a framework wrapper.',
  difficulty: 'intro',
  boundary:
    'Lifecycle, explicit runtime state, controller orchestration, adapter capability lookup, and browser-native mounting.',
  status: 'current',
  teaches: [
    'How a standalone URK kernel boots in the browser.',
    'How one adapter exposes a runtime capability.',
    'How one controller drives lifecycle, state, and emitted events.',
    'How a static website can host a live runtime surface.',
  ],
  adapters: ['loading'],
  controllers: ['minimal-runtime-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "minimal-runtime",
  "kernel": {
    "phases": ["boot", "loading", "ready", "paused", "error"],
    "adapters": ["loading"],
    "controllers": ["minimal-runtime-controller"]
  },
  "view": {
    "panels": ["schema", "preview", "runtime-log"],
    "liveTelemetry": true
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/minimal-runtime/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-minimal-runtime',
  adapters: [createLoadingAdapter()],
  controllers: [createMinimalRuntimeController()],
});

await kernel.boot();`,
    },
    {
      path: 'apps/www/src/components/urk-runtime/LiveURKExample.astro',
      label: 'Website island shell',
      language: 'ts',
      excerpt: `<section data-urk-example-root data-example-id="minimal-runtime">
  <SchemaPanel schemaSource={schemaSource} />
  <RuntimeStatePanel />
  <PreviewPanel />
  <RuntimeLogPanel />
</section>`,
    },
  ],
  explanation:
    'The minimal runtime example starts one kernel, registers one loading adapter, starts one controller, and writes the resulting state and events into a browser-hosted preview. It is intentionally small so the runtime model stays visible.',
  relatedDocs: [
    { title: 'Runtime Kernel', href: '/docs/concepts/runtime-kernel' },
    { title: 'Adapters', href: '/docs/concepts/adapters' },
    { title: 'Controllers', href: '/docs/concepts/controllers' },
    { title: 'State and Events', href: '/docs/concepts/state-events' },
  ],
  nextExampleId: 'adapter-registration',
};
