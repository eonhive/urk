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
