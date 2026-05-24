/**
 * Company: EonHive Inc.
 * Title: Package Data
 * Purpose: Describe the real URK workspace package surfaces for the public website.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-09
 * Notes: Vibe coded with Codex.
 */

export type PublicPackageStatusTone = 'current' | 'experimental' | 'planned';
export type PublicPackageSection = 'runtime' | 'tooling' | 'wrapper' | 'internal';

export type PublicPackageLink = {
  title: string;
  href?: string;
  detail?: string;
  statusLabel?: string;
};

export type PublicPackageApiItem = {
  name: string;
  description: string;
};

export type PublicPackageEntry = {
  slug: string;
  name: string;
  purpose: string;
  install: string;
  cardInstall?: string;
  statusLabel: string;
  statusTone: PublicPackageStatusTone;
  section: PublicPackageSection;
  detail: string;
  boundaryNote: string;
  stabilityNote: string;
  warning?: string;
  whatBelongs: string[];
  whatDoesNotBelong: string[];
  basicUsage: {
    language: 'ts' | 'tsx' | 'bash' | 'text';
    title: string;
    code: string;
  };
  apiOverview: PublicPackageApiItem[];
  relatedDocs: PublicPackageLink[];
  relatedExamples: PublicPackageLink[];
  showOnHome?: boolean;
};

