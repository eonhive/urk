/**
 * Company: EonHive Inc.
 * Title: Adapter Registration Metadata
 * Purpose: Describe the public URK example for adapter registration and capability lookup.
 * Author: Stan Nesi
 * Created: 2026-05-07
 * Updated: 2026-05-07
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const adapterRegistrationMeta: ExampleMeta = {
  id: 'adapter-registration',
  slug: 'adapter-registration',
  title: 'Adapter Registration',
  purpose: 'Shows how runtime capabilities are added through adapters.',
  summary:
    'A focused runtime proof for registering loading and storage capabilities, resolving required adapters, and handling optional capability misses safely.',
  difficulty: 'intro',
  boundary:
    'Adapter registration, required capability lookup, optional capability lookup, and visible missing-capability handling.',
  status: 'current',
  teaches: [
    'How adapter registrations become named runtime capabilities.',
    'How controllers resolve required capabilities with require().',
    'How optional capability lookup can fail visibly without crashing the runtime.',
    'How browser persistence stays behind the storage adapter boundary.',
  ],
  adapters: ['loading', 'storage'],
  controllers: ['adapter-demo-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "adapter-registration",
  "kernel": {
    "adapters": ["loading", "storage"],
    "controllers": ["adapter-demo-controller"]
  },
  "lookup": {
    "required": ["loading", "storage"],
    "optional": ["missing-capability"]
  },
  "storage": {
    "namespace": "urk-adapter-registration"
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/adapter-registration/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-adapter-registration',
  adapters: [
    createLoadingAdapter(),
    createStorageAdapter({ namespace: 'urk-adapter-registration' }),
  ],
  controllers: [createAdapterDemoController()],
});`,
    },
    {
      path: 'packages/examples/src/adapter-registration/mount.ts',
      label: 'Capability lookup',
      language: 'ts',
      excerpt: `const loading = ctx.adapters.require<LoadingAdapterApi>('loading');
const storage = ctx.adapters.require<StorageAdapterApi>('storage');
const missing = ctx.adapters.get('missing-capability');`,
    },
  ],
  explanation:
    'The adapter registration example boots one kernel with loading and storage adapters, then lets one controller prove required lookup, optional lookup, missing-capability handling, and a namespaced storage round trip. The browser page shell is still owned by the website runtime-island components.',
  relatedDocs: [
    { title: 'Adapter contracts', href: '/docs/concepts/adapters/' },
    { title: 'Adapter capability lookup', href: '/docs/concepts/adapter-capability-lookup/' },
    { title: 'Register an adapter', href: '/docs/getting-started/register-an-adapter/' },
    { title: 'Runtime Kernel', href: '/docs/concepts/runtime-kernel/' },
  ],
  nextExampleId: 'controller-orchestration',
};
