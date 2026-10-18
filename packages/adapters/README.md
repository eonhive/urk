# @urk/adapters

Contract-first capability adapters for URK's runtime kernel.

The root `@urk/adapters` entrypoint exports the base reference adapters, including
the Three scene adapter. Import individual adapters to avoid loading unrelated
implementations, or retain `@urk/adapters/dom` for the existing DOM composite.

Adapters and core are versioned `0.2.0`, with a `^0.2.0` core peer.
The manifests describe this implementation; validation does not publish it.

Built-in DOM listeners, loading subscriptions, UI roots, audio elements/preload
listeners, and Three renderer/canvas/resize resources now use component scopes.
Cleanup is registered during acquisition so failures before API publication also
release resources. Borrowed host elements and storage backends survive shutdown.
Audio preload observes cancellation; retained pointer/input/audio APIs reject new
subscription or binding acquisitions after disposal. Legacy custom disposers remain
supported, but migrated built-ins no longer duplicate scoped cleanup in a disposer.

## Independent entrypoints and tokens

| Import | Factory | Canonical token |
| --- | --- | --- |
| `@urk/adapters/motion` | `createMotionAdapter` | `MotionCapability` |
| `@urk/adapters/video` | `createVideoAdapter` | `VideoCapability` |
| `@urk/adapters/audio` | `createAudioAdapter` | `AudioCapability` |
| `@urk/adapters/audio/mixer` | `createAudioMixerAdapter` | `AudioMixerCapability` |
| `@urk/adapters/input` | `createInputAdapter` | `InputCapability` |
| `@urk/adapters/loading` | `createLoadingAdapter` | `LoadingCapability` |
| `@urk/adapters/pointer` | `createPointerAdapter` | `PointerCapability` |
| `@urk/adapters/storage` | `createStorageAdapter` | `StorageCapability` |
| `@urk/adapters/three` | `createThreeAdapter` | `ThreeCapability` |
| `@urk/adapters/ui-overlay` | `createUiOverlayAdapter` | `UiOverlayCapability` |
| `@urk/adapters/ui-widgets` | `createUiWidgetsAdapter` | `UiWidgetsCapability` |

Prefer `ui-overlay` for status, callouts, and owned nonmodal panels. `ui-widgets` remains a
compatibility path: both factories and tokens are identical objects, also shared
by root/DOM exports. `UiOverlayAdapterApi` and `UiOverlayCallout` alias the existing
types. Default ID `ui-widgets-adapter`, string capability `ui-widgets`, and token
label remain stable; the new name does not add a string lookup alias. Register
only one of the two factories. This is a small DOM overlay, independent of the
Three.js adapter, with no generic UI or rendering framework.

The optional audio mixer is available only through `@urk/adapters/audio/mixer`, keeping
its grouping/fade layer out of base imports. See [audio usage](src/audio/README.md).

Each entrypoint exports its existing API types and one canonical token. Factories
bind that token alongside their existing ID and string capability. Root, DOM,
and individual re-exports of the same adapter share its token identity.

The non-Three entrypoints and the DOM composite work without `three` or
`@types/three` installed. The root and `three` entrypoints still require the
optional Three.js peer; TypeScript consumers of those entrypoints also need
`@types/three`. The DOM composite retains loading, input, pointer, storage,
UI overlays, and motion; audio and video are available through their own entrypoints or the root.

Module imports and factory calls acquire no browser resources. Factories retain
their signatures and return inert registrations; setup/API calls acquire resources
when the host runs them. No package-wide `sideEffects` optimization or bundle-size
claim is introduced.

```ts
import { createKernel } from '@urk/core';
import { createLoadingAdapter, LoadingCapability } from '@urk/adapters/loading';

const kernel = createKernel({ adapters: [createLoadingAdapter()] });
await kernel.boot();
const loading = kernel.getContext().adapters.require(LoadingCapability);
loading.begin([{ id: 'assets', label: 'Assets' }]);
// Existing callers can still use require<LoadingAdapterApi>('loading').
await kernel.shutdown();
```

Import the canonical token instead of recreating it by name. Names do not define
identity; independent adapter copies can produce distinct tokens too. Token
dependencies still require prior publication in sequential configuration order.

For custom multiple-instance registrations that already remap capability strings,
omit the canonical binding with `token: undefined`, or replace it with your own
exported `token<Api>(...)`. Remapping only IDs/capability strings leaves the
canonical binding intact and a second provider rejects. For example:

```ts
const secondary = {
  ...createLoadingAdapter('secondary'),
  capability: 'secondary-loading',
  token: undefined,
};
```

Token-free custom registrations and generic string lookups remain supported.

## Reference adapters

- `createMotionAdapter()` - scoped finite DOM animations and numeric tweens with playback handles, cancellation, and reduced motion; see [motion usage](src/motion/README.md)
- `createVideoAdapter()` - independent native video handles, borrowed ownership, captions, and cancellable playback; see [video usage](src/video/README.md)

- `createAudioAdapter()` - manage browser-native audio transport with optional waveform, spectrum, RMS, and band analysis
- `createPointerAdapter()` - bind DOM targets or pointer surfaces and emit normalized pointer events
- `createInputAdapter()` - normalize keyboard input, track pressed keys, and bind simple key handlers
- `createStorageAdapter()` - provide namespaced local/session key-value persistence with swappable backends
- `createLoadingAdapter()` - track staged progress with an observable loading snapshot
- `createThreeAdapter()` - mount a small Three scene surface onto a host element and expose render primitives
- `createUiOverlayAdapter()` - mount status, callouts, and managed nonmodal panels (`createUiWidgetsAdapter` remains compatible).

See the [UI Overlay usage and cleanup contract](src/ui-widgets/README.md).

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
  createUiOverlayAdapter,
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
    createUiOverlayAdapter(),
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
  createUiOverlayAdapter,
} from '@urk/adapters/dom';

const kernel = createKernel({
  services: {
    'ui:host': document.querySelector('#overlay-host'),
  },
  adapters: [
    createLoadingAdapter(),
    createPointerAdapter(),
    createUiOverlayAdapter(),
  ],
});

await kernel.boot();
```

This remains a dependency-light path for DOM hosts such as Kivatar's current
host shell. The DOM subpath does not export `createThreeAdapter()` or
`createAudioAdapter()`; use the audio entrypoint when needed.

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

Build core first, then run `corepack yarn workspace @urk/adapters test`. This
builds adapters, checks public declarations without monorepo aliases, and runs
contract and isolated packed-package tests. The packed DOM-only fixture has no
Three.js or Three type definitions; a separate runtime pass copies the existing
local Three peer to verify root/Three compatibility without a network install.
The private proof routes under `examples/`, including `/audio-proof/` and
`/picking/`, provide additional integration surfaces. See
[validation evidence](../../docs/VALIDATION.md) for actual results and limits.

## Architecture

See `/docs/ARCHITECTURE.md`
