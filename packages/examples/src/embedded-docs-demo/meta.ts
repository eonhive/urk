/**
 * Company: EonHive Inc.
 * Title: Embedded Docs Demo Metadata
 * Purpose: Describe the public URK example for documentation-embedded runtime islands.
 * Author: Stan Nesi
 * Created: 2026-05-09
 * Updated: 2026-05-09
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const embeddedDocsDemoMeta: ExampleMeta = {
  id: 'embedded-docs-demo',
  slug: 'embedded-docs-demo',
  title: 'Embedded Docs Demo',
  purpose: 'Shows URK running inside a documentation page.',
  summary:
    'A documentation proof for embedding a small URK runtime island inside static Markdown content without making URK own the docs renderer.',
  difficulty: 'intro',
  boundary:
    'Static docs shell ownership, isolated client-side runtime island boot, local fallback handling, and clean teardown.',
  status: 'current',
  teaches: [
    'How content-first docs can embed runtime-first islands.',
    'How a docs page can render before a runtime island starts.',
    'How runtime island failures stay local to the island.',
    'How Astro/Starlight stays responsible for static documentation rendering.',
  ],
  adapters: ['loading'],
  controllers: ['docs-embed-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "embedded-docs-demo",
  "docsShell": {
    "owner": "Astro/Starlight",
    "content": "static MDX"
  },
  "runtimeIsland": {
    "owner": "URK",
    "adapter": "loading",
    "controller": "docs-embed-controller",
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
  adapters: [createLoadingAdapter()],
  controllers: [createDocsEmbedController(docsSurface)],
});`,
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
    'The Embedded Docs Demo mounts a small docs-shaped card inside the existing preview panel, then boots a URK kernel as an isolated client island. The controller proves host resolution, lazy island boot, runtime mount, local fallback ownership, visible events, and clean teardown while the website and Starlight remain responsible for static content.',
  relatedDocs: [
    { title: 'Use URK inside Astro docs', href: '/docs/guides/astro-docs-embed/' },
    { title: 'Embed URK in a static website', href: '/docs/guides/static-website-embed/' },
    { title: 'Mount a runtime surface', href: '/docs/getting-started/mount-a-runtime-surface/' },
    { title: '@urk/examples reference', href: '/docs/reference/examples/' },
  ],
};
