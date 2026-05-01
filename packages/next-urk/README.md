# @urk/next-urk

Thin Next App Router bindings for consuming an existing URK kernel through a client boundary.

This package stays wrapper-only:

- it creates one client-owned kernel instance per mount
- it composes `@urk/react-urk`
- it does not add routing, pathname, or SSR hydration policy
- it does not redefine the kernel architecture

## Public API

- `KernelFactory`
- `useClientKernel()`
- `UrkNextProvider`
- `UrkNextProviderProps`
- `useRuntimeInspector()`
- `useRuntimeInspectorSnapshot()`
- all current `@urk/react-urk` exports re-exported unchanged

## Usage

```tsx
'use client';

import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkNextProvider, useRuntimeInspectorSnapshot, useRuntimePhase } from '@urk/next-urk';

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

`UrkNextProvider` stays client-only and delegates runtime lifecycle to `UrkProvider` from `@urk/react-urk`.

This package is validated for this milestone through type-check/build plus the standalone App Router proof in `apps/next-proof`, including wrapper-facing runtime inspector consumption.
