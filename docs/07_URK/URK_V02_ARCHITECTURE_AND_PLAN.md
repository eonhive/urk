# URK v0.2: Architecture and Implementation Plan

Status: runtime architecture implemented locally; delivery and release evidence incomplete.
Prepared: October 3, 2026. Implementation status reviewed: October 7, 2026.
Original proposal baseline: eonhive/urk, main, commit 94b654c107ff6fbe2e554fc81c093d4372cdb001.

## Current implementation status

This remains the target design. The original specification below is preserved as written; its references to "proposed" or "current" APIs describe the October 3 baseline, not the present working tree. The current implementation is documented in [Architecture](../ARCHITECTURE.md), with exact executed checks in [Validation](../VALIDATION.md). Local package versions are 0.2.0; no release has been published.

The main runtime work is implemented, but **the entire plan is not complete**. The numbered PRs below were delivery milestones, not pull requests that have been created or merged.

| Original milestone | Current status | Implementation or remaining work |
| --- | --- | --- |
| 1. Baseline | Recorded | Real lifecycle, compatibility, package, SSR, and browser checks replace placeholder evidence. Results are in the validation record. |
| 2. Lifecycle | Implemented locally | Shared complete boot/shutdown, immediate cancellation, rollback, terminal disposal, scheduler generations, and failure aggregation. The lifecycle store is now the kernel's operational source of truth. |
| 3. Ownership | Implemented locally | Component scopes, reservation before setup, partial acquisition cleanup, borrowed-resource preservation, and built-in adapter cleanup migration. Cancellation remains cooperative. |
| 4. Execution and diagnostics | Implemented locally | Started-only ordered update entries; lazy, detachable diagnostics; immutable revisioned snapshots. Startup inserts update entries instead of rebuilding the whole list. |
| 5. Integration | Implemented locally | Explicit React/Next ownership, stable subscriptions, effect replay, pending-start unmount, and actual Next navigation. |
| 6. API and exports | Implemented locally | Typed adapter/service access through `ctx.get`/`ctx.require`, lifecycle snapshots, guarded compatibility paths, seven adapter subpaths, and isolated packed-package checks. |
| 7. Proof and performance | Partially complete | Shared standalone/React/Next/website experience, auto scheduling, repeated mount/dispose, comparable local startup/dispatch/lookup measurements, and a repeatable package/compressed-bundle baseline exist. Broader diagnostics/event/adapter-start workloads and heap/GC evidence remain. |
| 8. Development workflow | Partially complete | Dependency-aware builds, real static checks, updated CLI scaffolds, and documentation exist. Repeatable cold/warm build measurements and a supported toolchain matrix remain. |
| Section 11 CI gates | Configured; hosted run pending | `.github/workflows/ci.yml` wires production builds, static checks, existing unit/contract/packed/SSR/browser gates, size reports, and diagnostic artifacts. The complete command sequence passed locally with `CI=true`; a GitHub-hosted run and evidence-based regression budgets remain unverified. |

### Simplifications made while following the design

- The plan's boxes describe responsibilities. `ActiveUpdatePlan` is kept as compact entries within `ControllerRegistry`, and phase compatibility stays in `Kernel`/`RuntimeStore`; separate classes/files would not add a useful boundary today.
- Adapter acquisition order and direct ID/alias/token lookup use one list and one index. Services retain separate borrowed ownership; no oversized universal registry was introduced.
- Diagnostics observation is optional, but the compatibility facade remains in core. A separate diagnostics entrypoint is deferred, as permitted by the proposal.
- The migration guide is [MIGRATION_V02.md](../MIGRATION_V02.md), rather than the proposed `MIGRATION_0_2.md` filename.
- The subsequent v2 engine pass adds opt-in parallel dependency batches and `ctx.state.transition(...)` for ordered asynchronous phase commands. Legacy synchronous writes and sequential startup remain compatible. Live controller replacement and toolchain migration remain [deferred](../DEFERRED.md).

### Remaining work to close this plan

