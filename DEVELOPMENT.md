# Development Guide

## Setup

This is a TypeScript monorepo using Yarn workspaces on Node 22. The repo uses `nodeLinker: node-modules`; `.pnp.cjs` and `.pnp.loader.mjs` are not part of the current install model.

```bash
corepack enable
corepack yarn install
```

## Common commands

```bash
corepack yarn build
corepack yarn dev
corepack yarn dev:examples
corepack yarn dev:next-proof
corepack yarn workspace @urk/www check
```

`corepack yarn dev` starts the public website under `apps/www`. `corepack yarn dev:examples` starts the private proof workspace under `examples/`. `corepack yarn dev:next-proof` starts the standalone Next proof under `apps/next-proof`.

## Project structure

- `packages/core` - publishable kernel runtime
- `packages/adapters` - publishable reference adapters
- `packages/examples` - private, internal, unstable runtime examples consumed by `apps/www`
- `packages/cli` - publishable developer tooling with the `urk` bin
- `packages/react-urk` - publishable React wrapper
- `packages/next-urk` - publishable Next wrapper
- `apps/www` - public Astro/Starlight website, docs shell, package pages, playground shell, and runtime island presentation
- `examples` - private proof workspace with one folder per proof
- `apps/next-proof` - private Next App Router proof app

## Architecture

See:

- [docs/BOUNDARY.md](./docs/BOUNDARY.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DECISIONS.md](./docs/DECISIONS.md)
- [docs/EXAMPLES.md](./docs/EXAMPLES.md)

## Validation

Current validation in this repo is intentionally narrow and honest:

- `corepack yarn build`
- `corepack yarn workspace @urk/www check`
- targeted `npm pack --dry-run` checks for publishable packages
- manual browser checks for the public website, private proofs, and Next proof
