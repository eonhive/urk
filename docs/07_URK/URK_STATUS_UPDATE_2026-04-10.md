# URK Status Update and Action Plan

**Project:** URK — Universal Runtime Kernel  
**Date:** 2026-04-10  
**Status:** Active architecture consolidation  
**Source basis:** current URK docs plus recent project discussion history

---

## 1. Current canonical direction

URK is the **public, open-source runtime kernel** for interactive browser experiences. It should remain:

- standalone-first
- adapter-based
- controller-driven
- web-first
- scene/UI-cohesive
- framework-friendly
- lightweight but real

URK is **not**:

- a full engine like EnHive
- just a state manager
- just a Three.js wrapper
- just a React library
- a random bag of utilities

This boundary is now important enough that it should be treated as a non-negotiable rule for docs, repo layout, and implementation.

---

## 2. Important changes / clarifications

### Change 1 — Boundary is now sharper
URK is now clearly the **runtime kernel**, while Kivatar is the **private product layer** built on top of it.

URK owns:

- lifecycle
- runtime state
- adapter registry
- controller lifecycle
- update loop
- event bus foundations
- generic adapters

Kivatar owns product-specific systems, not URK.

### Change 2 — The architecture shape is stable enough to formalize
The layer model is no longer vague. The current stable shape is:

1. kernel layer
2. adapter layer
3. controller layer
4. state/runtime model layer
5. scene/experience layer
6. UI bridge layer
7. integration/wrapper layer

### Change 3 — Adapters and controllers are the center of gravity
The docs already imply this, but it now needs to be enforced in implementation:

- **adapters** define capability contracts
- **controllers** own orchestration
- **state** stays explicit
- wrappers sit on top later

### Change 4 — URK should not overbuild early
The “what not to overbuild yet” rule is now a real execution rule, not just a note.

Do **not** expand too early into:

- giant framework ecosystems
- engine-grade simulation
- too many speculative adapters
- no-code systems
- plugin marketplaces
- massive tool suites before the kernel proves itself

### Change 5 — URK needs a stronger package and file plan
The direction is clear enough now that URK should stop living only as concept docs and move into a concrete package map and module plan.

---

## 3. Stable product boundary

## URK
Public open-source runtime kernel.

### Owns
- lifecycle
- bootstrap/runtime context
- adapter registration
- controller registration/lifecycle
- shared service lookup
- event routing foundations
- runtime state transitions
- update/tick hooks
- generic capability adapters

### Does not own
- Kivatar identity
- Kivatar packs
- monetization systems
- host/personal avatar policy
- product dashboards
- Kivatar behavior identity rules

---

## 4. Proposed repo/package structure

```text
urk/
  packages/
    core/
    adapters/
    examples/
    react-urk/          # later
    next-urk/           # later
```

### `@urk/core`
Should contain:

- kernel bootstrap
- runtime context
- state/runtime model base
- controller registry
- adapter registry
- lifecycle hooks
- event bus foundation
- error boundary/runtime guards

### `@urk/adapters`
Should contain contract-first adapters such as:

- threeAdapter
- pointerAdapter
- inputAdapter
- uiWidgetsAdapter
- loadingAdapter
- audioAdapter
- storageAdapter
- router/navigation adapter later

### `@urk/examples`
Should exist early, not late.

Need examples for:

- minimal standalone runtime
- scene + UI coordination demo
- adapter registration example
- controller orchestration example
- input + overlay example

### `react-urk` and `next-urk`
Later only.
They must wrap the kernel rather than define it.

---

## 5. What needs to get done next

## Priority 0 — lock the boundary
- Create one canonical `BOUNDARY.md` or `POSITIONING.md` for URK vs EnHive vs Kivatar.
- Remove any wording that makes URK sound like a mini engine or framework replacement.
- Make the public repo readme reflect the exact kernel scope.

## Priority 1 — define the kernel contracts
Need concrete TypeScript interfaces for:

- runtime context
- kernel lifecycle
- adapter registration
- controller registration
- shared services lookup
- runtime state machine / transition model
- update/tick hooks
- cleanup/disposal

## Priority 2 — define adapter contracts
Create adapter contract docs and starter interfaces for:

- `threeAdapter`
- `pointerAdapter`
- `inputAdapter`
- `uiWidgetsAdapter`
- `loadingAdapter`
- `audioAdapter`
- `storageAdapter`

Each adapter should document:

- capability provided
- required dependencies
- init/setup
- runtime hooks
- teardown
- error/fallback behavior

## Priority 3 — define controller contracts
Create controller contract docs and starter interfaces for:

- base controller lifecycle
- app shell controller
- loading controller
- interaction controller
- scene controller
- UI bridge controller

Need explicit rules for:

- what belongs in a controller
- what does **not** belong in a controller
- how controllers talk to adapters
- how controllers read/write runtime state

## Priority 4 — define runtime state model
Need a formal runtime state model.

Start with:

- boot
- loading
- ready
- transition
- error
- paused
- interactive modes

Need to decide:

- flat vs hierarchical state shape
- event-triggered transitions
- debug visibility
- state snapshot format

## Priority 5 — build one proof example
URK should prove itself with one strong example instead of many weak examples.

Best first example:

- standalone web runtime
- scene + overlay UI
- pointer interaction
- loading flow
- one controller orchestration path
- one adapter stack

This should be the demo that makes URK feel real.

---

## 6. Recommended file/module plan

```text
packages/core/src/
  kernel/
    createKernel.ts
    Kernel.ts
    kernel.types.ts
    lifecycle.ts
  runtime/
    runtimeContext.ts
    runtimeState.ts
    stateMachine.ts
  controllers/
    controller.types.ts
    controllerRegistry.ts
    BaseController.ts
  adapters/
    adapter.types.ts
    adapterRegistry.ts
  events/
    eventBus.ts
    event.types.ts
  services/
    serviceRegistry.ts
  debug/
    runtimeInspector.ts
  errors/
    runtimeErrors.ts
```

```text
packages/adapters/src/
  three/
  pointer/
  input/
  uiWidgets/
  loading/
  audio/
  storage/
```

---

## 7. Recommended documentation updates

Create or update these docs next:

- `README.md`
- `BOUNDARY.md`
- `ARCHITECTURE.md`
- `PACKAGE_MAP.md`
- `ADAPTER_CONTRACTS.md`
- `CONTROLLER_MODEL.md`
- `RUNTIME_STATE_MODEL.md`
- `MVP_SCOPE.md`
- `DEFERRED.md`

---

## 8. Deferred on purpose

These should **not** become early priorities:

- full plugin marketplace
- no-code runtime builder
- giant framework integration matrix
- advanced devtools suite before kernel stability
- many adapters without real usage proof
- full engine-like simulation features

---

## 9. Execution summary

URK is ready to move from “architecture draft” into “contract-first implementation planning.”

The next real win is **not** more abstract philosophy.
The next win is:

- locking the boundary
- writing kernel interfaces
- defining adapter contracts
- defining controller contracts
- building one strong example

That is the shortest path to making URK credible.
