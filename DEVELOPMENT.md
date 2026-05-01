# Development Guide

## Setup

This is a TypeScript monorepo using Yarn workspaces.

```bash
corepack enable
corepack yarn install
```

## Common commands

```bash
corepack yarn build
corepack yarn dev
corepack yarn workspace @urk/next-proof dev
```

`corepack yarn dev` starts the private `examples/` workspace. The Next proof remains separate under `apps/next-proof`.

## Project structure

- `packages/core` - publishable kernel runtime
- `packages/adapters` - publishable reference adapters
- `packages/react-urk` - publishable React wrapper
- `packages/next-urk` - publishable Next wrapper
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
- targeted `npm pack --dry-run` checks for publishable packages
- manual browser checks for the private proofs