1. Confirm the first hosted CI run after pushing the configured workflow. Existing gates and the repeatable package/bundle-size report are wired and pass locally.
2. Record cold/warm build measurements and the supported toolchain matrix.
3. Extend performance evidence to the remaining representative workloads and resource trends, then set justified regression budgets. Current medians and raw samples are in [Performance](../PERFORMANCE.md); they do not establish an overall application speedup.
4. Review the complete delivery evidence before calling the full plan finished. Publishing packages or deploying the website is a separate release action.

The latest internal refactor improves measured startup and lookup cost without changing the public package shape. Busy dispatch was 1.6% slower in its recorded comparison; that result is retained rather than described as a universal speedup.

---

The original October 3 specification follows. At preparation time no repository files were changed and no runtime benchmarks or build results were claimed. Use the status map above for present completion claims.

## 1. Decision

Preserve URK as the public, web-first, standalone-first runtime kernel for interactive browser experiences. Keep adapters for capabilities, controllers for orchestration, and explicit state. Retain the existing public package names and thin framework wrappers while improving the implementation contracts.

The target is a compatibility-first v0.2, not a rewrite or a separate "Kernel 2" product. The priority order is correctness, ownership, avoidable runtime work, API clarity, and then development tooling.

The kernel owns operational lifecycle. Application controllers own experience flow. A small resource-ownership mechanism connects acquisition, cancellation, and cleanup. Typed capability lookup simplifies dependency access without merging all lifecycle records into one oversized registry.

This intentionally differs from parts of the earlier attached proposal: no immediate removal of Next, no forced example-workspace collapse, no blanket toolchain/package-manager migration, and no parallel adapter initialization before lifecycle safety.

### Evidence and proposal boundary

The current repository documents establish standalone-first, adapter/controller boundaries, explicit runtime state, thin wrappers, the existing example roles, and separate URK/Kivatar/EnHive responsibilities [R1-R3]. Current code exposes six legacy runtime phases and mutable adapter/controller/service registries through RuntimeContext [R4]. The lifecycle split, resource scopes, typed tokens, lazy diagnostics implementation, and release plan below are proposed changes, not current APIs.

## 2. Architecture

```text
HOST
  Standalone browser / Astro island / React / Next client boundary
    |
APPLICATION / EXPERIENCE
  Product behavior + explicit experience state + UI composition
    |
CONTROLLERS
  Coordinate input, loading, rendering, audio, and UI
    |
TYPED CAPABILITIES
  ctx.require(Token) / ctx.get(Token)
    |
ADAPTERS
  Pointer / Input / Loading / Three / Audio / Storage / UI
    |
PLATFORM OR BORROWED APPLICATION RESOURCES

URK CORE hosts the contracts above and provides:
  Lifecycle coordinator | Resource scopes | Frame scheduler
  Controller activation | Capability lookup | Events | Snapshots

DIAGNOSTICS observes core through an optional, detachable bridge.
FRAMEWORK WRAPPERS consume core; core never imports a wrapper.
CLI generates/checks source; runtime never depends on CLI.
```

The diagram describes responsibilities, not a requirement for a separate package or class for every box. Keep small related implementations together until an independent boundary is useful.

### Dependency direction

- @urk/core has no React or Three.js dependency. Its browser scheduler is an implementation behind an injectable scheduling contract; web-first does not imply support for every JavaScript host.
- @urk/adapters depends on core contracts. Adapter entrypoints do not import unrelated adapter implementations.
- @urk/react-urk consumes core lifecycle and snapshots.
- @urk/next-urk composes the React wrapper and retains its documented client-instance ownership convenience.
- Application examples depend on the appropriate packages, not vice versa.
- Product identity, memory policy, monetization, dashboards, and avatar behavior remain outside URK.

## 3. Lifecycle contract

### Authoritative operational state

```text
created -> starting -> running <-> paused
               |          |
               +-- fatal failure --> failed

Any non-disposed state -> disposing -> disposed
failed -> disposing -> disposed
```

