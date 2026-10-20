# Build Status

## Audio/motion integration — 2026-10-20

`thehive/urk-audio-integration` refreshes the scoped audio follow-ups directly onto
motion commit `04ee90a837aa841dc5a733c34dac3663a0d4ba03`. Adapters stay `0.2.1` and
Core stays `0.2.0`. Both widget exports, the docs host, starter routes/exporter, and
API guides remain aligned. Appended validation history was the only patch conflict;
motion release records and earlier audio evidence are both retained.

Immutable install, focused Core/adapters/React/shared examples builds, root/proof
typechecks, proof production build, website diagnostics (44 files, zero issues),
and a fresh exported audio starter install/build pass. The existing language-server
TypeScript peer warning remains. Generated tracked install metadata was restored
to its base and is excluded from review. The four focused browser flows also
passed: playback/source changes and controlled pending-play cancellation,
runtime pause/resume, widget removal/remount and URL/context cleanup, and
preference save/restore/reset/forget. Simulated visibility events passed; actual
native tab background/restore remains unverified because the in-app browser does
not background its automated documents. No runtime fix was required. No suites,
website production build, or full release matrix ran. See docs/AUDIO_RELEASE.md
and the integration manifest for evidence and remaining checks.

Core, motion, analysis implementation, overlay/video code, dependency versions,
and lockfile are unchanged from the motion candidate. The main development tree
and original motion release checkout remain separate. The scoped audio commit
and stacked draft target the unmerged motion branch. No tag, publication, or
deployment is performed.

## Current state

URK currently ships:

- `@urk/core` with the kernel, explicit runtime phases, registries, scheduler, event bus, and runtime inspector
- `@urk/adapters` with reference motion, media, input, storage, UI, and rendering adapters
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

The v0.2 runtime/tooling manifests remain at `0.2.0`, except for the motion release candidate `@urk/adapters@0.2.1`. The adapter retains its `^0.2.0` Core peer; Core source and package versions are unchanged by this motion release. The candidate adds callback tweens, finite timelines, scoped controls, and reusable DOM proofs. See [motion release notes](docs/MOTION_RELEASE.md) for scheduling migration, source scope, and release gates. This records local source, not npm publication or deployment. Validation below is historical unless its dated entry explicitly covers this candidate.

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


## Local motion and audio additions — 2026-10-17

The working tree adds optional numeric motion using temporary Core frame demand,
and optional analysis on the existing audio adapter. `/motion-playground/` and
`/audio-proof/analysis.html` exercise the APIs. See D-027/D-028 and the dated
validation entry in `docs/VALIDATION.md`. Package publication remains separate.


The Audio Lab integration now shares one implementation between the standalone
analysis route and `/examples/audio-proof/` on the website, including the reactive
Three scene and finite layout transitions. Shared/proof/site builds and targeted
type checks pass. This follow-up intentionally ran no test suites at the user's
request; the earlier 191/27 results describe the preceding adapter/motion slice.
