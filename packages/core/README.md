# @urk/core

Kernel bootstrap, runtime lifecycle, explicit phase state, registries, service lookup, and event routing.

## Public API

- `Kernel` - canonical kernel entrypoint
- `Runtime` - compatibility alias for `Kernel`
- `createKernel(config?)` - factory helper
- `RuntimeStore` - explicit phase store with subscriptions
- `AdapterRegistry`, `ControllerRegistry`, `ServiceRegistry`
- `EventBus`
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

## Validation

This package is manually validated for this milestone through type-check/build plus the standalone DOM proof in `@urk/examples`.

## Architecture

See `/docs/07_URK/URK_ARCHITECTURE.md`