Disposed is terminal. A failed kernel is not implicitly restarted; create a fresh kernel for recovery after cleanup. Successful startup means required adapter/controller startup completed, not that every future application asset has loaded. Cleanup failures are recorded in an immutable result even after disposal attempts complete.

### Public method semantics

| Operation | Proposed contract |
|---|---|
| boot() | Concurrent calls await the same complete startup operation. Resolve only after required controller startup and final cancellation checks. Running/paused calls are no-ops. Failed/disposal states reject. |
| pause() | Allowed after successful boot. Repeated pause is a no-op. Stops kernel-owned frame updates, not every external subsystem. |
| resume() | Repeated resume while running is a no-op. Resumes one scheduler generation; never duplicates frame requests. |
| shutdown() | Marks disposal intent and signals cancellation immediately. Concurrent calls await the same cleanup operation/result. Prevents further registration, publication, activation, and scheduling. |
| getLifecycleSnapshot() | Returns a cached immutable operational snapshot, with a monotonic revision. |
| getState() | Retains the documented legacy phase snapshot during migration. It is not authoritative proof that startup or shutdown completed. |

Preserve existing method names before adding aliases. Pause and resume remain simple synchronous operations in this release; do not add asynchronous pause hooks without a separate contract change.

### Startup sequence

1. Validate IDs, capability providers, required dependencies, aliases, and cycles before allocating resources when the complete configuration is available.
2. Create lifecycle cancellation state and component resource scopes.
3. Initialize adapters in deterministic, stable dependency order. Begin sequentially.
4. Publish an adapter capability only after setup succeeds and its lifecycle generation remains valid.
5. Initialize and start controllers in deterministic order.
6. Activate only successfully started update-capable controllers.
7. Commit running only if cancellation/disposal has not begun, then start scheduling if required by the chosen frame mode.

For legacy configurations, preserve their ordering when it satisfies dependencies. Reordering previously invalid configurations is an explicit new behavior, not an undocumented compatibility assumption. Preserve the legacy phase transition timing separately from the operational running state.

### Shutdown and rollback

Shutdown is an interrupt, not a command queued behind a possibly blocked boot operation. Immediately invalidate pending publications and scheduler continuations, stop scheduling, and signal cancellation. Coordinate in-flight setup/start work before destroying capabilities it can still access. Clean up controller scopes before the adapters they depend on, then clear lookups and subscriptions.

On startup failure, roll back acquired resources, preserve the initiating error, and report cleanup errors in addition to it. Do not overwrite the initiating error with the last disposer failure. Subsequent shutdown should complete without disposing the same registered resource twice.

Cancellation is cooperative. Third-party setup may ignore AbortSignal. URK cannot forcibly terminate arbitrary JavaScript. Such work must not later activate a disposed kernel, and shutdown must not falsely report full cleanup while owned tracked work is still unresolved. A future timeout policy must distinguish unresolved cleanup from successful disposal.

Hooks must not await the completion of the lifecycle operation that is waiting for that same hook. Document and test supported reentrant stop requests; a general FIFO queue does not solve self-await deadlocks. Kernel context should expose cancellation and scoped resources rather than encourage recursive lifecycle ownership.

## 4. Resource scopes

Every adapter/controller receives an owned scope and cancellation signal. A scope tracks disposers immediately after a resource is acquired. Cleanup is idempotent, reverse-ordered within the scope, and continues after individual failures.

Proposed usage, not existing URK API:

```ts
const unsubscribe = events.on('example:changed', listener);
ctx.scope.defer(unsubscribe);

const resource = createOwnedResource();
ctx.scope.defer(() => resource.dispose());

// Acquire safely before asynchronous work that could fail.
await initializeResource(resource, ctx.signal);
```

The contract is "cleanup is invoked exactly once for each tracked owned acquisition," not "every external disposal always succeeds." Setup authors must register cleanup; a scope cannot discover untracked listeners or GPU allocations automatically.

Ownership defaults:

- Resources an adapter creates are owned unless explicitly documented otherwise.
- Resources the application supplies are borrowed by default.
- A borrowed renderer, element, or audio context is not destroyed by kernel shutdown.
- No resource is simultaneously owned by an adapter scope and an independent legacy disposer.
- Late asynchronous completions cannot publish capabilities. Late acquisitions must still be tracked and cleaned up through the component's settlement/cleanup path.

