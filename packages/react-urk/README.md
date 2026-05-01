# @urk/react-urk

Thin React bindings for consuming an existing URK kernel instance.

If you are consuming URK inside a Next App Router client boundary, prefer `@urk/next-urk`
on top of this package instead of rebuilding that boundary yourself.

This package stays wrapper-only:

- it accepts an existing `Kernel`
- it subscribes to `RuntimeStore`
- it exposes the kernel event bus
- it does not introduce a React-owned runtime model

## Public API

- `UrkProvider`
- `useKernel()`
- `useRuntimeSnapshot()`
- `useRuntimePhase()`
- `useRuntimeInspector()`
- `useRuntimeInspectorSnapshot()`
- `useEventBus()`
- `useKernelEvent()`
- `KernelEventListener`

## Usage

```tsx
import { useMemo } from 'react';
import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkProvider, useKernelEvent, useRuntimeInspectorSnapshot, useRuntimePhase } from '@urk/react-urk';

function RuntimeView() {
  const phase = useRuntimePhase();
  const inspector = useRuntimeInspectorSnapshot();

  useKernelEvent('runtime:paused', (event) => {
    console.log(event.type);
  });

  return <div>{phase} / {inspector.frameCount}</div>;
}

export function App() {
  const kernel = useMemo(() => {
    return createKernel({
      adapters: [createLoadingAdapter()],
    });
  }, []);

  return (
    <UrkProvider kernel={kernel}>
      <RuntimeView />
    </UrkProvider>
  );
}
```

`UrkProvider` auto-boots by default. It only shuts the kernel down on unmount when the provider was responsible for booting the kernel in the first place.

This package is validated through type-check/build plus the private React proof route in `examples/react-starter/`, including wrapper-facing runtime inspector consumption.
