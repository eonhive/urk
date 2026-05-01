# @urk/core

Kernel bootstrap, runtime lifecycle, explicit phase state, registries, service lookup, and event routing.

## Public API

- `Kernel` - canonical kernel entrypoint
- `Runtime` - compatibility alias for `Kernel`
- `createKernel(config?)` - factory helper
- `RuntimeStore` - explicit phase store with subscriptions
- `AdapterRegistry`, `ControllerRegistry`, `ServiceRegistry`
- `EventBus` with targeted listeners plus `onAny(...)`
- `RuntimeInspector` via `kernel.getInspector()`
- `BrowserFrameScheduler`

## Runtime phases

- `boot`
- `loading`
- `ready`
- `transition`
- `paused`
- `error`

## Usage

```ts
import { createKernel } from '@urk/core';
import { createLoadingAdapter, createPointerAdapter, createUiWidgetsAdapter } from '@urk/adapters';

const kernel = createKernel({
  services: {
    'ui:host': document.querySelector('#overlay-host'),
  },
  adapters: [
    createPointerAdapter(),
    createLoadingAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
kernel.pause();
kernel.resume();
await kernel.shutdown();
```

Controllers resolve capability APIs through `ctx.adapters.require(...)` and service dependencies through `ctx.services.require(...)`. The scheduler is kernel-owned, and shutdown is disposal rather than another runtime phase.

The runtime inspector exposes a bounded read-only view of:

- runtime phase and reason
- scheduler running state
- cumulative frame count
- registered adapters, controllers, and services
- recent emitted events with raw payloads preserved

Service values stay hidden in inspector snapshots. Only service names and safe kind summaries are exposed.

## Internal structure

The implementation now mirrors the canonical runtime layers:

- `src/kernel/`
- `src/runtime/`
- `src/events/`
- `src/adapters/`
- `src/controllers/`
- `src/scheduler/`

Root `src/*.ts` files stay as stable public re-export surfaces.

## Validation

This package is validated through type-check/build plus the private proof routes under `examples/`, including `/runtime-inspector/`.

## Architecture

See `/docs/ARCHITECTURE.md`
