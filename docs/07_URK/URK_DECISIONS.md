# URK Decisions

**Project:** URK — Universal Runtime Kernel  
**Status:** Canonical decisions draft  
**Date:** 2026-04-10

---

## Purpose

This file captures the most important current decisions for URK so implementation can stay aligned and boundary drift can be caught early.

---

## Decision 001 — URK is a runtime kernel, not a product shell

**Decision**  
URK is a **web-first runtime kernel** for interactive browser experiences.

**Why**  
The current canon consistently defines URK around:
- lifecycle
- explicit runtime state
- adapters
- controllers
- scene/UI coordination
- browser-oriented runtime orchestration

It should remain lighter than EnHive and separate from product shells. fileciteturn29file0

**Implication**  
Product identity, monetization, dashboards, avatar behavior, and other product-specific systems stay outside URK.

---

## Decision 002 — URK stays standalone-first and adapter-based

**Decision**  
URK must stay **standalone-first**, **adapter-based**, and **controller-driven**.

**Why**  
The architecture center of gravity is adapters + controllers + explicit runtime state. Wrappers come later and must wrap the kernel rather than redefine it. fileciteturn29file0 fileciteturn29file1

**Implication**  
Build `@urk/core`, `@urk/adapters`, and `@urk/examples` first. Framework wrappers such as React or Next stay deferred until the kernel is proven.

---

## Decision 003 — URK and EnHive are related but not the same thing

**Decision**  
Do not frame URK as a smaller EnHive clone.

**Why**  
The boundary doc makes the distinction explicit:
- EnHive = broader determinism-first engine/runtime platform
- URK = lighter web runtime/orchestration kernel for interactive browser experiences fileciteturn29file0

**Implication**  
Avoid copying EnHive scope, terminology, or ambitions into URK unless clearly necessary for the kernel.

---

## Decision 004 — URK and Kivatar must remain separated

**Decision**  
URK is the public/open runtime kernel. Kivatar is the private product layer built on top of it.

**Why**  
The current boundary is explicit:
- URK owns generic lifecycle/state/adapter/controller foundations
- Kivatar owns identity, behavior, memory policy, packs, guide system behavior, communication profiles, dashboard/workspace, and monetization/product systems fileciteturn29file0 fileciteturn29file2

**Implication**  
If a feature depends on Soul Seed, Kivatar identity, host/personal behavior, communication profiles, packs, or product UX, it belongs in Kivatar, not URK.

---

## Decision 005 — Explicit runtime state is mandatory

**Decision**  
URK must expose explicit runtime states and state transitions.

**Why**  
The architecture doc centers URK around visible runtime states such as boot, loading, ready, transition, error, paused, and interaction modes. fileciteturn29file0

**Implication**  
Do not hide core runtime status inside React component state, scattered flags, or ad hoc utilities.

---

## Decision 006 — Controllers orchestrate; adapters expose capability

**Decision**  
Keep the separation sharp:
- adapters expose capability surfaces
- controllers orchestrate runtime behavior using adapters and explicit state

**Why**  
This is the architectural center of gravity in the boundary doc, with examples such as pointer/input/ui/audio/storage adapters and runtime/application/loading/scene flow controllers. fileciteturn29file0

**Implication**  
Avoid mixing orchestration logic directly into adapters or dumping capability-specific code into a monolithic controller.

---

## Decision 007 — Wrappers are later, not first

**Decision**  
React/Next wrappers are deferred until after the kernel, adapter contracts, and examples are stable.

**Why**  
The package direction already marks `react-urk` and `next-urk` as later layers. fileciteturn29file1

**Implication**  
Do not let framework ergonomics redefine the kernel API too early.

---

## Decision 008 — Examples are part of the product proof

**Decision**  
URK must prove itself through examples, not only abstractions.

**Why**  
The package direction explicitly includes `@urk/examples` with minimal standalone runtime, scene + UI demo, pointer + overlay demo, controller orchestration demo, and adapter registration demo. fileciteturn29file1

**Implication**  
A sharp example is a required part of validating the kernel boundary and API shape.

---

## Decision 009 — Scope discipline is a first-class requirement

**Decision**  
URK should not become:
- a full engine like EnHive
- a framework replacement
- a product shell
- a utilities dump
- a no-code ecosystem first
- a business logic home

**Why**  
These are explicitly listed as boundary drift and red flags. fileciteturn29file0

**Implication**  
Every major change should be checked against the boundary before implementation.

---

## Decision 010 — Canonical doc checks happen before code expansion

**Decision**  
Before significant implementation work:
1. check shared foundations
2. check URK architecture doc
3. check URK master prompt
4. confirm the change still fits the kernel boundary
5. only then add/update code or docs

**Why**  
The canonical implementation rule in the boundary doc says exactly this. fileciteturn29file1

**Implication**  
URK should grow through canon-backed decisions, not drifting local experiments.
