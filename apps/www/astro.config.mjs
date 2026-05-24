/**
 * Company: EonHive Inc.
 * Title: Public Site Astro Config
 * Purpose: Configure the URK public website shell, docs integration, and local workspace imports.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const siteUrl = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  integrations: [
    starlight({
      title: 'URK Docs',
      description: 'Canonical documentation for URK, the runtime kernel for interactive browser experiences.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/eonhive/urk',
        },
      ],
      customCss: ['./src/styles/global.css'],
      sidebar: [
        {
          label: 'Introduction',
          items: [
            { label: 'Docs home', link: '/docs/' },
            { label: 'What is URK?', link: '/docs/introduction/what-is-urk/' },
            { label: 'Why URK?', link: '/docs/introduction/why-urk/' },
            { label: 'What URK is not', link: '/docs/introduction/what-urk-is-not/' },
            { label: 'Core mental model', link: '/docs/introduction/core-mental-model/' },
          ],
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'Overview', link: '/docs/getting-started/' },
            { label: 'Installation', link: '/docs/getting-started/installation/' },
            { label: 'Create your first runtime', link: '/docs/getting-started/create-your-first-runtime/' },
            { label: 'Register an adapter', link: '/docs/getting-started/register-an-adapter/' },
            { label: 'Register a controller', link: '/docs/getting-started/register-a-controller/' },
            { label: 'Mount a runtime surface', link: '/docs/getting-started/mount-a-runtime-surface/' },
            { label: 'View runtime events', link: '/docs/getting-started/view-runtime-events/' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Runtime Kernel', link: '/docs/concepts/runtime-kernel/' },
            { label: 'Runtime context', link: '/docs/concepts/runtime-context/' },
            { label: 'Explicit runtime state', link: '/docs/concepts/explicit-runtime-state/' },
            { label: 'Adapter contracts', link: '/docs/concepts/adapters/' },
            { label: 'Adapter capability lookup', link: '/docs/concepts/adapter-capability-lookup/' },
            { label: 'Controller lifecycle', link: '/docs/concepts/controllers/' },
            { label: 'Event routing', link: '/docs/concepts/event-routing/' },
            { label: 'Scene/User Interface bridge', link: '/docs/concepts/scene-ui-bridge/' },
            { label: 'Integration wrappers', link: '/docs/concepts/integration-wrappers/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Build a minimal runtime example', link: '/docs/guides/minimal-runtime-example/' },
            { label: 'Create an adapter', link: '/docs/guides/create-adapter/' },
            { label: 'Create a controller', link: '/docs/guides/create-controller/' },
            { label: 'Use runtime state safely', link: '/docs/guides/runtime-state-safely/' },
            { label: 'Route events', link: '/docs/guides/route-events/' },
            { label: 'Bridge scene and User Interface', link: '/docs/guides/scene-ui-bridge/' },
            { label: 'Embed URK in a static website', link: '/docs/guides/static-website-embed/' },
            { label: 'Use URK inside Astro docs', link: '/docs/guides/astro-docs-embed/' },
            { label: 'Use URK with React', link: '/docs/guides/react-later/' },
            { label: 'Use URK with Next.js', link: '/docs/guides/next-later/' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Minimal standalone runtime', link: '/docs/examples/minimal-standalone-runtime/' },
            { label: 'Adapter registration', link: '/docs/examples/adapter-registration/' },
            { label: 'Controller orchestration', link: '/docs/examples/controller-orchestration/' },
            { label: 'Runtime state panel', link: '/docs/examples/runtime-state-panel/' },
            { label: 'Event routing demo', link: '/docs/examples/event-routing-demo/' },
            { label: 'Pointer/input overlay', link: '/docs/examples/pointer-input-overlay/' },
            { label: 'Scene/User Interface coordination', link: '/docs/examples/scene-ui-coordination/' },
            { label: 'Playground starter', link: '/docs/examples/playground-starter/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: '@urk/core', link: '/docs/reference/core/' },
            { label: '@urk/adapters', link: '/docs/reference/adapters/' },
            { label: '@urk/examples', link: '/docs/reference/examples/' },
            { label: '@urk/react-urk', link: '/docs/reference/react-urk/' },
            { label: '@urk/next-urk', link: '/docs/reference/next-urk/' },
            { label: 'CLI commands', link: '/docs/reference/cli/' },
            { label: 'Runtime types', link: '/docs/reference/runtime-types/' },
            { label: 'Adapter contract types', link: '/docs/reference/adapter-contract-types/' },
            { label: 'Controller contract types', link: '/docs/reference/controller-contract-types/' },
            { label: 'Event types', link: '/docs/reference/event-types/' },
            { label: 'Error types', link: '/docs/reference/error-types/' },
          ],
        },
        {
          label: 'Project',
          items: [
            { label: 'Boundary', link: '/docs/project/boundary/' },
            { label: 'Architecture', link: '/docs/project/architecture/' },
            { label: 'Decisions', link: '/docs/project/decisions/' },
            { label: 'Deferred features', link: '/docs/project/deferred-features/' },
            { label: 'Contributing', link: '/docs/project/contributing/' },
            { label: 'Roadmap', link: '/docs/project/roadmap/' },
          ],
        },
      ],
    }),
    mdx(),
    sitemap(),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@urk/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
        '@urk/adapters': fileURLToPath(new URL('../../packages/adapters/src/index.ts', import.meta.url)),
        '@urk/adapters/dom': fileURLToPath(new URL('../../packages/adapters/src/dom.ts', import.meta.url)),
        '@urk/examples': fileURLToPath(new URL('../../packages/examples/src/index.ts', import.meta.url)),
      },
    },
    server: {
      fs: {
        allow: [repoRoot],
      },
    },
  },
});
