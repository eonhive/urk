# URK

**Universal Runtime Kernel**

URK is the public, open-source runtime kernel for interactive browser experiences. It stays standalone-first, adapter-based, controller-driven, and explicit about runtime state.

## What ships in v0

- `@urk/core` provides `Kernel`, `createKernel`, explicit runtime phases, registries, service lookup, the event bus, the scheduler abstraction, and the runtime inspector.
- `@urk/adapters` provides the reference `audio`, `pointer`, `input`, `storage`, `loading`, `three`, and `ui-widgets` adapters.
- `@urk/adapters/dom` provides the dependency-light DOM-only adapter surface.
- `@urk/react-urk` provides the thin React provider and hooks for consuming an existing kernel instance.
- `@urk/next-urk` provides the thin Next App Router client-boundary wrapper on top of `@urk/react-urk`.
- `examples/` provides the repo-only proof workspace with one folder per proof.
- `apps/next-proof` provides the standalone Next proof app for validating `@urk/next-urk` in a real App Router runtime.

## Quick start

```bash
corepack enable
corepack yarn install
corepack yarn build
corepack yarn dev
```

Run the standalone Next proof separately:

```bash
corepack yarn workspace @urk/next-proof dev
```

Open:

- `/` for the examples index
- `/audio-proof/`
- `/picking/`
- `/loading-transition/`
- `/app-shell/`
- `/react-starter/`
- `/scrollytelling/`
- `/runtime-inspector/`

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
    react-urk/
    next-urk/
```

`packages/` contains publishable libraries only. `examples/` and `apps/next-proof` are private repo proofs and are not published to npm.

## Docs

- `docs/BOUNDARY.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DEFERRED.md`
- `docs/EXAMPLES.md`
- `docs/IMPLEMENTATION_PLAN.md`

`docs/07_URK/` remains draft and reference material. The top-level docs above are the canonical entry points.
