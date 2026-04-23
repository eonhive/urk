# URK

**Universal Runtime Kernel**

URK is the **public, open-source runtime kernel** for interactive browser experiences.
It is web-first, standalone-first, adapter-based, controller-driven, and designed for scene/UI hybrid applications.

URK is intended to be:

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
- a random bag of runtime utilities

## Core boundary

URK owns:

- kernel lifecycle
- runtime context
- runtime state model
- adapter registry
- controller registry and lifecycle
- update/tick hooks
- event routing foundations
- shared service lookup
- generic capability adapters

URK does **not** own:

- Kivatar identity
- Kivatar packs or behavior identity rules
- product dashboards
- monetization systems
- host/personal avatar policy
- engine-grade simulation scope

## Architecture shape

The stable layer model is:

1. kernel layer
2. adapter layer
3. controller layer
4. state/runtime model layer
5. scene/experience layer
6. UI bridge layer
7. integration/wrapper layer

Adapters define capability contracts.
Controllers orchestrate runtime behavior.
State stays explicit.
Framework wrappers come later and must wrap the kernel rather than define it.

## Repo direction

```text
urk/
  packages/
    core/
    adapters/
    examples/
    react-urk/   # later
    next-urk/    # later
```

### `@urk/core`
Should hold:

- kernel bootstrap
- runtime context
- runtime state base
- controller registry
- adapter registry
- lifecycle hooks
- event bus foundation
- runtime guards and errors

### `@urk/adapters`
Should begin with contract-first adapters such as:

- threeAdapter
- pointerAdapter
- inputAdapter
- uiWidgetsAdapter
- loadingAdapter
- audioAdapter
- storageAdapter

### `@urk/examples`
Should appear early, not late.
The first examples should prove:

- minimal standalone runtime
- scene + UI coordination
- adapter registration
- controller orchestration
- pointer/input + overlay interaction

## MVP priorities

1. lock the URK boundary
2. define kernel contracts
3. define adapter contracts
4. define controller contracts
5. define runtime state model
6. build one strong proof example

## Deferred on purpose

Do not prioritize these early:

- plugin marketplace
- no-code runtime builder
- giant framework integration matrix
- heavy devtools suite before kernel stability
- speculative adapter explosion
- full engine-like simulation features

## Winning strategy

URK wins by being a sharp runtime kernel for interactive web experiences.
It does not win by trying to be a full engine, a framework replacement, and a universal everything-layer at the same time.
