# URK

**Universal Runtime Kernel**

URK is the public, open-source runtime kernel for interactive browser experiences. It stays standalone-first, adapter-based, controller-driven, and explicit about runtime state.

## What ships in v0

- `@urk/core` exposes the `Kernel` entrypoint, `createKernel`, explicit runtime phases, registries, service lookup, an event bus, and a scheduler abstraction.
- `@urk/adapters` currently includes six reference adapters: `pointer`, `input`, `storage`, `loading`, `three`, and `ui-widgets`.
- `@urk/examples` contains four focused proofs:
  - a DOM + Three picking proof with two interactive DOM targets and two raycast-pickable scene objects
  - a DOM-first loading/transition proof for staged loading, timed handoff, replay, pause/resume, and shutdown
  - a DOM-first app-shell proof for panel-state orchestration, input/pointer flow, persistence, and lifecycle control
  - a DOM-first scrollytelling proof for section/motion orchestration, explicit section state, and pause-safe navigation

## Quick start

Use Corepack so the repo runs with the pinned Yarn version:

```bash
corepack enable
corepack yarn install
```

Build every current package from the repo root:

```bash
corepack yarn build
```

Run the example package:

```bash
corepack yarn dev
```

Open:

- `/` for the DOM + Three picking proof
- `/loading-transition.html` for the DOM-first loading/transition proof
- `/app-shell.html` for the DOM-first app-shell proof
- `/scrollytelling.html` for the DOM-first scrollytelling proof

```ts
import { createKernel } from '@urk/core';
import {
  createInputAdapter,
  createLoadingAdapter,
  createPointerAdapter,
  createStorageAdapter,
  createThreeAdapter,
  createUiWidgetsAdapter,
} from '@urk/adapters';

const kernel = createKernel({
  services: {
    'three:host': document.querySelector('#scene-host'),
    'ui:host': document.querySelector('#overlay-host'),
  },
  adapters: [
    createPointerAdapter(),
    createInputAdapter(),
    createStorageAdapter({ namespace: 'demo' }),
    createLoadingAdapter(),
    createThreeAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
```

The canonical runtime phases are:

- `boot`
- `loading`
- `ready`
- `transition`
- `paused`
- `error`

Shutdown is handled through disposal, not through another phase.

## Package layout

```text
urk/
  packages/
    core/
    adapters/
    examples/
```

Wrapper packages remain deferred until the kernel boundary and proof examples are more stable.

## Validation model

This milestone is validated through:

- package builds and `tsc --noEmit` checks
- focused browser proofs under `@urk/examples`
- browser acceptance for DOM + Three picking, DOM-first loading/transition, DOM-first app-shell, and DOM-first scrollytelling behavior

`corepack yarn test` is intentionally non-automated in this milestone. It reports the current manual-validation status for each package instead of pretending a full automated suite exists.

## Docs

- `docs/BOUNDARY.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DEFERRED.md`

URK should remain the runtime kernel. Product logic, dashboards, avatar identity, and monetization stay outside this repo.
