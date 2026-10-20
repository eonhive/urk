# URK refactor validation — 2026-10-04 through 2026-10-07

This record covers the continuation of the interrupted lifecycle/reliability work, diagnostics, React/Next ownership, operational lifecycle observation, and typed adapter lookup. Each section records its own dated validation results. It does not mark the full v0.2 proposal complete or authorize a release.

## Checkout and reference

- Repository: `https://github.com/eonhive/urk.git`, current local branch `main`.
- Local HEAD and remote HEAD/main were both `94b654c107ff6fbe2e554fc81c093d4372cdb001` when inspected.
- The linked ChatGPT share returned a page with no readable transcript. The accessible local work chat supplied the interrupted work context; the actual checkout and canonical docs governed implementation.
- Existing website, example catalog, audio-demo assets/code, deployment docs, supplied proposals, and unrelated planning/handoff changes were preserved. A task-entry file-hash comparison verified the website/catalog/audio edits stayed byte-for-byte unchanged.
- No commit, push, package publish, or deployment was performed. During the reliability/diagnostics phases, validation-only tracked Yarn install-state churn was restored and dependencies/lockfile were unchanged. The ownership slice adds pinned private Playwright development tooling and corresponding Yarn state, recorded below.

## Reliability gate and added behavior

The recovered core baseline passed 46 tests. Added regressions first reproduced duplicate inspector unsubscribe calls, diagnostics listener errors aborting boot, reversed controller update order after concurrent starts, and late boot registration that never started. The fixes passed 59 core tests; root test/lint commands and the full workspace build also passed before diagnostics work began.

Completed fixes:

- Idempotent inspector disposal, upstream subscription cleanup on successful/failed shutdown and startup rollback, and per-listener exception isolation.
- Registration-order controller updates even when concurrent starts finish out of order, preserving receivers/arguments and next-frame admission.
- Boot completes controllers admitted while its asynchronous startup pass settles, including an initially empty pass; cancellation prevents late activation.
- Additional update-failure regression verifies stopped frames, rejected restart, and explicit terminal cleanup.

The subsequent diagnostics slice removes inspector publication from the kernel frame handler. Snapshot reads acquire no observer resources, cache frozen values with monotonic revisions, and reuse structural lists by registry revisions. Observation attaches with the first subscriber and detaches with the last; frame metrics sample every 200 ms. Event history contains bounded metadata only and counts subscribed intervals. React consumes stable snapshot identity with memoized callbacks. Shutdown captures one terminal frozen snapshot, including for an unopened inspector.

## Reliability/diagnostics commands and outcomes

Commands used Node `22.22.2` via `env PATH=/Users/nappy.cat/.nvm/versions/node/v22.22.2/bin:$PATH` in front of package commands.

| Command/check | Result |
| --- | --- |
| `corepack yarn install --immutable` | Exit 0; existing `@astrojs/language-server`/TypeScript peer warning; no dependency/lockfile changes |
| `corepack yarn test` | Exit 0; **68/68 core tests**, **3/3 React inspector SSR tests**, Astro **39 files, 0 errors, 0 warnings, 0 hints** |
| `corepack yarn build` | Exit 0; all nine workspaces build, including Vite proofs, 79-page Astro site, and production Next proof |
| `corepack yarn lint` | Exit 0; Astro check passes with 0/0/0; other workspace lint commands are placeholders |
| `corepack yarn workspace @urk/core typecheck` | Exit 0 |
| `node_modules/.bin/tsc --noEmit` | Optional aggregate check exits 2 with five JSX-configuration diagnostics; root tsconfig has no JSX setting |
| `node_modules/.bin/tsc --noEmit --jsx react-jsx` | Exit 0; checks all package source with the necessary JSX option |
| `node_modules/.bin/tsc --noEmit --jsx react-jsx --target ES2020 --module ESNext --moduleResolution bundler --lib ES2020,DOM --strict --skipLibCheck --esModuleInterop examples/runtime-inspector/main.ts examples/react-starter/main.tsx` | Exit 0; explicitly checks proof entrypoints omitted by the examples tsconfig's `include: ["src"]` |
| `npm pack --dry-run --json --workspace @urk/core --workspace @urk/adapters --workspace @urk/react-urk --workspace @urk/next-urk --workspace @urk/cli` | Exit 0; 82/46/14/14/70 files respectively; only README, package metadata, dist output, and intentional CLI templates |
| Generated-site local anchor-target file audit | 79 HTML files; no missing local file/route targets; fragment IDs and external URLs were not audited |
| `git diff --check` | Pass |
| Generated-file inventory | No untracked dist, .astro, .next, or node_modules paths outside ignored output |
| `corepack yarn smoke:www` against `https://urk.eonhive.com` | **Exit 1: `/robots.txt` returned HTTP 404, expected 200.** This checks the currently deployed site, not the local refactor. The script stops there, so later 404/asset checks were not reached |

At this phase, other workspace test commands remained placeholders in adapters, internal examples, React/Next wrappers, CLI, and the Next proof. Successful exit codes from those commands do not establish unit or integration coverage. The React SSR tests run in the private `urk-examples` workspace, which already declares both React and React DOM; this phase added no test dependency. The subsequent ownership slice replaces the Next proof test placeholder and adds a separate browser gate. Node's mock-timer tests emit an experimental-API warning.

## Browser verification

Used production build previews and the production Next server, through the browser UI:

- `/runtime-inspector/`: reached ready, emitted a marker, paused, resumed, and shut down. Final view showed disposed=yes, scheduler stopped, empty adapter/controller/service registries, and disabled controls.
- `/react-starter/`: reached ready, paused/resumed, and shut down with disposed=yes, stopped scheduler, and registry counts 0/0/0.
- Next proof at port 3002: reached ready, paused/resumed, and shut down with the same terminal values. A fresh page instance also booted to ready and shut down successfully.
- Local public `/examples/minimal-runtime/`: reached ready and reset into a fresh loading/ready runtime.
- Captured browser warning/error logs were empty for the standalone, React, Next, and public minimal runtime checks.

These smoke checks did not prove wrapper ownership under Strict Mode replay, unmount during deferred async boot, multiple providers, or real App Router navigation. The subsequent ownership slice adds dedicated integration tests for those cases.

Local Next terminal-cleanup screenshot: `.codex/validation/next-shutdown.jpg`. It is ignored validation evidence, not a shipped package asset.

## Work-count evidence

Deterministic tests verify:

- After boot, 600 frames plus 600 emitted events with unopened diagnostics trigger **no additional inspector registry scans, observer subscriptions, or sampling timers**.
- An initial snapshot scans each registry once; 100 unchanged reads return the same frozen object without rescanning.
- With observation attached, 600 frame steps trigger no frame-handler inspector notifications. The 200 ms sample publishes the latest frame count once and reuses all structural arrays; unchanged subsequent samples do not notify again.
- Direct registry mutations invalidate only the corresponding cached list. Snapshot revisions advance even with `Date.now()` fixed.
- Last-unsubscribe/shutdown releases upstream subscriptions and sampling, and event metadata retains no payload graph.
- A reentrant subscriber state change cannot deliver an older snapshot to later subscribers after they received a newer revision. Its regression reproduced out-of-order `transition` then `ready` notifications before the final fix.

These are operation counts, not a before/after timing benchmark, bundle-size comparison, or memory-leak measurement.

## Exact continuation file inventory

Modified during this continuation:

