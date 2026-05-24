# URK Implementation Plan

## Current package shape

- `packages/core` - publishable kernel runtime
- `packages/adapters` - publishable reference adapters
- `packages/examples` - private, internal, unstable runtime examples consumed by the public website
- `packages/cli` - publishable developer tooling for URK projects and proofs
- `packages/react-urk` - publishable React wrapper
- `packages/next-urk` - publishable Next wrapper
- `apps/www` - public Astro/Starlight website, docs, package pages, examples, and runtime demo shells
- `examples` - private proof workspace
- `apps/next-proof` - private Next proof app

## Current architecture direction

- keep the kernel standalone-first
- keep adapters contract-first
- keep wrappers thin and downstream
- keep examples as the proof surface for developer understanding
- keep `packages/cli` limited to source-based scaffolding, mutation, and inspection
- keep `packages/cli` outside runtime architecture; it is developer tooling, not kernel ownership
- keep `apps/www` responsible for static public content and presentation
- keep URK responsible for runtime-first website surfaces such as demos, examples, playgrounds, and interactive docs islands
- keep publishable npm artifacts limited to built library output
- keep `@urk/examples` private until its catalog and mount contract are intentionally promoted

## Near-term maintenance rules

- new publishable runtime or tooling code belongs under `packages/`
- public website content belongs under `apps/www`
- public website-consumed runtime examples belong under `packages/examples`
- private proof routes belong under `examples/` unless they require a real app shell
- new adapters should use `packages/adapters/src/<adapter>/`
- new core runtime code should follow the layered folders under `packages/core/src/`
- runtime packages must not import `packages/cli`
- doc changes that affect onboarding should update the top-level docs first, not only `docs/07_URK/`
- public website architecture should stay aligned with `docs/PUBLIC_SITE_PLAN.md`
- package manager state should stay on Node 22 with Yarn `nodeLinker: node-modules`
- Yarn cache archives remain tracked; generated `.astro/`, `dist/`, `.next/`, and `node_modules/` output remains ignored
