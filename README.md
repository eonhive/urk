# URK

**Universal Runtime Kernel**

URK is the public, open-source runtime kernel for interactive browser experiences. It stays standalone-first, adapter-based, controller-driven, and explicit about runtime state.

## What ships in v0

- `@urk/core` exposes the `Kernel` entrypoint, `createKernel`, explicit runtime phases, registries, service lookup, an event bus, and a scheduler abstraction.
- `@urk/adapters` includes seven reference adapters: `audio`, `pointer`, `input`, `storage`, `loading`, `three`, and `ui-widgets`.
- `@urk/react-urk` provides a thin React provider and hooks surface for consuming an existing kernel instance.
- `@urk/adapters/dom` is the dependency-light subpath for DOM-only consumers that do not need the Three adapter surface.
- `@urk/examples` contains six focused proofs:
  - a DOM-first audio transport proof for staged loading, track playback, mute/volume control, pause/resume, and shutdown
  - a DOM + Three picking proof with two interactive DOM targets and two raycast-pickable scene objects
  - a DOM-first loading/transition proof for staged loading, timed handoff, replay, pause/resume, and shutdown
  - a DOM-first app-shell proof for panel-state orchestration, input/pointer flow, persistence, and lifecycle control
  - a React starter proof for provider-based kernel consumption, runtime snapshot subscription, and lifecycle-safe controls
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

- `/audio-proof.html` for the DOM-first audio transport proof
- `/` for the DOM + Three picking proof
- `/loading-transition.html` for the DOM-first loading/transition proof
- `/app-shell.html` for the DOM-first app-shell proof
- `/react-starter.html` for the React wrapper starter proof
- `/scrollytelling.html` for the DOM-first scrollytelling proof

```ts
import { createKernel } from '@urk/core';
import {
  createAudioAdapter,
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
    createAudioAdapter(),
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

DOM-only hosts can import from the dependency-light adapter subpath:

```ts
import { createLoadingAdapter, createPointerAdapter } from '@urk/adapters/dom';
```

React hosts can wrap an existing kernel instance without redefining the kernel:

```tsx
import { useMemo } from 'react';
import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkProvider, useRuntimeSnapshot } from '@urk/react-urk';

function PhaseView() {
  const snapshot = useRuntimeSnapshot();
  return <div>{snapshot.phase}</div>;
}

export function App() {
  const kernel = useMemo(() => {
    return createKernel({
      adapters: [createLoadingAdapter()],
    });
  }, []);

  return (
    <UrkProvider kernel={kernel}>
      <PhaseView />
    </UrkProvider>
  );
}
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
    react-urk/
    examples/
```

`next-urk` and broader wrapper helpers remain deferred. `@urk/react-urk` is the first thin wrapper starter and still has to wrap the kernel rather than redefine it.

## Validation model

This milestone is validated through:

- package builds and `tsc --noEmit` checks
- focused browser proofs under `@urk/examples`
- browser acceptance for DOM-first audio transport, DOM + Three picking, DOM-first loading/transition, DOM-first app-shell, and DOM-first scrollytelling behavior, plus the new React wrapper starter route once the added React dependencies are installed

`corepack yarn test` is intentionally non-automated in this milestone. It reports the current manual-validation status for each package instead of pretending a full automated suite exists.

## Docs

- `docs/BOUNDARY.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DEFERRED.md`

URK should remain the runtime kernel. Product logic, dashboards, avatar identity, and monetization stay outside this repo.
