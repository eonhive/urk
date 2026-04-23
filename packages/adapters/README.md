# @urk/adapters

Contract-first capability adapters that prove URK's v0 kernel surface.

## Reference adapters

- `createPointerAdapter()` - bind DOM targets or pointer surfaces and emit normalized pointer events
- `createInputAdapter()` - normalize keyboard input, track pressed keys, and bind simple key handlers
- `createStorageAdapter()` - provide namespaced local/session key-value persistence with swappable backends
- `createLoadingAdapter()` - track staged progress with an observable loading snapshot
- `createThreeAdapter()` - mount a small Three scene surface onto a host element and expose render primitives
- `createUiWidgetsAdapter()` - mount a small overlay shell with status and callout surfaces

## Usage

```ts
import { createKernel } from '@urk/core';
import {
  createInputAdapter,
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
    createThreeAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
```

These adapters use the canonical `AdapterRegistration<TApi>` contract from `@urk/core`. They are intentionally small and exist to prove the kernel surface, not to introduce a broad adapter matrix early.

`createInputAdapter()` is deliberately keyboard-first in this milestone:

- pressed-key tracking through `isPressed(code)`
- key bindings through `bindKey(binding)`
- normalized keyboard event subscriptions through `subscribe(listener)`
- no named action map, gamepad support, text-entry model, or focus-management system yet

`createStorageAdapter()` is deliberately small in this milestone:

- local and session key-value access through one adapter capability
- namespaced keys so clear operations do not wipe unrelated browser storage
- optional `storage:local` and `storage:session` service overrides for swappable backends
- no IndexedDB, sync, cross-tab coordination, or product-facing save model yet

`createPointerAdapter()` now covers two small interaction paths:

- `bindTarget(...)` for DOM-target hover and select events
- `bindSurface(...)` for normalized scene-surface move, leave, and select events
- no drag model, press-and-hold semantics, or gesture layer yet

`createThreeAdapter()` is deliberately scene-surface-first in this milestone:

- requires a `three:host` `HTMLElement` service
- owns the `Scene`, `PerspectiveCamera`, `WebGLRenderer`, and mounted canvas
- keeps renderer and camera size in sync with the host element
- exposes `raycast(clientX, clientY, objects)` so controllers can own picking behavior
- does not own scene objects created by controllers
- does not own selection state, drag helpers, or its own render loop

## Validation

This package is validated for this milestone through type-check/build plus the standalone DOM + Three picking proof in `@urk/examples`.

## Architecture

See `/docs/07_URK/URK_ARCHITECTURE.md`
