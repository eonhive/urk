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
- `corepack yarn build:www`
- `corepack yarn smoke:www`
- `corepack yarn workspace @urk/www check`
- `corepack yarn test` and `corepack yarn test:integration` for automated core, SSR, and browser regressions
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

The v0.2 implementation is in the working tree with runtime/tooling manifests at `0.2.0` and compatible `^0.2.0` peers. It adds common typed lookup, borrowed typed services, dependency planning, auto frame mode, scoped built-in cleanup, a React lifecycle hook, and a shared experience across standalone/React/Next/website hosts. The dependency-aware full build, real root static/regression checks, and browser experience checks are recorded in [docs/VALIDATION.md](docs/VALIDATION.md). This updates local code, not npm publication or deployment. Historical results below retain their original dates.

Build/package/link checks last completed: 2026-05-18 under Node `/Users/nappy.cat/.nvm/versions/node/v22.22.2/bin/node`.

Install immutability last checked: 2026-05-22 under Node `/Users/nappy.cat/.nvm/versions/node/v22.22.2/bin/node`.

Live public website smoke last checked: 2026-06-05 at `https://urk.eonhive.com`.

- `corepack yarn install --immutable` passes. It exits `0` with warnings only: one `@astrojs/language-server` peer warning for `typescript` and native rebuild notices for `esbuild` and `sharp`.
- `corepack yarn workspace urk-examples build` passes without a Vite chunk-size warning. The private proof workspace now splits intentional vendor code into `vendor-three`, `vendor-react`, and `vendor-urk`, with `vendor-three` at about `501.52 kB` under the proof-workspace warning limit of `650 kB`.
- `corepack yarn workspace @urk/www check` passes with `0 errors`, `0 warnings`, and `0 hints`.
- `corepack yarn workspace @urk/www build` passes after `@urk/examples` artifacts are present.
- `corepack yarn build:www` is the deployment-safe public website build because it creates `@urk/core`, `@urk/adapters`, and `@urk/examples` artifacts before building `@urk/www`.
- `corepack yarn build` passes and does not emit the previous proof-workspace chunk-size warning.
- Generated-site internal link audit over `apps/www/dist` passed with `htmlFiles: 77` and `missing: []`.
- Publish dry-runs passed for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Runtime and wrapper tarballs contain package metadata, README, and `dist/**`; no raw `src/` is included for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, or `@urk/next-urk`.
- `@urk/cli` intentionally includes `src/templates/**` because those files are required scaffold assets for CLI output.
- `@urk/examples` remains private and was not treated as publishable.
- Live Cloudflare smoke checks for `https://urk.eonhive.com` are repeatable with `corepack yarn smoke:www`.
- `corepack yarn smoke:www` passes against `https://urk.eonhive.com`, including route, sitemap, robots, 404, critical asset, and minimal runtime marker checks.

Remaining release risks: this is a readiness verification, not a long-term monitoring claim. Release commit/tag decisions remain separate work.

## Notes

- `packages/` contains publishable runtime packages, publishable tooling, and the private website examples package.
- `@urk/examples` is internal and private; it is not a stable public npm API.
- `examples/` and `apps/next-proof` are repo-only proofs.
- `apps/www` owns public routes, documentation shell, package pages, playground shell, and runtime island presentation.
- The repo uses Yarn `nodeLinker: node-modules` on Node 22 and tracks Yarn cache archives.
- `corepack yarn test` now runs core regressions and public token type/packed-package checks, adapter contract/type/packed-export tests, React inspector SSR tests in `urk-examples`, Next ownership SSR tests in `@urk/next-proof`, and Astro diagnostics. The root command no longer calls echo-only scripts.
- `corepack yarn test:integration` separately runs the private React and real Next browser ownership gate; placeholder scripts are not counted as tests.
