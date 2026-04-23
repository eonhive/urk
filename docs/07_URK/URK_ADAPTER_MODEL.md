# URK_ADAPTER_MODEL

**Project:** URK  
**Version:** 0.1  
**Status:** Canonical Adapter Direction  
**Last Updated:** 2026-03-31

---

# 1. Purpose

This document defines URK’s adapter model.

Adapters are one of URK’s core structural ideas.
Without a clean adapter model, URK becomes either:

- random utility glue,
- hardcoded implementation soup,
- or just another thin wrapper library.

---

# 2. What an Adapter Is

An adapter is a modular subsystem integration layer that gives URK a capability through a defined contract.

Examples:

- rendering
- input
- pointer handling
- UI widgets
- loading/progress
- storage
- audio
- navigation/router behavior later

Adapters should expose capability, not chaos.

---

# 3. Why Adapters Matter

Adapters let URK:

- stay modular
- avoid hardcoding vendor/library specifics everywhere
- keep the kernel lighter
- support multiple implementation strategies
- remain extensible without losing structure

---

# 4. Core Adapter Principles

## 4.1 Explicit Capability

Every adapter should clearly define what it provides.

## 4.2 Clear Dependencies

An adapter should declare what other runtime pieces it needs.

## 4.3 Stable Contract

Controllers and kernel logic should rely on adapter contracts, not implementation quirks.

## 4.4 Clean Lifecycle

Adapters should support init, ready/use, and cleanup behavior.

## 4.5 Robust by Default

Adapters should be resilient and ergonomic, not fragile ceremony traps.

---

# 5. Suggested Adapter Contract Shape

An adapter should conceptually describe:

- adapter ID/name
- capability category
- initialization requirements
- provided API surface
- optional lifecycle hooks
- cleanup logic
- compatibility notes

The exact code API can evolve, but the design intent should remain.

---

# 6. Early Core Adapter Candidates

## 6.1 threeAdapter

Purpose:

- integrate Three.js or scene rendering context
- expose render/runtime scene hooks
- provide camera/scene access
- support object picking/raycast helpers later

Important note:
URK should support injected `THREE` and container references rather than relying on global assumptions.

---

## 6.2 pointerAdapter

Purpose:

- normalize pointer/touch/mouse interaction
- provide robust element fallback behavior
- improve cross-device interaction consistency

Important direction:
It should be robust enough to auto-apply common interaction-safety defaults where appropriate instead of forcing repetitive manual setup.

---

## 6.3 uiWidgetsAdapter

Purpose:

- bridge runtime state with modular UI widgets
- support overlays, toolbars, dialogs, windows, debug UI, and related presentation systems

This should remain optional and modular, not hardwired into the kernel.

---

## 6.4 loadingAdapter

Purpose:

- coordinate startup/loading/progress behavior
- support staged load experiences
- expose progress information to UI/controllers

Important direction:
Loading should support staged progress rather than only raw asset completion percentages.

---

## 6.5 audioAdapter

Purpose:

- abstract audio playback/control
- support runtime events and scene/UI-triggered sound behavior

---

## 6.6 storageAdapter

Purpose:

- support local/session/persistent data access
- keep storage implementation swappable

---

# 7. Adapter vs Controller Boundary

This boundary matters.

## Adapter

Provides capability.

Examples:

- rendering hooks
- pointer events
- widget APIs
- loading APIs

## Controller

Uses capabilities to orchestrate behavior.

Examples:

- boot flow controller
- transition controller
- globe scene controller
- landing page scroll controller
- menu interaction controller

Adapters provide tools.
Controllers use them.

---

# 8. Adapter Registration Direction

The kernel should allow adapters to be:

- registered explicitly
- discovered through config/runtime composition
- initialized in a known order
- queried by capability or ID where appropriate

Do not make adapter wiring magical and impossible to reason about.

---

# 9. Hot-Swap / Replaceability Direction

Not every adapter must be hot-swappable at runtime.

But the architecture should support:

- implementation replacement
- environment-specific adapters
- project-specific adapter combinations
- future testing mocks/fakes

That is enough for the early product.

---

# 10. What Not to Do

Do not let adapters become:

- giant kitchen-sink singletons
- branding names for random helpers
- hidden dependencies with no contracts
- impossible-to-replace hardcoded integrations
- pseudo-plugin chaos

That would kill URK’s architecture fast.

---

# 11. Summary

URK adapters should be:

- explicit
- capability-based
- lifecycle-aware
- replaceable where practical
- and clean enough that controllers and experiences can rely on them without coupling the whole system to one implementation.