Keep v0.1 dispose callbacks supported. Migrate each adapter so a given acquisition has one owner; do not run equivalent scope cleanup and old manual cleanup twice.

## 5. Capabilities and registries

Expose one typed dependency vocabulary:

```ts
// Proposed API. Tokens are defined once by the capability contract owner.
export const Audio = token<AudioApi>('audio');
export const Pointer = token<PointerApi>('pointer');

const audio = ctx.require(Audio); // AudioApi
const pointer = ctx.get(Pointer); // PointerApi | undefined
```

Token identity is not its display string. Consumers import the canonical exported token; independently creating another token named "audio" does not resolve the original provider. Validate legacy ID/capability aliases and collisions. Test package duplication and peer-dependency behavior rather than silently using a process-wide mutable token registry.

Internally retain separate records for adapter acquisition, controller lifecycle, and capability values. A Map is not a problem by itself; unchecked mutation and overlapping responsibilities are.

Reserve adapter IDs and capabilities before awaiting setup. Publish only after successful setup. Release reservations on rollback. Reject unsupported environments or missing required capabilities with component-specific errors.

During migration, preserve string lookup aliases and existing registration shapes. Route legacy mutating surfaces through the same lifecycle guards. Narrow the preferred new context to lookup, observation, scoped ownership, events, and cancellation. Do not leave one unguarded registry mutation path that bypasses the coordinator.

## 6. State: operational lifecycle versus experience flow

Operational state answers whether the runtime has started, can tick, has failed, or has been disposed. Experience state answers whether the user is loading assets, seeing a menu, transitioning, or interacting with content.

Examples:

| Kernel lifecycle | Experience flow | Meaning |
|---|---|---|
| running | loading | Controllers can update a loading screen while assets load. |
| running | ready | The experience is interactive. |
| running | transition | Controllers coordinate a transition. |
| paused | ready | Kernel frames are stopped; experience intent remains ready. |

Keep loading/ready/transition in application/controller flow or an optional reusable helper after concrete examples prove the abstraction. Do not add a general state-machine package in v0.2.

Preserve RuntimeStore, RuntimePhase, useRuntimePhase(), and documented getState() behavior through a LegacyPhaseBridge. Existing phase writes must not silently acquire new scheduler side effects. Maintain previous phase notification timing where practical, and characterize intentional differences in migration tests. There is no lossless one-to-one mapping between the six old phases and the new lifecycle; never hide that fact behind a simplistic conversion table.

New application transition commands that await asynchronous work must serialize the transition itself, including its commit point. Queuing callbacks after multiple states already committed is not a complete ordering solution. Keep ordinary notifications distinct from awaited transition commands.

## 7. Scheduler and controller execution

The active update plan contains only successfully started controllers with synchronous update functions. Build or update that plan when membership changes, not every frame. Preserve callback receiver, arguments, and deterministic order.

Choose and test a frame-boundary rule for runtime membership changes. A controller added during a frame becomes eligible no earlier than the next frame after startup succeeds. Deactivation takes effect before the next frame, and cannot leave the scheduler using disposed capabilities.

Use a scheduler generation/epoch to invalidate stale callbacks and to prevent a callback-triggered stop/start from causing the original tick to schedule a second chain. Keep at most one outstanding kernel-owned frame request. Disposal stops the current generation and prevents later scheduling.

Introduce auto mode, which schedules only when an active updater needs frames. Preserve an explicit continuous mode for legacy applications that depend on continuous scheduling. Audit built-in adapters and examples before changing any default. Tests stating "no frames when idle" apply to auto mode, not to every legacy configuration or to external libraries with their own tickers.

Keep the injected FrameScheduler contract and add a deterministic ManualFrameScheduler for tests. Preserve raw timing fields and first-frame behavior unless migration notes explicitly change them. Do not silently clamp delta values or add fixed-step semantics.

