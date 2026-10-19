/**
 * Company: EonHive Inc.
 * Title: Embedded Docs Demo Metadata
 * Purpose: Describe the public URK example for documentation-embedded runtime islands.
 * Author: Stan Nesi
 * Created: 2026-05-09
 * Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const embeddedDocsDemoMeta: ExampleMeta = {
  id: 'embedded-docs-demo',
  slug: 'embedded-docs-demo',
  title: 'Embedded Docs Demo',
  purpose: 'Embeds a reusable motion widget inside a documentation runtime island.',
  summary:
    'A documentation island with a shared motion widget, keyboard scrubbing, optional saved timing/speed settings, and clean runtime shutdown while static content stays readable.',
  difficulty: 'intro',
  boundary:
    'Static docs shell ownership, isolated client-side runtime island boot, local fallback handling, and clean teardown.',
  status: 'current',
  teaches: [
    'How content-first docs can embed runtime-first islands.',
    'How a docs page can render before a runtime island starts.',
    'How runtime island failures stay local to the island.',
    'How Astro/Starlight stays responsible for static documentation rendering.',
    'How the same motion widget borrows a standalone or website host runtime.',
  ],
  adapters: ['loading', 'motion'],
  controllers: ['motion-controller', 'docs-embed-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "embedded-docs-demo",
  "docsShell": {
    "owner": "Astro/Starlight",
    "content": "static MDX"
  },
  "runtimeIsland": {
    "owner": "URK",
    "adapters": ["loading", "motion"],
    "controllers": ["motion-controller", "docs-embed-controller"],
    "widget": "shared motion-widget",
    "fallback": "local island error state"
  }
}`,
  sourceFiles: [
    {
      path: 'apps/www/src/content/docs/docs/guides/astro-docs-embed.mdx',
      label: 'MDX embed',
      language: 'mdx',
      excerpt: `import LiveURKExample from '@/components/urk-runtime/LiveURKExample.astro';

<LiveURKExample example="embedded-docs-demo" />`,
    },
    {
      path: 'packages/examples/src/embedded-docs-demo/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-embedded-docs-demo',
  services: {
    'docs:host': docsSurface.article,
  },
  adapters: [createLoadingAdapter(), createMotionAdapter()],
  controllers: [createDocsEmbedController(docsSurface)],
});`,
    },
    {
      path: 'packages/examples/src/embedded-docs-demo/mount.ts',
      label: 'Shared widget',
      language: 'ts',
      excerpt: `async start(ctx) {
  widget = await mountMotionWidget(docsSurface.widgetHost, ctx, {
    title: 'Docs signal',
  });
}
// After boot, the host replays the sequence. Controller scope owns its cleanup.`,
    },
    {
      path: 'packages/examples/src/embedded-docs-demo/mount.ts',
      label: 'Local failure boundary',
      language: 'ts',
      excerpt: `loading.setStage(
  'confirm-fallback',
  0.92,
  'Docs content remains available while the runtime island owns its local fallback',
);`,
    },
  ],
  explanation:
    'The Embedded Docs Demo mounts the same motion widget as the standalone proof inside its existing preview panel and kernel. Its motion controller drives staggered entrances and a final reveal; local controls provide scrubbing, speed, timing, and cancellation. Host pause freezes playback, shutdown removes the widget, and reset creates a fresh kernel. Static content and island failure boundaries stay owned by the website and Starlight.',
  relatedDocs: [
    { title: 'Use URK inside Astro docs', href: '/docs/guides/astro-docs-embed/' },
    { title: 'Embed URK in a static website', href: '/docs/guides/static-website-embed/' },
    { title: 'Mount a runtime surface', href: '/docs/getting-started/mount-a-runtime-surface/' },
    { title: '@urk/examples reference', href: '/docs/reference/examples/' },
  ],
};
