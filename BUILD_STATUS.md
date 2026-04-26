# Build Status

## Current state

Implemented: **URK v0 Contract-First Kernel Proof + React Wrapper Starter**

This repo now contains:

- `@urk/core` with `Kernel`, `Runtime` alias, explicit flat runtime phases, registries, service lookup, event bus, and scheduler abstraction
- `@urk/adapters` with seven reference adapters: `audio`, `pointer`, `input`, `storage`, `loading`, `three`, and `ui-widgets`
- `@urk/react-urk` with a thin provider/hooks wrapper for React consumers of an existing kernel instance
- `@urk/examples` with six standalone proofs:
  - DOM-first audio transport for staged loading, transport control, mute/volume, and lifecycle behavior
  - DOM + Three picking for scene/UI interaction
  - DOM-first loading/transition for phased runtime handoff
  - DOM-first app-shell for panel-state orchestration and lifecycle control
  - React wrapper starter for provider-based kernel consumption and runtime snapshot/event subscription
  - DOM-first scrollytelling for section and motion orchestration

## In this milestone

- standalone-first kernel proof
- Phase 4 started with `@urk/react-urk` as the first thin wrapper layer
- flat runtime phases: `boot`, `loading`, `ready`, `transition`, `paused`, `error`
- shutdown handled as disposal instead of another runtime phase
- controller-driven audio transport, loading, transition handoff, DOM + scene picking, keyboard input, Three scene sync, storage proof, DOM-first app-shell orchestration, React wrapper proof, and DOM-first scrollytelling orchestration
- browser-verified acceptance workflows for the existing five non-React example entries
- deterministic root scripts using explicit workspace sequencing

## Explicitly not implemented

- product logic or Kivatar-specific behavior
- Next wrappers or a broader wrapper matrix
- broad adapter matrix beyond the seven reference adapters
- automated browser testing
- broad test-framework buildout for this milestone
- drag interactions, gizmos, or scene-editor behavior

## Notes

- use `corepack yarn ...` from the repo root to ensure Yarn 3.8.7 is used
- `corepack yarn test` is intentionally manual-status only for this milestone
- the standalone proof acceptance flow lives in `packages/examples/README.md`
- browser acceptance completed on April 23, 2026 for the DOM-first audio transport proof in Brave
- browser acceptance completed on April 22, 2026 for the local DOM + Three proof and the DOM-first loading/transition proof in Brave
- browser acceptance completed on April 23, 2026 for the DOM-first app-shell proof in Brave
- browser acceptance completed on April 23, 2026 for the DOM-first scrollytelling proof in Brave
- the React wrapper starter implementation is landed, but dependency install and browser acceptance are still pending in this session because the required package-install approval was blocked before execution
- verified in-browser for audio: `loading -> ready`, monotonic staged progress, no autoplay at ready, pointer and keyboard track starts, play/pause toggle, mute/volume updates, stop/reset transport, overlay transport-state reflection, pause freeze with playback pause, resume restore, natural track completion handling, and shutdown disablement
- verified in-browser for picking: `loading` observed from `10%` through monotonic completion to `ready`, two DOM targets, two Three objects, DOM hover/select, scene hover/select through raycast, keyboard move/select/clear, local/session save-load-clear, pause freeze, resume restore, shutdown disablement, and duplicate-registration guards for `pointer` and `three`
- verified in-browser for loading/transition: `loading -> transition -> ready`, monotonic progress, visible transition veil, ready panel reveal, pause/resume freeze and restore, replay without refresh, and shutdown disablement
- verified in-browser for app-shell: `loading -> ready`, monotonic staged progress, pointer view switching, `1/2/3` view shortcuts, `B` sidebar toggle, `I` and `Escape` inspector control, overlay shell-state reflection, persisted layout restore after reload, reset-to-default layout, pause freeze with blocked mutation, resume restore, and shutdown disablement
- verified in-browser for scrollytelling: `loading -> ready`, monotonic staged progress, native internal scroll changing sections in order, pointer and keyboard section jumps, `ArrowDown` / `ArrowUp` section stepping, overlay section-state reflection, back-to-top navigation, pause freeze with blocked scroll/nav mutation, resume restore, and shutdown disablement
