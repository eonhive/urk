# URK_MASTER_PROMPT

Use this as the canonical context prompt whenever generating plans, code guidance, architecture, examples, or implementation strategy for URK.

---

You are working on **URK**, which stands for **Universal Runtime Kernel**, under **EonHive**.

## Canonical identity
URK is a web-first runtime and orchestration layer for interactive browser experiences, motion systems, UI/scene hybrids, and lightweight real-time web apps.

URK is not:
- a full engine like EnHive
- just a state manager
- just a Three.js wrapper
- just a React library
- or a random set of runtime utilities

---

## Core direction
URK should be:
- standalone-first
- adapter-based
- controller-driven
- web-first
- framework-friendly
- scene/UI-cohesive
- lightweight but real

The product must stay architecturally serious without drifting into full-engine scope.

---

## Product boundary
Keep the distinction clear:

- **URK** = lighter runtime kernel for interactive web experiences
- **EnHive** = broader determinism-first engine platform

Do not collapse URK into EnHive or describe it like a small engine clone.

---

## Architecture expectations
Prefer layers such as:
- kernel layer
- adapter layer
- controller layer
- state/runtime model layer
- scene/experience layer
- UI bridge layer
- integration/wrapper layer

Adapters are a core pillar.
Controllers are the main orchestration unit.

---

## Adapter expectations
Adapters should define clear capability contracts for things like:
- rendering
- pointer/input
- UI widgets
- loading/progress
- storage
- audio

Do not hardcode the whole product around one library or one implementation detail.

---

## Framework expectations
URK should work standalone first.
Framework wrappers such as react-urk are valid later, but must wrap the kernel rather than define it.

---

## Product strategy reminder
The first real wins are:
- kernel quality
- adapter quality
- controller usefulness
- scene/UI orchestration
- strong interactive web examples

Do not overbuild giant ecosystem sprawl too early.

---

## Constraints
- be blunt about scope
- keep URK lighter than EnHive
- preserve standalone-first architecture
- keep adapter and controller roles clear
- prefer implementation-ready structure
- avoid random naming drift
- do not turn URK into “yet another global store”

---

## Output expectations
When responding:
1. state assumptions
2. separate MVP vs later
3. keep URK/EnHive boundary clear
4. list planned files/modules before implementation work
5. protect adapter/controller architecture
6. call out what should be deferred
7. avoid vague hype language

---

## Important reminder
URK wins by being a sharp runtime kernel for interactive web experiences.

It does **not** win by pretending to be a full engine, a framework replacement, and a universal everything-layer at the same time.