- `packages/core/src/kernel/Kernel.ts`
- `packages/core/src/controllers/ControllerRegistry.ts`
- `packages/core/src/adapters/AdapterRegistry.ts`
- `packages/core/src/runtime/RuntimeInspector.ts`
- `packages/core/src/runtime/RuntimeStore.ts`
- `packages/core/src/runtime/ServiceRegistry.ts`
- `packages/core/tests/lifecycle-edge.test.mjs`
- `packages/react-urk/src/hooks.ts`
- `examples/runtime-inspector/main.ts`
- `examples/package.json`
- `packages/core/README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `DEVELOPMENT.md`
- `BUILD_STATUS.md`

Created during this continuation:

- `packages/core/tests/inspector.test.mjs`
- `packages/core/tests/controller-execution.test.mjs`
- `packages/core/tests/diagnostics.test.mjs`
- `examples/tests/inspector-react.test.mjs`
- `docs/MIGRATION_V02.md`
- `docs/VALIDATION.md`

Carried forward and validated from the interrupted refactor: core test/typecheck manifest commands, resource scopes/CleanupError, cancellation context types, public exports, deterministic manual scheduler, browser scheduler generation guards, adapter/controller/service ownership changes, and the existing adapter/lifecycle/resource/scheduler test files. Those were already working-tree edits at task entry; the inventory above distinguishes new continuation edits from the inherited diff.

## Remaining risks and next step

Cancellation is cooperative: a hook that never settles can keep shutdown pending. A hook must not await lifecycle completion that depends on that same hook returning. Legacy phase commits are synchronous and async controller notifications for different phase changes can overlap. Fatal update/state-handler failures stop frames but still require host shutdown for cleanup. Built-in adapters still need their own resource-ownership audit; scopes do not fix cleanup they do not own.

Inspector snapshots are now readonly and event payloads are omitted; consumer migration is intentional and documented in `MIGRATION_V02.md`. The inspector facade still contributes bundle code. Structural caching does not track mutation inside borrowed values. Continuous scheduling remains the default. The reliability/diagnostics phases added no public operational lifecycle observation; that was implemented subsequently below. Tokens, dependency sorting, parallel startup, and auto frame mode remain pending.

React/Next ownership and operational lifecycle observation are now implemented and validated below. Typed token/export work remains a separate slice. Resolve the independent deployed `/robots.txt` regression before treating the public-site smoke gate as green; neither continuation deployed or modified the website.

## React/Next ownership implementation

The core baseline entering this slice passed 68 tests, including the final diagnostics reentrancy regression. Four new compatibility regressions bring the total to 72. Adapter registration captures ID/capability before setup can mutate the adapter; controller registration captures ID before event observers can mutate it. Registry initialization/start guard failures once again return rejected promises. Callback receivers and registration order remain intact.

`UrkProvider` now accepts `ownership: 'legacy' | 'external' | 'provider'`, defaulting to `legacy`. External consumers never initiate shutdown. Explicit provider ownership claims one cleanup owner per kernel, including with `autoBoot: false`; competing owners and ownership changes after mount reject. Next defaults to provider ownership without changing existing factory/hook signatures. Factories remain inert, including during server rendering.

Boot and cleanup effects are independent. A cancellable zero-delay cleanup task accommodates synchronous Strict Mode replay; when it fires, shutdown signals cancellation immediately without awaiting boot. Boot completion is suppressed after unmount or cancellation. Changes to reasons and `autoBoot` do not trigger teardown. Wrapper event-observer exceptions do not block boot or cancellation. The regular runtime snapshot hook uses the store revision and memoized read/subscribe callbacks, so updates remain observable even when timestamps and final phase/reason values match an earlier snapshot.

## Ownership commands and outcomes

All commands used Node **22.22.2** and Yarn **3.8.7**. Browser coverage used React **18.3.1**, Next **14.2.35**, Playwright **1.63.0**, and Chromium **153.0.8010.12**. `@playwright/test` is pinned in the private examples workspace; Playwright and playwright-core are its locked transitive dependencies. No published runtime dependency was added.

| Command/check | Result |
| --- | --- |
| `corepack yarn install --immutable` | Exit 0; final manifest/lock/cache state agrees; existing Astro language-server TypeScript peer warning |
| `corepack yarn workspace @urk/core test` | Exit 0; **72/72 core tests** |
| `corepack yarn workspace @urk/core typecheck` | Exit 0 |
| `corepack yarn workspace urk-examples test` | Exit 0; **3/3 React SSR tests** |
| `corepack yarn workspace @urk/next-proof test` | Exit 0; builds Next wrapper and passes **1/1 Next SSR ownership test** |
| `corepack yarn test:integration` | Exit 0; builds core/adapters/React/Next libraries and passes **17/17 browser tests**, final run 10.5 seconds |
| `corepack yarn test` | Exit 0; **72 core + 3 React SSR + 1 Next SSR tests**; Astro **39 files, 0 errors, 0 warnings, 0 hints** |
| `node_modules/.bin/tsc --noEmit --jsx react-jsx` | Exit 0; aggregate package source check |
| Strict browser fixture/config/spec TypeScript check, listed below | Exit 0 |
| `corepack yarn workspace urk-examples build` | Exit 0; private Vite proof production build |
| `corepack yarn workspace @urk/examples build` | Exit 0; shared internal example library |
| `corepack yarn workspace @urk/next-proof build` | Exit 0; Next production compilation, type checking, and static generation, including both ownership routes |
| Task-entry website/audio file-hash comparison | **137 existing files unchanged**, including current uncommitted website/audio work |
| `git diff --check` | Pass |
| Test-host listener check after integration | No servers listening on ports 5174 or 3102 |

The strict check covers test sources outside the regular examples build:

```sh
corepack yarn workspace urk-examples exec tsc --noEmit --jsx react-jsx --target ES2020 --module ESNext --moduleResolution bundler --lib ES2020,DOM --strict --skipLibCheck --esModuleInterop tests/fixtures/runtime.ts tests/fixtures/ProbeView.tsx tests/fixtures/react-host.tsx tests/browser/ownership.spec.ts playwright.config.ts
```

The root test command still includes echo-only placeholders in adapters, internal examples, React/Next wrapper workspaces, and CLI. Those are not counted as tests. Browser coverage runs through the dedicated integration gate. This slice reran affected production builds and Astro checking, rather than repeating the earlier full-root build, lint, package dry-run, or deployed-site smoke checks. Node mock-timer and test-server color-environment warnings were benign.

## Ownership browser acceptance evidence

The Playwright configuration launches two actual servers: a private Vite React fixture on port 5174 and the real Next App Router proof on port 3102. Next test output uses ignored `.next-integration/`, leaving ordinary production output separate. Failure traces are retained under ignored `.codex/validation/ownership-browser/`. The fixture instruments actual owned frame requests, sampling/controller timers, custom event subscriptions, and store/event/inspector subscriptions; no fixture resource is acquired by its inert factory or during server rendering.

The 17 browser tests cover:

- Strict Mode effect replay under legacy and explicit provider ownership: one startup, no terminal disposal during replay, one cleanup on actual unmount.
- Unmount during deferred adapter setup and controller start: abort observed before the hook settles, shutdown pending until release, no late activation or boot-completion event.
- Shared external consumers: one or all consumers can unmount without terminal cleanup; the external host retains a usable kernel and shuts it down explicitly.
- Competing explicit owners: the newcomer rejects while the existing owner remains active. Ownership changes after mount reject and the original owner still cleans up.
- Reason and `autoBoot` changes under both owner modes: no accidental teardown; enabling/disabling/re-enabling auto-boot starts once. Explicit ownership cleans up even without boot, while legacy leaves a previously host-booted kernel usable.
- External unmount during pending host boot suppresses stale wrapper completion without cancelling host-owned work.
- Multiple store revisions at one fixed millisecond remain observable, including a return to the same phase/reason; unchanged rerenders retain stable subscriptions.
- Throwing wrapper event observers cannot prevent startup or cleanup cancellation.
- Real Next Link navigation away completes cleanup; returning creates a fresh kernel; leaving again disposes the second kernel.

Completed disposal asserts zero owned frame requests, interval timers, custom listeners, and store/event/inspector subscriptions, with stopped scheduling and empty registries. The Next SSR regression renders twice and verifies inert factories, no acquired browser resources, no diagnostic subscriptions, and no running scheduler.

These checks cover Chromium and the installed React/Next versions. They are not Firefox/WebKit, React 19, heap-leak, timing-speedup, or before/after bundle benchmarks. Cancellation remains cooperative; a hook that never settles keeps cleanup pending. Legacy phase-based inference remains a compatibility heuristic, so shared host-owned kernels should explicitly use `external` ownership.

## Exact ownership-slice file inventory

Modified during this slice:

- `packages/core/src/kernel/Kernel.ts`
- `packages/core/src/controllers/ControllerRegistry.ts`
- `packages/react-urk/src/provider.tsx`
- `packages/react-urk/src/hooks.ts`
- `packages/next-urk/src/provider.tsx`
- `package.json`
- `examples/package.json`
- `apps/next-proof/package.json`
- `apps/next-proof/next.config.mjs`
- `apps/next-proof/tsconfig.json`
- `.gitignore`
- `yarn.lock`
- `.yarn/install-state.gz`
- `packages/react-urk/README.md`
- `packages/next-urk/README.md`
- `docs/MIGRATION_V02.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`
- `docs/VALIDATION.md`
- `DEVELOPMENT.md`

Created during this slice:

- `packages/core/tests/compatibility.test.mjs`
- `examples/playwright.config.ts`
- `examples/tests/fixtures/runtime.ts`
- `examples/tests/fixtures/ProbeView.tsx`
- `examples/tests/fixtures/index.html`
- `examples/tests/fixtures/react-host.tsx`
- `examples/tests/browser/ownership.spec.ts`
- `apps/next-proof/app/ownership/page.tsx`
- `apps/next-proof/app/ownership/away/page.tsx`
- `apps/next-proof/tests/ownership-ssr.test.mjs`
- `.yarn/cache/@playwright-test-npm-1.63.0-98d5b1a3d6-ed4a641d14.zip`
- `.yarn/cache/playwright-npm-1.63.0-f27e8a40d2-6f90bca3d6.zip`
- `.yarn/cache/playwright-core-npm-1.63.0-ef52743921-b4c190c409.zip`

The Next config isolates integration output, and its TypeScript include tracks the isolated generated route types. Existing website/audio changes, Node/Yarn versions, package names, legacy phases, sequential adapter startup, and thin wrapper boundaries are preserved. Typed capabilities, adapter export changes, and automatic idle scheduling remain outside this slice. No performance gain is claimed without comparable measurements.

## Operational lifecycle observation slice

This continuation adds a public observation API without changing legacy application phases or wrapper behavior:

- `getLifecycleSnapshot()` returns a cached, frozen `LifecycleSnapshot` with state, optional reason, monotonic revision, and display timestamp.
- `subscribeLifecycle()` observes future transitions synchronously, isolates observer exceptions, and returns an idempotent unsubscribe. It does not acquire diagnostic subscriptions, polling timers, or frame work.
- States are `created`, `starting`, `running`, `paused`, `failed`, `disposing`, and `disposed`. Starting lasts through required adapter/controller startup. Disposal intent commits before abort listeners and publishes after scheduler stop; terminal disposal commits after tracked hooks and cleanup attempts finish.
- Shared operation promises are installed before observer callbacks. Reentrant transitions suppress older pending delivery, and terminal disposal releases listeners. Cleanup failures still reject through the existing promise and immutable error list; startup rollback preserves the initiating error.
- `getState()`, `RuntimeStore`, six legacy phase names, notification timing, sequential adapter startup, continuous scheduling, and React/Next ownership defaults remain supported. Direct phase writes have no new scheduler or lifecycle effects. The inspector's legacy disposal flag still means intent; the new lifecycle `disposed` state means cleanup attempts finished.

The 72-test core baseline gains **14 observation regressions**, for **86 core tests**. They cover frozen/cached identity, repeated operations, equal timestamps, deferred setup/start versus legacy phase timing, shared reentrant boot, direct writes to every legacy phase, abort-time disposal intent, pending startup settlement, startup rollback and cleanup failures, fatal frame failure, observer isolation/unsubscribe, nested revision ordering, legacy pause/resume reentrancy, shutdown from a starting observer, and preserved throwing phase-observer behavior.

## Lifecycle observation commands and outcomes

Commands used Node **22.22.2** and Yarn **3.8.7**. No dependency, lockfile, package version, or manifest change was needed in this slice.

| Command/check | Result |
| --- | --- |
| `corepack yarn workspace @urk/core build` followed by `node --test packages/core/tests/lifecycle-observation.test.mjs` | Exit 0; initial **13/13** new tests; one subsequent phase-write regression is covered by the final root gate |
| `corepack yarn workspace @urk/core typecheck` | Exit 0 |
| `corepack yarn test` | Exit 0; **86/86 core + 3/3 React SSR + 1/1 Next SSR**; Astro **39 files, 0 errors, 0 warnings, 0 hints** |
| `node_modules/.bin/tsc --noEmit --jsx react-jsx` | Exit 0; all package source |
| `corepack yarn test:integration` | Exit 0; rebuilds core/adapters/React/Next libraries; **17/17 browser ownership tests**, 10.8 seconds |
| `npm pack --workspace @urk/core --pack-destination <temporary-dir> --json` | Exit 0; **86 packed files**; no runtime dependencies |
| Packed-package isolated `.mts` type fixture | Exit 0 under strict NodeNext resolution with ES2022/DOM libs; public lifecycle types resolve, readonly mutation and application-phase assignments reject as expected |
| Packed-package isolated `.mjs` runtime fixture | Exit 0; loads `@urk/core` by package name and observes startup, pause/resume, disposal, and frozen terminal snapshots |
| Existing website/audio file-hash comparison | **137 files unchanged** |
| `git diff --check` | Pass |

The packed fixture contains only the extracted `@urk/core` package under its own `node_modules`; it uses the existing compiler as tooling without monorepo path aliases, React, or Three.js installed in the fixture. No install or network fetch was required. Fixture files live outside the repository and are validation artifacts. The runtime check uses `ManualFrameScheduler` and does not claim browser scheduler behavior beyond the separate browser gate.

As in the preceding slice, echo-only workspace tests are not counted as coverage. Mock-timer and server color-environment warnings remain benign. Full root build/lint, proof production builds, other package dry-runs, and deployed-site smoke were not repeated in this slice; their earlier dated evidence remains separate. The affected runtime library builds, SSR/browser gate, aggregate/core type checking, and Astro check were rerun.

## Exact lifecycle observation file inventory

Modified:

- `packages/core/src/kernel/Kernel.ts`
- `packages/core/src/types.ts`
- `packages/core/README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/MIGRATION_V02.md`
- `docs/VALIDATION.md`
- `BUILD_STATUS.md`

Created:

- `packages/core/src/lifecycle/LifecycleStore.ts`
- `packages/core/tests/lifecycle-observation.test.mjs`

The new public types flow through the existing `types.ts` barrel export; no export-map edit or framework hook was required. Cancellation remains cooperative, and unresolved hooks keep lifecycle disposal pending. Lifecycle subscriptions are current-state observation: nested transitions may skip intermediate notification delivery but cannot deliver revisions backwards. They are not an event-history API. Typed capabilities, adapter subpaths, transition serialization, automatic idle scheduling, and comparable performance measurements remain later work. No commit, push, package publish, deployment, or performance claim was made.

## Typed adapter lookup slice — 2026-10-07

The 86-test baseline was rerun before editing and passed. This continuation adds optional `CapabilityToken<TApi>` binding to the existing adapter registration and lookup surface:

- `token<TApi>(name)` creates a frozen identity with a unique symbol key and display label; it retains no API value and acquires no browser resources.
- `AdapterRegistration<TApi>.token` is optional. Existing IDs/capability strings, token-free providers, generic string lookups, registry list metadata, and inspector metadata remain supported.
- Adapter `get(token)` returns `TApi | undefined`; `require(token)` returns `TApi`. `dependsOn` accepts mixed tokens and strings under configured sequential startup.
- Token identity reserves before hooks, publishes only after successful uncancelled setup, and releases through existing failed-setup/disposal cleanup. Pending reservations do not satisfy dependencies. Hook mutation cannot change the captured identity.
- Lookup uses the shared symbol key without constructor checks or a global name registry. Equal labels do not resolve one another or create string aliases.

This is deliberately an adapter-registry addition rather than a common `ctx.get`/`ctx.require` facade or a new value/lifecycle coordinator. Service lookups remain string-based. Contract authors should annotate providers as `AdapterRegistration<Api>` or use `satisfies` to verify token/setup agreement; heterogeneous inline kernel configuration retains its existing `unknown` erasure. Lookup inference is not runtime schema validation. Built-in tokens and adapter exports remain follow-on work.

The suite adds **15 runtime regressions** for identity, duplicate pending reservation, conflict/retry isolation, rollback, unsupported providers, cancellation, captured identity, mixed dependencies, late dependency publication, pending-controller capability access, cleanup failure, and independent module instances. A **16th test** packs and checks independent installed copies. The final core total is **102 tests**. Public declaration checks additionally assert optional/required inference, incompatible generic rejection, registration/token mismatch, readonly metadata, nominal construction, mixed lookup inputs, and legacy configuration compatibility.

## Typed lookup commands and outcomes

All package commands used Node **22.22.2**, Yarn **3.8.7**, and the installed TypeScript **5.9.3** compiler. The core manifest adds `test:types` and includes it in `test`; no dependency, version, lockfile, or install-state change was required.

| Command/check | Result |
| --- | --- |
| `corepack yarn workspace @urk/core test` before changes | Exit 0; **86/86 baseline tests** |
| `corepack yarn workspace @urk/core build` | Exit 0 |
| `corepack yarn workspace @urk/core test:types` | Exit 0; strict public declaration checks under NodeNext with ES2020/DOM and no ambient workspace types |
| `node --test packages/core/tests/capabilities.test.mjs` | Exit 0; **15/15 runtime token tests** |
| `node --test packages/core/tests/packaged-capabilities.test.mjs` | Exit 0; **1/1 isolated packed-core test**, 90 shipped files |
| `corepack yarn workspace @urk/core typecheck` | Exit 0 |
| `corepack yarn test` | Exit 0; public token type gate + **102/102 core + 3/3 React SSR + 1/1 Next SSR tests**; Astro **39 files, 0 errors, 0 warnings, 0 hints** |
| `node_modules/.bin/tsc --noEmit --jsx react-jsx` | Exit 0; aggregate package source check |
| `corepack yarn test:integration` | Exit 0; builds core/adapters/React/Next and passes **17/17 browser ownership tests**, 12.8 seconds |
| `corepack yarn workspace @urk/examples build` | Exit 0; shared internal examples compile against the built dependencies |
| Task-entry preservation hash audit | **139 files unchanged**: 137 website/catalog/audio files plus lockfile/install state |
| `git diff --check` | Pass |

The new checked-in packed test creates a temporary directory, packs core with local npm, extracts two copies, and checks declarations without monorepo aliases or installed React/Three.js. It tests both copies' registries with the same canonical token, distinct same-name tokens, and the independent helper's token in the original registry. Its strict type fixture also imports the independently installed copy. Temporary fixtures and tarballs are removed in `finally`; no install, publish, network fetch, or workspace tarball is needed. This is same-version duplication evidence, not a promise of compatibility across arbitrary versions.

The browser gate remains the existing React/Next ownership gate; new token behavior is proven through deterministic core and packed-package tests. Echo-only workspace test commands are not counted as coverage. Existing Node mock-timer and server color-environment warnings were benign. Full-root build/lint, proof production builds, immutable reinstall, other package dry-runs, and deployed-site smoke were not repeated; their earlier dated results remain separate.

## Exact typed lookup file inventory

Modified:

- `packages/core/src/adapters/AdapterRegistry.ts`
- `packages/core/src/types.ts`
- `packages/core/src/index.ts`
- `packages/core/package.json`
- `packages/core/README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/MIGRATION_V02.md`
- `docs/VALIDATION.md`
- `DEVELOPMENT.md`
- `BUILD_STATUS.md`

Created:

- `packages/core/src/capabilities/token.ts`
- `packages/core/tests/capabilities.test.mjs`
- `packages/core/tests/packaged-capabilities.test.mjs`
- `packages/core/tests/types/capabilities.ts`
- `packages/core/tests/types/tsconfig.json`

Existing lifecycle/ownership changes and website/audio work were preserved. No React/Next source, service registration, adapter implementation, runtime phase, scheduler default, package export map, or dependency was changed in this slice. Cancellation remains cooperative. Next add independent adapter subpaths and built-in canonical tokens with clean DOM-only packed fixtures; service-token lookup, a context facade, dependency sorting, transition queues, automatic idle scheduling, and performance benchmarks remain separate work. No commit, push, package publish, deployment, or timing-speedup claim was made.

## Independent adapter contracts and exports — 2026-10-07

Completed the follow-on adapter slice after the **102-test core baseline** passed. This is a working refactor, not a completed v0.2 release.

- Added public `audio`, `input`, `loading`, `pointer`, `storage`, `three`, and `ui-widgets` subpaths pointing directly at the existing built modules/declarations.
- Exported and bound `AudioCapability`, `InputCapability`, `LoadingCapability`, `PointerCapability`, `StorageCapability`, `ThreeCapability`, and `UiWidgetsCapability`. Existing IDs, string aliases, API types, factory signatures, lifecycle hooks, and resource acquisition logic remain unchanged.
- Root/DOM/individual imports share each existing module's token and factory identity. The DOM composite keeps its previous five adapters, excluding audio and Three; audio has its own new subpath.
- Replaced the adapter echo-only test with real build, public declaration, runtime contract, and packed export checks. Type fixtures use strict NodeNext resolution without monorepo aliases or ambient workspace types.
- Staged core **0.1.3** and adapters **0.1.5**, with adapters requiring core **^0.1.3** for the runtime token helper. Updated Yarn lock/install state. Added no third-party dependencies and published nothing.
- Documented the custom multi-instance boundary: remapping only string aliases retains the canonical token and rejects a second provider. Omit the binding with `token: undefined`, or supply a separately exported token, when multiple instances intentionally expose separate contracts.

### Commands and results

All package commands used Node **22.22.2**, Yarn **3.8.7**, and the existing node-modules linker.

| Check | Result |
| --- | --- |
| Task-entry `corepack yarn workspace @urk/core test` | **102 passed**, including public type and isolated duplicate-core package checks |
| `corepack yarn workspace @urk/core build` then `corepack yarn workspace @urk/adapters test` | **6 passed**; public root/DOM/leaf declarations and runtime contract checks pass |
| `corepack yarn install` then `corepack yarn install --immutable` | Exit 0; staged workspace versions/core peer resolve without adding third-party dependencies; existing Astro language-server TypeScript peer warning remains |
| `corepack yarn workspace @urk/core typecheck` | Exit 0 |
| `corepack yarn exec tsc --noEmit --jsx react-jsx` | Exit 0; aggregate library source check |
| `corepack yarn test` | Exit 0: **102 core + 6 adapters + 3 React SSR + 1 Next SSR**; Astro **39 files, 0 errors, 0 warnings, 0 hints** |
| `corepack yarn test:integration` | Exit 0; **17 browser tests passed** against private React and real Next hosts; core/adapters/React/Next builds pass before the gate |
| `corepack yarn workspace @urk/examples build` | Exit 0; shared internal examples compile |
| `corepack yarn workspace urk-examples build` | Exit 0; private Vite proof production build |
| Task-entry preservation hash audit | **137 website/audio proof/catalog files unchanged** |
| Browser host cleanup check | No listeners remain on proof ports 5174 or 3102 |
| `git diff --check` | Pass |

The packed test extracts **90 core files and 46 adapter files** into a temporary fixture. All six non-Three subpaths and the DOM composite pass strict public declaration checking and runtime import/factory checks without installed `three` or `@types/three`. Browser globals and scheduling entrypoints throw if read during those imports/factory calls. Root/Three imports reject when their peer is absent, preserving the existing boundary. A separate process with the existing local Three peer copied into the fixture verifies root/Three module and factory identity without a browser or network install. Temporary tarballs and fixtures are removed in `finally`. The fixture initially tried the unexported Three package-metadata subpath; resolving its installed runtime entry corrected that fixture, and both targeted and full gates then passed.

Runtime contract tests also boot actual loading, pointer, and storage registrations with a manual scheduler, verify token/string/ID lookup and mixed dependencies, preserve borrowed storage data after shutdown, reject a competing canonical provider without replacing the first API, and prove explicit token omission/replacement allows intentional independent instances. All seven factories remain inert under browser/scheduler access guards. Root/Three declarations are checked with the existing workspace peer/types; only the DOM-only declarations are checked in the isolated packed fixture.

The browser gate remains the established React/Next ownership gate; it does not replace a built-in adapter resource-ownership audit or a shared cross-host experience proof. Echo-only workspace scripts are not counted as tests. Existing Node mock-timer and server color-environment warnings were benign. Full-root build/lint, website/Next production builds, deployed-site smoke, and performance measurements were not repeated in this slice. No speedup or bundle-size improvement is claimed from independent exports.

### Exact adapter slice file inventory

Modified:

- `packages/adapters/src/audio/index.ts`
- `packages/adapters/src/input/index.ts`
- `packages/adapters/src/loading/index.ts`
- `packages/adapters/src/pointer/index.ts`
- `packages/adapters/src/storage/index.ts`
- `packages/adapters/src/three/index.ts`
- `packages/adapters/src/ui-widgets/index.ts`
- `packages/adapters/package.json`
- `packages/adapters/README.md`
- `packages/core/package.json`
- `packages/core/README.md`
- `yarn.lock`
- `.yarn/install-state.gz`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/MIGRATION_V02.md`
- `docs/VALIDATION.md`
- `DEVELOPMENT.md`
- `BUILD_STATUS.md`

Created:

- `packages/adapters/tests/contracts.test.mjs`
- `packages/adapters/tests/packaged-exports.test.mjs`
- `packages/adapters/tests/types/dom.ts`
- `packages/adapters/tests/types/root.ts`
- `packages/adapters/tests/types/tsconfig.json`

Existing lifecycle, framework ownership, website, and audio proof/catalog work stays preserved. Continuous scheduling, legacy phases, sequential adapter startup, borrowed service lookup, package names, and thin wrappers remain unchanged. Cancellation remains cooperative. Next audit built-in adapter ownership and prove repeated mounting/disposal before collecting comparable measurements; service-token lookup, a common context facade, dependency sorting, transition queues, and automatic idle scheduling remain separate decisions. No commit, push, package publish, or deployment was performed.

## Implemented URK v0.2 — 2026-10-07

The current working tree now implements the v0.2 runtime and a usable shared experience. This section supersedes the earlier slice's staged 0.1.x versions and deferred service lookup, dependency planning, ownership audit, shared experience, idle mode, and measurement work. All six package workspaces and the private root are now **0.2.0**; public workspace peer ranges use **^0.2.0**. These changes are local and unpublished.

### Delivered behavior

- Typed service bindings and `ctx.get(Token)` / `ctx.require(Token)` resolve adapter and borrowed-service contracts. Competing token providers reject; ambiguous legacy string lookups require an explicit registry.
- Initial adapter dependencies are planned before acquisition. Forward references work, missing providers and cycles reject, and startup remains sequential. Duplicate configured controllers also reject before adapters acquire resources. Existing hook-only adapter providers remain valid.
- Opt-in `frameMode: 'auto'` rests when no started controller has an update function and wakes when an updater starts. The continuous default and legacy experience phases remain compatible. Direct legacy registry mutations cannot reactivate a failed kernel.
- Input, pointer, loading, UI widgets, Three, and audio register cleanup at acquisition through the runtime scope. Partial setup and deferred audio preload are cancellable; borrowed hosts and supplied services remain owned by their caller.
- One shared v0.2 experience now runs in standalone, React, real Next, and website hosts. It provides selection, saved preferences, pause/resume, diagnostics, unmount, fresh startup, and deliberate setup-failure recovery. Event-driven interaction rests with zero kernel frames.
- The CLI generates a v0.2 starter with typed lookups and auto scheduling. A packed CLI resolves its template versions outside the monorepo.
- A dependency-aware build script builds requested workspace prerequisites once. Echo-only validation scripts were removed or replaced with actual checks.

### Validation performed

Commands used Node **22.22.2**, Yarn **3.8.7**, and the existing node-modules linker. No new third-party dependency was added in this rework.

| Check | Result |
| --- | --- |
| `corepack yarn install` and `corepack yarn install --immutable` | Pass; updated local workspace versions and dependencies resolve. Existing Astro language-server TypeScript peer warning remains. |
| `corepack yarn test` | Pass: **107 core, 6 adapter, 3 React SSR, 1 Next SSR** checks, and website diagnostics with no errors, warnings, or hints. |
| Final `corepack yarn workspace @urk/core test` | **108 passed**, including failure guards and the last hook-only dependency-provider compatibility adjustment. |
| Aggregate typecheck and v0.2 example source typecheck | Pass, including the final core adjustment. |
| `corepack yarn test:integration` | **20 browser tests passed**: existing React/Next ownership cases plus the shared standalone/React/Next experience, repeated recovery and disposal, saved preferences, and idle frames. |
| `corepack yarn build` | Pass across all nine workspaces in dependency order. |
| `corepack yarn lint` | Pass; actual TypeScript and Astro checks. |
| Final private Vite, website, and Next production builds | Pass; website generates 81 pages and Next generates 7 static pages including `/v02`. |
| Final website check | **40 files, 0 errors, 0 warnings, 0 hints**. |
| Isolated packed CLI generation and generated starter typecheck | Pass outside the monorepo; no network install needed for the generation check. |
| Deferred audio acquisition check | Cancellation occurs before preload settles; zero media listeners remain and acquired playback is stopped once. |
| Partial input acquisition check | A failed listener installation removes the previously installed listener; zero listeners remain. |
| Browser Three disposal check | Zero owned canvases remain, borrowed host stays connected, renderer disposed once. |
| Website/audio preservation audit | **135 of 137 prior files unchanged**; the two intentional changes add v0.2 links to the website homepage and docs index. |
| `git diff --check` | Pass. |

The last adjustment only changes dependency preflight's recognition of existing providers with no API value. Core tests, core build, and aggregate typechecking cover that final adjustment; the full browser gate and application production builds passed immediately before it and were not repeated afterward. Temporary packed fixtures are removed. Integration ports 5174 and 3102 are clear. A development preview on port 5175 remains intentionally available for review at `http://127.0.0.1:5175/v02/`.

The reproducible manual-scheduler measurement is saved in `benchmarks/results/runtime-v02.json`. With no updater, auto mode dispatches **0** frames across 5,000 opportunities; continuous mode dispatches **5,000**. Both dispatch 5,000 frames with active updaters. The record contains two warmups and seven measured runs, environment details, medians, and maximums. It compares modes within this working tree, not historical v0.1, browser rendering, GPU cost, or heap behavior. No broad speedup claim is made. The final provider-presence adjustment occurs during startup outside the measured dispatch interval.

