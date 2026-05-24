# URK

**Universal Runtime Kernel**

URK is the public, open-source runtime kernel for interactive browser experiences. It stays standalone-first, adapter-based, controller-driven, and explicit about runtime state.

## What ships in v0

- `@urk/core` provides `Kernel`, `createKernel`, explicit runtime phases, registries, service lookup, the event bus, the scheduler abstraction, and the runtime inspector.
- `@urk/adapters` provides the reference `audio`, `pointer`, `input`, `storage`, `loading`, `three`, and `ui-widgets` adapters.
- `@urk/adapters/dom` provides the dependency-light DOM-only adapter surface.
- `@urk/react-urk` provides the thin React provider and hooks for consuming an existing kernel instance.
- `@urk/next-urk` provides the thin Next App Router client-boundary wrapper on top of `@urk/react-urk`.
- `@urk/examples` provides internal, unstable runtime examples consumed by the public website.
- `@urk/cli` provides early developer tooling for URK projects and proofs.
- `apps/www` provides the public Astro/Starlight website, docs, package pages, example pages, and runtime demo shells.
- `examples/` provides the repo-only proof workspace with one folder per proof.
- `apps/next-proof` provides the standalone Next proof app for validating `@urk/next-urk` in a real App Router runtime.

## Quick start

Use Node 22. The repo uses Yarn workspaces with `nodeLinker: node-modules`; Yarn cache archives are tracked as part of the repo's zero-install workflow.

```bash
corepack enable
corepack yarn install
corepack yarn build
corepack yarn dev
```

Run the public website:

```bash
corepack yarn workspace @urk/www dev
```

Run the private proof workspace:

```bash
corepack yarn workspace urk-examples dev
```

Run the standalone Next proof separately:

```bash
corepack yarn workspace @urk/next-proof dev
```

Try the CLI locally:

```bash
corepack yarn workspace @urk/cli build
node packages/cli/dist/index.js --help
```

`@urk/cli` is developer tooling only. It helps scaffold, check, and inspect URK projects, but it
does not own runtime architecture.

Open:

- `http://localhost:4321/` for the public website
- `http://localhost:4321/docs/` for public docs
- `http://localhost:4321/examples/minimal-runtime/` for the first live website-consumed URK runtime example
- `http://localhost:5173/` for the private proof index when `urk-examples` is running
- `http://localhost:5173/audio-proof/`
- `http://localhost:5173/picking/`
- `http://localhost:5173/loading-transition/`
- `http://localhost:5173/app-shell/`
- `http://localhost:5173/react-starter/`
- `http://localhost:5173/scrollytelling/`
- `http://localhost:5173/runtime-inspector/`

## Minimal usage

```ts
import { createKernel } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
  createUiWidgetsAdapter,
} from '@urk/adapters/dom';

const kernel = createKernel({
  services: {
    'ui:host': document.querySelector('#overlay-host'),
  },
  adapters: [
    createPointerAdapter(),
    createInputAdapter(),
    createLoadingAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
```

The canonical runtime phases are `boot`, `loading`, `ready`, `transition`, `paused`, and `error`. Shutdown is disposal, not another phase.

## Repo layout

```text
urk/
  apps/
    www/
    next-proof/
  docs/
  examples/
    audio-proof/
    picking/
    loading-transition/
    app-shell/
    react-starter/
    scrollytelling/
    runtime-inspector/
  packages/
    core/
    adapters/
    examples/
    cli/
    react-urk/
    next-urk/
```

`apps/www` is the public website shell. Content-first pages use Astro/Starlight; runtime-first surfaces use URK examples imported from `packages/examples`.

`packages/` contains publishable runtime packages, publishable tooling, and the private website examples package. `@urk/examples` stays internal and unstable; it is consumed by `apps/www` and is not treated as a public npm API. `examples/` and `apps/next-proof` are private repo proofs and are not published to npm.

## CLI

`@urk/cli` is the URK Command-Line Interface package.

- `urk create <name>` scaffolds a standalone URK app
- `urk create-proof <name>` scaffolds a repo-only proof
- `urk add adapter <name>` adds one supported adapter
- `urk create controller <name>` scaffolds one controller
- `urk check` runs static checks
- `urk inspect` runs static inspection

See [packages/cli/README.md](./packages/cli/README.md) for the full command reference and boundary notes.

## Docs

- `docs/BOUNDARY.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DEFERRED.md`
- `docs/EXAMPLES.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PUBLIC_SITE_PLAN.md`
- `docs/DOCUMENTATION_IA.md`
- `docs/UI_UX_SYSTEM.md`

`docs/07_URK/` remains draft and reference material. The top-level docs above are the canonical entry points.
