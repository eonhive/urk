# @urk/next

Previously named `@urk/next-urk`. The v0.2 legacy package forwards to this
implementation. This package depends on `@urk/react`; provider/hook APIs, client
boundaries, and inert SSR remain unchanged. Existing `0.1.x` releases are not
rewritten; see [migration notes](../../docs/MIGRATION_V02.md).

Thin Next App Router bindings for consuming an existing URK kernel through a client boundary.

This package stays wrapper-only:

- it creates one client-owned kernel instance per mount
- it composes `@urk/react`
- it does not add routing, pathname, or SSR hydration policy
- it does not redefine the kernel architecture

## Public API

- `KernelFactory`
- `useClientKernel()`
- `UrkNextProvider`
- `UrkNextProviderProps`
- `useRuntimeInspector()`
- `useRuntimeInspectorSnapshot()`
- all current `@urk/react` exports re-exported unchanged

## Usage

```tsx
'use client';

import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkNextProvider, useRuntimeInspectorSnapshot, useRuntimePhase } from '@urk/next';

function PhaseView() {
  const phase = useRuntimePhase();
  const inspector = useRuntimeInspectorSnapshot();
  return <div>{phase} / {inspector.frameCount}</div>;
}

function createAppKernel() {
  return createKernel({
    adapters: [createLoadingAdapter()],
  });
}

export function App() {
  return (
    <UrkNextProvider createKernel={createAppKernel}>
      <PhaseView />
    </UrkNextProvider>
  );
}
```

`UrkNextProvider` defaults to `ownership="provider"` and delegates lifecycle to `UrkProvider` from `@urk/react`. It cancels pending startup when its cleanup task runs after unmount. It also forwards `ownership="external"` or `"legacy"` when a host intentionally selects those contracts; an external owner must arrange cleanup itself.

`useClientKernel()` keeps its existing signature and stable factory/instance checks. A client boundary can be server-rendered, so the factory may execute during render on the server as well as the client. Construct an inert kernel and registrations there; acquire DOM, audio, rendering, or timer resources only inside lifecycle hooks. Do not call boot inside the factory.

Real App Router navigation and fresh-instance cleanup are covered by `corepack yarn test:integration`. `corepack yarn workspace @urk/next-proof test` verifies inert server rendering. See [validation evidence](../../docs/VALIDATION.md).

## v0.2 shared experience

The real App Router proof exposes `/v02`, mounting the same experience used by standalone/React/website hosts through `UrkNextProvider`. Factories remain inert and the provider owns cleanup by default. Wrapper/core peers are versioned `^0.2.0`; publication remains separate from the local implementation.
