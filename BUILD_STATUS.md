# Build Status

## Current state

URK currently ships:

- `@urk/core` with the kernel, explicit runtime phases, registries, scheduler, event bus, and runtime inspector
- `@urk/adapters` with seven reference adapters
- `@urk/react-urk` and `@urk/next-urk` as thin wrappers over the kernel
- `@urk/cli` as publishable developer tooling
- `@urk/examples` as a private internal examples package consumed by `apps/www`
- `apps/www` as the public Astro/Starlight website
- `examples/` as the private proof workspace with one folder per proof
- `apps/next-proof` as the standalone Next App Router proof

## Validation model

- `corepack yarn install --immutable`
- `corepack yarn build`
- `corepack yarn workspace @urk/www check`
- `npm pack --dry-run --json` for publishable packages: `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`
- generated-site internal link audit over `apps/www/dist`
- manual browser smoke tests for:
  - `http://127.0.0.1:4321/`
  - `http://127.0.0.1:4321/docs/`
  - `http://127.0.0.1:4321/examples/minimal-runtime/`
  - `http://127.0.0.1:4321/packages/`
  - `http://127.0.0.1:4321/playground/`
  - `http://127.0.0.1:5173/`
  - `http://127.0.0.1:5173/picking/`
  - `http://127.0.0.1:3002/`

## Readiness snapshot

Build/package/link checks last completed: 2026-05-18 under Node `/Users/nappy.cat/.nvm/versions/node/v22.22.2/bin/node`.

Install immutability last checked: 2026-05-22 under Node `/Users/nappy.cat/.nvm/versions/node/v22.22.2/bin/node`.

- `corepack yarn install --immutable` passes. It exits `0` with warnings only: one `@astrojs/language-server` peer warning for `typescript` and native rebuild notices for `esbuild` and `sharp`.
- `corepack yarn workspace urk-examples build` passes without a Vite chunk-size warning. The private proof workspace now splits intentional vendor code into `vendor-three`, `vendor-react`, and `vendor-urk`, with `vendor-three` at about `501.52 kB` under the proof-workspace warning limit of `650 kB`.
- `corepack yarn workspace @urk/www check` passes with `0 errors`, `0 warnings`, and `0 hints`.
- `corepack yarn workspace @urk/www build` passes after `@urk/examples` artifacts are present.
- `corepack yarn build` passes and does not emit the previous proof-workspace chunk-size warning.
- Generated-site internal link audit over `apps/www/dist` passed with `htmlFiles: 77` and `missing: []`.
- Publish dry-runs passed for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Runtime and wrapper tarballs contain package metadata, README, and `dist/**`; no raw `src/` is included for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, or `@urk/next-urk`.
- `@urk/cli` intentionally includes `src/templates/**` because those files are required scaffold assets for CLI output.
- `@urk/examples` remains private and was not treated as publishable.

Remaining release risks: this is a readiness verification, not a deployment or npm publish claim. The worktree is still intentionally dirty from prior tasks, and release commit/version/publish decisions remain separate work.

## Notes

- `packages/` contains publishable runtime packages, publishable tooling, and the private website examples package.
- `@urk/examples` is internal and private; it is not a stable public npm API.
- `examples/` and `apps/next-proof` are repo-only proofs.
- `apps/www` owns public routes, documentation shell, package pages, playground shell, and runtime island presentation.
- The repo uses Yarn `nodeLinker: node-modules` on Node 22 and tracks Yarn cache archives.
- `corepack yarn test` remains manual-status only in this milestone.
