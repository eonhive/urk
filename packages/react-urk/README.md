# @urk/react-urk

Thin React bindings for consuming an existing URK kernel instance.

This package stays wrapper-only:

- it accepts an existing `Kernel`
- it subscribes to `RuntimeStore`
- it exposes the kernel event bus
- it does not introduce a React-owned runtime model

## Public API

- `UrkProvider`
- `useKernel()`
- `useRuntimeSnapshot()`
- `useEventBus()`

## Usage

```tsx
import { useMemo } from 'react';
import { createKernel } from '@urk/core';
import { createLoadingAdapter } from '@urk/adapters/dom';
import { UrkProvider, useRuntimeSnapshot } from '@urk/react-urk';

function RuntimeView() {
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
      <RuntimeView />
    </UrkProvider>
  );
}
```

`UrkProvider` auto-boots by default. It only shuts the kernel down on unmount when the provider was responsible for booting the kernel in the first place.

This package is intended to be validated for this milestone through type-check/build plus the standalone React proof in `@urk/examples`.
The implementation is landed, but full validation still depends on installing the added React dependencies in the workspace.