Error handling must distinguish a controller failure from an observer/diagnostics failure. Fatal controller failure stops the kernel-owned loop and enters failed. Errors from error-reporting observers must not recursively block cleanup. Avoid unrelated changes to generic EventBus delivery semantics without explicit tests and documentation.

## 8. Diagnostics and React

v0.2 target: no inspector history collection or full snapshot assembly merely because the kernel exists. Keep only required runtime counters/state. getInspector() may retain a small compatibility facade that activates observation on demand; do not claim zero diagnostic bundle bytes while that facade remains exported.

When attached, diagnostics should:

- Cache immutable snapshots and increment a revision on observable publication.
- Rebuild structural lists only when their revision changes.
- Sample continuous metrics at a proposed default of 5 Hz rather than each frame.
- Bound retained event history and prefer small diagnostic metadata over retained live DOM/renderer/payload objects.
- Isolate observer errors from runtime ownership/cleanup.
- Detach subscriptions and sampling on explicit detach or shutdown.

Boot history exists only when observation was enabled before boot; do not fabricate a history when a panel opens later. Full diagnostics packaging can move behind @urk/core/diagnostics once compatible entrypoints are proven. A separate @urk/devtools package is not required for this release.

React snapshot integration uses stable subscribe/getSnapshot function identities and cached immutable snapshots. Do not use Date.now() equality as a version check. React requires unchanged external-store data to produce the same snapshot value and server snapshots to match during hydration [W1].

Retain @urk/react-urk and @urk/next-urk. Distinguish external-owner provider mode from wrapper-owned kernel mode. Only the owner initiates terminal cleanup. Preserve existing defaults through compatibility behavior while adding an explicit preferred mode. Test lifecycle replay, multiple consumers, unmount during startup, ownership changes, and real App Router navigation. No browser resource acquisition during render or server module evaluation.

## 9. Target repository shape

This is a logical target, not an instruction to rename every current file immediately.

```text
packages/
  core/
    src/
      kernel/Kernel.ts                 # Public facade, existing entrypoint
      kernel/createKernel.ts           # Existing factory
      lifecycle/                       # Coordinator, lifecycle snapshot
      resources/                       # ResourceScope and cleanup reporting
      capabilities/                    # Typed tokens, lookup, pending providers
      adapters/AdapterRegistry.ts      # Adapter ownership/lifecycle records
      controllers/ControllerRegistry.ts
      controllers/ActiveUpdatePlan.ts
      scheduler/BrowserFrameScheduler.ts
      scheduler/ManualFrameScheduler.ts
      events/EventBus.ts
      runtime/RuntimeStore.ts          # Legacy phase store during migration
      runtime/RuntimeInspector.ts      # Lazy compatibility surface
      compat/LegacyPhaseBridge.ts
      diagnostics/                     # Optional observation/sampling internals
      index.ts
    tests/
  adapters/
    src/{audio,input,loading,pointer,storage,three,uiWidgets}/
    tests/
  react-urk/
  next-urk/
  examples/                            # Private shared example logic
  cli/                                 # Developer tooling, not runtime
apps/
  www/                                 # Public docs and runtime example hosts
  next-proof/                          # Real framework integration fixture
examples/                              # Thin standalone/React proof hosts
benchmarks/                            # Baseline and repeatable comparisons
```

Preserve existing public re-export modules. Do not delete them simply because implementations move behind them.

### Package exports

Keep @urk/core, @urk/adapters, @urk/react-urk, @urk/next-urk, and @urk/cli. Keep private example packages private.

Keep the existing @urk/adapters/dom export. Add individual adapter subpaths incrementally (pointer, input, loading, audio, storage, three, ui-widgets). Retain the existing root barrel. Contract/token exports should be side-effect-safe and must not allocate browser resources when imported.

Test packed artifacts in a clean DOM-only fixture without Three.js installed. Also test type resolution and module loading, not just tree-shaken output in the monorepo. Use sideEffects metadata only where actually true.

Keep distinct proof hosts when their environments differ; share the orchestration implementation to avoid duplicate demo logic. Do not force every real integration into one universal playground.