Cancellation remains cooperative: a hook that never settles can keep cleanup pending. Deferred transitions, parallel setup, live removal/hot swapping, deep profiling, and toolchain upgrades are recorded in `docs/DEFERRED.md`. No commit, tag, push, package publication, or website deployment was performed.

### Exact v0.2 rework file inventory

Modified in this rework, including files introduced by earlier local slices:

- Root: `package.json`, `README.md`, `CHANGELOG.md`, `DEVELOPMENT.md`, `BUILD_STATUS.md`, `yarn.lock`, `.yarn/install-state.gz`.
- Workspace manifests: `packages/core/package.json`, `packages/adapters/package.json`, `packages/examples/package.json`, `packages/react-urk/package.json`, `packages/next-urk/package.json`, `packages/cli/package.json`, `examples/package.json`, `apps/next-proof/package.json`.
- Core: `packages/core/src/types.ts`, `packages/core/src/kernel/Kernel.ts`, `packages/core/src/adapters/AdapterRegistry.ts`, `packages/core/src/controllers/ControllerRegistry.ts`, `packages/core/src/runtime/ServiceRegistry.ts`, `packages/core/tests/types/capabilities.ts`, `packages/core/README.md`.
- Adapters: `packages/adapters/src/audio/index.ts`, `packages/adapters/src/input/index.ts`, `packages/adapters/src/loading/index.ts`, `packages/adapters/src/pointer/index.ts`, `packages/adapters/src/three/index.ts`, `packages/adapters/src/ui-widgets/index.ts`, `packages/adapters/tests/packaged-exports.test.mjs`, `packages/adapters/README.md`.
- Frameworks: `packages/react-urk/src/hooks.ts`, `packages/react-urk/README.md`, `packages/next-urk/README.md`.
- CLI: `packages/cli/src/commands/create.ts`, `packages/cli/src/templates/create.ts`, `packages/cli/README.md`.
- Hosts: `examples/index.html`, `examples/vite.config.ts`, `examples/tsconfig.json`, `apps/next-proof/app/page.tsx`, `apps/www/src/pages/index.astro`, `apps/www/src/content/docs/docs/index.mdx`.
- Canon: `docs/ARCHITECTURE.md`, `docs/BOUNDARY.md`, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/MIGRATION_V02.md`, `docs/DEFERRED.md`, `docs/VALIDATION.md`, `codex/SESSION_HANDOFF.md`, `codex/PLANS.md`.

Created in this rework:

- `packages/core/src/adapters/planAdapters.ts`
- `packages/core/tests/v02.test.mjs`
- `packages/examples/src/v02/runtime.ts`
- `examples/v02/host.tsx`
- `examples/v02/main.ts`
- `examples/v02/main.tsx`
- `examples/v02/index.html`
- `examples/v02/react.html`
- `examples/tests/browser/v02.spec.ts`
- `apps/next-proof/app/v02/page.tsx`
- `apps/www/src/pages/v02.astro`
- `apps/www/src/content/docs/docs/guides/urk-v02.mdx`
- `scripts/build.mjs`
- `benchmarks/runtime.mjs`
- `benchmarks/results/runtime-v02.json`
- `docs/PERFORMANCE.md`

Earlier local lifecycle, framework ownership, independent exports, website, and audio-proof changes remain preserved and are recorded in the preceding sections.

## Architecture simplification — 2026-10-07

Reworked the existing v0.2 core in response to the request for a simpler, faster architecture. No package, framework layer, registry superclass, or replacement public API was introduced.

- Removed the kernel's duplicate paused/failed/disposed flags. Lifecycle decisions now read the operational store; the successful-boot flag remains historical inspector metadata.
- Commit lifecycle state before injected scheduler calls. Dynamic controller activation leaves an already-running frame chain alone. Existing completion, cancellation, observer, and cleanup contracts remain.
- Replaced controller startup's repeated full-registry update-plan rebuild with ordered insertion of compact active entries. Pending-start checks no longer allocate public controller metadata arrays. Frames use the context already captured at startup.
- Replaced adapter ID/capability/token indirection through three maps with an ordered acquisition list and one direct key index. Reservation, publication, reverse disposal, and borrowed-service ownership remain distinct.
- Rewrote the architecture document around actual component responsibilities and dependency direction, removing speculative layers and stale descriptions of implemented features as future work.

### Evidence

| Check | Result |
| --- | --- |
| `corepack yarn test` | Pass: **109 core, 6 adapter, 3 React SSR, 1 Next SSR** checks. Website check: **40 files, 0 errors, 0 warnings, 0 hints**. |
| `corepack yarn typecheck` | Pass for aggregate library sources. |
| `corepack yarn test:integration` | **20 passed**, including standalone/React/Next experience recovery and existing ownership/navigation cases. The gate builds core, adapters, shared examples, React, and Next libraries. |
| Existing core coverage | Concurrent startup/order, callback receivers and contexts, frame membership, cancellation, failed-kernel guards, token identity/reservation, rollback, and reverse cleanup remain covered. |
| Added focused regression | Injected scheduler callbacks observe committed lifecycle state; dynamic startup does not restart a running scheduler; failure-time callbacks cannot activate new services. |
| Saved-build comparison | Same Node 22.22.2 / Apple M1 environment, alternating execution order, 3 warmups and 11 measured samples. Both builds identified by JavaScript SHA-256; workload results checked. |
| Local v0.2 preview | HTTP 200 at port 5175 after validation. |
| `git diff --check` | Pass. |

The measured 1,000-updater boot median changed from **7.599 ms to 1.539 ms**; 5,000 updaters changed from **144.463 ms to 7.667 ms**. One million typed adapter lookups changed from **42.758 ms to 36.464 ms**, and alias lookups from **45.322 ms to 29.555 ms**. Busy dispatch was **1.6% slower** in the recorded run; no frame/rendering or overall application speedup is claimed. See `docs/PERFORMANCE.md` and the complete raw samples in `benchmarks/results/architecture-v02.json`.

Initial candidates exposed a busy-dispatch regression. Separating compact active entries from lifecycle records removed most of that cost before the final validation. The recorded comparison is against the immediately preceding local v0.2 build, retained in the ignored `.codex/validation/architecture-before` directory, not a historical release. Reverse concurrent insertion can still shift entries, and no heap/GPU profiling was performed.

Production website/Next/CLI builds and deployment were not repeated for this internal core refactor; their earlier evidence remains separate. SSR, website checking, library builds, and real browser hosts were rerun. Existing application source, adapters, wrappers, package versions, Node/Yarn configuration, and prior local work remain preserved. Cancellation remains cooperative. No external release action was performed.

### Exact files changed in this refactor

Modified:

- `packages/core/src/kernel/Kernel.ts`
- `packages/core/src/controllers/ControllerRegistry.ts`
- `packages/core/src/adapters/AdapterRegistry.ts`
- `packages/core/tests/lifecycle-observation.test.mjs`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MIGRATION_V02.md`
- `docs/PERFORMANCE.md`
- `docs/VALIDATION.md`

Created:

- `benchmarks/architecture.mjs`
- `benchmarks/results/architecture-v02.json`

The lifecycle store itself needed no change; its existing commit/publish contract now serves as the kernel's operational source of truth.

## CI wiring and package/bundle reporting — 2026-10-07

Completed the next local delivery step from the original plan. Added a GitHub Actions workflow for pull requests, `main` pushes, and manual dispatch. It selects Node 22 from `.nvmrc`, enables the pinned Yarn package manager, installs immutably, builds all workspaces/production hosts, runs existing static and regression gates, installs Chromium with its Linux dependencies, and runs the real browser hosts. Actions are pinned to verified revisions, permissions are read-only, and generated size/browser reports are retained for 14 days. There is no publication or deployment step.

`corepack yarn report:size` now measures all five publishable npm archives plus core, DOM, Three, React, and Next browser fixtures using built public exports. It records raw/gzip/Brotli bytes, package integrity, bundle hashes, module counts, actual external imports, tool versions, lockfile hash, and repository state. DOM/core/framework fixtures reject bundled Three; the Three fixture must include it. Unexpected externals, Node-only browser shims, source aliases, and empty export fixtures reject. Temporary archives/fixtures are removed in `finally`, and stale success reports are removed at the start of a run.

The browser configuration rejects `.only` tests in CI and generates an HTML report while retaining failure traces. No new runtime tests or dependencies were introduced.

### Commands and results

The complete application command sequence used Node **22.22.2**, Yarn **3.8.7**, and `CI=true` locally on macOS. This is not a GitHub-hosted Ubuntu run.

| Check | Result |
| --- | --- |
| `corepack yarn install --immutable` | Pass; 726 cached packages. Existing Astro language-server TypeScript peer warning remains. |
| `corepack yarn build` | Pass across all nine workspaces, including website, private proof, Next production host, and CLI. |
| `corepack yarn report:size` | Pass; five package archives and five browser fixtures reported. |
| Repeat size report after full build | All package sizes/integrities and bundle sizes/hashes match the first run exactly. |
| `corepack yarn lint` | Pass; aggregate TypeScript and Astro checks. Website: 40 files, 0 errors, 0 warnings, 0 hints. |
| Proof workspace and Next proof `lint` commands | Both pass. |
| `corepack yarn test` | **109 core + 6 adapter + 3 React SSR + 1 Next SSR** checks pass; website check passes. |
| `corepack yarn test:integration` with `CI=true` | **20 passed**; generated `.codex/validation/ownership-report/index.html`. |
| Workflow static inspection | YAML parses; events, runner, permissions, and full action pins checked. Every configured action input exists in that exact pinned action's metadata. |
| `git diff --check` | Pass. |

Core fixture gzip size is **6,607 bytes**, DOM is **9,493**, Three-enabled is **132,011**, React is **7,597**, and Next is **7,691**. Framework peers are external in wrapper measurements; these are library surfaces, not complete application download sizes. npm archives include types/maps/metadata and differ from browser transfer costs. The first recorded baseline is `benchmarks/results/bundles-v02.json`; the methodology and limits are in `docs/PERFORMANCE.md`.

