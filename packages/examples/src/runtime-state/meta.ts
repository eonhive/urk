/**
 * Company: EonHive Inc.
 * Title: Runtime State Metadata
 * Purpose: Describe the public URK example for explicit runtime phase state.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const runtimeStateMeta: ExampleMeta = {
  id: 'runtime-state',
  slug: 'runtime-state',
  title: 'Runtime State',
  purpose: 'Shows explicit runtime state and state updates.',
  summary:
    'A state-focused runtime proof for phase snapshots, transition reasons, subscriptions, and bounded state panel visibility.',
  difficulty: 'intermediate',
  boundary:
    'Explicit runtime phase state, snapshot reads, state-change observation, and the line between runtime state and product state.',
  status: 'current',
  teaches: [
    'How runtime phases differ from product state.',
    'How controllers read runtime snapshots before changing state.',
    'How state-change hooks make phase transitions visible.',
    'How transition reasons help explain pause, resume, ready, and error paths.',
  ],
  adapters: ['loading'],
  controllers: ['state-demo-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "runtime-state",
  "runtimeState": {
    "phases": ["boot", "loading", "transition", "ready", "paused", "error"],
    "reasons": [
      "kernel:boot",
      "runtime-state:transition",
      "runtime-state:ready",
      "runtime-state:pause",
      "runtime-state:resume"
    ]
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/runtime-state/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-runtime-state',
  adapters: [createLoadingAdapter()],
  controllers: [createStateDemoController()],
});`,
    },
    {
      path: 'packages/examples/src/runtime-state/mount.ts',
      label: 'Explicit state transition',
      language: 'ts',
      excerpt: `const snapshot = ctx.state.getSnapshot();
ctx.events.emit({
  type: 'runtime-state:snapshot-read',
  source: 'state-demo-controller',
  payload: { phase: snapshot.phase, reason: snapshot.reason },
  timestamp: Date.now(),
});

ctx.state.setPhase('transition', 'runtime-state:transition');`,
    },
  ],
  explanation:
    'The runtime state example boots one kernel with a loading adapter and one controller. The controller reads snapshots, drives explicit phase transitions, observes state changes, and emits small events that explain why runtime state changed without treating the runtime store as product data.',
  relatedDocs: [
    { title: 'Explicit runtime state', href: '/docs/concepts/explicit-runtime-state/' },
    { title: 'Use runtime state safely', href: '/docs/guides/runtime-state-safely/' },
    { title: 'Runtime types', href: '/docs/reference/runtime-types/' },
    { title: 'State and Events', href: '/docs/concepts/state-events/' },
  ],
  nextExampleId: 'event-routing',
};
