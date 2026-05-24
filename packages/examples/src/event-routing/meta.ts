/**
 * Company: EonHive Inc.
 * Title: Event Routing Metadata
 * Purpose: Describe the public URK example for visible runtime event routing.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const eventRoutingMeta: ExampleMeta = {
  id: 'event-routing',
  slug: 'event-routing',
  title: 'Event Routing',
  purpose: 'Shows how events move through the runtime.',
  summary:
    'An event-focused runtime proof for emitted events, targeted listeners, guarded debug listeners, sources, payload summaries, and bounded runtime logs.',
  difficulty: 'intermediate',
  boundary:
    'Runtime event emission, targeted event listening, guarded debug observation, and readable event-log output.',
  status: 'current',
  teaches: [
    'How controller events describe runtime activity.',
    'How one controller listens for a focused event type with on().',
    'How onAny() supports debug visibility when guarded from event sprawl.',
    'How event logs support debugging without becoming product state.',
  ],
  adapters: ['loading'],
  controllers: ['event-source-controller', 'event-listener-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "event-routing",
  "events": {
    "emitted": [
      "event-demo:started",
      "event-demo:checkpoint",
      "event-demo:payload-sample",
      "event-demo:completed"
    ],
    "targetedListener": "event-demo:checkpoint",
    "debugListener": "guarded onAny()"
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/event-routing/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-event-routing',
  adapters: [createLoadingAdapter()],
  controllers: [
    createEventListenerController(),
    createEventSourceController(),
  ],
});`,
    },
    {
      path: 'packages/examples/src/event-routing/mount.ts',
      label: 'Targeted listener',
      language: 'ts',
      excerpt: `unsubscribeCheckpoint = ctx.events.on('event-demo:checkpoint', (event) => {
  emitListenerEvent(ctx, 'event-demo:checkpoint-observed', {
    message: 'Listener controller observed the checkpoint event.',
    observedType: event.type,
  });
});`,
    },
    {
      path: 'packages/examples/src/event-routing/mount.ts',
      label: 'Guarded debug listener',
      language: 'ts',
      excerpt: `unsubscribeAny = ctx.events.onAny((event) => {
  if (!event.type.startsWith('event-demo:')) return;
  if (event.source === 'event-listener-controller') return;

  emitListenerEvent(ctx, 'event-demo:any-observed', {
    message: 'onAny() observed a source-controller event.',
    observedType: event.type,
  });
});`,
    },
  ],
  explanation:
    'The event routing example boots one kernel with a loading adapter and two controllers. The listener controller subscribes before the source controller emits, then observes focused checkpoint events with on() and source-controller events with a guarded onAny() debug listener. The page keeps the event log bounded so events stay useful for runtime visibility instead of becoming product state.',
  relatedDocs: [
    { title: 'Event routing', href: '/docs/concepts/event-routing/' },
    { title: 'Route events', href: '/docs/guides/route-events/' },
    { title: 'View runtime events', href: '/docs/getting-started/view-runtime-events/' },
    { title: 'Event types', href: '/docs/reference/event-types/' },
  ],
  nextExampleId: 'scene-ui-bridge',
};
