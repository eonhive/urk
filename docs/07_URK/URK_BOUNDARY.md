# URK Boundary

**Project:** URK — Universal Runtime Kernel  
**Status:** Canonical boundary draft  
**Date:** 2026-04-10

---

## 1. What URK is

URK is a **web-first runtime kernel** for interactive browser experiences.

It exists to coordinate:
- runtime lifecycle
- explicit runtime state
- adapter registration and capability lookup
- controller lifecycle and orchestration
- scene/UI coordination
- interactive browser-oriented runtime flows

URK should stay:
- standalone-first
- adapter-based
- controller-driven
- scene/UI-cohesive
- framework-friendly
- lighter than EnHive

---

## 2. What URK is not

URK is **not**:
- a full engine like EnHive
- a mini game engine clone
- just a state manager
- just a Three.js wrapper
- just a React library
- a random utilities package
- a framework replacement
- a product shell

If a feature starts pulling URK toward product logic, monetization, avatar identity, or ecosystem sprawl, it probably belongs outside URK.

---

## 3. What URK owns

URK owns the generic runtime foundation:

- kernel bootstrap
- startup/shutdown lifecycle
- runtime context creation
- runtime state model foundations
- controller registration and lifecycle
- adapter registration and capability contracts
- shared service lookup / dependency access
- update/tick hooks where needed
- event routing foundations
- scene/UI bridge foundations
- interactive runtime orchestration primitives
- examples that prove the kernel works

---

## 4. What URK does not own

URK does **not** own product-specific systems such as:

- Kivatar identity or Soul Seed logic
- Kivatar packs or avatar variants
- Kivatar monetization or product dashboards
- host/personal user policy systems
- product branding or premium package systems
- agent bridge product behavior
- creator economy logic
- marketplace logic
- deep simulation or full engine tooling

---

## 5. URK vs EnHive

### EnHive
Broader determinism-first engine/runtime platform.

### URK
Lighter web runtime/orchestration kernel for interactive browser experiences.

### Rule
Do not describe URK like a smaller EnHive clone.
Do not collapse the two concepts into one bucket.

---

## 6. URK vs Kivatar

### URK
Public open-source runtime kernel.

### Kivatar
Private product layer built on top of URK.

### URK owns
- runtime lifecycle
- adapter/controller model
- generic runtime state
- generic capability surfaces
- scene/UI synchronization foundations

### Kivatar owns
- identity system
- behavior system
- memory policy
- avatar packs and variants
- host/personal modes
- guide system product behavior
- communication profiles
- dashboard/workspace
- product shell and monetization

---

## 7. Architectural center of gravity

URK should revolve around **adapters + controllers + explicit runtime state**.

### Adapters
Adapters expose capabilities.

Examples:
- threeAdapter
- pointerAdapter
- inputAdapter
- uiWidgetsAdapter
- loadingAdapter
- audioAdapter
- storageAdapter

### Controllers
Controllers orchestrate runtime behavior using adapters and state.

Examples:
- app shell flow
- loading flow
- scene flow
- input mode transitions
- UI state reactions
- section / motion orchestration

### State
State must stay explicit and tied to runtime behavior.

Examples:
- boot
- loading
- ready
- transition
- error
- paused
- interaction modes

---

## 8. Package direction

```text
urk/
  packages/
    core/
    adapters/
    examples/
    react-urk/      # later
    next-urk/       # later
```

### `@urk/core`
- kernel
- runtime context
- controller registry
- adapter registry
- state model foundations
- event bus foundations
- lifecycle and teardown

### `@urk/adapters`
- adapter contracts
- default/reference implementations
- capability guardrails
- fallback patterns

### `@urk/examples`
- minimal standalone runtime
- scene + UI demo
- pointer + overlay demo
- controller orchestration demo
- adapter registration demo

### wrappers later
- `react-urk`
- `next-urk`

Wrappers must wrap the kernel, not redefine it.

---

## 9. MVP rule

URK wins by shipping a sharp kernel with:
- clear boundaries
- useful adapters
- useful controllers
- explicit runtime state
- strong examples

URK does **not** win by trying to be a universal everything-layer on day one.

---

## 10. Red flags

If a new idea sounds like one of these, stop and re-check scope:

- “URK should also own product identity”
- “URK should become the full visual engine”
- “URK should become a no-code ecosystem first”
- “URK should embed all business logic”
- “URK should replace framework app architecture entirely”

These are boundary drift signals.

---

## 11. Canonical implementation rule

Before implementation work:
1. check shared foundations
2. check URK architecture doc
3. check URK master prompt
4. make sure the change still fits the kernel boundary
5. only then add/update code or docs
