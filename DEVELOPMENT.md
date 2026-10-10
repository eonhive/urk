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
corepack yarn build:www
corepack yarn dev
corepack yarn dev:examples
corepack yarn dev:next-proof
corepack yarn workspace @urk/www check
corepack yarn test
corepack yarn workspace @urk/core typecheck
corepack yarn test:integration
corepack yarn dev:v02
corepack yarn report:size
```

`corepack yarn dev` starts the public website under `apps/www`. `corepack yarn dev:examples` starts the private proof workspace under `examples/`. `corepack yarn dev:next-proof` starts the standalone Next proof under `apps/next-proof`.

`corepack yarn build:www` is the deployment-safe public website build. It builds `@urk/core`, `@urk/adapters`, private `@urk/examples`, and then `@urk/www` in dependency order. Use this for Cloudflare Pages, Netlify, Vercel, and local deploy-build checks.

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
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## Validation

Current validation in this repo is intentionally narrow and honest:

- `corepack yarn test` runs build-runner dependency/concurrency checks, real core regressions, public token type checks, isolated packed-core checks, adapter contract/type/packed-export tests, React inspector SSR tests in `urk-examples`, Next ownership SSR tests in `@urk/next-proof`, and Astro diagnostics; the root command calls only real checks.
- `corepack yarn test:integration` runs browser ownership regressions against the private React and real Next proof hosts.
- `corepack yarn build`
- `corepack yarn workspace @urk/www check`
- targeted `npm pack --dry-run` checks for publishable packages
- manual browser checks for the public website, private proofs, and Next proof

See [the current validation record](docs/VALIDATION.md) for exact results, preserved edits, and remaining gaps. Root `lint` runs TypeScript static checks and Astro diagnostics. Package lint commands run their TypeScript checks. This is a real static-quality gate, not a formatter or a new ESLint setup.

The core package gate builds declarations before `test:types`, then packs/unpacks two local core copies to verify public resolution and token identity without monorepo aliases or React/Three.js dependencies. It uses local npm/tar and the existing TypeScript compiler; no dependency download is required. Type fixtures opt out of ambient workspace types.

The adapter gate builds against core declarations and checks independent/root/DOM public types and runtime contracts. The packed DOM fixture excludes Three.js and its types; a second process copies the installed Three peer for root/Three runtime checks. Public runtime/tooling packages are `0.2.0` with compatible `^0.2.0` peers. Root builds resolve local dependencies once with `node scripts/build.mjs [workspace names]`. Independent workspaces run concurrently, with at most two builds active by default. A consumer starts only after its local runtime, development, peer, and optional dependencies finish. Packages without build scripts still preserve transitive dependency ordering. `--plan` prints the dependency order without building; actual parallel start order follows dependency readiness.

The ownership integration gate uses pinned Playwright tooling in the private examples workspace. Install Chromium once with `corepack yarn workspace urk-examples exec playwright install chromium`, then run `corepack yarn test:integration` on Node 22. The gate builds runtime dependencies and starts isolated standalone/React, Next, and website hosts on ports 5174, 3102, and 4322. It stops the hosts when finished; traces from failures go under ignored `.codex/validation/ownership-browser/`. The Next test host uses ignored `.next-integration/` output so it does not replace a normal Next build.

## v0.2 workbench

`corepack yarn dev:v02` builds the shared runtime dependencies and starts the standalone/React host. Open `/v02/` and `/v02/react.html`. Next exposes `/v02`; the website exposes the shared playground at `/playground/` and `/v02/`, with the earlier config inspector at `/playground/config/`. Shared orchestration belongs in `packages/examples/src/v02/runtime.ts`; hosts only supply their surface and cleanup ownership.

`corepack yarn build` builds every workspace once with bounded parallelism. Use `corepack yarn build --jobs 1` for sequential execution or `--jobs N` to set another positive limit. The same flag works with `build:www`, `build:runtime`, and named workspace targets. On failure, no new builds start; already-running builds finish before the command returns the failure. `corepack yarn test:build` checks the build runner and is included in the root test/CI gate. `corepack yarn build:www` builds only website dependencies and the website. `corepack yarn build:runtime` builds the local libraries/tooling. `node benchmarks/runtime.mjs` measures frame dispatch after core is built; see `docs/PERFORMANCE.md` for its scope.

## Continuous integration and size reports

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual dispatch. It uses Ubuntu 24.04, Node 22 from `.nvmrc`, and Yarn 3.8.7 from `packageManager`. It installs the locked dependencies, builds every package and production host, checks library/website/proof sources, runs the existing unit/contract/packed/SSR gates, and runs the standalone/React/Next browser gate.

The workflow installs Chromium and Linux dependencies using [Playwright's documented CI setup](https://playwright.dev/docs/ci). CI rejects focused `.only` tests and writes an HTML browser report. Failed tests retain traces. The workflow uploads only the generated size report, browser report, and browser diagnostic directories for 14 days, including on failure. Action revisions are pinned; permissions are read-only and no publish/deploy step is included.

Generate the same size report locally after building:

```bash
corepack yarn build:runtime
corepack yarn report:size
```

The report is written as JSON and Markdown under `.codex/validation/bundle-report/`. CI adds the Markdown to its run summary. It measures all five publishable npm archives and five representative browser fixtures: core, DOM, Three, React, and Next. Each fixture imports built public exports. Core is included in each browser case; Three is bundled only in the Three case; framework peers are external in the wrapper cases. These are library measurements, not complete application download sizes.

The report records compressed/uncompressed package bytes, minified/gzip/Brotli bundle bytes, hashes, external imports, tool versions, lockfile hash, and repository state. It rejects unintended Three inclusion in the other fixtures, unexpected external imports, source aliases, and empty export fixtures. Temporary tarballs and fixture files are removed. It reports a baseline without inventing a size budget; see [Performance](docs/PERFORMANCE.md).

Local validation with `CI=true` verifies the commands and reporter behavior. It does not establish that GitHub's hosted Ubuntu job has run; confirm that separately once the workflow is pushed.
