# URK Implementation Tasks

**Project:** URK  
**Status:** execution-facing task draft  
**Date:** 2026-04-10

---

## 1. Immediate goal

Turn URK from a strong architecture idea into a **credible working kernel** with clean contracts and small but real examples.

---

## 2. Priority order

### Priority 0 — lock the docs
- add `README.md`
- add `BOUNDARY.md`
- add `ARCHITECTURE.md`
- add `DECISIONS.md`
- make scope language consistent everywhere

### Priority 1 — define kernel contracts
Create TypeScript interfaces for:
- `RuntimeContext`
- `KernelConfig`
- `KernelLifecycle`
- `ControllerRegistration`
- `AdapterRegistration`
- `RuntimeState`
- `ServiceRegistry`
- `DisposeHandle`

### Priority 2 — define base runtime states
Create explicit states such as:
- `boot`
- `loading`
- `ready`
- `transition`
- `paused`
- `error`

### Priority 3 — define adapter contracts
Starter contracts for:
- `threeAdapter`
- `pointerAdapter`
- `inputAdapter`
- `uiWidgetsAdapter`
- `loadingAdapter`
- `audioAdapter`
- `storageAdapter`

Each contract should define:
- capability provided
- init/setup
- runtime hooks
- teardown
- fallback/error behavior

### Priority 4 — define controller contracts
Create a base controller interface and a small first controller set:
- `BaseController`
- `AppShellController`
- `LoadingController`
- `InteractionController`
- `SceneController`
- `UiBridgeController`

### Priority 5 — ship examples early
Need examples for:
- minimal standalone runtime
- scene + UI sync demo
- hover/select + callout demo
- loading state demo
- adapter swap demo

---

## 3. Proposed file plan

```text
packages/
  core/
    src/
      kernel/
        createKernel.ts
        Kernel.ts
        lifecycle.ts
      runtime/
        RuntimeContext.ts
        RuntimeState.ts
        ServiceRegistry.ts
      controllers/
        BaseController.ts
        ControllerRegistry.ts
      adapters/
        AdapterRegistry.ts
        AdapterContract.ts
      events/
        EventBus.ts
      errors/
        RuntimeError.ts
        guards.ts
  adapters/
    src/
      pointer/
      input/
      ui-widgets/
      loading/
      audio/
      storage/
      three/
  examples/
    minimal-runtime/
    scene-ui-sync/
    hover-callout/
    loading-flow/
```

---

## 4. What to defer

Do **not** prioritize yet:
- broad framework wrappers
- plugin marketplaces
- giant devtool suites
- no-code editors
- many speculative adapters
- full engine-grade simulation
- complex CMS/content systems

---

## 5. First implementation checkpoint

URK v0 should be considered credible when it can do all of these:

- boot and shut down cleanly
- register adapters and controllers
- expose runtime context cleanly
- move through explicit runtime states
- coordinate one scene + one UI overlay flow
- handle input/pointer interaction through adapters
- demonstrate this in small examples without framework lock-in

---

## 6. Practical next actions

### This week
- finalize docs boundary language
- define interfaces for kernel, adapters, controllers, runtime state
- decide package names and folder structure

### Next step after that
- implement `@urk/core`
- implement minimal pointer + uiWidgets adapters
- implement one example proving scene/UI orchestration

### Then
- add `threeAdapter`
- add loading flow
- add wrapper strategy docs for React/Next later
