# URK Canonical Doc Set

**Project:** URK — Universal Runtime Kernel  
**Purpose:** Define the final recommended canonical markdown structure for the URK repo.  
**Date:** 2026-04-10

---

## Recommended top-level canonical files

```text
urk/
  README.md
  docs/
    FOUNDATION.md
    BOUNDARY.md
    ARCHITECTURE.md
    DECISIONS.md
    IMPLEMENTATION_PLAN.md
    DEFERRED.md
    EXAMPLES.md
```

---

## File-by-file purpose

### `README.md`
What URK is, what it is not, why it exists, and how the repo is organized.

Use the current `URK_README.md` draft as the base.

### `docs/FOUNDATION.md`
The plainest statement of URK’s purpose and product philosophy.

Should include:
- web-first runtime kernel
- standalone-first
- adapter-based
- controller-driven
- explicit runtime state
- lighter than EnHive

This should be the shortest canonical explanation.

### `docs/BOUNDARY.md`
What URK owns and does not own.

Use the current `URK_BOUNDARY.md` draft as the direct base because it already captures:
- URK vs EnHive
- URK vs Kivatar
- architectural center of gravity
- scope red flags
- canonical implementation rule fileciteturn29file0 fileciteturn29file1

### `docs/ARCHITECTURE.md`
The implementation-facing architecture.

Should cover:
- kernel runtime context
- lifecycle
- explicit runtime states
- adapter registry
- controller lifecycle
- scene/UI bridge
- event routing foundations
- package direction

Use the current `URK_ARCHITECTURE.md` draft as the base.

### `docs/DECISIONS.md`
Short, stable design decisions.

Use the attached `URK_DECISIONS.md` as the base.

### `docs/IMPLEMENTATION_PLAN.md`
Concrete build order and module/file plan.

Use `URK_IMPLEMENTATION_TASKS.md` as the base.

### `docs/DEFERRED.md`
What URK is intentionally not doing yet.

Use the current `URK_DEFERRED.md` draft as the base.

### `docs/EXAMPLES.md`
Required examples and proof targets.

Should include:
- minimal standalone runtime
- scene + UI demo
- pointer + overlay demo
- controller orchestration demo
- adapter registration demo

This is important because examples are already part of the package direction. fileciteturn29file1

---

## Merge map from current draft files

### Keep and rename
- `URK_README.md` -> `README.md`
- `URK_BOUNDARY.md` -> `docs/BOUNDARY.md`
- `URK_ARCHITECTURE.md` -> `docs/ARCHITECTURE.md`
- `URK_IMPLEMENTATION_TASKS.md` -> `docs/IMPLEMENTATION_PLAN.md`
- `URK_DEFERRED.md` -> `docs/DEFERRED.md`
- `URK_DECISIONS.md` -> `docs/DECISIONS.md`

### Merge into `docs/FOUNDATION.md`
Pull the most compact foundational statements from:
- `URK_README.md`
- `URK_BOUNDARY.md`
- `URK_STATUS_UPDATE_2026-04-10.md`

### Optional archive/supporting drafts
- `URK_STATUS_UPDATE_2026-04-10.md`

This should not remain a permanent canonical file once the main docs are updated.

---

## Naming rules

Use simple, stable names:
- `BOUNDARY.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `IMPLEMENTATION_PLAN.md`
- `DEFERRED.md`

Avoid long names once the repo adopts the docs.

---

## Recommended order of doc finalization

1. `README.md`
2. `docs/BOUNDARY.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DECISIONS.md`
5. `docs/IMPLEMENTATION_PLAN.md`
6. `docs/DEFERRED.md`
7. `docs/EXAMPLES.md`

That order keeps scope and architecture stable before implementation detail expands.