Official [Playwright CI guidance](https://playwright.dev/docs/ci) informed the browser/system-dependency setup. Action tags were resolved to full revisions and their metadata checked; project tool versions were retained. Linux browser dependencies, GitHub event execution, job-summary rendering, and artifact upload are configured but require the first hosted run after the workflow is pushed. No hosted success is claimed. The existing local Chromium installation was used for the local run; the Linux installation step was not executed on macOS.

The plan now marks CI as configured with hosted execution pending. Cold/warm build measurements, a supported toolchain matrix, broader profiling, and justified regression budgets remain outstanding. Existing runtime/application source and prior local edits are preserved; no commit, push, release, or deployment was performed.

### Exact files changed

Created:

- `.github/workflows/ci.yml`
- `scripts/bundle-report.mjs`
- `benchmarks/results/bundles-v02.json`

Modified:

- `package.json`
- `examples/playwright.config.ts`
- `DEVELOPMENT.md`
- `docs/PERFORMANCE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/07_URK/URK_V02_ARCHITECTURE_AND_PLAN.md`
- `docs/VALIDATION.md`
# V2 engine completion pass — 2026-10-07

On `refactor/kernel-v2`, added ordered `RuntimeStore.transition` commands, immediate command cancellation with awaited notification cleanup, and opt-in parallel adapter dependency batches. Setup failure now signals cancellation before partial cleanup; boot retains its initiating error. Published sibling cleanup follows planned admission order. The shared v0.2 experience uses both APIs. Sequential startup and synchronous `setPhase` remain compatibility defaults.

Changed engine files: `packages/core/src/runtime/RuntimeStore.ts`, `packages/core/src/kernel/Kernel.ts`, `packages/core/src/adapters/AdapterRegistry.ts`, `packages/core/src/adapters/planAdapters.ts`, `packages/core/src/types.ts`, and `packages/examples/src/v02/runtime.ts`. Added `transitions.test.mjs` and `parallel-startup.test.mjs`; updated API/architecture/migration/decision documentation.

Final local checks on Node 22.22.2: **120 core tests and public declaration checks, 4 React/Next SSR tests, 20 browser integration tests, six runtime/tooling package builds, aggregate TypeScript checking, private proof production build, and website check (40 files, zero errors/warnings/hints) passed**. `git diff --check` passed. Logs: `/tmp/urk-v2-engine-{tests,ssr,browser,build,types,proof,website}.log`. An initial lifecycle-reason regression was corrected before the final passing run.

No new timing gain is claimed; earlier performance/bundle records predate this pass. No hosted CI run, publication, or deployment was performed. Cancellation remains cooperative, and legacy phase writes bypass the explicit command queue.


## Complete v0.2 playground — 2026-10-08

On `refactor/kernel-v2`, the shared playground now combines Three.js picking, focused keyboard selection/rotation, accessible buttons, namespaced selection/volume preferences, opt-in confirmation audio, actual initialization progress, and overlays. Drawing is coalesced on demand; pause and abort cancel queued frames. Shutdown mutes/stops sound immediately and awaits pending playback before disposing the adapter. Blocked storage uses borrowed memory; invalid preferences and media errors remain local. Factories, providers, routes, and public core/adapter APIs are unchanged.

Files: `packages/examples/src/v02/{runtime,scene,styles}.ts`, `packages/examples/package.json`, `yarn.lock`, `apps/next-proof/public/audio/confirm.wav`, `examples/tests/browser/v02.spec.ts`, the website `guides/urk-v02.mdx`, and this record. The Next WAV is byte-identical to the existing proof asset.

Validation on Node 22.22.2 / Yarn 3.8.7:

- Shared package and affected dependencies compile; standalone/React proof, Next production, and website production builds pass.
- **12 focused Chromium browser checks pass** across standalone, React, and real Next hosts, including deferred playback/loading cancellation, blocked/malformed storage, WebGL rollback, fresh-kernel recovery, idle/coalesced rendering, resize, and disposal. Completed disposal leaves no tracked frame requests, resize observers, retained media sources, active playback, owned surfaces, or controller event subscriptions.
- **3 React + 1 Next SSR checks pass**. Website check: 40 files, zero errors/warnings/hints. Desktop and 390px layouts visually inspected; screenshots are under `.codex/validation/v02-*.png`.
- `git diff --check` passes. Core and ownership suites were not repeated because their code did not change in this slice. Browser coverage is Chromium; no cross-browser or speed improvement claim is made.

The website build still reports its large-chunk warning and missing docs 404 entry; builds succeed. Run Next production builds after the integration server exits because Next's generated type directories share the project configuration. Pending browser media promises remain cooperative cleanup dependencies. No publication or deployment was performed.


## Bounded parallel workspace builds — 2026-10-08

Updated `scripts/build.mjs`, added `scripts/build.test.mjs`, wired `test:build` into the root test command in `package.json`, and updated `DEVELOPMENT.md`. Builds admit at most two independent workspaces by default; `--jobs N` overrides the limit and `--jobs 1` preserves sequential execution. Targets and `--plan` remain supported. Local dependency barriers include runtime, development, peer, optional, and transitive dependencies through packages without build scripts. The first failure stops admission; already-running builds settle before the command reports it.

Validation: **6 focused build-runner checks passed**; full `corepack yarn build` passed across all nine workspaces on Node 22 / Yarn 3.8.7. Full and website-only plan output were inspected; `git diff --check` passed. The existing website large-chunk and docs 404 warnings remain. Full build log: `/tmp/urk-v02-parallel-build.log`. Runtime/browser suites were not repeated for this build-only change. No measured speedup, hosted CI result, toolchain migration, publication, or deployment is claimed.


## Public v0.2 playground integration — 2026-10-09

`/playground/` now runs the completed shared experience, with `/v02/` retained through the same `V02Playground.astro` host. The earlier config editor is preserved at `/playground/config/`; homepage navigation and usage links lead to the live playground. The host handles page hide/show and element disconnect/reconnect, waits for pending cleanup before mounting a fresh silent runtime, and keeps stacked navigation in normal flow on narrow playground pages. Workbench teardown uses its own resource scope so controls and surfaces are released even if kernel cleanup rejects. Repeated restart clicks during cleanup admit one replacement.

Changed implementation: the shared Astro host, `pages/playground.astro`, `pages/playground/config.astro`, `pages/v02.astro`, the homepage link, `packages/examples/src/v02/runtime.ts`, website route smoke markers, and the browser configuration/website fixture. Updated playground usage pages, public-site current status, and development instructions.

Validation: website check passed for **42 files with zero errors/warnings/hints**; the shared examples package compiled; website (82 pages), standalone/React proof, and Next production builds passed. The full **32-check Chromium gate passed**, covering 17 ownership checks and 15 shared/website playground checks. After adding the restart guard, all 15 playground checks passed again, including rapid restart. A production-browser check verified sound, disposal, zero page errors, and desktop/390px layouts. Screenshots: `.codex/validation/playground-production-{desktop,mobile}.png`. `git diff --check` passed.

The full website HTTP smoke command verified the new playground routes and then stopped at the pre-existing local `/robots.txt` 404. Local production does not pass that deployment-oriented check; no deployed-site result is claimed. Existing large-chunk/docs-404 build warnings remain. Logs: `/tmp/urk-v02-{website-build,proof-build,next-final,website-browser,playground-final}.log`. No core API, publication, or deployment change was made.

## v0.2 release-candidate review — 2026-10-09

Reviewed lifecycle cancellation, controller/adapter cleanup, framework ownership, public exports, and the shared playground host. Committed the accumulated implementation on `refactor/kernel-v2`; preserved prior website/audio work and excluded generated output and Yarn install-state changes.

Fixed the local website check in `scripts/smoke-www.mjs`: explicit `--local` checks Astro's generated routes and assets without requiring Cloudflare's injected `robots.txt`. Default deployed mode retains that requirement. Usage is in `docs/DEPLOYMENT.md`; the earlier release ledger is labeled historical in `codex/RELEASE_HYGIENE.md`.

Final local results on Node **22.22.2**, Yarn **3.8.7**, with `CI=true`:

- Immutable install, all nine workspace production builds, aggregate/library/proof type checks, and website check passed (42 files; zero errors, warnings, or hints).
- **6 build-runner, 120 core, 6 adapter/package, 3 React SSR, and 1 Next SSR tests passed.** Public declaration checks passed.
- **32 Chromium integration checks passed**, including ownership, shared interactions, cancellation, idle rendering, disposal, Next navigation, and website restoration.
- Package/browser size reporting passed. Current core/DOM/Three/React/Next fixture gzip bytes are **7,267 / 10,160 / 132,637 / 8,254 / 8,353**; earlier benchmark files remain historical baselines. No new speedup claim.
- Local production smoke passed: 10 routes (including 404), plus nine assets. Unknown flags reject; deployed mode was separately confirmed to reject the absent local robots response.
- `git diff --check` passed. Logs: `/tmp/urk-v02-release-checks.log` and `/tmp/urk-v02-release-browser.log`.

Existing Astro language-server peer, website large-chunk, and docs-404 build warnings remain non-blocking. Chromium/macOS is the local browser evidence; hosted CI, broader performance workloads, and the supported toolchain matrix are not established by this run. No package publication or website deployment was performed.

## Lifecycle review correction — 2026-10-10

Review reproduced an operational-state bug: an application write to the legacy `paused` phase made `kernel.pause()` leave frames running; an application phase change while paused made `resume()` leave the kernel stopped. `Kernel.ts` now uses lifecycle state for both guards and preserves the last non-paused application phase. No public signature or lifecycle policy changes.

Added two focused regressions in `lifecycle-observation.test.mjs`, covering continuous and auto frame modes, duplicate calls, phase restoration, and actual update delivery. On Node 22.22.2 / Yarn 3.8.7, **122 core tests and declaration checks passed**, then **all 32 Chromium integration checks passed**. The integration command rebuilt affected runtime dependencies; full production builds are delegated to the PR gate. Logs: `/tmp/urk-v02-pause-{review,browser}.log`. `git diff --check` passed.

The preceding candidate `e7ec4dc` passed its first [GitHub-hosted Ubuntu CI run](https://github.com/eonhive/urk/actions/runs/38025788225), including browser checks and artifact upload. Current-head hosted results are tracked on [PR #1](https://github.com/eonhive/urk/pull/1). No external review comments were present at this review. The documented Cloudflare production branch is `main`; merging therefore needs to account for automatic deployment as well as source integration.

## Production delivery and robots correction — 2026-10-10

After explicit merge/deployment approval, PR #1 merged as `8404cc4`. Its [main-branch CI run](https://github.com/eonhive/urk/actions/runs/38082288950) and Cloudflare production build passed. The live playground passed a Chromium check for picking, keyboard rotation, preferences, sound opt-in, pause/resume, idle rendering, disposal, fresh-kernel recovery, and a 390px layout with zero page errors.

The deployed HTTP smoke exposed `/robots.txt` returning 404: Cloudflare did not supply the response assumed by the earlier check. Added `apps/www/src/pages/robots.txt.ts` to generate the response and canonical sitemap from Astro's configured site URL. Updated `scripts/smoke-www.mjs` so local and deployed modes both require that route; provider-specific `Content-Signal` content is no longer assumed. Updated deployment usage notes.

Website diagnostics and static production build passed on Node 22.22.2 / Yarn 3.8.7. The local production smoke passed **11 routes and nine assets**, including the generated robots response; `git diff --check` passed. Log: `/tmp/urk-robots-validation.log`. No runtime code or npm publication changed. Follow-up production results are recorded with the delivery PR after deployment.

## URK visual identity and playground refresh — 2026-10-11

Rebuilt the homepage and shared playground presentation around the supplied visual references: faceted cyan/violet branding, original transparent hero artwork, coordinated dark/light themes, and a responsive scene/inspector layout. The homepage is static; the interactive runtime starts in the playground. Existing public APIs and host ownership remain unchanged. Theme changes request one coalesced scene redraw, and theme controls work when browser storage is blocked.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- **51 focused browser checks passed** across Chromium, Firefox, and WebKit for standalone, React, Next, website navigation, preferences, sound, cancellation, disposal, idle rendering, and branding. After final artwork and contrast adjustments, all **six brand checks** passed again, including 1440px/390px layouts and blocked storage.
- Affected examples, Next, and website production builds passed. Root type checking, examples/Next checks, and website diagnostics passed; the website reported **43 files, zero errors/warnings/hints**.
- Local production smoke passed **11 routes and 14 assets**. `git diff --check` passed. Core/SSR suites were not repeated for this presentation slice; their previous results remain recorded above.
- Package size reporting and the existing runtime microbenchmark completed. Raw results are in `benchmarks/results/{bundles,runtime}-brand-v02.json`; methodology and limitations are in `docs/PERFORMANCE.md`. No overall speed improvement or physical-device Safari result is claimed.

Updated design canon, decision D018, performance evidence, and roadmap status. Existing website bundle-size warnings remain. Logs: `/tmp/urk-brand-{browser,final-visual,host-builds,final-check}.log`. This branch does not publish packages or deploy the redesign.

## Media milestones 1–2 — 2026-10-12

Added the browser-native video adapter (`packages/adapters/src/video/`) and `@urk/adapters/video` exports, with borrowed/owned elements, independent transport, captions, stable event snapshots, immediate playback cancellation, and safe cross-kernel element handoff. Existing audio/core APIs remain unchanged. Added shared Video Proof and Interactive Media controllers under `packages/examples/src/{video-proof,interactive-media}/`, private cue/time-source helpers in `src/media/`, catalog/export wiring, standalone entries, and the shared website `MediaExample.astro` host. Original Orbit MP4, poster, and captions are shared across both hosts; an optional Swift generator reproduces the clip.

Interactive Media demonstrates timestamp/ended/application-event cues, chapters, a timed hotspot, two application-owned branches, native captions, and validated bookmarks through storage. Fresh kernels restore paused. Unavailable storage falls back to borrowed page memory. Seeks skip missed actions and cancel pending work; replay re-arms repeating cues, including the zero-time boundary. Optional frame-sensitive observation uses native video callbacks or an animation-frame fallback; the demos use native events without an idle frame loop.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- **17 adapter/package tests passed**, including public declarations, packed dependency-light exports, playback races, competing element ownership, rollback, and cleanup failures.
- **6 cue/time-source checks and 3 existing React SSR checks passed**. Cue checks cover ordering, seek/replay, cooperative cancellation, reentrancy, optional frame cancellation/fallback, and malformed bookmarks.
- **24 Chromium/Firefox/WebKit browser checks passed** across standalone and website hosts: real sample decoding, multiple players, local files, captions, controls, branch/seek/replay, bookmarks, blocked storage, deferred playback cancellation, silent recovery, and disposal. Completed disposal leaves zero tracked media listeners, sources, object URLs, playing videos, and frame requests.
- Affected package, standalone, and website production builds passed (**86 website pages**), as did root/proof type checks and website diagnostics (**44 files; zero errors/warnings/hints**). Desktop and 390px layouts were visually checked, including native-caption contrast. `git diff --check` passed.

Usage docs: `packages/adapters/src/video/README.md`, `examples/{video-proof,interactive-media}/README.md`, and the two website example guides. Logs: `/tmp/urk-video-adapters.log`, `/tmp/urk-media-{builds,check,typecheck,unit,cues,browser-clean}.log`. An intermediate browser run was invalidated by a concurrent dependency rebuild; the final 24-check run completed after builds finished. Existing website chunk-size warnings remain. Core/Next ownership suites were not repeated because those implementations did not change. Browser engines on macOS are not physical-device Safari evidence; optional frame sampling has focused controlled tests, not a frame-perfect synchronization claim.

This local checkpoint stops after milestone 2. Cue helpers remain private; async actions must cooperate with cancellation. Audio mixing/ducking, motion/flow, Three.js video textures, and the larger showcase are subsequent milestones. No push, package publication, or deployment was performed.

## Package naming and overlay compatibility - 2026-10-12

Moved the framework implementations to `packages/react` (`@urk/react`) and `packages/next` (`@urk/next`), with Next depending on React. The old published names are v0.2 forwarding packages under `packages/compat`. Added `@urk/adapters/ui-overlay` and matching factory/type/token aliases, keeping the original UI widget implementation, registration strings, and token identity. Updated workspace manifests, paths, builds, CLI checks, proof imports, Yarn state, and directly affected docs. Existing media work remains preserved.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- `corepack yarn install` and `corepack yarn install --immutable` passed. The existing Astro language-server/Volar TypeScript peer warning remains; no external dependency was added.
- `corepack yarn build` passed for every workspace, including both forwarders, examples, Next, and the website. Final website and Next production builds were repeated after the last label/documentation edits.
- `corepack yarn lint`, `corepack yarn workspace urk-examples lint`, and `corepack yarn workspace @urk/next-proof lint` passed. Website diagnostics covered **44 files with zero errors, warnings, or hints**.
- `corepack yarn test` passed **159 tests**: 6 build-plan, 122 core, 18 adapter, 2 CLI, 9 React/media, and 2 Next/packed-wrapper checks, plus public type checks and website diagnostics.
- Packed adapter tests verified old `ui-widgets` and new `ui-overlay` imports and strict declarations without Three.js. Both names share the exact factory/token; legacy string lookup, duplicate-token rejection, and cleanup remain intact. Root/Three imports still resolve with their existing peer.
- Packed wrapper tests verified all old/new runtime exports are identical, hooks consume the same context through every provider name, SSR stays inert, Next retains its client directive, and strict declarations resolve outside monorepo path aliases.
- `URK_WEBSITE_PORT=4325 corepack yarn workspace urk-examples test:browser ownership.spec.ts v02.spec.ts` passed **29 Chromium checks**, including Strict Mode replay, unmount during startup, competing owners, Next navigation, shared overlays, picking, idle rendering, and disposal. The initial launch was interrupted because an unrelated local server occupied the default website port; the isolated rerun passed. Firefox/WebKit and unrelated media/brand browser suites were not repeated for this naming change.
- `corepack yarn report:size` packed all **seven** publishable packages and built all five representative fixtures. Its assertions confirm Three.js remains absent from DOM/React/Next fixtures. Reports are under `.codex/validation/bundle-report/`; no performance improvement is claimed.
- A source comparison verified React/Next provider/hook implementations are unchanged except Next's package import/re-export specifier. `git diff --check` passed.

Registry reads returned E404 for `@urk/react` and `@urk/next`, and latest `0.1.1` for both published legacy names. This verifies no public package was found under the new names at the check, not publication permission. No packages were published. Existing `0.1.x` consumers need an explicit upgrade to use the forwarders, and mixed independently installed React binding copies cannot be assumed to share context. Historical release records and prior measured package names remain unchanged. See [migration notes](MIGRATION_V02.md) and decision D-019.

## v0.3 interactive rendering/UI integration slice - 2026-10-13

Extended the existing shared v0.2 experience, retaining its routes, exports, and `0.2.0` manifests. Native layout/rotation controls, hover callouts, selection feedback, and finite Row/Arc transitions work across standalone, React, Next, and website hosts. Operational pause freezes progress; resize/theme changes may repaint the frozen view. Reduced motion skips animation. Scene-owned frames, observers, geometry/materials, subscriptions, and controls retain scoped cleanup. The kernel, independent Three adapter, and small overlay keep their existing architectural boundaries.

Implementation files changed in this slice:

- `packages/adapters/src/{three,input,pointer,ui-widgets}/index.ts`: changed-size events, unchanged-buffer preservation, pre-render picking, cancellation guards, input focus/visibility resets, and accessible overlay feedback.
- `packages/examples/src/v02/{runtime,scene,styles}.ts`: native controls, application-owned transitions and pause policy, scoped hover feedback, and unobstructed narrow-screen scenes.
- `apps/next-proof/app/v02/page.tsx`: stable factory identity across host rerenders; provider/hook implementations and SSR ownership remain unchanged.
- `examples/tests/browser/rendering-ui.spec.ts` (new) and `v02.spec.ts`: focused integration coverage and updated owned-event subscription count.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- `corepack yarn install --immutable` and the complete `corepack yarn build` passed, including forwarding packages, standalone/React, Next production, and all 86 website pages.
- `corepack yarn lint`, examples lint, and Next-proof lint passed. Website diagnostics: **44 files, zero errors/warnings/hints**. `git diff --check` passed.
- **18 adapter/package tests** plus public declarations passed. Both overlay subpaths still resolve without Three.js and share the original factory/token identity.
- **4 React/Next SSR checks and 1 packed-wrapper compatibility check** passed, including inert acquisition, common context, runtime export identity, and strict declarations.
- **34 Chromium checks** passed for `rendering-ui.spec.ts`, `v02.spec.ts`, and `ownership.spec.ts` before the final narrow-layout adjustment. This includes the 29 existing shared-experience/ownership checks.
- The final rendering/UI and website suites passed across **24 browser cases** (eight each on Chromium, Firefox, and WebKit). One combined run encountered a concurrent rebuild that temporarily removed `packages/examples/dist/v02/runtime.js`, causing an HMR reset during a WebKit transition. After outputs settled, the complete eight-case WebKit rerun passed without implementation changes.
- Browser checks cover native keyboard behavior, hover versus selection, rotation, latest-layout selection, pause/resume mid-transition, reduced motion, paused resize, pre-render raycasts, unchanged drawing buffers, focus loss, cancellation during pending cleanup, and website restoration. Completed disposal leaves zero tracked animation frames, resize observers, owned canvases, and overlays; borrowed hosts survive. Desktop/mobile screenshots and nonblank WebGL pixel assertions verify the scene; screenshots are under `.codex/validation/ownership-browser/`.

Updated only affected adapter READMEs, the shared playground guide, architecture/UI notes, changelog, and this record. Prior naming migration and media work remain preserved. No dependencies, core subsystem, renderer registry, UI framework, package publication, deployment, or release-version bump was added. Existing Astro peer, website chunk-size, and docs-404 build warnings remain. Core, unrelated media/brand browser suites, hosted CI, and physical devices were not revalidated in this slice.

Next smallest task: add context-loss feedback and a demand redraw after WebGL context restoration, with a focused lose/restore/dispose browser regression. This slice does not yet supply that application-level recovery behavior.

## Interactive media: optional audio coordination — 2026-10-13

Implemented Milestone 3 on `thehive/urk-media-video`: an optional `@urk/adapters/audio/mixer` subpath composes existing transports with music/narration/effects/ambience groups and finite cancellable fades. The shared film now has explicit sound opt-in, independent saved music/narration levels, branch crossfades, a synthesized spoken guide, cue-driven narration, ducking that preserves user volume, and visible transcript. Fresh kernels restore silent. Pause, seek, replay, visibility loss, disable, and disposal invalidate playback. Errors remain local to sound controls; no kernel or wrapper API changed.

Files for this milestone:

- `packages/adapters/src/audio/{index.ts,mixer.ts,README.md}`, `packages/adapters/{package.json,README.md}`: compatible native playback cancellation/loading fixes, optional mixer, exports, and usage.
- `packages/examples/src/interactive-media/{mount.ts,sound.ts,view.ts,styles.ts,bookmarks.ts}`: shared sound orchestration, controls, and validated volume preferences.
- `examples/interactive-media/{generate-audio.mjs,AUDIO_ASSETS.md,README.md}`; `orbit-{explore,create,guide}.wav` in both `examples/public/audio/` and `apps/www/public/audio/`: original music and synthesized original narration, shared assets and provenance. The speech generator is an optional external tool, not a runtime/build dependency.
- `packages/adapters/tests/{audio.test.mjs,packaged-exports.test.mjs,types/dom.ts}`, `examples/tests/media.test.mjs`, `examples/tests/browser/{media-probe.ts,interactive-audio.spec.ts}`: focused playback, export, volume, cancellation, and cleanup checks.
- Website interactive-media guide and adapter reference, plus `docs/ARCHITECTURE.md` and this record: current usage and the optional boundary.

Node **22.22.2**, Yarn **3.8.7** validation:

- **25 adapter/package tests** pass, including seven focused audio/mixer cases and packed strict types/inert imports without Three.js.
- **9 cue/React SSR tests** pass; root and standalone proof type checks pass.
- Affected adapter/shared-example/standalone/website builds pass; website builds **86 pages**. Website check: **44 files, zero errors, warnings, or hints**. Existing large-chunk and docs-404 build warnings remain.
- Final **27 browser cases** pass across Chromium, Firefox, and WebKit: 12 new audio cases across both hosts, plus 15 existing playground/website audio cleanup cases. They cover native playback, automatic two-second narration, ducking/restoration, branch crossfade, saved levels, fresh silent recovery, source failure isolation, and cancellation during pending playback. The preceding combined media run passed **24 cases**, including 12 existing cue/chapter/bookmark cases.
- Browser probes report zero pending animation frames after fades, and zero owned audio sources/listeners/playback after disposal. Deferred native playback keeps disposal pending until settlement. Original video behavior, blocked storage, and fresh recovery remain working.
- Desktop (1440px) and narrow (390px) screenshots inspected; no horizontal overflow. Preview: `http://127.0.0.1:5176/interactive-media/`. Screenshots retained at `.codex/validation/urk-audio-{desktop,mobile}.png`. `git diff --check` passes.

No performance gains claimed. Native media volume support varies; physical mobile devices, sample-accurate synchronization, playlists, and audio analysis are not validated or provided by this slice. Core/full ownership suites were not repeated because kernel and wrapper lifecycle code did not change. Existing working-tree changes were preserved; nothing was committed, pushed, published, or deployed.

Next implementation checkpoint: native motion and cancellable experience transitions driven by the existing media controller, followed by optional Three.js video textures.

## Three context-loss recovery - 2026-10-13

Implemented capability-local recovery in the existing Three adapter and shared playground. `three:context-lost` and `three:context-restored` carry the borrowed host and owned canvas, with the adapter ID as source. Loss suppresses rendering, resizing, and picking. Three.js retains ownership of its native renderer restoration; the adapter applies the latest size before notifying consumers. No public method signatures, framework ownership, package versions, dependencies, or kernel lifecycle states changed.

The shared scene freezes its finite transition, cancels pending drawing, and retains selection, rotation, scene objects, and renderer/canvas identity. Its controller disables only scene interaction and shows recovery feedback. Restoration redraws automatically; a paused scene redraws once without advancing or resuming. The lost canvas is hidden to avoid the browser's broken-canvas placeholder. Abort suppresses recovery during pending cleanup, and completed disposal removes both URK and Three native listeners. Existing fresh-kernel recovery remains available if restoration never arrives; there is no forced-restore or retry loop.

Files changed in this pass:

- `packages/adapters/src/three/index.ts` and `packages/adapters/tests/types/root.ts`: context events, cancellation/loss guards, and public payload declaration coverage.
- `packages/examples/src/v02/{scene,runtime,styles}.ts`: scene suspension/restoration, controller feedback, disabled controls, and hidden lost canvas.
- `examples/tests/browser/context-recovery.spec.ts` and `rendering-probe.ts` (new): native loss/restoration tests and the extracted shared frame/pixel/resource probe.
- `examples/tests/browser/rendering-ui.spec.ts` and `v02.spec.ts`: reuse the probe and account for the two scoped recovery subscriptions.
- `packages/adapters/src/three/README.md`, the website `guides/urk-v02.mdx`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, and this record: recovery contract, usage, boundaries, and evidence.

Node **22.22.2** / Yarn **3.8.7** validation:

- **36 rendering/recovery browser cases passed** across Chromium, Firefox, and WebKit. After the lost-canvas style correction, all **21 context-recovery cases passed again**. Real `WEBGL_lose_context` loss/restoration is exercised, including repeated cycles, resize while lost, running and paused transitions, restoration during pending shutdown, unmount during recovery, and fresh-kernel reuse. The initial low-level test driver attempted restoration before loss-event dispatch completed; waiting for that browser boundary corrected the test without a runtime workaround.
- **29 existing Chromium ownership/shared-experience cases passed**, including Strict Mode replay, Next navigation, pending boot cancellation, selection/audio behavior, and release of all seven owned event subscriptions.
- **25 adapter/package tests and public declaration checks passed**, including dependency-light packed exports and old/new overlay identity. **Four React/Next SSR checks passed** with inert startup and no browser acquisition.
- Root lint/type checking, the examples type check, explicit strict checks of the changed browser test/probe files, and website diagnostics passed (**44 files; zero errors/warnings/hints**). Next's production build also checked its types. `git diff --check` passed.
- `node scripts/build.mjs urk-examples @urk/next-proof @urk/www` passed with their runtime and forwarding-package dependencies. The website produced **86 pages**. Existing large-chunk and docs-404 warnings remain.
- Pixel assertions verify nonblank restored rendering at desktop/mobile sizes. Screenshots were inspected before and after restoration; final copies are `.codex/validation/context-{lost,restored}-mobile.png`. Completed disposal has zero tracked frames, resize observers, or long-lived canvas context listeners; borrowed hosts remain connected.

Preview remains `http://127.0.0.1:5175/v02/`. Prior migration and media work are preserved. Core, unrelated media/brand browser suites, hosted CI, physical devices, and real hardware GPU resets were not revalidated. No commit, push, publication, or deployment was performed. Browser restoration is not forced by URK.

Next smallest rendering task: handle device-pixel-ratio changes that leave the host's CSS dimensions unchanged, with a focused resize/redraw regression.

## Interactive media: native motion and experience handoffs — 2026-10-13

Added the next working media milestone on `thehive/urk-media-video`. Chapter titles use finite native animations. The existing controller transitions from the film to a branch-specific closing panel, with Watch again and Return to film controls. Replay, seeking, and chapter selection interrupt pending handoffs. Focus transfers only when its panel is hidden. Experience pause/visibility loss freezes title motion and cancels the current panel handoff; visual resume never restarts media. Reduced-motion changes finish active effects and skip new ones. Missing Web Animations support preserves immediate navigation.

Files changed in this slice:

- Added `packages/examples/src/media/{motion,transitions}.ts`; exported them through the existing private `media/index.ts`. Native effects and media-query listeners have explicit cleanup; newer transitions abort older work, and disposal awaits cooperative completion.
- Added `packages/examples/src/interactive-media/stage.ts`; updated `mount.ts`, `view.ts`, and `styles.ts` for application-owned film/ending state, native motion, accessible actions, and responsive presentation. No public adapter, package, dependency, kernel state, or separate Stage runtime was added.
- Added `examples/tests/motion.test.mjs` and `examples/tests/browser/interactive-motion.spec.ts` for cancellation, reentrancy, pause/resume, reduced-motion changes, focus, fallback, and disposal.
- Updated `examples/interactive-media/README.md`, the website interactive-media guide, `docs/ARCHITECTURE.md`, and this record.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- **14 unit/SSR checks** pass: five new motion/transition cases, six existing cue/media cases, and three React SSR cases. Root and standalone proof type checks pass.
- Affected shared-example, standalone, and website builds pass, including dependency builds and **86 website pages**. Website check: **44 files, zero errors/warnings/hints**. Existing large-chunk/docs-404 build warnings remain.
- **26 browser cases** pass: 14 Chromium checks cover the new motion behavior plus existing media/audio flows across both hosts; 12 Firefox/WebKit checks cover the new motion flows across both hosts. No source changes were needed for browser differences.
- Checks confirm rapid replacement rejects stale transitions, paused title progress stays fixed, interrupted ending handoffs can resume or be replaced, return transfers keyboard focus without autoplay, and disposal cancels active effects and removes owned media resources. Idle has no tracked animation-frame requests or active native effects. Unit checks verify preference-listener removal.
- Desktop (1440px) and narrow (390px) screenshots inspected. An initial aspect-ratio/min-height interaction caused horizontal overflow; explicit screen width fixed it. Screenshots: `.codex/validation/urk-motion-{desktop,mobile}.png`. `git diff --check` passes.

A concurrent local rebuild removed compiled package outputs during the first Firefox/WebKit run and reset one Firefox test via HMR. After outputs settled, the complete 12-case run passed. One immediate retry found the shared test port still occupied; it was restarted after the port was released. These runs did not require implementation changes.

No physical-device validation or performance gain is claimed. Core, public adapter, and framework ownership suites were not repeated because their implementation did not change. Unrelated working-tree changes remain preserved; nothing was committed, pushed, published, or deployed. Running preview: `http://127.0.0.1:5176/interactive-media/`.

Next concrete implementation step: optional Three.js video-texture ownership and a media-to-3D handoff in the shared showcase.

## Three fixed-size pixel-ratio changes - 2026-10-13

The Three adapter now watches the browser's resolution media query alongside host resizing. Each notification replaces the old listener using the uncapped device ratio; the existing renderer ratio remains capped at 2x. Effective changes emit the existing `three:resize` event, so the shared scene redraws once while paused without advancing its transition. Changes above the cap do not clear the buffer or redraw. Context restoration applies the latest ratio. Abort prevents further rearming/resizing, and scope cleanup removes the final listener. There is no polling, new API, dependency, or framework ownership change.

Files changed in this pass:

- `packages/adapters/src/three/index.ts`: scoped resolution watcher.
- `examples/tests/browser/rendering-probe.ts`: resolution-listener tracking.
- `examples/tests/browser/pixel-ratio.spec.ts` (new): fractional/capped ratios, frozen redraws across standalone/React/Next, context recovery, pending shutdown, and fresh mounts.
- `packages/adapters/src/three/README.md`, `CHANGELOG.md`, and this record: sizing contract and evidence. Architecture and naming decisions remain unchanged.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- `node scripts/build.mjs @urk/examples @urk/next` passed, including core, adapter, and React dependencies.
- **25 adapter/package tests** and public declaration checks passed, retaining independent imports and identical old/new overlay aliases.
- **42 browser cases passed** for `pixel-ratio.spec.ts`, `rendering-ui.spec.ts`, and `context-recovery.spec.ts` across Chromium, Firefox, and WebKit. Six live-DPR cases are explicitly skipped on Firefox/WebKit because CDP emulation is Chromium-only; controlled ratio changes through native media-query objects cover the adapter contract in all three engines.
- Chromium's emulation updates DPR without notifying resolution queries until another media feature changes. The test driver toggles an unused contrast preference to trigger browser-generated query events without changing viewport/host dimensions. The initial run exposed this driver limitation; runtime code needed no workaround. After aligning Playwright's screenshot viewport with CDP, all **four DPR cases passed again**.
- Desktop/mobile screenshots inspected, with nonblank WebGL pixel assertions and no narrow-page overflow. Copies: `.codex/validation/pixel-ratio-{desktop,mobile}.png`. Tests verify exactly one paused redraw per effective change, preserved selection/rotation/progress, one active resolution listener across repeated changes, and zero listeners after disposal.
- Root TypeScript checking, strict checks of the changed browser files, **five React/Next SSR and packed compatibility checks**, and `git diff --check` passed.

Physical monitor changes/browser zoom, live DPR changes in Firefox/WebKit, full workspace production builds, and unrelated media/core suites were not repeated in this pass. Dependencies and manifests did not change, so Yarn installation was not repeated. No publication, deployment, push, or commit was performed. Preview remains `http://127.0.0.1:5175/v02/`.

Next smallest interaction task: add mobile touch-selection and pointer-cancellation coverage for scene picking and overlay feedback, fixing only demonstrated gaps.

## Tap-only touch feedback and pointer cleanup - 2026-10-13

Implemented the selected tap-only policy in the shared playground controller. A passive touch-down listener and the existing surface-move subscription restore selected feedback without picking on touch movement. Selection still uses native clicks; mouse/pen hover, keyboard controls, and vertical scrolling remain available. One private reset helper clears the inline cursor and transient callout on leave, pause, and graphics loss. Cancellation retains the browser's existing cancellation-to-leave sequence. Abort guards and scoped listener removal cover pending and completed shutdown. No pointer adapter API, event payload, Three implementation, ownership behavior, package name, or dependency changed.

Files changed in this pass:

- `packages/examples/src/v02/runtime.ts`: touch policy, shared feedback reset, and scoped passive listener.
- `examples/tests/browser/rendering-probe.ts`: owned pointer-listener accounting.
- `examples/tests/browser/touch-pointer.spec.ts` (new): host integration, native tap/scroll behavior, controlled pen/touch events, and pending-cleanup regressions.
- The website `guides/urk-v02.mdx`, `CHANGELOG.md`, and this record: behavior and validation evidence.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- **15 new browser cases passed** across standalone, React, and Next. Browser-emulated taps run in Chromium, Firefox, and WebKit. Controlled PointerEvents cover pen hover and touch movement in all engines. Chromium CDP touch swipes produce trusted `pointercancel`, `lostpointercapture`, and `pointerleave` events, scroll the page, and preserve selection/rotation without a click. Six CDP-only cases are explicitly skipped outside Chromium.
- Tests confirm blank-space taps preserve selection; touch down/up do not select; one click selects once; pause and graphics loss reject scene interaction; native keyboard controls retain their behavior. Unmount during real emulated contact and late events during pending/completed cleanup cannot revive feedback. All 13 tracked target/surface listeners release on disposal and return without duplicates on fresh mounts.
- **42 existing rendering/recovery/DPR cases passed** across the browser matrix, with their six Chromium-only live-DPR variants skipped on Firefox/WebKit. **29 existing Chromium ownership/shared-experience cases passed**, including Strict Mode replay, Next navigation, sound cancellation, and scoped event subscriptions. Total: **86 passed browser cases**, with **12 intentional CDP-only skips**.
- **25 adapter/package tests**, public declarations, and **five React/Next SSR/package-compatibility checks** passed. Root TypeScript and strict checks of the changed browser test/probe files passed. Website diagnostics: **44 files, zero errors/warnings/hints**. `git diff --check` passed.
- `node scripts/build.mjs @urk/examples @urk/next` and production builds for `urk-examples`, `@urk/next-proof`, and `@urk/www` passed with their runtime/forwarder dependencies. Website output remains **86 pages**; existing large-chunk and docs-404 warnings remain.
- Desktop/mobile screenshots inspected with nonblank canvas and narrow-layout overflow assertions. Copies: `.codex/validation/touch-{desktop,mobile}.png`. Completed shutdown has no tracked pointer listeners, animation frames, resize observers, canvases, or overlays.

Physical phones/tablets/styluses were not tested; native swipe/cancellation emulation is Chromium-only. Core/CLI and unrelated media browser suites were not repeated. Manifests/dependencies are unchanged, so installation was not repeated. Existing unrelated changes remain preserved. No commit, push, publication, or deployment was performed. Preview remains `http://127.0.0.1:5175/v02/`.

Next smallest rendering task: respond to reduced-motion preference changes during an active layout transition, using the existing scene and scoped media-query pattern.

## Live playground reduced motion - 2026-10-13

The shared scene now keeps one reduced-motion media query and reads its live value on existing transition frames. Enabling reduction completes a running transition on its next eligible frame. Paused or graphics-unavailable scenes stay frozen; resume/restoration applies the latest preference, while a paused recovery redraw still preserves progress. Disabling reduction does not replay completed work. The immediate layout path also respects pause and graphics availability when a queued controller request arrives late. No preference listener, idle frame, dependency, rendering layer, public API, or ownership change was needed.

Files changed in this pass:

- `packages/examples/src/v02/scene.ts`: live preference reads and guarded immediate settlement.
- `examples/tests/browser/reduced-motion.spec.ts` (new): cross-host live changes, idle behavior, pause/recovery, queued layouts, shutdown, and fresh mounts.
- The website `guides/urk-v02.mdx`, `CHANGELOG.md`, and this record: behavior and evidence.

Validation on Node **22.22.2** / Yarn **3.8.7**:

- `node scripts/build.mjs @urk/examples @urk/next` passed, including core, adapters, and React dependencies.
- **66 browser cases passed** across Chromium, Firefox, and WebKit: 30 new reduced-motion cases plus 36 existing rendering/recovery cases. The final run had no skips or retries. It covers standalone, React, and Next, retains selected-object feedback/rotation, and verifies one eligible settlement draw, static paused recovery, idle scheduling, and released frames/listeners/observers after shutdown.
- Initial runs exposed test-driver timing assumptions: WebKit can acknowledge emulation before existing media queries update, and runner delays can outlast the 650 ms transition before injecting pause/loss. Tests now await the native query value and interrupt transitions inside a browser frame. Neither required an application workaround.
- **Seven adapter contract/packed-export checks**, public declaration checks, and **five React/Next SSR/package-compatibility checks** passed. Both overlay subpaths retain identity. Root TypeScript and explicit strict checks of the new browser spec/probe passed. Website diagnostics: **44 files, zero errors/warnings/hints**. `git diff --check` passed.
- Desktop/mobile screenshots inspected, with nonblank canvas and narrow-page overflow assertions. Copies: `.codex/validation/reduced-motion-{desktop,mobile}.png`.

Preference changes use browser emulation; graphics loss uses native `WEBGL_lose_context`. Physical devices, operating-system preference toggles, hardware GPU resets, full workspace production builds, and unrelated core/CLI/media/touch/DPR suites were not repeated in this slice. Dependencies/manifests did not change, so installation was not repeated. Prior working-tree changes are preserved; no commit, push, publication, or deployment was performed. Preview remains `http://127.0.0.1:5175/v02/`.

Next smallest implementation task: preserve keyboard focus when **Start fresh** replaces the host controls, without reclaiming focus after the user moves elsewhere. A focused Chromium check confirmed that Enter on the standalone restart button currently leaves `document.activeElement` on `BODY`. Add standalone/React/Next coverage and fix the shared host behavior; no focus framework is needed. This follow-up is not implemented in this pass.

## Video-to-3D gallery and Experience Showcase — 2026-10-13

Implemented the optional `@urk/adapters/three/video` binding, a shared lazy gallery, the Interactive Media entry button, and standalone/website Experience Showcase routes. The original video handle drives textures, chapters, captions, selection, and opt-in sound. Child scopes release graphics before the borrowed media; interrupted imports remain owned until settlement. WebGL failure stays local, context recovery preserves the film, and idle rendering stops. The standalone chunk split now keeps Three.js out of the initial media page; the website prepares optional dependencies before development navigation.

Changed areas: `packages/adapters/src/three/video.ts` plus its export, public-type/ownership/package checks and Three README; `packages/examples/src/interactive-media/`, `experience-showcase/`, catalog/types/exports; standalone route/build wiring; website media host/catalog wiring; shared browser checks and usage documentation. Core APIs and dependency versions are unchanged.

Verified on Node 22.22.2 / Yarn 3.8.7:

- **30 adapter/package checks**, including five texture ownership cases; strict public declarations and independent native-video imports pass.
- **14 media, motion, and React SSR checks** pass. Root types, shared examples compilation, standalone types, and the new browser test's strict types pass.
- **21 gallery browser cases pass across Chromium, Firefox, and WebKit**, covering both production hosts, picking, keyboard selection, captions, sound, idle drawing, context loss/restoration, cancelled imports on return/shutdown, graphics failure, fresh recovery, and the animation-frame fallback. Final Chromium rerun also passes all **14 existing media/audio/motion browser cases** (35 distinct browser cases overall).
- Affected adapter/shared-example builds and standalone/website production builds pass; website output has **87 pages**. Website diagnostics: **44 files, zero errors/warnings/hints**. `git diff --check` passes.
- Desktop and narrow-screen screenshots inspected in both hosts. Corrected light-theme control contrast. Final screenshots are under `.codex/validation/gallery-regressions/`; the three-browser artifacts are under `.codex/validation/gallery-browser/`.

Final browser runs use isolated copies of completed production builds with Vite preview's media range support. Earlier development runs were interrupted by port contention, first-use dependency optimization, and another task rebuilding shared dist folders. No runtime failures remain in the final gates. Physical devices and unrelated core/CLI/framework ownership suites were not repeated. A paused native VideoTexture can retain a dormant decoded-frame callback until disposal; completed return/disposal releases all observed media frame callbacks, rendering requests, canvases, and native video listeners. No commit, push, publish, or deployment was performed.

Preview: `http://127.0.0.1:5176/experience-showcase/`; existing `/interactive-media/` remains available. Next slice: configurable element/document visibility and lazy media loading, preserving explicit user playback and application-owned resume policy.

## Media visibility and deferred loading — 2026-10-14

Completed the visibility/loading slice of Milestone 6. Optional registration policies defer the supplied video source until visible or explicitly played, pause offscreen/hidden media, and never resume automatically. Source replacement wins over deferred loading. Cancellation disconnects observers immediately. Unregister now delivers a terminal snapshot so real video-texture bindings dispose without waiting for their owner to shut down. The shared film/gallery observes its experience container; hiding the native video for a texture does not stop gallery playback.

Files changed in this slice:

- `packages/adapters/src/video/{types,player,visibility}.ts`, `src/video/README.md`, `tests/video.test.mjs`, and `tests/types/dom.ts`.
- `packages/examples/src/{interactive-media,video-proof}/mount.ts`.
- `examples/tests/browser/{video-visibility,video,interactive-media,interactive-audio,interactive-motion,gallery}.spec.ts`.
- Website example docs `apps/www/src/content/docs/docs/examples/{video-proof,interactive-media}.mdx` and this record.

Verified with Node 22.22.2 / Yarn 3.8.7:

- **21 video/texture checks**, **11 media/motion checks**, and the independent packed-export check pass. Root types, public declarations, and strict types for all six affected browser specs pass.
- **51 distinct browser cases pass**: 12 visibility and 21 gallery cases across Chromium/Firefox/WebKit, plus 18 existing Chromium video/media/audio/motion cases. Initial harness failures were corrected by scrolling before expecting lazy metadata and making the old Video Proof test honor the configured proof port. No runtime workaround was needed.
- Adapter, shared examples, standalone, and website builds pass; website produces 87 pages. Website check: 44 files, zero errors/warnings/hints. Desktop/narrow-screen captures inspected. `git diff --check` passes.
- Live preview at `http://127.0.0.1:5176/interactive-media/` plays and disposes without page errors. Browser artifacts: `.codex/validation/visibility-browser/` and `visibility-regressions/`.

Browser checks use real viewport intersections; document hiding is delivered through a controlled visibility event. Physical devices and operating-system tab suspension were not tested. Unrelated core/CLI/framework suites were not rerun. No new dependency, core API, publication, deployment, commit, or push. Remaining Milestone 6 work includes experience-level media retry/recovery that preserves chapter, branch, and bookmark state.

## Playground restart focus continuity - 2026-10-14

Shared host-control cleanup now checks the currently focused owned button immediately before removing the old controls. When replacement controls already exist in the same host, focus moves to their matching button without scrolling. Focus moved outside remains untouched, and complete detach does not target another host or a later mount. There is no stored focus intent, timer, listener, focus manager, dependency, or wrapper/API change.

Screenshot inspection also exposed an existing replacement-cleanup defect: old controls removed the host layout class while new controls still needed it, moving the inspector above the scene after restart. Cleanup now retains the class while replacement controls remain and removes it on final detach.

Files changed:

- `packages/examples/src/v02/runtime.ts`: focus transfer and replacement-aware host-class cleanup.
- `examples/tests/browser/focus-continuity.spec.ts` (new): keyboard restart/failure recovery/unmount, pending-shutdown focus changes, host isolation, and responsive layout.
- The website `guides/urk-v02.mdx`, `CHANGELOG.md`, and this record: current behavior and validation.

Verified on Node **22.22.2** / Yarn **3.8.7**:

- The first Chromium regression failed against the previous build at the expected missing-focus assertion. After the fixes, **30 focus cases passed across Chromium, Firefox, and WebKit**, covering standalone, React, and Next without skips or retries.
- A held playback promise exercises genuine pending shutdown. Moving focus outside prevents restoration; moving to another owned button transfers that newer focus instead of the initiating action. Enter/Space, failed setup, repeated fresh mounts, final detach, and multiple hosts are covered.
- Desktop/mobile screenshots inspected with nonblank WebGL assertions, retained selection, no narrow-page overflow, correct inspector placement, and visible focus. Copies: `.codex/validation/focus-{desktop,mobile}.png`. Completed shutdown retains no tracked frames or resize observers.
- `node scripts/build.mjs @urk/examples @urk/next`, root TypeScript checking, and explicit strict checks of the new browser spec/probe passed. **Five existing React/Next SSR and packed-wrapper compatibility checks** passed. Public names, provider/hook APIs, and lifecycle ownership remain unchanged.
- Website diagnostics passed: **44 files, zero errors/warnings/hints**. `git diff --check` passed.

Tests use browser automation and emulated viewport sizes, not physical-device or assistive-technology validation. The broader ownership/rendering/media browser suites and full workspace production builds were not repeated in this focused pass. Dependencies/manifests are unchanged, so installation was not repeated. Unrelated migration/media changes are preserved; no commit, push, publication, or deployment was performed. Preview: `http://127.0.0.1:5175/v02/`.

Next smallest implementation task: keep keyboard focus on the available Pause/Resume action when activating its counterpart disables the focused button, without changing focus on external lifecycle updates. A focused Chromium check confirmed Enter on Pause currently leaves focus on `BODY`. This follow-up is not implemented in this pass.

## Public DOM motion extraction — 2026-10-14

Extracted the private native animation helper into `@urk/adapters/motion` with
`MotionCapability`, scoped groups, terminal playback handles, explicit millisecond
options, and completed/cancelled/failed results. Interactive Media and its shared
Showcase host now register the adapter; the private motion implementation/export
was removed. UI state/CSS remains responsible for stable appearance. Whole-element
replacement starts from authored keyframes; controllers explicitly coordinate
pause/visibility. Core, scheduling, and dependency versions are unchanged.

Files changed in this slice:

- New `packages/adapters/src/motion/{index,keyframes,playback,types}.ts` and usage README.
- `packages/adapters/package.json`, `src/{adapters,dom}.ts`, README, new motion tests,
  existing contract/packed-export tests, and public DOM type checks.
- `packages/examples/src/interactive-media/{mount,stage,meta}.ts`,
  `experience-showcase/meta.ts`, `media/index.ts`, and removal of `media/motion.ts`.
- Migrated `examples/tests/motion.test.mjs` to retain application-transition checks;
  native-motion checks now live with the adapter. Added
  `examples/tests/browser/motion-adapter.spec.ts` and updated the Interactive Media README.
- Root README, architecture, decision D-020, and this validation record.

Verified with Node **22.22.2** and Yarn **3.8.7**:

- `node scripts/build.mjs @urk/examples`: core, adapters, and shared example builds pass.
- `corepack yarn workspace @urk/adapters test:types`, `corepack yarn typecheck`, and
  explicit strict TypeScript checks of the public-motion and Interactive Media
  browser specs pass.
- `node --test packages/adapters/tests/motion.test.mjs examples/tests/motion.test.mjs`:
  **13 checks pass** (11 adapter contracts and two cooperative transition checks).
- `node --test packages/adapters/tests/contracts.test.mjs packages/adapters/tests/packaged-exports.test.mjs`:
  **seven checks pass**, including real packed strict declarations, browser-free
  imports/factories, and independent motion imports without Three.js.
- **21 browser cases pass across Chromium, Firefox, and WebKit**, exercising both
  standalone and website Interactive Media plus the public adapter directly.
  Coverage includes real native pause timing, individual/group pause, finish,
  natural completion, replacement, cancellation, reduced-motion changes, absent
  WAAPI, stable authored styling, focus handoffs, scope cleanup, and fresh kernels.
  Motion active count, native effects, and its kernel frame demand return to zero.
- `git diff --check` passes. Standalone mobile and website desktop ending captures
  were inspected; artifacts are in `.codex/validation/motion/results/`.

The default test ports were occupied, so the run used the existing browser config
through `.codex/validation/motion/playwright.config.ts` on isolated ports:

```sh
URK_PROOF_PORT=5274 URK_WEBSITE_PORT=4422 URK_BROWSER_MATRIX=1 \
  corepack yarn workspace urk-examples test:browser \
  --config ../.codex/validation/motion/playwright.config.ts \
  interactive-motion.spec.ts motion-adapter.spec.ts
```

No full workspace production build or unrelated media/rendering/framework suite was
rerun. Browser preference emulation does not validate physical devices or OS
settings. Numeric tweening, automatic lifecycle pause, continuous interruption
handoffs, presets, and sequence composition remain deferred. No publication or
deployment was performed; existing unrelated working-tree changes were preserved.

## Shared film retry and recovery — 2026-10-15

Interactive Media and Experience Showcase now recover native film failures through an explicit Retry action. Recovery retains the last valid position, branch, captions, and volume preferences, starts paused and silent, and recreates active gallery resources after replacing the video source. Cancellation, pause, document hiding, gallery return, and shutdown prevent stale restoration. Focus transfers from the removed recovery control to Play only when that control still has focus.

Files: `packages/examples/src/interactive-media/{mount,reload,view,styles}.ts`, `examples/tests/media-reload.test.mjs`, `examples/tests/browser/media-recovery.spec.ts`, the Interactive Media usage page, and this record. No public adapter or kernel API changed.

Verified on Node **22.22.2** / Yarn **3.8.7**:

- **12 focused Node checks pass**: reload ordering/cancellation/cleanup plus existing cue, time-source, and transition contracts.
- **43 distinct browser cases pass**: 18 recovery cases across Chromium, Firefox, and WebKit on standalone and website hosts; 25 existing Chromium media/audio/motion/gallery/visibility cases. Recovery covers initial and repeated failures, retained preferences, focus, cancelled pending loads, replacement graphics/captions, return, fresh kernels, and zero tracked media resources after disposal. The first run exposed and fixed recovery-panel `[hidden]` styling; its range-input fixture was corrected to respect the existing step.
- Shared examples, standalone, and website builds pass (87 website pages). Root TypeScript and strict recovery-spec checking pass; website diagnostics report **44 files, zero errors/warnings/hints**. `git diff --check` passes.
- Desktop and narrow-screen captures inspected. The live preview at `http://127.0.0.1:5176/interactive-media/` also passed decoder failure, controlled document-hiding cancellation, paused restoration, and disposal without page errors. Artifacts: `.codex/validation/recovery-browser/`, `recovery-regressions/`, and `recovery-{desktop,restored-desktop}.png`.

Validation used isolated copies of production output on ports 5187/4347. Document hiding was simulated through a visibility event; physical devices and OS tab suspension were not tested. Cancelling a retry releases its observation and prevents activation, but does not guarantee cancellation of a browser network request already in flight. Unrelated core/CLI/framework suites were not rerun. No dependency, package version, publication, deployment, commit, or push changed. Next: compact media observation in the existing inspector.

## On-demand media inspector — 2026-10-15

Video Proof, Interactive Media, and Experience Showcase share a private read-only panel backed by the existing runtime inspector and video snapshots. It displays registered players, playback/buffering/error status, media time, captions, lifecycle, adapters/controllers, and eight recent event labels. The story views also show scene, direction, last cue, and recovery state. Current values are read on opening; event history covers observed intervals only. Closing clears the view and detaches inspector/lifecycle subscriptions. Cancellation detaches immediately; scope cleanup removes the panel and its button listener. No new clock, polling timer, render loop, core API, or adapter API was added. The existing inspector samples only while observed.

Files changed:

- `packages/examples/src/media/inspector.ts` and `inspector-styles.ts` (new): shared scoped presenter and bounded, keyboard-scrollable presentation.
- `packages/examples/src/interactive-media/mount.ts` and `view.ts`: optional sidebar diagnostics and textual recovery-error detail.
- `packages/examples/src/video-proof/mount.ts` and `styles.ts`: replace the previous text-only diagnostics with the shared panel and remove obsolete styles.
- `examples/tests/browser/media-inspector.spec.ts` (new) and `video.spec.ts`: observation, history, player independence, failure/recovery, fresh-kernel and unmount checks.
- Website Interactive Media and Video Proof usage pages, plus this record.

Verified on Node **22.22.2** / Yarn **3.8.7**:

- **35 distinct browser cases pass**: 18 new cases across Chromium/Firefox/WebKit on standalone and website hosts, plus 17 existing Chromium video/recovery/gallery cases. The six story cases were rerun after bounding and repositioning the panel; desktop/mobile captures and keyboard scrolling were inspected. Kernel frame count stays zero during native media inspection, and closing/disposal/fresh start leaves zero tracked inspector sampling timers. Completed disposal releases tracked video/audio sources, listeners, playback, and frame requests.
- **Eight existing inspector ownership/error-isolation checks pass**. Root TypeScript, strict browser-spec types, shared examples build, standalone build, and website build pass (87 pages). Website diagnostics: **44 files, zero errors/warnings/hints**. The production build retains its existing missing `docs → 404` entry notice. `git diff --check` passes.
- Browser artifacts: `.codex/validation/inspector-{browser,crossbrowser,regressions,layout}/`; validation used isolated production copies on ports 5187/4347.

Buffering was exercised with a controlled native event; decoder failure used an invalid real media source. Physical devices and real network throttling were not tested. Media timing follows native events rather than promising frame accuracy. Core/adapter source, dependencies, package versions, publication, and deployment remain unchanged; unrelated working-tree work was preserved.

## Playground Pause/Resume focus - 2026-10-15

Activating a focused Pause or Resume button now transfers focus to its newly enabled counterpart without scrolling. The shared click handler owns this handoff; lifecycle observation remains passive. External pause/resume, phase-only writes, and actions on unfocused buttons do not claim focus. Synchronous observers can redirect focus elsewhere, and detached controls cannot move it. No listener, timer, dependency, public API, or React/Next ownership change was added.

Files changed in this slice:

- `packages/examples/src/v02/runtime.ts`: local focus handoff with connected/enabled target guards.
- `examples/tests/browser/focus-continuity.spec.ts`: repeated native Enter/Space activation, forward/backward tab navigation, external/unfocused actions, observer-directed focus, and detached controls. An optional test base URL permits an isolated proof port.
- Website `guides/urk-v02.mdx`, `CHANGELOG.md`, and this record: implemented behavior and evidence.

Verified on Node **22.22.2** / Yarn **3.8.7**:

- The new Chromium regression first failed against the previous build at the expected missing Resume focus. The final combined run passed **54 browser cases across Chromium, Firefox, and WebKit**, with no skips or retries: 42 focus cases across standalone/React/Next plus 12 existing Next rendering, interaction, and graphics-recovery cases.
- Native keys are sent to the current focus, without locator refocusing between actions. Selection and rotation survive repeated pause/resume, no idle frame remains pending, and completed unmount releases tracked rendering resources. The macOS WebKit test uses its native Option-Tab button navigation; no runtime key interception was introduced.
- `node scripts/build.mjs @urk/examples @urk/next`, root TypeScript, explicit strict types for the focus spec/probe, and adapter public declaration checks passed. **Seven adapter contract/packed-export checks** and **five React/Next SSR/packed-wrapper checks** passed, retaining both overlay subpaths' identity and old/new wrapper compatibility.
- Desktop/mobile captures were inspected with visible Resume focus, retained scene content, and no horizontal overflow. Existing host tests also assert nonblank WebGL pixels and correct responsive inspector placement. Captures: `.codex/validation/pause-focus-{desktop,mobile}.png`; final browser artifacts: `.codex/validation/pause-focus-final/`.
- Website diagnostics passed: **44 files, zero errors/warnings/hints**. `git diff --check` passed.

Earlier supplemental runs encountered concurrent shared-dist rebuilds and competing Next integration caches. The final run completed after rebuilding dependencies, using an ignored local config on proof port 5184, Next port 3102 with the separate `.next` cache, and website port 4325. No application workaround or relaxed assertion was added for build interference.

```sh
URK_WEBSITE_PORT=4325 URK_FOCUS_BASE_URL=http://127.0.0.1:5184 URK_BROWSER_MATRIX=1 \
  corepack yarn workspace urk-examples exec playwright test \
  --config ../.codex/validation/pause-focus.playwright.config.ts \
  --output ../.codex/validation/pause-focus-final \
  focus-continuity.spec.ts rendering-ui.spec.ts context-recovery.spec.ts v02.spec.ts \
  --grep '(focus|Next:)'
```

Coverage is automated browser engines and emulated viewport sizes, not physical devices or assistive technology. Full workspace production builds and unrelated media/core/CLI/touch/DPR suites were not repeated. Dependencies/manifests did not change, so installation was not repeated. Unrelated working-tree changes remain intact; no commit, push, publication, or deployment was performed. Preview: `http://127.0.0.1:5175/v02/`.

Next smallest UI implementation: one nonmodal selection-details panel with a real selected-object action and scoped cleanup. Prove it in the scene, then a DOM-only example before extracting broader UI contracts. Custom panel handles, subscriptions, and a general UI framework remain unimplemented by this slice.

## Selection details and material control - 2026-10-15

The shared playground now opens a native details disclosure when an object is selected. It shows selected-object information and a Wireframe checkbox that changes the actual Three material. Selection opens it without moving focus; hover remains preview-only. Closing preserves selection, and Escape is handled only inside the disclosure and returns focus to its summary. Material settings are per object and per kernel. Pause and graphics loss reject material changes without hiding the information; recovery retains settings, while a fresh kernel resets them. The existing scene owns GPU cleanup; the controller scope removes the two new native listeners. No public adapter/core API, wrapper ownership, dependency, or package change was needed.

Files changed:

- `packages/examples/src/v02/{runtime,scene,styles}.ts`: scoped native disclosure, selected material access, and compact responsive presentation.
- `examples/tests/browser/selection-details.spec.ts` (new) and `rendering-probe.ts`: real pixel changes, native keys/focus, recovery, independent instances, held shutdown, late events, and listener counts.
- The playground guide, changelog, and this record: implemented behavior and verification.

Verified with Node **22.22.2** / Yarn **3.8.7**:

- **49 browser checks pass**: 21 new checks across standalone/React/Next and Chromium/Firefox/WebKit; 27 existing Next focus, rendering, recovery, interaction, and touch checks across those engines; one native Chromium touch-scroll/cancellation check. No skips or retries in the final runs. The initial isolation fixture incorrectly matched the viewport's state attribute instead of the checkbox; qualifying its input selector fixed the fixture without an application workaround.
- Tests inspect both Three material state and changed, nonblank canvas pixels. Hover cannot replace selected details, native checkbox/summary/slider keys remain usable, closing does not clear selection, and pause/recovery retain each object's setting. Completed shutdown leaves zero tracked details listeners, frames, and resize observers; fresh mounts have exactly two details listeners.
- Affected builds (`node scripts/build.mjs @urk/examples @urk/next`), root TypeScript, strict spec/probe types, and adapter declaration checks pass. **12 SSR/packed-wrapper/adapter compatibility checks** pass, preserving legacy aliases and independent imports. Website diagnostics: **44 files, zero errors/warnings/hints**. `git diff --check` passes.
- Desktop/mobile screenshots inspected: wireframe visible, focus retained, details below the canvas, no horizontal overflow or control overlap. Artifacts: `.codex/validation/selection-details-{browser,regressions,scroll}/`. The ignored local browser config uses ports 5184/3102/4325 and the separate Next cache. Live standalone/React preview: `http://127.0.0.1:5175/v02/` and `/v02/react.html`.

Coverage uses browser engines, emulated viewport sizes, native WebGL context loss, and Chromium touch injection, not physical devices or assistive technology. Full workspace production builds, installation, and unrelated media/core/CLI suites were not repeated. Unrelated working-tree changes are preserved; nothing was committed, published, or deployed.

Next smallest task: prove selection/details in a DOM-only example before extracting shared panel code. Public custom-panel handles, panel subscriptions, and a UI framework remain outside this implementation.

## 2026-10-15 — UI Overlay instances and selection reuse

Used the installed Node 22.22.2 runtime. The shell initially selected Node 18;
Playwright and Astro correctly refused it. No dependency or runtime upgrade was
needed. Checks below were run with the Node 22 bin directory first in PATH.

- `node scripts/build.mjs @urk/examples @urk/next`: passed.
- `corepack yarn typecheck`: passed.
- `corepack yarn workspace urk-examples lint`: passed after dependency builds completed.
- `corepack yarn workspace @urk/adapters test:types`: passed, including typed handles and rejected wrong-kind updates.
- `node --test packages/adapters/tests/contracts.test.mjs packages/adapters/tests/packaged-exports.test.mjs`: 7 passed. Confirms canonical alias identity, inert factories, packed types, and DOM imports without Three.js.
- `corepack yarn workspace urk-examples test:browser ui-overlay.spec.ts rendering-ui.spec.ts selection-details.spec.ts`: 17 Chromium cases passed at the initial checkpoint, including 12 existing standalone/React/Next rendering and selection regressions.
- `URK_BROWSER_MATRIX=1 corepack yarn workspace urk-examples test:browser ui-overlay.spec.ts`: 18 passed across Chromium, Firefox, and WebKit after input isolation and history restoration changes.
- `URK_BROWSER_MATRIX=1 corepack yarn workspace urk-examples test:browser ui-overlay.spec.ts --grep 'overlay handles'`: 3 passed after preserving inert late legacy writes and explicit determinate zero progress.
- `corepack yarn workspace urk-examples build`: passed; includes `/selection-details/`.
- `corepack yarn build:www`: passed; 88 static pages including both selection routes. Build output includes large-chunk and missing 404 documentation-entry warnings.
- `git diff --check`: passed.

Browser checks cover duplicate IDs, stale handles, immutable/cached snapshots,
unchanged live-region DOM, observer isolation, cleanup failures, separate kernels,
legacy status/callouts, late writes, real highlight/feature actions, keyboard
selection/dismissal/focus, theme changes without remounting, compact host sizing,
local failure/retry, stale async results, unmount, history restoration, and website
restart. Closing or destroying a panel during a click cannot activate scene input.
Desktop and mobile screenshots were visually inspected. The full repository test
suite was not run, and this is not a performance or accessibility certification.

Preview command: `corepack yarn workspace urk-examples dev --host 127.0.0.1 --port 5176 --strictPort`.
Preview route: `/selection-details/` (scene and project instances on one page).
Website routes: `/examples/scene-ui-bridge/` and `/examples/project-selection/`.
Panel mounts/disposers are synchronous; applications own asynchronous work and its
cancellation. Snapshots describe managed `open()` instances, not legacy singleton
status/callouts. Modal dialogs, docking, notifications, and public widget packages
remain deferred. No publication or deployment was performed.

## 2026-10-15 — Selection loading and focus continuity

Files changed in this continuation:

- `packages/examples/src/selection-details/controller.ts`: preserve an open selection,
  settle pending loading on close, expose busy state, and keep keyboard focus through
  retry. The failure demonstration reloads the mounted panel.
- `packages/adapters/src/ui-overlay/overlays.ts`: restore a control's focus when
  moving its panel between placement slots, without taking focus from elsewhere.
- `examples/tests/browser/ui-overlay.spec.ts`: cancellation/status, reopening,
  repeated selection, native retry keys, pending activation, focus handoff, text
  selection, and unchanged panel ownership regressions.
- `docs/RUNTIME_UI_UX_SYSTEM.md`, the UI Widgets compatibility README, and this record:
  document the implemented behavior and validation.

Verified with Node **22.22.2** / Yarn **3.8.7**:

- The two new Chromium regressions failed against the preceding build at the
  missing busy state and lost placement focus. After implementation,
  `URK_BROWSER_MATRIX=1 corepack yarn workspace urk-examples test:browser ui-overlay.spec.ts
  --output ../.codex/validation/ui-continuity-browser` passed **24 checks** across
  Chromium, Firefox, and WebKit, including both website routes and their restarts.
- `node scripts/build.mjs @urk/examples @urk/next`, `corepack yarn typecheck`, and
  `corepack yarn workspace @urk/adapters test:types` passed.
- The browser spec passed a separate strict TypeScript check with ES2020, DOM,
  DOM.Iterable, Node types, and bundler module resolution. Its initial fixture
  cast needed `typeof window` to include the browser global type; no runtime or
  test assertion was relaxed.
- Desktop and mobile captures under `.codex/validation/ui-continuity-browser/`
  were inspected. The mobile test also checks no horizontal page overflow.
  `git diff --check` passed.

This continues the accepted overlay/selection scope without changing public API
signatures. Loading completion means the request finished; the cancellation and
failure messages distinguish those outcomes from successful content. Production
site builds and the full repository suite were not repeated in this continuation.
Physical devices and assistive technology were not tested. Unrelated working-tree
changes remain intact; no commit, publication, or deployment was performed.

## 2026-10-16 — Portable Experiences: static web export

`urk export [directory]` builds an existing browser project with Vite 5 into
static HTML, bundled JS/CSS, and assets. Relative output URLs are the default;
fixed hosting bases are supported. Nonempty destinations require `--overwrite`.
Builds finish in temporary output before replacement, including when a project
configures Rollup output directories. Failed builds preserve prior output.

Files changed for this feature:

- CLI: `packages/cli/src/index.ts`, `src/commands/export.ts` (new),
  `src/commands/create.ts`, `src/templates/create.ts`, `tests/export.test.mjs`
  (new), `package.json`, and `README.md` (all under `packages/cli/`).
- Proof: `examples/portable-embed.html` and
  `examples/tests/browser/portable-export.spec.ts` (new), plus `examples/README.md`.
- Integration and records: root `package.json`, `yarn.lock`, Yarn's generated
  install state, `examples/playwright.config.ts`,
  `examples/tests/browser/gallery.spec.ts`, `apps/www/astro.config.mjs`,
  `docs/DECISIONS.md`, and this record.

This feature makes no edits to Picking, Core, adapter, or framework source.
The shared workspace had substantial pre-existing changes and concurrent motion
work; those changes were preserved. An early dependency build/typecheck observed
unfinished motion edits. Subsequent dependency builds and root typechecking passed.

Verified on Node **22.22.2**, Yarn **3.8.7**, Vite **5.4.21**:

- `corepack yarn workspace @urk/cli test`: **10 passed**, including eight export/
  scaffold checks and both existing CLI checks. Covers imported/public assets,
  custom aliases/plugins, fixed bases, replacement refusal/success, failed-build
  preservation, source/symlink safety, Rollup output overrides, and unsupported
  server/library/external/non-browser output.
- `corepack yarn test:build`: **6 passed**. Root and CLI typechecks, explicit strict
  TypeScript checking of the browser spec, and `git diff --check` passed.
- `corepack yarn workspace urk-examples test:browser portable-export.spec.ts`:
  **5 Chromium checks passed**, including the final run after output hardening.
  Real exports run through plain HTTP servers at `/`, `/games/picking/`, and a
  fixed `/fixed/` base. A second origin serves the actual plain HTML embed example.
  Tests verify nonblank WebGL, pointer selection, keyboard movement, pause/resume,
  disposal, responsive sizing, and no failed/external/development-server requests.
  A generated starter loads public JSON under `/starter/`, handles keyboard input,
  and stops/restarts. Desktop/mobile captures were visually inspected.
- `corepack yarn export:demo` and `corepack yarn export:demo --overwrite` passed.
  Output is `examples/picking/dist/`. Python static servers on ports 8080 and 8081
  successfully serve the exported demo and independent embed page. The sample's
  Three.js bundle retains Vite's size warning (about 577 kB, 147 kB gzip).
- `corepack yarn install --immutable --mode=skip-build` passed with the existing
  Astro/TypeScript peer warning. `npm pack ./packages/cli --dry-run --json` confirmed
  that the built export command is included. No package was published.

The final `corepack yarn test:integration` run passed **147/147 Chromium tests**
in 4.1 minutes, including all five portable-export cases. The first run exposed
three existing test-setup failures, resolved without changing application behavior:

- The gallery test now intercepts only the lazy `gallery.js` module. Its previous
  `**/gallery*.js*` matcher also held the statically imported `gallery-controller.js`
  and blocked page startup. The pending-import disposal assertions remain intact.
- The Astro integration host sets the existing `URK_INTEGRATION_TEST` flag and
  disables Astro's developer toolbar for that host. The toolbar accessed blocked
  localStorage without catching the exception; the site's theme handling already
  caught it. The blocked-storage assertion remains intact, and normal development
  retains the toolbar.

`corepack yarn workspace urk-examples test:browser brand.spec.ts gallery.spec.ts`
passed **9/9** targeted checks before the full gate. Root typechecking and
`git diff --check` also passed again after these adjustments.
The full repository Node test suite and other browser engines were not rerun.

Artifacts: `.codex/validation/portable-export/` contains the initial and final
integration logs, targeted host regression log, final typecheck log, and export
browser screenshots. Full integration output is under
`.codex/validation/ownership-browser/`.
Export requires browser HTML and ordinary HTTP hosting, not `file://` or SSR.
Runtime URL strings, remote assets/services, iframe permissions, and typechecking
remain application/developer concerns. No production deployment, commit, or push
was performed.

## 2026-10-17 — Portable Package MVP

The existing CLI now packs compiled Web Export output into a ZIP-compatible
`.urkpkg`, inspects it without extraction or execution, and safely unpacks it
into a directly hostable directory. Format 1 adds a generated `urk.json` beside
the unchanged `index.html` and assets. Experience types are metadata only.

Files changed for this milestone:

- New CLI files: `src/commands/pack.ts`, `src/commands/unpack.ts`,
  `src/utils/portable-package.ts`, and `tests/portable-package.test.mjs`, all
  under `packages/cli/`.
- Existing CLI files: `src/index.ts`, `src/commands/inspect.ts`, `package.json`,
  and `README.md`; added zip.js 2.24.0, plus lockfile/generated Yarn install state.
- Extended `examples/tests/browser/portable-export.spec.ts`; updated
  `examples/README.md`, `docs/DECISIONS.md` (D-023), and this record.

Core, adapters, controllers, and Picking source were not changed by this milestone.
The existing unrelated working-tree changes were preserved.

Verified using Node 22.22.2 and Yarn 3.8.7:

- `corepack yarn workspace @urk/cli test`: **19 passed** (all 10 existing CLI/export
  checks and 9 package checks). Covers metadata/defaults/flags, legacy inspection,
  byte-for-byte HTML/JS/CSS/SVG/JSON/binary round trips, overwrite refusal and failed
  replacement preservation, missing/source/nonportable entrypoints, manifest
  validation, corrupt/truncated/encrypted ZIPs, traversal, links, unsafe names,
  duplicate/case/Unicode/file-directory collisions, symlink destinations, declared
  and streamed extraction limits, and temporary-output cleanup.
- `corepack yarn workspace @urk/cli typecheck`, strict standalone TypeScript
  checking of the portable browser spec, and `git diff --check` passed.
- `corepack yarn workspace urk-examples test:browser portable-export.spec.ts
  --output ../.codex/portable/browser`: **6 Chromium checks passed**. Tests retain
  original root/subpath/fixed-base exports, and add a real CLI pack/inspect/unpack
  round trip. Unpacked Picking runs at `/packages/picking/` and inside the separate
  origin's responsive iframe; unpacked starter public JSON, keyboard behavior,
  and lifecycle controls also work. Checks assert visible WebGL pixels, pointer
  selection, keyboard movement, pause/resume/disposal, responsive sizing, and no
  browser errors or failed/development-server asset requests.
- Direct CLI commands produced `.codex/portable/picking.urkpkg` and extracted
  `.codex/portable/site/`. The archive contains four files, approximately 151 kB
  compressed and 587 kB expanded. Python's standard `zipfile` reader opened it,
  listed its entries, and passed `testzip()` checksum validation.

Limits: 256 MiB archive, 512 MiB expanded, 128 MiB per file, 10,000 entries,
16 KiB manifest. Inspection reads and validates all file data without extracting.
Unpack requires an absent or empty destination and writes ordinary file permissions.
Only stored/deflated, unencrypted ZIP entries are supported; there is no package
signing or direct browser execution of archives. Root `urk.json` is reserved.
Entrypoint script/style URL checks do not rewrite arbitrary runtime URLs or replace
remote services. Existing Vite chunk-size and Astro peer-dependency warnings remain.

Logs and browser captures: `.codex/portable/{cli-tests.log,browser.log,browser/}`.
Other browser engines, the broad integration gate, and release/deployment checks
were not rerun for this focused milestone. No commit, push, or publication occurred.

## 2026-10-17 — Web Player MVP

Added optional `@urk/player`, a browser-only Web Component that hosts existing
compiled exports in separately originated, sandboxed iframes. It has no runtime
dependencies and does not import Core or adapters. The built module is 9,525 bytes
(Vite reports 3.35 kB gzip). Applications retain their own lifecycle ownership.

Player milestone files:

- `packages/player/src/index.ts`, `package.json`, `tsconfig.json`,
  `vite.config.ts`, and `README.md`.
- `examples/player/index.html` (two independent Players),
  `examples/player/plain-iframe.html`, `scripts/serve-player-demo.mjs`.
- `examples/tests/browser/player.spec.ts`, `examples/playwright.player.config.ts`.
- Root `package.json` workspace/demo/test scripts and integration build prerequisite;
  `yarn.lock` and generated `.yarn/install-state.gz`.
- `examples/README.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (D-024),
  and this validation record.

No Core, adapter, controller, Picking, Audio proof, React, or Next implementation
was changed for this milestone. Prior unrelated working-tree changes remain.

Verified with Node 22.22.2, Yarn 3.8.7, Vite 5.4.21, and Playwright Chromium:

- `corepack yarn test:player`: **14 passed**. Eight new Player checks and six
  existing portable-export/package checks run against plain static HTTP servers,
  without the normal Vite/Next/Astro development hosts. The Player tests perform
  actual CLI export → pack → inspect → unpack before hosting Picking at a subpath.
- Verified visible WebGL pixels, mouse selection, independent keyboard movement,
  existing pause/resume controls, reload/unload/play, DOM removal/reconnection,
  and separate-origin denial of parent document access. Both Players accept touch
  at 390px width; the host and experience have no horizontal overflow. Desktop
  and mobile screenshots were visually inspected.
- Verified optional fullscreen, operation without the optional HEAD check,
  invalid/same-origin/archive URL rejection, HTTP 404/non-HTML/network errors,
  retry, a stalled-check timeout, cancellation of pending fetches/timers/document
  listeners, and synchronous unload from a state-change listener.
- Exported the existing Audio proof unchanged; retained its `../audio/` static
  directory layout. WAV requests succeed, an in-frame gesture starts playback,
  and a real audio element's playback time advances. Unload destroys its frame
  while the other Picking instance remains ready. No assertion of audible output
  on physical speakers or asynchronous kernel shutdown is made.
- Successful browser paths have no uncaught page errors, failed requests, or
  development-server asset requests. Explicit negative tests intentionally fail
  requests. A separate smoke run against the documented live demo URL confirmed
  two ready experiences with no console, page, or request errors.
- `corepack yarn workspace @urk/cli test`: **19 passed**.
- `corepack yarn typecheck`, `corepack yarn workspace @urk/player typecheck`,
  strict standalone checking of the Player spec/config with `--allowJs`, and
  `git diff --check`: passed.
- `corepack yarn demo:player`: builds, exports, and serves the HTML host at
  `http://127.0.0.1:8090/` and experience at `http://127.0.0.1:8091/picking/`.
  Both respond HTTP 200; the experience HEAD response includes CORS and HTML type.

Initial checks caught and fixed hidden-placeholder layout, duplicate upgrade
loads, and completion of the optional HEAD response before later cancellation.
Mobile checks scroll each Player into view to respect native offscreen frame
throttling. Existing Vite large-chunk and Astro peer warnings remain.

Limits: trusted exports on separate HTTP(S) origins only; same-origin URLs are
rejected. `loaded` describes iframe navigation, not verified application health.
`check-src` improves HTTP diagnostics only when CORS HEAD is supported. Framing,
fullscreen, storage, and audio remain browser/host-policy dependent. Shared-origin
experiences can share persistent storage. Removal discards a browsing context;
it does not await kernel shutdown or erase storage/service workers. Hosts must not
redirect/navigate experiences onto the parent origin. There is no untrusted-package
containment claim, native filesystem bridge, ZIP mounting, or publication.

Logs: `.codex/portable/player-{tests,cli-tests,typecheck,demo}.log`.
Screenshots: `.codex/validation/player-browser/`.
Other browser engines and the broad integration/release gates were not rerun.

## 2026-10-17 — One-command static embed generation

`urk embed <experience-url>` now writes a static Player host, its compiled module,
a plain iframe fallback, and hosting notes. Options configure title, height,
fullscreen, and optional CORS HEAD checking. The command copies `@urk/player`
through installed-package resolution without evaluating browser code in Node,
fetching the experience, building a project, or deploying anything.

Files changed for this milestone:

- Added `packages/cli/src/commands/embed.ts`, `src/templates/embed.ts`, and
  `tests/embed.test.mjs`; updated its `src/index.ts`, `package.json`, and README.
- Updated `scripts/serve-player-demo.mjs` and
  `examples/tests/browser/player.spec.ts` to serve and exercise generated files.
- Updated `packages/player/README.md`, `examples/README.md`, D-025 in
  `docs/DECISIONS.md`, this record, `yarn.lock`, and generated Yarn install state.

No Player runtime, Core, adapter, controller, or existing experience source was
changed. Unrelated working-tree work remains intact.

Verification (Node 22.22.2, Yarn 3.8.7, Playwright Chromium):

- `corepack yarn workspace @urk/cli test`: **24 passed**, including five new
  embed tests. Covers defaults/options, byte-identical Player copying, escaped
  HTML, invalid URLs/arguments/CSS lengths, output preservation, symlinks/unsafe
  destinations, empty-directory publication, absence of temporary leftovers,
  relocated installed CLI resolution, and clean missing-build failure.
- Focused `player.spec.ts`: **9 passed**, including real export → pack → inspect
  → unpack → embed. Generated pages run under `/generated/` on a separate origin,
  preserve query/fragment configuration and title text, accept pointer/keyboard
  input, reload, and link to a working plain iframe fallback. Existing two-player,
  mobile touch, audio, fullscreen, loading/error, and cleanup checks also passed.
- Visual inspection caught the generated page overriding the Player's flex layout.
  Corrected the template CSS, added an iframe-height assertion, then reran all
  **24 CLI tests** and the focused generated-host browser check (**1 passed**).
  The corrected screenshot was visually inspected.
- CLI/root typechecks and strict standalone browser spec/config typechecking
  passed. `git diff --check` passed.
- Generated `.codex/portable/embed/` using the existing experience on port 8091;
  served it through Python's plain HTTP server on port 8093. Both generated pages
  reach ready without page/request errors. The corrected 75vh host provides a
  roughly 580px iframe at a 1280×900 viewport, exceeding the 550px smoke threshold.

Logs: `.codex/portable/embed-{cli-tests,browser,generated-browser,install}.log`.
Corrected screenshot: `.codex/validation/embed-browser/`.

Output requires an absent/empty directory; no overwrite option is provided.
Trusted separate-origin exports only, with the existing Player's framing,
audio, fullscreen, and load-detection limits. The plain iframe relies on the
deployer preserving the origin boundary. Availability is not checked during
generation. No registry publication, production deployment, broad integration
gate, or additional browser-engine verification was performed.

## 2026-10-17 — Complete portable workflow using the normal project build

Inspected `thehive/urk-media-video` against both main refs after fetching
`origin/main`. HEAD and `origin/main` are `f6c1cc5`; local `main` is `64a3da5`
and two commits behind. Web Export, packaging, Player, and embed generation
already existed as uncommitted local work. Reused them and preserved unrelated
working-tree changes.

A fresh standalone project installed from packed local packages built successfully
with its normal `yarn build`, but emitted root-relative `/assets/` URLs. Set the
scaffold's Vite `base` to `./` and verified the same build at a hosting subpath.
The existing build script is unchanged. The prior optional `urk export` remains
available; the completed workflow does not require it.

Files changed for this completion:

- `packages/cli/src/templates/create.ts` and `packages/cli/README.md`.
- Added `examples/tests/fixtures/standalone-project.mjs` and
  `examples/tests/browser/portable-workflow.spec.ts`.
- `examples/playwright.player.config.ts`, root `package.json`,
  `examples/README.md`, D-026 in `docs/DECISIONS.md`, and this record.

No Core, adapter, Player implementation, or archive implementation changes were
needed for this completion.

Verification (Node 22.22.2, Yarn 3.8.7, Vite 5.4.21, Playwright Chromium):

- `corepack yarn test:portable`: **1 ordered end-to-end test passed**. Creates a
  fresh project, installs real local package archives, runs the unchanged
  `tsc --noEmit && vite build`, and serves it through static HTTP at a subpath.
  Verifies rendered CSS, public JSON content, pointer lifecycle controls, keyboard
  focus/input, and shutdown initiation on parent navigation in an external plain
  iframe. Then packs, inspects, unpacks, compares every built file byte-for-byte,
  and opens the extracted manifest entrypoint in the existing Player. Reload and
  removal detach their previous browsing contexts. No failed HTTP requests,
  uncaught browser errors, or development-server requests occurred.
- `corepack yarn workspace @urk/cli test`: **24 passed**, including existing
  export, package validation/extraction, and embed-generation regression checks.
- `corepack yarn workspace urk-examples test:browser --config
  playwright.player.config.ts player.spec.ts --grep 'Audio proof' --output
  ../.codex/validation/portable-audio`: **1 passed**. Existing real WAV assets play
  after an in-frame gesture; native audio time advances and unloading detaches
  the frame while the other Player remains ready.
- `node scripts/build.mjs @urk/adapters @urk/cli`, CLI/root typechecks, strict
  standalone typechecking of the new browser spec/config with `--allowJs`, and
  `git diff --check`: passed.
- Persistent demo generated under `.codex/portable-complete/`: normal project
  build → `urk pack` → `urk inspect` → `urk unpack` → `urk embed`. The package
  contains five files including its manifest, with 17,492 archive bytes and
  61,593 expanded bytes. Its manifest identifies `Standalone proof`, version
  `0.1.0`, type `app`, and entrypoint `index.html`.
- Served extracted files using Python HTTP on port 8095 and the generated host
  on port 8096. A separate Chromium smoke passed direct-site and plain-iframe
  loading, Player rendering, pointer/keyboard input, and reload with no browser,
  request, or HTTP errors. Both the test screenshot and live-demo screenshot
  were visually inspected.

Logs: `.codex/portable-complete/`. Screenshot: the same directory's `demo.png`;
ordered-test screenshot: `.codex/validation/player-browser/`.

Limits: local package archives substitute for unpublished registry versions only
in the test installation. Authoring/building still requires developer tooling;
recipients receive compiled static files. The starter has no audio, so media was
checked separately with the existing Audio proof; physical speaker output is not
asserted. Only Chromium was run. Trusted separate-origin hosting, browser framing
and activation rules, and Player navigation-detection limits still apply. Cleanup
initiates the scaffold's shutdown and discards its browsing context; it does not
await asynchronous shutdown or erase persistent storage. Browsers run extracted
HTTP content, not `.urkpkg` ZIP files. No publication, deployment, other browser
engines, or broad integration/release gates were exercised.


## 2026-10-17 — Numeric motion and optional audio analysis

Node 22.22.2 / Yarn 3.8.7, local unpublished checkout.

- `node scripts/build.mjs @urk/examples` — passed Core, adapters, and shared example builds.
- `corepack yarn typecheck` — passed repository source typecheck.
- `corepack yarn workspace urk-examples lint` — passed proof typecheck, including both new proofs.
- `corepack yarn workspace @urk/core test:types` and
  `corepack yarn workspace @urk/adapters test:types` — passed public declaration checks.
- `node --test packages/core/tests/*.test.mjs packages/adapters/tests/*.test.mjs`
  — **191 passed**, including packed consumer checks, existing playback/mixer tests,
  eight analysis tests, numeric motion, and temporary frame demand.
- `corepack yarn workspace urk-examples build` — passed production proof build.
- Playwright `audio-analysis.spec.ts motion-playground.spec.ts motion-adapter.spec.ts
  interactive-motion.spec.ts` with `URK_BROWSER_MATRIX=1` — **27 passed** across
  Chromium, Firefox, and WebKit. Used the existing config with isolated proof,
  Next, and website ports 5274/3202/4422. A prior run had one website failure while
  generated Core files disappeared during another build; the complete rerun passed.
- Inspected the real Canvas screenshot: waveform, spectrum, all four meters, and
  coordinated bass/mids/treble visual respond to the original three-band fixture.

Analysis coverage includes lazy acquisition, one context/analyser, reusable arrays,
normalized values/band boundaries, validation, source reuse/switching, bypass,
unsupported Web Audio, known non-CORS rejection, late context/play failure, pending
enable cancellation, and node/context disposal. Browser checks exercise real native
playback, settings, pause/restart, source switching, runtime pause, and shutdown.
Motion checks cover timing, property replacement, interruption, reduced motion,
owner disposal, failure, frame ordering, and fresh runtime ownership.

Changed areas for this continuation:

- `packages/core/src/types.ts`, `packages/core/src/kernel/Kernel.ts`, and
  `packages/core/tests/frame-work.test.mjs`.
- `packages/adapters/src/motion/{index,keyframes,playback,timing,tween,types}.ts`,
  its README, and `packages/adapters/tests/{motion,tween}.test.mjs`.
- `packages/adapters/src/audio/{index,analysis}.ts`, its README,
  `packages/adapters/tests/audio-analysis.test.mjs`, public types in
  `packages/adapters/tests/types/dom.ts`, and `packages/adapters/README.md`.
- `examples/motion-playground/{index.html,main.ts,styles.css,README.md}`;
  `examples/audio-proof/{analysis.html,analysis.ts,analysis.css,generate-analysis-audio.py,README.md}`;
  `examples/public/audio/analysis.wav`; `examples/{index.html,vite.config.ts,tsconfig.json}`;
  and `examples/tests/browser/{audio-analysis,motion-playground}.spec.ts`.
- `BUILD_STATUS.md`, `docs/{ARCHITECTURE,DECISIONS,EXAMPLES,MIGRATION_V02,VALIDATION}.md`.

The full root build/test and deployment gates were not run for this focused change.
No physical mobile-device, remote CORS-server matrix, perceptual loudness, or
performance benchmark is claimed. Package versions, publication, and deployment
are unchanged. Other pre-existing working-tree changes were preserved.

## 2026-10-17 — Bounded overlay panels and keyboard scrolling

Completed the panel overflow work started on October 15. Long bottom-aligned
panels previously placed their headings above the scroll origin. Managed panel
bodies now scroll within their shells, keeping the heading and Close button
outside the body scroll area. Narrow or short hosts stack occupied slots, and
bottom alignment permits multiple panels to overflow in a reachable direction.
The content group has a named native Tab stop, including when it contains only
text. Keyboard scrolling, ordinary controls, page navigation, and Escape remain
native; no new event interception, resize observer, or frame loop was added.

Files changed in this continuation:

- `packages/adapters/src/ui-overlay/styles.ts`: host-relative bounds, scrollable
  bodies, overflow-safe bottom alignment, and compact layout for short hosts.
- `packages/adapters/src/ui-overlay/overlays.ts`: focusable, named panel content.
- `examples/tests/browser/ui-overlay-layout.spec.ts`: long content in wide,
  narrow, and short hosts; native wheel and keyboard scrolling; offscreen action
  access; multiple panels; resize identity/focus; and text-only page navigation.
- `docs/RUNTIME_UI_UX_SYSTEM.md`, `packages/adapters/src/ui-widgets/README.md`,
  and this record: current behavior, host responsibilities, and evidence.

Verified with the installed Node **22.22.2** runtime:

- The original wide-host and multiple-panel regressions failed with headings
  above the supplied host. An intermediate run exposed Firefox's native Tab stop
  for scroll containers. Explicit content focusability now gives each tested
  engine keyboard access without suppressing its native behavior.
- The final run passed **39 browser checks** across Chromium, Firefox, and WebKit:
  15 layout checks and 24 existing ownership, selection, retry, input isolation,
  focus, and website restart checks. No skips or retries.
- `corepack yarn workspace @urk/adapters build`, `corepack yarn typecheck`, and
  `corepack yarn workspace @urk/adapters test:types` passed. Both overlay browser
  specs passed a separate strict TypeScript check using ES2020, DOM, DOM.Iterable,
  Node types, and bundler resolution. `git diff --check` passed.
- Inspected wide Firefox and narrow WebKit long-panel captures and the Chromium
  mobile selection proof. Close and the focused final action remain visible,
  long identifiers wrap, and the selection examples retain their presentation.
  Artifacts: `.codex/validation/ui-layout-final/`.

```sh
URK_BROWSER_MATRIX=1 corepack yarn workspace urk-examples test:browser \
  ui-overlay-layout.spec.ts ui-overlay.spec.ts \
  --output ../.codex/validation/ui-layout-final
```

Sizing follows CSS container dimensions; implementation references are MDN's
[size containment guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries)
and [container-relative lengths](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#container_query_length_units).
Hosts still need enough space for readable headings and controls. Public API
signatures, legacy aliases, application ownership, and package versions are
unchanged. Production site builds and the full repository suite were not repeated;
physical devices and assistive technology were not tested. Unrelated working-tree
work was preserved. No commit, publication, or deployment was performed.


## 2026-10-17 — Shared Audio Lab integration (build-focused follow-up)

Implemented one shared Audio Lab under `packages/examples/src/audio-proof`,
consumed through the private `@urk/examples/audio-proof` entrypoint by the website
and standalone analysis host. Added a scoped Three scene and finite Orbit/Row
motion; retained direct measured audio reactions, Canvas plots, controls, and
analysis bypass. Reused the media host and inspector, adding audio state to its
existing diagnostics. Removed the superseded website-only record surface.

Validation was limited at the user's request:

- `node scripts/build.mjs @urk/examples` — passed.
- `corepack yarn workspace urk-examples lint` — passed.
- `corepack yarn workspace @urk/www check` — 44 files, zero errors/warnings/hints.
- `corepack yarn workspace urk-examples build` — passed.
- `corepack yarn workspace @urk/www build` — passed, 88 pages.
- `git diff --check` for touched tracked files — passed.

Existing audio browser selectors were adjusted to the shared, host-scoped DOM.
No test suites, full integration gate, or publication/deployment ran in this follow-up.
The preceding test results are historical evidence for the adapter/motion slice,
not a claim that the new shared UI has been through that browser matrix.

## 2026-10-18 — Scoped motion release changeset

Prepared a motion-only source patch against
`ee4072652e5dfa280f28e87c82af51fcdaa0eaac`. The combined patch, ordered runtime
and example patches, file/checksum manifest, diffstat, and command log are local
review artifacts under `.codex/validation/motion-changeset/`.

The selection keeps the motion API, focused tests, Motion Lab, Story Flow, shared
widget, website island, independent starter/exporter, and canonical motion notes
together. Shared route/export/type files omit concurrent audio and overlay edits.
Separate video/audio, desktop notes, and Interactive Media/Showcase preset adoption
are excluded. Existing baseline features remain present. No Core code, lockfile,
version, real Git index, branch, commit, or tag changed during preparation.

Validation used Node 22.22.2 in an isolated archive of that base plus the patch.
Existing installed build dependencies were borrowed; all `@urk` workspace links
pointed into the isolated tree and its freshly compiled output.

- `git apply --check` against the recorded base — passed.
- TypeScript builds of Core, adapters, shared examples, and React — passed.
- Standalone examples TypeScript check with `--noEmit` — passed.
- `node --test packages/adapters/tests/packaged-exports.test.mjs` — 1 passed;
  strict packed DOM/motion declarations, no-Three imports, deterministic numeric
  playback, lifecycle cancellation, and existing root/Three peer boundary passed.
- Standalone examples Vite production build — passed, including all motion routes.
- Patch whitespace and ordered patch reconstruction checks — passed.

The isolated check validates the selected source rather than the earlier mixed
working-tree archives. This gate did not rerun browser tests, the whole test suite,
website/Astro checks, or a release matrix. The artifacts remain review snapshots;
version selection, commit, tag, publication, and deployment are separate actions.

## 2026-10-19 — Motion v0.2.1 candidate commit

Applied the previously reviewed motion-only source selection in the managed
`thehive/urk-motion-v0.2.1` worktree, based on
`ee4072652e5dfa280f28e87c82af51fcdaa0eaac`. Set only `@urk/adapters` to `0.2.1`;
Core remains `0.2.0` with the compatible `^0.2.0` peer. Existing public factories,
entrypoints, and property/native playback signatures remain available. The
custom-controller scheduling migration is documented in MOTION_RELEASE.md and
MIGRATION_V02.md.

Included the existing motion exporter's content-digest archive filenames so
unpublished same-version builds cannot share stale Yarn file-dependency cache
identities. Newer audio/video, overlay-host, framework-panel, shared theme, and
media-stage work remains in the original development checkout. No Core source,
lockfile, third-party dependency, tag, push, publication, or deployment changed.

Validation with Node 22.22.2 and Yarn 3.8.7 in the candidate worktree:

- `corepack yarn install --immutable` — passed; lockfile unchanged. The existing
  Astro language-server TypeScript peer warning and native build notices remain.
- `node scripts/build.mjs @urk/examples @urk/react` — passed Core, adapters,
  shared examples, and React builds.
- `corepack yarn workspace urk-examples lint` — passed the examples typecheck.
- `node --test packages/adapters/tests/packaged-exports.test.mjs` — 1 passed;
  94 Core / 126 adapter packed files. Strict DOM/motion types, inert imports and
  deterministic numeric playback work without Three; existing root/Three imports
  work with the peer.
- `corepack yarn workspace urk-examples build` — passed, including the motion
  routes; Vite built 185 modules without a chunk-size warning.
- `corepack yarn workspace urk-examples test:browser --config
  playwright.motion-starter.config.ts --project chromium` — 1 passed. The actual
  exported project moved outside the checkout, installed and built independently,
  ran under a static subpath, paused/resumed, disposed/restarted, respected reduced
  motion and mobile width, and worked inside an external-page iframe. No page
  errors were recorded. Review artifacts are retained in this worktree under
  `.codex/validation/motion-starter/`.
- Inspected the smoke test's exported archives: each filename matches its SHA-256;
  packaged metadata is `@urk/core@0.2.0` / `@urk/adapters@0.2.1`.
- Explicit-path staging and whitespace checks passed; generated install state
  and browser/build output were excluded from the source commit.

The existing broader CI workflow, website/Astro checks, complete runtime suite,
and browser matrix were not repeated. This is a local candidate commit, not a
publication-readiness claim. The original checkout and its index remain intact.


## 2026-10-19 — Scoped audio review candidate

Prepared audio transport/widget/starter changes over the recorded base and the
recorded motion review prerequisite. See `docs/AUDIO_RELEASE.md` and the ignored
`.codex/validation/audio-changeset/manifest.json` for exact checksums and scope.
The real index/HEAD remain unchanged. A synchronous native preload load failure
now releases temporary media/abort listeners before rejecting.

Isolated validation used Node 22.22.2, existing installed external dependencies,
and workspace aliases pointing into the candidate:

- Direct TypeScript builds of Core, adapters, shared examples, and React — passed.
- Standalone proof TypeScript noEmit and Vite production build — passed.
- Astro diagnostics — 44 files, zero errors/warnings/hints. Initial tooling
  lookups were corrected to the installed Astro CLI and workspace-local dependencies.
- A starter exported from the isolated builds, followed by a fresh Yarn install
  and normal TypeScript/Vite build — passed at
  `/tmp/urk-audio-candidate-export.lbltrN/widget`.
- Packed Core/audio files match the isolated compiled output, and archive
  filenames match their SHA-256 contents — passed.
- Combined/ordered patch application, reverse check, tree reconstruction,
  selected-file hashes, and patch whitespace — passed.

Exact logs and archive checksums live in `.codex/validation/audio-changeset/`.
Earlier mixed-checkout starter exports are not this candidate's release archives.
The candidate used existing dependencies; no immutable install was repeated there.
No test suites, browser playback/codecs, pending source/seek interactions, measured
object-URL cleanup, preference restore/forget/storage-failure interactions, audio
hardware checks, website production build, or broader release gate ran. These
runtime paths were inspected in code. The preload exception cleanup fix is build-
checked and inspected, not exercised in a browser or behavior test in this phase.

Only final validation documentation changed after these builds; the manifest pins
the exact validated code tree. The real index/HEAD remain unchanged. No version
bump, commit, tag, publication, or deployment was performed.


## 2026-10-20 — Audio integration on the committed motion candidate

Refreshed the recorded 42-file audio selection onto motion commit
`04ee90a837aa841dc5a733c34dac3663a0d4ba03` in the managed
`thehive/urk-audio-integration` worktree. The only patch conflict was appended
validation history: committed motion release records were retained, then the
earlier audio evidence was appended. Both widget exports, docs composition,
starter configuration, and exporter remain present. Updated release notes,
README version wording, NEXT_STEPS, and BUILD_STATUS describe this integration.

No new runtime code was needed. The selected audio implementation matches the
earlier reviewed source; Core, motion, baseline analysis, overlay/video code,
dependency versions, and lockfile are unchanged from the motion candidate.
Adapters remain 0.2.1 and Core 0.2.0; the main development checkout's newer theme,
onset/state, Media FX Lab, and unrelated UI work are excluded.

Validation with Node 22.22.2 / Yarn 3.8.7 in this integration worktree:

- `corepack yarn install --immutable` — passed with the existing language-server
  TypeScript peer warning and native dependency build notices.
- `node scripts/build.mjs @urk/examples @urk/react` — passed, including Core/adapters.
- `corepack yarn typecheck` — passed.
- `corepack yarn workspace urk-examples lint` — passed.
- `corepack yarn workspace urk-examples build` — passed.
- `corepack yarn workspace @urk/www check` — 44 files, zero errors/warnings/hints.
- Starter export from this worktree, fresh install, and normal TypeScript/Vite
  build — passed at `/tmp/urk-audio-integration-export.uV6QXu/widget`.
- Archive content/name identity, source scope, base replay/reverse/tree checks,
  and review diff whitespace — recorded in the integration manifest.

The install-regenerated tracked `.yarn/install-state.gz` was restored from this
worktree's base after checks and is excluded from the review diff. Logs and the
single refreshed patch live in `.codex/validation/audio-integration/`. The original
audio and motion patch artifacts remain historical evidence; this patch applies
directly to the committed motion base and needs no separate motion patch.

No test suites, browser interactions, hardware playback, website production build,
or broader release gates ran. Remaining browser checks are demo/local-file codecs,
runtime/tab pause policy, pending source replacement/seek cancellation, widget
removal/restart and URL/context cleanup, preference opt-in/restore/forget/reset,
invalid/quota-limited storage, and no callbacks after removal. Build/type success
does not establish those runtime behaviors. No commit, tag, publication, deployment,
or staging of either working checkout was performed.


## 2026-10-20 — Four focused audio browser flows

Exercised the isolated integration candidate in the macOS in-app Chromium browser
at `127.0.0.1:5184`. No runtime code change was required.

1. Demo audio and repository WAVs selected through the native file picker played
   with nonzero normalized level/band meters. Seeking and local replacement worked.
   An ignored UI diagnostic retained a real native play result, then forced a late
   native start on release. A seek or source change cancelled it with `AbortError`
   and left native audio paused; the later seek stayed near one second rather than
   resetting. This deliberately controlled race is not a browser/codec matrix.
2. Runtime pause stopped playback and disabled controls. Resume restored controls
   without starting sound. Simulated `document.hidden`/`visibilitychange` controls
   paused native playback, and returning did not autoplay. Hiding the in-app
   surface or opening another automated tab did not background the document;
   actual native tab background/restore therefore remains unverified.
3. Removing a playing local-file widget preserved the host caption, paused audio,
   and revoked its URL. Replacement held one URL, demo reset held zero. Remounting
   reused the existing context (one created, none closed); shutdown closed it
   (one created, one closed). Fresh startup remained idle without a new context.
   Starter Dispose removed widget/preferences; Restart created instance 2 idle.
4. Opt-in and a committed 200% Bass pulse value survived reload. Reset persisted
   the 100% defaults. Forget retained the live 200% Mids color setting while reload
   returned defaults with memory off. Memory was left off at completion.

No warnings/errors were captured from the starter console. Evidence lives in
ignored `.codex/validation/audio-integration/browser-results.json`, its local UI
diagnostic, final state, and `audio-browser-proof.png`. The diagnostic is not part
of the shipped examples or review diff. Runtime sources still match the reviewed
candidate; the prior successful build/typechecks remain applicable. Only docs
and ignored evidence changed in this pass; diff/integrity checks were refreshed.

Not run: hardware speaker audition, additional codecs/browsers, invalid records,
unavailable/quota-limited storage, retained-control callbacks after removal,
automated suites, website production build, and broader release gates. The audio
commit/draft is stacked on the unmerged motion prerequisite; no tag, package
publication, or deployment occurs in this phase.
