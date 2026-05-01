# Build Status

## Current state

URK currently ships:

- `@urk/core` with the kernel, explicit runtime phases, registries, scheduler, event bus, and runtime inspector
- `@urk/adapters` with seven reference adapters
- `@urk/react-urk` and `@urk/next-urk` as thin wrappers over the kernel
- `examples/` as the private proof workspace with one folder per proof
- `apps/next-proof` as the standalone Next App Router proof

## Validation model

- `corepack yarn install`
- `corepack yarn build`
- `npm pack --dry-run` for publishable packages
- manual browser smoke tests for:
  - `http://127.0.0.1:4173/`
  - `http://127.0.0.1:4173/picking/`
  - `http://127.0.0.1:3002/`

## Notes

- `packages/` contains publishable libraries only.
- `examples/` and `apps/next-proof` are repo-only proofs.
- `corepack yarn test` remains manual-status only in this milestone.
