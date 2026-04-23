# URK_ARCHITECTURE

**Project:** URK  
**Version:** 0.1  
**Status:** Working Architecture Draft  
**Last Updated:** 2026-03-31

---

# 1. Architecture Goal

URK should be architected as a modular web runtime kernel that coordinates application state, runtime flows, adapters, controllers, and interactive experiences without becoming a full engine or a tangled framework-dependent blob.

The architecture should support:

- standalone runtime use
- adapter-based subsystem integration
- controller-driven orchestration
- scene/UI synchronization
- framework integration later
- reusable runtime patterns

---

# 2. Core Architecture Shape

URK should be understood in these main layers:

## 2.1 Kernel Layer

The central runtime core.

Responsibilities:

- lifecycle
- bootstrap
- app/runtime context
- registration of adapters/controllers
- orchestration loop
- event routing foundations
- state transition control where appropriate

## 2.2 Adapter Layer

Subsystem integration contracts.

Examples:

- threeAdapter
- pointerAdapter
- uiWidgetsAdapter
- loadingAdapter
- audioAdapter
- inputAdapter
- storageAdapter
- router/navigation adapter later

Adapters should expose capabilities cleanly.

## 2.3 Controller Layer

Behavior orchestration layer.

Controllers should:

- coordinate flows
- react to runtime state
- invoke adapters
- manage feature logic
- bridge scene and UI behavior
- avoid dumping orchestration inside random components

## 2.4 State / Runtime Model Layer

Represents runtime states, transitions, and shared app/session context.

Examples:

- app states
- scene states
- loading states
- interaction modes
- view modes
- transition states

This must remain explicit.

## 2.5 Scene / Experience Layer

Holds scene-level logic for interactive visuals and runtime presentation.

Examples:

- Three.js scene orchestration
- camera logic
- object selection/picking
- scene transitions
- timeline/motion coordination

## 2.6 UI Bridge Layer

Coordinates runtime logic with UI systems.

Examples:

- HUD state
- overlays
- loading bars
- modals
- debug panels
- widget systems

## 2.7 Integration Layer

Later wrappers/bindings for frameworks or products.

Examples:

- react-urk
- next-urk helpers
- CMS/content integrations later
- EonHive product bridges later

---

# 3. Core Architectural Principles

## 3.1 Standalone First

URK must work well without React or any one framework.

## 3.2 Adapter-Based

Subsystems should plug in through explicit contracts.

## 3.3 Controller-Oriented

Controllers should own orchestration logic rather than scattering it everywhere.

## 3.4 Scene + UI Cohesion

URK should help scenes and UI act like one system.

## 3.5 Lightweight but Real

URK should remain lighter than a full engine, but still architecturally serious.

## 3.6 Framework-Compatible

Framework wrappers should sit on top, not define the core.

---

# 4. Kernel Direction

The kernel should manage:

- startup/shutdown
- adapter registration
- controller lifecycle
- runtime context creation
- shared service lookup
- update/tick or frame hooks where needed
- runtime mode/state transitions

The kernel should remain small and disciplined.

---

# 5. Adapter Direction

Adapters are a core product differentiator.

Each adapter should define:

- what capability it provides
- what dependencies it needs
- how it initializes
- what runtime hooks it exposes
- what cleanup it requires

Examples:

- rendering adapters
- pointer/input adapters
- UI adapters
- loading/progress adapters
- storage adapters
- audio adapters

Adapters should be swappable where practical and robust by design.

---

# 6. Controller Direction

Controllers are the orchestration layer.

A controller may manage:

- app shell flow
- loading flow
- scene orchestration
- page transition logic
- input mode changes
- camera behavior
- UI state reactions
- section/scroll-driven animation logic

Controllers should not become giant god-objects.
But they should exist as clear orchestration units.

---

# 7. State Direction

URK needs more than a dumb global store.

It should support explicit runtime states such as:

- boot
- loading
- ready
- transition
- error
- paused
- interactive modes

Different experiences may define more detailed sub-states.

The important thing is that state remains structured and tied to runtime orchestration.

---

# 8. Scene / Render Bridge Direction

URK should support interactive visual scenes cleanly, especially through adapters like threeAdapter.

This means:

- render context integration
- scene lifecycle handling
- picking/raycast support
- camera coordination
- scene-driven state transitions
- UI overlays linked to scene behavior

URK should help unify these instead of leaving each project to improvise.

---

# 9. Framework Integration Direction

React or other framework integrations should be wrappers around URK, not the core itself.

This allows:

- standalone use
- smaller runtime core
- wider adoption
- cleaner architecture

Examples later:

- react-urk hooks/providers
- Next.js integration helpers
- view bindings for common runtime state

---

# 10. What Not to Overbuild Yet

Do not overbuild immediately:

- giant framework ecosystems
- full engine-grade scene simulation
- too many adapters with no usage proof
- no-code systems
- abstract plugin marketplaces
- massive devtool suites before the core is solid

The first win is a clean, useful, adapter-based runtime kernel.

---

# 11. Summary

The right URK architecture is:

- standalone-first
- adapter-based
- controller-driven
- scene/UI-cohesive
- web-first
- framework-friendly
- and disciplined enough to stay lighter than a full engine while still solving real orchestration problems.

