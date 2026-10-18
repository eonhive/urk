# @urk/react

Thin React bindings for consuming an existing URK kernel instance.

Previously named `@urk/react-urk`. The v0.2 legacy package forwards to this
implementation, sharing context and cleanup ownership. Existing `0.1.x` releases
are unchanged; see [migration notes](../../docs/MIGRATION_V02.md). Provider/hook
APIs and `react-urk:*` lifecycle events and default reasons remain stable.

If you are consuming URK inside a Next App Router client boundary, prefer `@urk/next`
on top of this package instead of rebuilding that boundary yourself.

This package stays wrapper-only:

- it accepts an existing `Kernel`
- it subscribes to `RuntimeStore`
- it exposes the kernel event bus
- it does not introduce a React-owned runtime model

## Public API

- `UrkProvider`
- `UrkProviderProps`, `KernelOwnership`
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
import { UrkProvider, useKernelEvent, useRuntimeInspectorSnapshot, useRuntimePhase } from '@urk/react';

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
    <UrkProvider kernel={kernel} ownership="provider">
      <RuntimeView />
    </UrkProvider>
  );
}
```

`UrkProvider` auto-boots by default. Choose cleanup ownership explicitly for new integrations:

| `ownership` | Cleanup contract |
| --- | --- |
| `legacy` (default) | The first provider that requests boot while the legacy phase is `boot` claims cleanup, preserving the existing convenience |
| `external` | The provider can auto-boot and observe the kernel; the external host performs terminal cleanup |
| `provider` | The provider owns terminal cleanup, including when `autoBoot={false}` |

Only one provider can claim a kernel. A competing explicit owner throws; a competing legacy consumer does not claim cleanup. Mount multiple consumers of a shared kernel with `ownership="external"`. Kernel identity and ownership cannot change after mount; unmount and use a fresh kernel to change them. Legacy inference cannot distinguish an externally initiated pending boot, so use explicit external ownership for shared runtimes.

Unmount schedules one cancellable zero-delay cleanup task so synchronous effect replay can reattach. When the task runs, shutdown signals cancellation immediately without waiting for boot. A hook that ignores cancellation can still keep cleanup pending. Reason and `autoBoot` changes do not release ownership; enabling auto-boot requests startup once. Wrapper boot-completion events are suppressed after unmount or cancellation, and wrapper event observers cannot block cleanup.

`useRuntimeSnapshot()` caches by the store's revision with stable subscription/read callbacks. Distinct revisions remain observable when their phases, reasons, and timestamps end up equal. Inspector snapshots retain their existing cached immutable contract.

Create inert kernels during render. Allocate browser resources in adapter/controller hooks and register their cleanup in scopes.

Run `corepack yarn test:integration` for real React and Next ownership tests. Existing SSR tests run with `corepack yarn workspace urk-examples test`. See [validation evidence](../../docs/VALIDATION.md).

## v0.2 lifecycle observation

`useLifecycleSnapshot()` returns the cached immutable operational snapshot (`created`, `starting`, `running`, `paused`, `failed`, `disposing`, `disposed`). It uses stable external-store callbacks and complements the existing legacy phase hooks. Wrapper/core manifests are `0.2.0` with compatible peers. The shared example at `/v02/react.html` demonstrates provider ownership and fresh-kernel recovery.
