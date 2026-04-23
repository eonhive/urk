# URK Boundary

## Purpose

URK is a **web-first runtime kernel** for interactive browser experiences.

It coordinates:
- lifecycle
- explicit runtime state
- adapter registration and capability lookup
- controller lifecycle and orchestration
- scene/UI coordination
- interactive browser-oriented runtime flows

URK should remain:
- standalone-first
- adapter-based
- controller-driven
- scene/UI-cohesive
- framework-friendly
- lighter than EnHive fileciteturn30file0

## What URK owns

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

## What URK does not own

URK does **not** own product-specific systems such as:
- Kivatar identity or Soul Seed logic
- Kivatar packs or avatar variants
- Kivatar monetization or dashboards
- host/personal user policy systems
- product branding or premium package systems
- guide-system product behavior
- deep simulation or engine tooling

## URK vs EnHive

### EnHive
Broader determinism-first engine/runtime platform.

### URK
Lighter web runtime/orchestration kernel for interactive browser experiences.

### Rule
Do not describe URK like a smaller EnHive clone. Do not collapse the two into one bucket.

## URK vs Kivatar

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

## Architectural center of gravity

URK should revolve around **adapters + controllers + explicit runtime state**.

### Adapters
Expose capabilities such as:
- threeAdapter
- pointerAdapter
- inputAdapter
- uiWidgetsAdapter
- loadingAdapter
- audioAdapter
- storageAdapter

### Controllers
Orchestrate runtime behavior using adapters and state.

### State
Must stay explicit and tied to runtime behavior.

## Red flags

Treat these as boundary violations unless documented otherwise:
- product-specific business logic moving into URK
- avatar identity logic in URK core
- dashboard/admin behavior in kernel packages
- wrappers redefining kernel architecture
- framework-first implementation that undermines standalone-first
