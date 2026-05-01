# @urk/adapters

Contract-first capability adapters that prove URK's v0 kernel surface.

The root `@urk/adapters` entrypoint exports every reference adapter, including
the Three scene adapter. DOM-only consumers that do not need Three should import
from `@urk/adapters/dom`.

## Reference adapters

- `createAudioAdapter()` - manage browser-native audio transport across a small set of registered tracks
- `createPointerAdapter()` - bind DOM targets or pointer surfaces and emit normalized pointer events
- `createInputAdapter()` - normalize keyboard input, track pressed keys, and bind simple key handlers
- `createStorageAdapter()` - provide namespaced local/session key-value persistence with swappable backends
- `createLoadingAdapter()` - track staged progress with an observable loading snapshot
- `createThreeAdapter()` - mount a small Three scene surface onto a host element and expose render primitives
- `createUiWidgetsAdapter()` - mount a small overlay shell with status and callout surfaces

Each adapter now lives in its own source folder under `src/<adapter>/` with a local `README.md`
that documents:

- purpose
- required services
- public API
- the proof route that demonstrates it

## Usage

```ts
import { createKernel } from '@urk/core';
import {
  createAudioAdapter,
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
    createAudioAdapter(),
    createPointerAdapter(),
    createInputAdapter(),
    createStorageAdapter({ namespace: 'demo' }),
    createThreeAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
```

## DOM-only consumers

Use the `@urk/adapters/dom` subpath when a host only needs browser DOM
capabilities and should not consume the Three adapter surface:

```ts
import { createKernel } from '@urk/core';
import {
  createLoadingAdapter,
  createPointerAdapter,
  createUiWidgetsAdapter,
} from '@urk/adapters/dom';

const kernel = createKernel({
  services: {
    'ui:host': document.querySelector('#overlay-host'),
  },
  adapters: [
    createLoadingAdapter(),
    createPointerAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
```

This is the intended path for dependency-light DOM hosts such as Kivatar's
current host shell. The DOM subpath does not export `createThreeAdapter()`.

These adapters use the canonical `AdapterRegistration<TApi>` contract from `@urk/core`. They are intentionally small and exist to prove the kernel surface, not to introduce a broad adapter matrix early.

`createAudioAdapter()` is deliberately transport-first in this milestone:

- register a small set of browser-native media tracks
- preload them into `HTMLAudioElement` instances
- control playback through `play`, `pause`, `stop`, `setMuted`, and `setVolume`
- expose one observable transport snapshot plus `audio:changed`, `audio:ended`, and `audio:error`
- no Web Audio graph, spatial audio, playlist system, or mixer layer yet

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

This package is validated through type-check/build plus the private proof routes under `examples/`, including `/audio-proof/` and `/picking/`.

## Architecture

See `/docs/ARCHITECTURE.md`
