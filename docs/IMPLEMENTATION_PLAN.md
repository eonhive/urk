# URK Implementation Plan

## Current package shape

- `packages/core` - publishable kernel runtime
- `packages/adapters` - publishable reference adapters
- `packages/react-urk` - publishable React wrapper
- `packages/next-urk` - publishable Next wrapper
- `examples` - private proof workspace
- `apps/next-proof` - private Next proof app

## Current architecture direction

- keep the kernel standalone-first
- keep adapters contract-first
- keep wrappers thin and downstream
- keep examples as the proof surface for developer understanding
- keep publishable npm artifacts limited to built library output

## Near-term maintenance rules

- new publishable code belongs under `packages/`
- new proof routes belong under `examples/` unless they require a real app shell
- new adapters should use `packages/adapters/src/<adapter>/`
- new core runtime code should follow the layered folders under `packages/core/src/`
- doc changes that affect onboarding should update the top-level docs first, not only `docs/07_URK/`
