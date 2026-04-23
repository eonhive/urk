# Build Status

## Current state

Implemented: **URK v0 Contract-First Kernel Proof**

This repo now contains:

- `@urk/core` with `Kernel`, `Runtime` alias, explicit flat runtime phases, registries, service lookup, event bus, and scheduler abstraction
- `@urk/adapters` with six reference adapters: `pointer`, `input`, `storage`, `loading`, `three`, and `ui-widgets`
- `@urk/examples` with four standalone proofs:
  - DOM + Three picking for scene/UI interaction
  - DOM-first loading/transition for phased runtime handoff
  - DOM-first app-shell for panel-state orchestration and lifecycle control
  - DOM-first scrollytelling for section and motion orchestration

## In this milestone

- standalone-first kernel proof
- flat runtime phases: `boot`, `loading`, `ready`, `transition`, `paused`, `error`
- shutdown handled as disposal instead of another runtime phase
- controller-driven loading, transition handoff, DOM + scene picking, keyboard input, Three scene sync, storage proof, DOM-first app-shell orchestration, and DOM-first scrollytelling orchestration
- browser-verified acceptance workflows for all four example entries
- deterministic root scripts using explicit workspace sequencing

## Explicitly not implemented

- product logic or Kivatar-specific behavior
- React or Next wrappers
- broad adapter matrix beyond the six reference adapters
- automated browser testing
- broad test-framework buildout for this milestone
- drag interactions, gizmos, or scene-editor behavior

## Notes

- use `corepack yarn ...` from the repo root to ensure Yarn 3.8.7 is used
- `corepack yarn test` is intentionally manual-status only for this milestone
- the standalone proof acceptance flow lives in `packages/examples/README.md`
- browser acceptance completed on April 22, 2026 for the local DOM + Three proof and the DOM-first loading/transition proof in Brave
- browser acceptance completed on April 23, 2026 for the DOM-first app-shell proof in Brave
- browser acceptance completed on April 23, 2026 for the DOM-first scrollytelling proof in Brave
- verified in-browser for picking: `loading` observed from `10%` through monotonic completion to `ready`, two DOM targets, two Three objects, DOM hover/select, scene hover/select through raycast, keyboard move/select/clear, local/session save-load-clear, pause freeze, resume restore, shutdown disablement, and duplicate-registration guards for `pointer` and `three`
- verified in-browser for loading/transition: `loading -> transition -> ready`, monotonic progress, visible transition veil, ready panel reveal, pause/resume freeze and restore, replay without refresh, and shutdown disablement
- verified in-browser for app-shell: `loading -> ready`, monotonic staged progress, pointer view switching, `1/2/3` view shortcuts, `B` sidebar toggle, `I` and `Escape` inspector control, overlay shell-state reflection, persisted layout restore after reload, reset-to-default layout, pause freeze with blocked mutation, resume restore, and shutdown disablement
- verified in-browser for scrollytelling: `loading -> ready`, monotonic staged progress, native internal scroll changing sections in order, pointer and keyboard section jumps, `ArrowDown` / `ArrowUp` section stepping, overlay section-state reflection, back-to-top navigation, pause freeze with blocked scroll/nav mutation, resume restore, and shutdown disablement
