/**
 * Company: EonHive Inc.
 * Title: Controller Orchestration Metadata
 * Purpose: Describe the public URK example for controller lifecycle and coordination.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMeta } from '../types.js';

export const controllerOrchestrationMeta: ExampleMeta = {
  id: 'controller-orchestration',
  slug: 'controller-orchestration',
  title: 'Controller Orchestration',
  purpose: 'Shows how controllers own runtime behavior and lifecycle.',
  summary:
    'A controller-focused runtime proof for lifecycle ordering, event-based coordination, state transitions, and clean disposal.',
  difficulty: 'intermediate',
  boundary:
    'Controller lifecycle, controller-to-controller coordination, runtime state changes, and clean teardown.',
  status: 'current',
  teaches: [
    'How controllers initialize before they start.',
    'How one controller can emit a coordination event for another controller to observe.',
    'How controllers use adapters without owning adapter implementation details.',
    'How controller disposal stays visible during runtime teardown.',
  ],
  adapters: ['loading', 'ui-widgets'],
  controllers: ['primary-controller', 'telemetry-controller'],
  panels: ['source', 'schema', 'state', 'events', 'adapters', 'preview'],
  schemaSource: `{
  "surface": "controller-orchestration",
  "kernel": {
    "adapters": ["loading", "ui-widgets"],
    "services": ["ui:host"],
    "controllers": ["primary-controller", "telemetry-controller"]
  },
  "coordination": {
    "event": "controller-demo:primary-ready",
    "observer": "telemetry-controller"
  }
}`,
  sourceFiles: [
    {
      path: 'packages/examples/src/controller-orchestration/mount.ts',
      label: 'Runtime mount',
      language: 'ts',
      excerpt: `const kernel = createKernel({
  id: 'urk-www-controller-orchestration',
  services: { 'ui:host': uiHost },
  adapters: [createLoadingAdapter(), createUiWidgetsAdapter()],
  controllers: [createPrimaryController(), createTelemetryController()],
});`,
    },
    {
      path: 'packages/examples/src/controller-orchestration/mount.ts',
      label: 'Controller coordination',
      language: 'ts',
      excerpt: `ctx.events.emit({
  type: 'controller-demo:primary-ready',
  source: 'primary-controller',
  timestamp: Date.now(),
});`,
    },
  ],
  explanation:
    'The controller orchestration example boots one kernel with two controllers. The primary controller owns the loading flow and ready transition, while the telemetry controller observes a coordination event and updates the same runtime surface through the UI widgets adapter.',
  relatedDocs: [
    { title: 'Controller lifecycle', href: '/docs/concepts/controllers/' },
    { title: 'State and Events', href: '/docs/concepts/state-events/' },
    { title: 'Register a controller', href: '/docs/getting-started/register-a-controller/' },
    { title: 'Create a controller', href: '/docs/guides/create-controller/' },
  ],
  nextExampleId: 'runtime-state',
};
