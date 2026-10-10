/**
 * Company: EonHive Inc.
 * Title: Example Data
 * Purpose: Describe the public examples index while reusing real metadata from the URK examples workspace.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-06-06
 * Notes: Vibe coded with Codex.
 */

import { exampleCatalog } from '@urk/examples';
import type { ExampleId, ExampleStatus } from '@urk/examples';

export type ExampleIndexEntry = {
  title: string;
  href: string;
  summary: string;
  status: 'Current' | 'Experimental' | 'Planned';
  boundary: string;
  difficulty: 'Intro' | 'Intermediate' | 'Advanced';
  purpose: string;
  visualLabel: string;
  visualTone: 'core' | 'adapter' | 'controller' | 'state' | 'event' | 'bridge' | 'input' | 'docs' | 'audio';
  visualNodes: string[];
};

export type RepoProofEntry = {
  title: string;
  route: string;
  sourceHref: string;
  summary: string;
  visualTone: ExampleIndexEntry['visualTone'];
  stack: string[];
};

function formatStatus(status: ExampleStatus): ExampleIndexEntry['status'] {
  if (status === 'current') {
    return 'Current';
  }

  if (status === 'experimental') {
    return 'Experimental';
  }

  return 'Planned';
}

function formatDifficulty(difficulty: 'intro' | 'intermediate' | 'advanced'): ExampleIndexEntry['difficulty'] {
  if (difficulty === 'intro') {
    return 'Intro';
  }

  if (difficulty === 'intermediate') {
    return 'Intermediate';
  }

  return 'Advanced';
}

const visualByExampleId: Record<ExampleId, Pick<ExampleIndexEntry, 'visualLabel' | 'visualTone' | 'visualNodes'>> = {
  'audio-proof': {
    visualLabel: 'Audio Lab',
    visualTone: 'audio',
    visualNodes: ['Play', 'Pause', 'Listen'],
  },
  'minimal-runtime': {
    visualLabel: 'Boot path',
    visualTone: 'core',
    visualNodes: ['Kernel', 'Loading', 'Ready'],
  },
  'adapter-registration': {
    visualLabel: 'Capabilities',
    visualTone: 'adapter',
    visualNodes: ['loading', 'storage', 'optional miss'],
  },
  'controller-orchestration': {
    visualLabel: 'Coordination',
    visualTone: 'controller',
    visualNodes: ['primary', 'ready event', 'telemetry'],
  },
  'runtime-state': {
    visualLabel: 'State rail',
    visualTone: 'state',
    visualNodes: ['boot', 'transition', 'paused'],
  },
  'event-routing': {
    visualLabel: 'Event bus',
    visualTone: 'event',
    visualNodes: ['source', 'checkpoint', 'listener'],
  },
  'scene-ui-bridge': {
    visualLabel: 'Surface bridge',
    visualTone: 'bridge',
    visualNodes: ['scene', 'selection', 'overlay'],
  },
  'pointer-input-overlay': {
    visualLabel: 'Input overlay',
    visualTone: 'input',
    visualNodes: ['pointer', 'keyboard', 'surface'],
  },
  'embedded-docs-demo': {
    visualLabel: 'Docs island',
    visualTone: 'docs',
    visualNodes: ['MDX', 'island', 'fallback'],
  },
};

const exampleIndexEntries: ExampleIndexEntry[] = exampleCatalog.map((example) => ({
  title: example.title,
  href: `/examples/${example.slug}`,
  summary: example.summary,
  status: formatStatus(example.status),
  boundary: example.boundary,
  difficulty: formatDifficulty(example.difficulty),
  purpose: example.purpose,
  ...visualByExampleId[example.id],
}));

export const liveExamples: ExampleIndexEntry[] = exampleIndexEntries.filter(
  (example) => example.status === 'Current',
);

export const nonCurrentExamples: ExampleIndexEntry[] = exampleIndexEntries.filter(
  (example) => example.status !== 'Current',
);

export const repoProofExamples: RepoProofEntry[] = [
  {
    title: 'Picking Proof',
    route: '/picking/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/picking',
    summary: 'Three scene picking, DOM targets, storage, keyboard input, and overlay feedback in one proof workspace route.',
    visualTone: 'bridge',
    stack: ['three', 'pointer', 'input', 'storage'],
  },
  {
    title: 'Audio Proof',
    route: '/audio-proof/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/audio-proof',
    summary: 'Original audio integration proof. Try its public Audio Lab adaptation above, or explore the broader local pointer/input stack here.',
    visualTone: 'event',
    stack: ['audio', 'loading', 'input'],
  },
  {
    title: 'Scrollytelling',
    route: '/scrollytelling/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/scrollytelling',
    summary: 'Section state, internal scrolling, pointer/input navigation, and overlay messaging without a framework wrapper.',
    visualTone: 'state',
    stack: ['loading', 'pointer', 'input'],
  },
  {
    title: 'App Shell',
    route: '/app-shell/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/app-shell',
    summary: 'DOM-first app shell orchestration, persisted layout chrome, runtime state, pointer/input, and lifecycle control.',
    visualTone: 'controller',
    stack: ['storage', 'ui-widgets', 'input'],
  },
  {
    title: 'React Starter',
    route: '/react-starter/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/react-starter',
    summary: 'React provider and hook consumption around an existing kernel instance.',
    visualTone: 'docs',
    stack: ['react', 'dom adapters'],
  },
  {
    title: 'Runtime Inspector',
    route: '/runtime-inspector/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/runtime-inspector',
    summary: 'Inspector snapshots for runtime state, registries, services, and recent event visibility.',
    visualTone: 'core',
    stack: ['inspector', 'state', 'events'],
  },
  {
    title: 'Loading Transition',
    route: '/loading-transition/',
    sourceHref: 'https://github.com/eonhive/urk/tree/main/examples/loading-transition',
    summary: 'Explicit staged loading, transition state, replay, pause, and resume behavior.',
    visualTone: 'adapter',
    stack: ['loading', 'transition', 'input'],
  },
];