export const publicPackages: PublicPackageEntry[] = [
  {
    slug: 'core',
    name: '@urk/core',
    purpose:
      'Kernel bootstrap, runtime context, explicit phase state, registries, scheduler ownership, and event bus foundations.',
    install: 'pnpm add @urk/core',
    cardInstall: 'pnpm add @urk/core',
    statusLabel: 'Current',
    statusTone: 'current',
    section: 'runtime',
    detail:
      '`@urk/core` is the runtime source of truth. Start here before adding adapters, examples, tooling, or framework wrappers.',
    boundaryNote:
      'Owns runtime lifecycle and contracts. Browser capability implementations, wrappers, product policy, and website code stay outside core.',
    stabilityNote:
      'Publishable and usable now, but still 0.x. Prefer root exports and avoid depending on internal folder layout.',
    whatBelongs: [
      'Kernel bootstrap through `createKernel(...)` and the `Kernel` entrypoint.',
      'Runtime context shared across state, adapters, controllers, services, events, and scheduler.',
      'Explicit runtime state through phases, snapshots, subscriptions, and updates.',
      'Adapter, controller, and service registries with required and optional lookup.',
      'Controller lifecycle contracts such as `init`, `start`, `update`, `onStateChange`, and `dispose`.',
      'Event bus, kernel events, frame scheduling, lifecycle guards, and bounded inspector snapshots.',
    ],
    whatDoesNotBelong: [
      'DOM, pointer, input, storage, audio, Three, or User Interface (UI) adapter implementation code.',
      'React or Next.js providers, hooks, or client-boundary helpers.',
      'Product workflows such as authentication, dashboards, identity policy, or monetization.',
      'Static docs rendering, site theming, or public website presentation code.',
    ],
    basicUsage: {
      language: 'ts',
      title: 'Kernel bootstrap',
      code: `import { createKernel } from '@urk/core';

const kernel = createKernel();

await kernel.boot();

console.log(kernel.getState().phase);

await kernel.shutdown('surface:teardown');`,
    },
    apiOverview: [
      {
        name: 'createKernel(config?)',
        description: 'Build the kernel with optional services, adapters, controllers, and scheduler.',
      },
      {
        name: 'Kernel and Runtime',
        description: 'Canonical runtime entrypoints for boot, pause, resume, shutdown, event access, and inspection.',
      },
      {
        name: 'RuntimeContext',
        description: 'Shared runtime access to state, adapters, controllers, services, events, and scheduler.',
      },
      {
        name: 'RuntimeStore and RuntimePhase',
        description: 'Explicit runtime state for `boot`, `loading`, `ready`, `transition`, `paused`, and `error`.',
      },
      {
        name: 'AdapterRegistration and ControllerRegistration',
        description: 'Public contracts for capability adapters and orchestration controllers.',
      },
      {
        name: 'EventBus, KernelEvent, and RuntimeInspector',
        description: 'Visibility surfaces for runtime events and bounded diagnostics snapshots.',
      },
    ],
    relatedDocs: [
      { title: '@urk/core reference', href: '/docs/reference/core/' },
      { title: 'Runtime kernel', href: '/docs/concepts/runtime-kernel/' },
      { title: 'Runtime types', href: '/docs/reference/runtime-types/' },
      { title: 'Boundary', href: '/docs/project/boundary/' },
    ],
    relatedExamples: [
      { title: 'Minimal Runtime', href: '/examples/minimal-runtime/', statusLabel: 'Current' },
      { title: 'Runtime State', href: '/examples/runtime-state/', statusLabel: 'Current' },
      { title: 'Event Routing', href: '/examples/event-routing/', statusLabel: 'Current' },
    ],
    showOnHome: true,
  },
  {
    slug: 'adapters',
    name: '@urk/adapters',
    purpose:
      'Contract-first capability adapters for browser-facing runtime features, with a dependency-light DOM entrypoint.',
    install: 'pnpm add @urk/core @urk/adapters',
    cardInstall: 'pnpm add @urk/core @urk/adapters',
    statusLabel: 'Current',
    statusTone: 'current',
    section: 'runtime',
    detail:
      'Use this package when a runtime needs explicit browser capabilities. Prefer `@urk/adapters/dom` unless you need the broader adapter surface.',
    boundaryNote:
      'Adapters expose capabilities. They do not own orchestration, product logic, framework wrappers, or kernel lifecycle.',
    stabilityNote:
      'Publishable and usable now, but still 0.x. Treat adapter contracts as the stable center and check adapter-specific maturity.',
    warning:
      'Install `@urk/core` alongside this package. The root export includes the optional Three adapter surface; DOM-only hosts should import from `@urk/adapters/dom`.',
    whatBelongs: [
      'Capability adapters for loading, input, pointer, storage, audio, UI widgets, and Three scene surfaces.',
      'The DOM-only `@urk/adapters/dom` subpath for dependency-light browser hosts.',
      'Adapter setup, support checks, disposal, capability names, and small typed APIs.',
      'Runtime-visible adapter events such as loading, input, pointer, storage, audio, and UI widget events.',
    ],
    whatDoesNotBelong: [
      'Kernel lifecycle, runtime state ownership, scheduler orchestration, or controller lifecycle.',
      'Feature flows that belong in controllers rather than inside capability adapters.',
      'React or Next.js wrapper behavior.',
      'Product-specific adapters for dashboards, auth, cloud services, or monetization.',
    ],
    basicUsage: {
      language: 'ts',
      title: 'DOM-first adapter registration',
      code: `import { createKernel } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
} from '@urk/adapters/dom';

const kernel = createKernel({
  adapters: [
    createLoadingAdapter(),
    createInputAdapter(),
    createPointerAdapter(),
  ],
});`,
    },
    apiOverview: [
      {
        name: '@urk/adapters',
        description: 'Root export for all current reference adapters, including optional Three support.',
      },
      {
        name: '@urk/adapters/dom',
        description: 'DOM-first export for loading, input, pointer, storage, UI widgets, and contracts.',
      },
      {
        name: 'createLoadingAdapter()',
        description: 'Expose staged loading progress and an observable loading snapshot.',
      },
      {
        name: 'createInputAdapter() and createPointerAdapter()',
        description: 'Normalize keyboard and pointer interaction into runtime capabilities.',
      },
      {
        name: 'createStorageAdapter() and createUiWidgetsAdapter()',
        description: 'Expose small browser persistence and overlay UI capabilities.',
      },
      {
        name: 'createAudioAdapter() and createThreeAdapter()',
        description: 'Broader browser capability surfaces with stronger runtime assumptions.',
      },
    ],
    relatedDocs: [
      { title: '@urk/adapters reference', href: '/docs/reference/adapters/' },
      { title: 'Adapter contracts', href: '/docs/concepts/adapters/' },
      { title: 'Adapter contract types', href: '/docs/reference/adapter-contract-types/' },
      { title: 'Create an adapter', href: '/docs/guides/create-adapter/' },
    ],
    relatedExamples: [
      { title: 'Adapter Registration', href: '/examples/adapter-registration/', statusLabel: 'Current' },
      { title: 'Pointer Input Overlay', href: '/examples/pointer-input-overlay/', statusLabel: 'Current' },
      { title: 'Scene/UI Bridge', href: '/examples/scene-ui-bridge/', statusLabel: 'Current' },
    ],
    showOnHome: true,
  },
  {
    slug: 'cli',
    name: '@urk/cli',
    purpose:
      'Command-Line Interface tooling for scaffolding, static checks, and source-based URK project inspection.',
    install: `pnpm add -D @urk/cli
# Monorepo development: corepack yarn workspace @urk/cli build`,
    cardInstall: 'pnpm add -D @urk/cli',
    statusLabel: 'Experimental',
    statusTone: 'experimental',
    section: 'tooling',
    detail:
      '`@urk/cli` is publishable developer tooling. It helps generate and inspect URK projects without owning runtime behavior.',
    boundaryNote:
      'The CLI may scaffold code that imports runtime packages, but it must not become part of runtime architecture.',
    stabilityNote:
      'Publishable and experimental. The command set is real but still tightening around the kernel-first workflow.',
    warning:
      'Use the CLI for scaffolding and static inspection. It is not a live runtime server, browser inspector, product generator, or telemetry transport.',
    whatBelongs: [
      '`urk create` for standalone browser-first URK projects.',
      '`urk create-proof` for repo-only proof routes.',
      '`urk add adapter <name>` and `urk create controller <name>` source mutations.',
      '`urk check` and `urk inspect` static project checks and summaries.',
    ],
    whatDoesNotBelong: [
      'Kernel lifecycle ownership or browser runtime execution.',
      'Framework-first runtime architecture or wrapper-owned runtime boot.',
      'Cloud deployment, auth, marketplace features, dashboards, or monetization templates.',
      'A live runtime inspector server or long-running application process.',
    ],
    basicUsage: {
      language: 'bash',
      title: 'Scaffold and inspect',
      code: `pnpm exec urk create demo-runtime
pnpm exec urk add adapter loading
pnpm exec urk create controller loading-flow
pnpm exec urk check
pnpm exec urk inspect`,
    },
    apiOverview: [
      {
        name: 'urk create <name>',
        description: 'Scaffold a standalone browser-first URK runtime project.',
      },
      {
        name: 'urk create-proof <name>',
        description: 'Scaffold a repo-only proof route inside the private examples workspace.',
      },
      {
        name: 'urk add adapter <name>',
        description: 'Add a supported DOM adapter import and registration to a recognized project shape.',
      },
      {
        name: 'urk create controller <name>',
        description: 'Generate a controller file and print the manual wiring step.',
      },
      {
        name: 'urk check and urk inspect',
        description: 'Run static checks and static project summaries; no live browser connection.',
      },
    ],
    relatedDocs: [
      { title: 'CLI commands', href: '/docs/reference/cli/' },
      { title: 'Contributing', href: '/docs/project/contributing/' },
      { title: 'Architecture', href: '/docs/project/architecture/' },
    ],
    relatedExamples: [
      { title: 'Minimal Runtime', href: '/examples/minimal-runtime/', statusLabel: 'Current' },
      { title: 'Controller Orchestration', href: '/examples/controller-orchestration/', statusLabel: 'Current' },
    ],
    showOnHome: true,
  },
  {
    slug: 'react-urk',
    name: '@urk/react-urk',
    purpose:
      'Thin React provider and hooks for consuming an existing URK kernel inside a React host.',
    install: 'pnpm add @urk/core @urk/react-urk react react-dom',
    cardInstall: 'pnpm add @urk/core @urk/react-urk react react-dom',
    statusLabel: 'Experimental wrapper',
    statusTone: 'experimental',
    section: 'wrapper',
    detail:
      '`@urk/react-urk` is publishable and downstream. Use it when a React host needs to consume an existing kernel boundary.',
    boundaryNote:
      'React stays a host boundary. The provider and hooks consume the kernel; they do not replace `@urk/core`.',
    stabilityNote:
      'Publishable and experimental. The wrapper is real, but standalone kernel usage remains the recommended starting point.',
    warning:
      'Do not start URK architecture from React. Prove the standalone kernel first, then add React when the host app needs it.',
    whatBelongs: [
      'A provider that accepts an existing `Kernel` instance.',
      'Hooks for runtime phase, snapshot, inspector snapshot, event bus access, and event subscription.',
      'React lifecycle glue around auto-boot and provider-owned shutdown.',
    ],
    whatDoesNotBelong: [
      'A React-owned runtime model that replaces the kernel.',
      'Adapter implementations, controller orchestration, or product state management.',
      'Routing, server rendering policy, or application shell decisions.',
    ],
    basicUsage: {
      language: 'tsx',
      title: 'Wrap an existing kernel',
      code: `import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkProvider, useRuntimePhase } from '@urk/react-urk';

function PhaseView() {
  const phase = useRuntimePhase();
  return <div>{phase}</div>;
}

const kernel = createKernel({
  adapters: [createLoadingAdapter()],
});

export function App() {
  return (
    <UrkProvider kernel={kernel}>
      <PhaseView />
    </UrkProvider>
  );
}`,
    },
    apiOverview: [
      {
        name: 'UrkProvider',
        description: 'Accept an existing kernel and expose it to a React tree.',
      },
      {
        name: 'useKernel()',
        description: 'Read the active kernel from React context.',
      },
      {
        name: 'useRuntimeSnapshot() and useRuntimePhase()',
        description: 'Read explicit runtime state without inventing a second runtime model.',
      },
      {
        name: 'useRuntimeInspector() and useRuntimeInspectorSnapshot()',
        description: 'Read bounded inspector data from React.',
      },
      {
        name: 'useEventBus() and useKernelEvent()',
        description: 'Access and subscribe to runtime events inside React.',
      },
    ],
    relatedDocs: [
      { title: '@urk/react-urk reference', href: '/docs/reference/react-urk/' },
      { title: 'Integration wrappers', href: '/docs/concepts/integration-wrappers/' },
      { title: 'Use URK with React', href: '/docs/guides/react-later/' },
    ],
    relatedExamples: [
      { title: 'Minimal Runtime', href: '/examples/minimal-runtime/', statusLabel: 'Current' },
      {
        title: 'Private React proof',
        detail: 'Validated through the private `examples/react-starter/` proof.',
        statusLabel: 'Private proof',
      },
    ],
    showOnHome: false,
  },
  {
    slug: 'next-urk',
    name: '@urk/next-urk',
    purpose:
      'Thin Next App Router client-boundary helpers built on top of `@urk/react-urk`.',
    install: 'pnpm add @urk/core @urk/react-urk @urk/next-urk next react react-dom',
    cardInstall: 'pnpm add @urk/core @urk/react-urk @urk/next-urk next react react-dom',
    statusLabel: 'Experimental wrapper',
    statusTone: 'experimental',
    section: 'wrapper',
    detail:
      '`@urk/next-urk` is publishable and downstream. It composes the React wrapper for Next client boundaries.',
    boundaryNote:
      'Next integration should create or consume a client-side kernel and delegate runtime lifecycle to the React wrapper.',
    stabilityNote:
      'Publishable and experimental. Use it only where a Next client boundary is actually required.',
    warning:
      'Do not treat Next as the primary URK mental model. Runtime execution belongs on the client, not in server rendering.',
    whatBelongs: [
      'A client-boundary provider that composes `@urk/react-urk`.',
      'A stable client kernel factory hook for one kernel instance per mount.',
      'React wrapper re-exports through the Next entrypoint.',
    ],
    whatDoesNotBelong: [
      'Server-side runtime execution or routing policy.',
      'A replacement for `@urk/core` or `@urk/react-urk`.',
      'Adapter implementations, controller orchestration, or app-specific product logic.',
    ],
    basicUsage: {
      language: 'tsx',
      title: 'Client-boundary wrapper',
      code: `'use client';

import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkNextProvider, useRuntimePhase } from '@urk/next-urk';

function createAppKernel() {
  return createKernel({
    adapters: [createLoadingAdapter()],
  });
}

function PhaseView() {
  const phase = useRuntimePhase();
  return <div>{phase}</div>;
}

export function App() {
  return (
    <UrkNextProvider createKernel={createAppKernel}>
      <PhaseView />
    </UrkNextProvider>
  );
}`,
    },
    apiOverview: [
      {
        name: 'UrkNextProvider',
        description: 'Wrap a Next client boundary and delegate lifecycle to `UrkProvider`.',
      },
      {
        name: 'useClientKernel(createKernel)',
        description: 'Create one client-owned kernel instance per mounted boundary.',
      },
      {
        name: 'React wrapper re-exports',
        description: 'Use React wrapper hooks through the Next entrypoint without duplicating API shape.',
      },
    ],
    relatedDocs: [
      { title: '@urk/next-urk reference', href: '/docs/reference/next-urk/' },
      { title: 'Integration wrappers', href: '/docs/concepts/integration-wrappers/' },
      { title: 'Use URK with Next.js', href: '/docs/guides/next-later/' },
    ],
    relatedExamples: [
      { title: 'Minimal Runtime', href: '/examples/minimal-runtime/', statusLabel: 'Current' },
      {
        title: 'Private Next proof',
        detail: 'Validated through `apps/next-proof`.',
        statusLabel: 'Private proof',
      },
    ],
    showOnHome: false,
  },
  {
    slug: 'examples',
    name: '@urk/examples',
    purpose:
      'Private website-consumed example catalog and mount helpers for public runtime islands.',
    install: `# Private workspace package only.
corepack yarn workspace @urk/examples build`,
    cardInstall: 'Private workspace only',
    statusLabel: 'Private internal',
    statusTone: 'experimental',
    section: 'internal',
    detail:
      '`@urk/examples` powers real website examples without pretending the example catalog is a stable public Software Development Kit (SDK).',
    boundaryNote:
      'Examples prove URK behavior for the website. They are not a publishable consumer package or long-term public API.',
    stabilityNote:
      'Private, internal, and unstable. The catalog, metadata, and mount contract can change without public API guarantees.',
    warning:
      'Do not install or depend on `@urk/examples` from consumer projects. Use public runtime packages instead.',
    whatBelongs: [
      'Website-consumed runtime examples and catalog metadata.',
      'Current public example mounts for the website examples routes.',
      'Source excerpts, schema/config text, related docs, and mount helpers for runtime islands.',
    ],
    whatDoesNotBelong: [
      'A stable npm API for external consumers.',
      'Product showcases, dashboard flows, no-code builder behavior, or private app logic.',
      'Core runtime contracts that belong in `@urk/core`.',
      'Wrapper-first examples that obscure the standalone kernel model.',
    ],
    basicUsage: {
      language: 'ts',
      title: 'Website-only example loading',
      code: `import { loadExampleModule } from '@urk/examples';

const host = document.querySelector<HTMLElement>('[data-urk-example-root]');

if (!host) {
  throw new Error('Missing example host.');
}

const { mount } = await loadExampleModule('minimal-runtime');
const runtime = await mount(host);`,
    },
    apiOverview: [
      {
        name: 'exampleCatalog',
        description: 'Internal unstable list of current example metadata and any future planned entries.',
      },
      {
        name: 'getExampleMeta(id)',
        description: 'Resolve one internal example metadata entry for website routing.',
      },
      {
        name: 'loadExampleModule(id)',
        description: 'Load a runnable example module when that example has a real mount implementation.',
      },
      {
        name: 'ExampleMeta, ExampleModule, and ExampleMountResult',
        description: 'Internal unstable contracts used by `apps/www` runtime islands.',
      },
    ],
    relatedDocs: [
      { title: '@urk/examples reference', href: '/docs/reference/examples/' },
      { title: 'Minimal standalone runtime', href: '/docs/examples/minimal-standalone-runtime/' },
      { title: 'Use URK inside Astro docs', href: '/docs/guides/astro-docs-embed/' },
    ],
    relatedExamples: [
      { title: 'Minimal Runtime', href: '/examples/minimal-runtime/', statusLabel: 'Current' },
      { title: 'Adapter Registration', href: '/examples/adapter-registration/', statusLabel: 'Current' },
      { title: 'Embedded Docs Demo', href: '/examples/embedded-docs-demo/', statusLabel: 'Current' },
    ],
    showOnHome: true,
  },
];

export const homepagePackages = publicPackages.filter((entry) => entry.showOnHome !== false);

export const runtimePackages = publicPackages.filter((entry) => entry.section === 'runtime');

export const toolingPackages = publicPackages.filter((entry) => entry.section === 'tooling');

export const wrapperPackages = publicPackages.filter((entry) => entry.section === 'wrapper');

export const internalPackages = publicPackages.filter((entry) => entry.section === 'internal');

export function getPublicPackage(slug: string): PublicPackageEntry | undefined {
  return publicPackages.find((entry) => entry.slug === slug);
}
