# URK Architecture

## Assumptions

This document assumes:
- URK remains lighter than EnHive
- URK is public/open-source
- standalone-first is non-negotiable
- adapters and controllers are the main architectural pillars
- framework wrappers are downstream integrations, not the source of truth fileciteturn30file0

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

### 6. UI bridge layer
Owns scene/UI linkage.

Responsibilities:
- overlays
- loading UI
- modals/panels
- cross-surface synchronization
- pointer/UI feedback linkage

### 7. Integration/wrapper layer
Owns outer framework compatibility.

Examples:
- react-urk
- next-urk

Rule: wrappers must wrap the kernel. They must not define the kernel architecture. fileciteturn30file8

## First proof target

URK should prove itself with one strong example instead of many weak examples:
- standalone web runtime
- scene + overlay UI
- pointer interaction
- loading flow
- one controller orchestration path
- one adapter stack fileciteturn30file8

## Immediate implementation focus

1. runtime context and lifecycle contracts
2. adapter and controller registries
3. explicit runtime state model
4. one strong example app
