# URK Architecture

## Assumptions

This document assumes:

- URK remains lighter than EnHive
- URK is public/open-source
- standalone-first is a non-negotiable rule
- adapters and controllers are the main architectural pillars
- framework wrappers are downstream integrations, not the source of truth

## Canonical layering

### 1. Kernel layer
Owns the runtime shell itself.

Responsibilities:

- bootstrap
- startup/shutdown lifecycle
- runtime context creation
- update/tick loop
- disposal
- error boundaries / guards

Typical files:

```text
packages/core/src/kernel/
  createKernel.ts
  Kernel.ts
  kernel.types.ts
  lifecycle.ts
```

### 2. Adapter layer
Owns capability contracts.

Responsibilities:

- define external/system capabilities
- expose stable init/runtime/teardown semantics
- isolate implementation details
- support fallback/error behavior

Adapter candidates:

- threeAdapter
- pointerAdapter
- inputAdapter
- uiWidgetsAdapter
- loadingAdapter
- audioAdapter
- storageAdapter

Typical files:

```text
packages/core/src/adapters/
  adapter.types.ts
  adapterRegistry.ts

packages/adapters/src/
  three/
  pointer/
  input/
  uiWidgets/
  loading/
  audio/
  storage/
```

### 3. Controller layer
Owns orchestration.

Responsibilities:

- coordinate between adapters
- read/write runtime state
- respond to events
- drive runtime flows
- contain feature-specific orchestration logic

Controllers should not become generic dumping grounds for unrelated business logic.

Typical files:

```text
packages/core/src/controllers/
  controller.types.ts
  controllerRegistry.ts
  BaseController.ts
```

### 4. State/runtime model layer
Owns explicit runtime state.

Responsibilities:

- formal state definitions
- transitions
- snapshot model
- debug visibility
- event-triggered state updates

Start with:

- boot
- loading
- ready
- transition
- paused
- error
- interactive sub-modes later

Typical files:

```text
packages/core/src/runtime/
  runtimeContext.ts
  runtimeState.ts
  stateMachine.ts
```

### 5. Scene/experience layer
Owns concrete experience composition.

Responsibilities:

- scene lifecycle composition
- experience-level orchestration
- interaction surface coordination

This is where URK proves it can coordinate real web experiences rather than just hold abstractions.

### 6. UI bridge layer
Owns scene/UI linkage.

Responsibilities:

- overlays
- loading UI
- modals/panels
- cross-surface synchronization
- pointer/UI feedback linkage

This layer exists because URK is explicitly scene/UI-cohesive rather than scene-only or UI-only.

### 7. Integration/wrapper layer
Owns outer framework compatibility.

Examples:

- react-urk
- next-urk

Rule:
These wrappers must wrap the kernel.
They must not define the kernel architecture.

## Controller rules

Controllers should:

- orchestrate
- subscribe/react to runtime state and events
- talk to adapters through contracts
- keep feature flows understandable

Controllers should not:

- become unstructured service blobs
- replace the runtime state model
- own raw library-specific implementation detail that belongs in adapters
- hide critical transitions from debug visibility

## Adapter rules

Each adapter contract should document:

- capability provided
- required dependencies
- initialization requirements
- runtime hooks
- teardown behavior
- fallback/error behavior

## Example-first proof

URK should prove itself with **one strong example** before broad ecosystem expansion.

Best first proof:

- standalone web runtime
- one scene + overlay UI flow
- pointer interaction
- loading flow
- one controller orchestration path
- one adapter stack

## Non-goals for early architecture

- full engine simulation stack
- giant plugin architecture
- broad framework-first design
- advanced editor/devtools suite before kernel stability
- large speculative adapter matrix
