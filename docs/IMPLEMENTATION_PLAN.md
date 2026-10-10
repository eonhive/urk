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

## v0.2 implementation

The v0.2 code is implemented in the working tree and package manifests are `0.2.0`. Publication and deployment remain separate. Node 22, Yarn, existing package names, legacy phases, standalone-first architecture, and thin wrappers remain supported.

Delivered:

- Complete shared boot/shutdown operations, cancellation, rollback, terminal disposal, and local resource scopes.
- Built-in adapter acquisition cleanup for partial setup, borrowed hosts/storage, and cancellable audio preload.
- Configured dependency preflight, sequential compatibility, and opt-in parallel dependency batches with stable reverse cleanup.
- Awaitable phase commands that serialize commits and handlers, with immediate cancellation on shutdown.
- Typed adapter and borrowed-service tokens with the common `ctx.get`/`ctx.require` facade and one provider per token per kernel.
- Independent adapter subpaths, compatible root/DOM composites, and clean DOM-only packed imports.
- Separate operational lifecycle snapshots, optional diagnostics, immutable revisions, and React lifecycle/snapshot hooks.
- Auto frame mode that rests without started updaters, alongside continuous compatibility mode.
- Explicit React/Next ownership and one shared interactive experience in standalone/React/Next/website hosts.
- Dependency-aware workspace builds, real root static/regression checks, migration guidance, and a repeatable runtime measurement.
- A GitHub Actions workflow for existing gates and a repeatable package/browser-bundle size report. Commands pass locally with CI settings; the first hosted run remains pending.

Run `corepack yarn dev:v02`, then open `/v02/` or `/v02/react.html`. The Next proof and public website each expose `/v02`. The experience demonstrates loading, DOM interaction, overlays, pause/resume, optional diagnostics, unmount, partial setup failure, and fresh-kernel recovery.

Known boundaries: noncooperative hooks can keep cleanup pending; only explicit transition commands are serialized; automatic scheduling controls only the kernel controller loop. Static checks use TypeScript/Astro. Deeper profiling and toolchain upgrades remain [deferred](DEFERRED.md). See [migration](MIGRATION_V02.md), [performance](PERFORMANCE.md), and [validation](VALIDATION.md).

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