## 10. Ordered delivery plan

These are proposed reviewable changes, not already-created pull requests.

| Change | Scope | Exit condition |
|---|---|---|
| PR 1: baseline | Characterize current lifecycle, build/test commands, exports, examples; reproduce known races in deterministic tests. | Baseline and failures are documented; no misleading passing placeholder checks. |
| PR 2: lifecycle | Shared complete startup/shutdown operations, disposal interrupt, scheduler generation guards, failure aggregation. | No startup continuation can reactivate a disposing/disposed kernel. |
| PR 3: ownership | ResourceScope; built-in adapter/controller cleanup migration; reservation before async setup. | Partial setup is cleaned up; borrowed resources survive; concurrent conflicts reject. |
| PR 4: execution and diagnostics | Started-only update plan; lazy detachable inspector; cached revisioned snapshots. | No premature controller updates or unopened inspector snapshot builds. |
| PR 5: integration | Explicit wrapper ownership, stable subscriptions, phase compatibility, dynamic registration tests. | Standalone, React, and real Next proof lifecycle tests pass. |
| PR 6: API and exports | Typed capability lookup, guarded compatibility aliases, individual adapter subpaths, lifecycle observation API. | Existing supported imports remain valid; clean package fixtures pass. |
| PR 7: proof and performance | One shared end-to-end experience, browser mount/dispose cycles, repeatable benchmarks, auto scheduler mode. | Gates below pass and performance claims are backed by recorded measurements. |
| PR 8: development workflow | Dependency-aware builds, real lint/typecheck gates, docs refresh; evaluate tool upgrades separately. | Cold/warm build results and supported toolchain matrix are recorded. |

The API/exports change should expose the lifecycle split already implemented internally, not introduce another rewrite. Update small relevant docs alongside each PR; do not wait until PR 8 to document behavior.

Retain Yarn and the currently documented Node/cache setup during the initial runtime work. Package-manager migration, cache removal, compiler upgrades, and bundler upgrades need independent decisions and compatibility verification. Do not copy unverified version/release claims from the older proposal.

## 11. Tests and release gates

Lifecycle tests include concurrent boot, boot during controller start, shutdown during adapter setup, shutdown during controller start, concurrent shutdown, failure after partial acquisition, late async completion, repeated shutdown after failure, and failed cleanup without skipped later cleanup.

Registry tests include duplicate ID/capability reservation under concurrency, missing dependencies, cycles, ambiguous legacy aliases, canonical token identity, failed setup reservation release, and no capability publication after cancellation.

Execution tests include no update before start, deterministic order, membership mutation during a frame, pause/resume behavior, stop/start inside a callback, stale scheduler callbacks, and preserved callback receivers.

Snapshot tests include stable identity when unchanged, distinct revisions within the same millisecond, sanitized bounded event history, no unopened observation work, detach cleanup, and listener failures that do not derail disposal.

Integration tests include DOM-only installation without Three.js, packed package imports/type resolution, real React lifecycle replay, externally owned providers, wrapper-owned providers, unmount during async boot, and Next navigation/unmount.

CI gates: typecheck, lint, unit, contracts, browser smoke, package builds, packed-artifact checks, and bundle report. These must run real checks. The current echo-only test/lint scripts are not evidence of coverage [R10].

### Behavioral acceptance targets

- Zero updates to a controller before successful startup.
- No new capability publication or active scheduling after disposal begins.
- At most one outstanding kernel-owned frame request per scheduler.
- Zero pending kernel-owned frame requests after completed disposal.
- Zero diagnostic snapshot builds from frames/events when diagnostics are not attached.
- One cleanup invocation per registered owned acquisition.
- All concurrent shutdown callers observe completed cleanup or the same reported failure outcome.
- No frames with an empty update plan in auto mode; continuous compatibility mode is exempt.

### Measurements, not promises

Record commit, runtime/browser versions, hardware, workload, warmup, repeated runs, and medians/tail percentiles. Compare baseline with candidate on the same environment. Measure kernel dispatch separately from rendering, audio, network, and user callback work.

Suggested fixtures: 0/10/100/1000 no-op active controllers; a mixed controller set with few updaters; diagnostics off/on; many small events; sequential adapter setup with controlled delays; repeated mount/dispose; DOM-only and Three-enabled bundles.

Report update CPU cost, allocation/GC evidence where the profiler supports it, outstanding callbacks/listeners, heap/resource trends, startup time, compressed bundle sizes, and cold/warm build time. Set quantitative regression budgets after obtaining repeatable baselines. Do not promise 2x speed, zero allocations everywhere, or GPU speedups from a kernel refactor.

## 12. Documentation update map

- docs/ARCHITECTURE.md: authoritative lifecycle/ownership/capability design and dependency direction.
- docs/BOUNDARY.md: preserve web-first/product boundaries; clarify experience flow versus operational lifecycle.
- docs/DECISIONS.md: record lifecycle separation, scopes, sequential-first startup, compatibility policy, and opt-in diagnostics.
- docs/IMPLEMENTATION_PLAN.md: replace stale milestone tracking with the ordered changes and exit gates.
- docs/MIGRATION_0_2.md: new migration guide; map supported legacy surfaces and intentional behavior fixes without pretending phase mapping is lossless.
- docs/VALIDATION.md: new gate definitions, fixtures, commands actually implemented, and evidence format.
- docs/PERFORMANCE.md: new benchmark protocol and measured baseline/results, not aspirational percentages.
- docs/DEFERRED.md: explicit non-goals and conditions for revisiting them.
- README.md and package READMEs: current runnable setup and examples only after implementation lands.

Label proposal versus shipped behavior. Do not make the website advertise APIs that have not been implemented and validated.

## 13. One flagship proof

Use one existing example as the starting point. Demonstrate controlled asset loading, scene/DOM interaction, an overlay, pause/resume, a deliberate setup failure, cleanup, and fresh-kernel restart. Keep its logic in the shared private examples package and mount it through thin standalone/React/Next hosts.

Include a diagnostics toggle, lifecycle/experience-state display, and repeated mount/unmount control. The demo should prove reliability and boundaries, not become a new editor project. A DOM-only proof must remain available independently of any Three.js demo.

## 14. Deferred work

No new rendering engine, ECS, physics layer, editor, marketplace, product systems, arbitrary hot-swapping of adapter dependency graphs, general workflow engine, fixed-step scheduler, worker job system, or framework matrix expansion in v0.2.

Parallel adapter startup is reconsidered only after dependency validation, pending-provider reservation, cancellation, rollback, deterministic disposal, and representative startup measurements are in place. Framework/package renaming is reconsidered only when migration benefits exceed disruption.

## 15. Source map

Repository source identifiers refer to the pinned commit above:

- R1: README.md.
- R2: docs/BOUNDARY.md and docs/DECISIONS.md.
- R3: docs/ARCHITECTURE.md and docs/IMPLEMENTATION_PLAN.md.
- R4: packages/core/src/types.ts.
- R5: packages/core/src/kernel/Kernel.ts.
- R6: packages/core/src/adapters/AdapterRegistry.ts and controllers/ControllerRegistry.ts.
- R7: packages/core/src/runtime/RuntimeInspector.ts and RuntimeStore.ts.
- R8: packages/core/src/scheduler/BrowserFrameScheduler.ts.
- R9: packages/react-urk/src/hooks.ts and provider.tsx; packages/next-urk/README.md.
- R10: package.json, packages/core/package.json, and packages/adapters/package.json.

User-provided supporting source: Pasted text.txt, earlier reevaluation. Used for the proposed direction, not as proof of unverified toolchain releases or measured performance.

External technical contract references consulted October 3, 2026:

- W1: React, useSyncExternalStore: `https://react.dev/reference/react/useSyncExternalStore`.
- W2: MDN, AbortSignal: `https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal`.
- W3: MDN, cancelAnimationFrame: `https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame`.

Begin implementation with regression tests and lifecycle/ownership hardening, not package renames or a toolchain migration.
