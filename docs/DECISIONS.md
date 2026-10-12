# URK Decisions

## D-001 — URK is a runtime kernel, not a product shell

URK is the public runtime kernel for interactive browser experiences. Product logic belongs above it. fileciteturn30file0

## D-002 — Standalone-first is mandatory

The kernel must work in a standalone web context. Framework wrappers are later conveniences, not architectural anchors. fileciteturn30file8

## D-003 — Adapters and controllers are the core pattern

Adapters define capability contracts. Controllers orchestrate runtime behavior. State stays explicit. fileciteturn30file0

## D-004 — Kivatar remains separate

Kivatar is the private product layer built on URK. URK does not own identity, avatar behavior, packs, or product dashboards. fileciteturn30file0 fileciteturn30file3

## D-005 — One strong proof example beats many vague examples

URK should prove itself with a focused standalone web demo using one clean adapter stack and one clear controller path. fileciteturn30file8

## D-006 — Do not overbuild early

No marketplace, no huge tool suite, no speculative framework matrix, and no engine-grade simulation before the kernel is credible. fileciteturn30file1

## D-007 — Harden the existing lifecycle before changing public APIs

Implemented in the current refactor: concurrent startup and shutdown callers share complete operations; shutdown signals cancellation immediately; terminal disposal prevents later registration, activation, and scheduler restart. Cleanup waits for outstanding owned work and preserves all collected failures without replacing an initiating startup error.

The existing phase values, factory/method names, public package names, wrappers, and string lookups remain supported. Operational lifecycle observation was added subsequently in D-012; typed adapter tokens were added in D-013. A host awaits `boot()` or `shutdown()` to observe successful completion; legacy phases cannot substitute for those promises.

## D-008 — Make resource ownership explicit and local

Implemented: adapters and controllers receive owned resource scopes with reverse, idempotent cleanup and a shared cancellation signal. Services remain borrowed. An acquisition has one cleanup owner; retaining legacy disposers does not authorize duplicate cleanup of resources also tracked in scopes.

Cancellation is cooperative. Never report full cleanup while tracked work remains unresolved. Hooks must not await a lifecycle completion that depends on their own settlement. No timeout or forced cancellation policy is introduced in this slice.

## D-009 — Preserve deterministic execution while removing avoidable work

Implemented: adapter setup stays sequential in configured order, IDs/capability aliases are reserved before asynchronous setup, and only successfully started update-capable controllers enter the frame list. Scheduler generations prevent stale callback continuations from duplicating frame requests.

Keep legacy continuous scheduling. Dependency graph planning, parallel adapter startup, and automatic idle scheduling require separate validation and measurements. Existing async phase notifications remain unsequenced across phase changes; serialization needs an explicit transition contract.

## D-010 — Diagnostics must remain observational

Implemented after the 59-test reliability baseline passed: the inspector subscribes and samples only while observed, caches immutable snapshots by monotonic revision, reuses structural lists by registry revisions, and keeps bounded event metadata without payloads. Snapshot reads acquire no observer resources. The final unsubscribe or shutdown releases upstream subscriptions and sampling. Shutdown captures a terminal frozen snapshot. Listener failures cannot interrupt sibling observers or kernel startup. React consumes snapshot identity directly with stable subscription/read callbacks.

History covers subscribed intervals; callers needing boot history must subscribe before boot. This deliberately changes eager history and mutable copied snapshots. See migration notes. Do not claim zero bundle overhead or measured speedups from making observation lazy.

## D-011 — Framework hosts declare cleanup ownership

React providers offer explicit external-host or provider ownership while keeping legacy inference as the default. One provider can claim terminal cleanup for a kernel; competing explicit owners reject. Ownership and kernel identity stay fixed for a mount. The Next provider defaults to owning its factory-created kernel.

Startup requests are independent of ownership cleanup. A zero-delay task preserves synchronous effect replay, then invokes shutdown immediately without awaiting boot. Reason/auto-boot changes do not dispose a kernel. Resource acquisition belongs in lifecycle hooks because inert kernel factories can run during server rendering. Private browser tests validate actual React and App Router mounts; library builds and SSR tests alone do not prove client lifecycle behavior.

## D-012 — Observe operational lifecycle independently of application phases

The kernel now exposes `getLifecycleSnapshot()` and `subscribeLifecycle()` with frozen, revisioned snapshots for `created`, `starting`, `running`, `paused`, `failed`, `disposing`, and `disposed`. These APIs do not replace `RuntimeStore`, the six legacy phases, or their notification timing. Phase writes do not acquire scheduling side effects.

Install shared operation promises before observer callbacks. Commit disposal intent before abort callbacks, publish it after stopping scheduling, and commit terminal disposal only after tracked work and cleanup attempts finish. Cleanup errors retain their existing promise/error-list contract; a terminal snapshot does not assert every disposer succeeded. Isolate synchronous observer failures, suppress superseded notifications under reentrancy, and release subscribers after terminal disposal. Lifecycle observation is a current-state subscription without timers, frame polling, or a transition queue.

## D-013 — Add typed adapter identity through the existing registry

Implement `token<TApi>(name)` and optional `AdapterRegistration<TApi>.token` binding. Existing adapter `get`/`require` methods infer from the token, and `dependsOn` accepts tokens alongside strings. Keep legacy IDs/capability aliases, registration shapes without a token, metadata, and configured sequential startup. Capture and reserve the unique symbol key before hooks, publish after successful uncancelled setup, and release references through existing rollback/disposal ownership.

Display names are not identity or additional aliases. Import the canonical token; do not intern names globally or depend on a constructor identity. Tests use independently installed copies of the same packed core version. Contract owners should annotate typed registrations; heterogeneous configuration keeps its existing API erasure and tokens do not validate JavaScript values at runtime. Services remain string-based and a common context facade waits for a separate tested contract. Built-in token binding is implemented subsequently in D-014. Prefer this small additive registry surface over introducing another lifecycle/value coordinator merely to support lookup.

## D-014 — Export adapters independently with canonical typed contracts

Add seven subpaths directly to the existing adapter modules and export `AudioCapability`, `InputCapability`, `LoadingCapability`, `PointerCapability`, `StorageCapability`, `ThreeCapability`, and `UiWidgetsCapability`. The suffix avoids collisions with browser globals. Bind tokens in factories without changing their signatures, resource acquisition, or legacy aliases. Root/DOM re-exports share module identity; preserve the existing DOM subset without audio/Three. Canonical tokens remain distinct between independent contract module instances; no name registry is introduced.

Keep the optional Three peer boundary explicit: root/Three consumers need it, while six non-Three subpaths and DOM resolve modules and strict declarations in a clean packed fixture without it. Imports and factory calls acquire no browser resources. Custom multiple-instance registrations that remap strings can omit the canonical binding or replace it with a distinct token. Tests preserve the original provider when a competing canonical token rejects.

Stage core `0.1.3` and adapters `0.1.5` with a `^0.1.3` core peer because older core releases lack the runtime helper. Update Yarn state without new third-party dependencies or publishing. Replace the adapter echo-only test with real public type, runtime contract, and packed-package checks. Do not infer a completed v0.2 release, package-wide `sideEffects` safety, or measured bundle/timing improvements from independent exports.

## D-015 — Deliver the v0.2 implementation as a usable runtime

Version the runtime/tooling manifests together at `0.2.0` and runtime peers at `^0.2.0`. Complete the preferred context lookup with typed borrowed services, sharing only token reservation within a kernel while retaining separate acquisition records. Legacy ambiguous facade strings reject; explicit registries stay supported.

Preflight configured providers/controllers and order forward dependencies before consumers, sequentially. Keep dynamic registration dependent on already-published providers. Add `auto` scheduling for started updater demand; preserve `continuous` as the compatibility default and recommend auto in new scaffolds.

Move built-in acquisition cleanup into scopes, including partial setup and audio cancellation, while preserving borrowed hosts/storage. Export the React lifecycle hook. Share one event-driven experience across thin standalone/React/Next/website hosts, including cleanup and fresh-kernel recovery. Build local workspace dependencies once; root checks do real work. Keep Node/Yarn and compiler/bundler versions. Publication, deployment, wider profiling, and deferred architecture remain separate from this code update.

## D-016 — Simplify existing ownership and execution records

Use the lifecycle store as the operational source of truth instead of parallel kernel paused/failed/disposed flags. Keep the historical successful-boot flag because diagnostics retain that fact after disposal. Commit state before injected scheduler callbacks, and retain shared lifecycle completion and observer isolation.

Keep controller lifecycle records separate from compact active update entries. Insert each completed updater in registration order instead of rebuilding the full list after every start. This makes ordinary sequential activation linear across a batch, while reverse concurrent completions may still require shifting entries. Preserve receivers, initialized contexts, and next-frame eligibility. Avoid allocating public metadata lists to check pending startup, and avoid restarting an already-running scheduler.

Use one adapter acquisition list and one direct ID/alias/token index. Pending reservation remains separate from published acquisition, and borrowed services retain separate ownership. Do not introduce a generic registry superclass, another coordinator, or additional packages to achieve these changes. Existing public barrels remain; kernel internals import their implementations directly.

The architecture document now describes these concrete responsibilities instead of seven speculative layers. Compare saved before/after builds under identical startup, dispatch, and lookup workloads; report the workload limits and raw samples. A startup or lookup improvement does not establish a rendering or release-wide speedup.

## D-017 — Explicit phase commands and opt-in parallel startup

Add `RuntimeStore.transition` to serialize the entire commit/notification operation without changing synchronous `setPhase`. Shutdown closes commands immediately and waits for active notification work before cleanup. Rejection closes the command queue; controller rejection retains fatal-runtime behavior. Handlers cannot await commands queued behind themselves.

Add `adapterStartup: 'parallel'` using stable dependency batches; retain sequential startup by default. Keep sibling ownership in admission order, independent of completion timing. Setup failure cancels immediately before partial cleanup, preserving the original boot error. The existing shared experience adopts both APIs. No new package, scheduler subsystem, or measured performance claim accompanies these additions.

## D-018 — Express URK through a creative, consistent public identity

The user-requested v0.2 redesign uses uppercase URK, an editable faceted cyan–violet mark, midnight/cool-light surfaces, and original illustrative art. Keep Universal Runtime Kernel, package names, core APIs, and runtime boundaries unchanged. The website and shared playground use the same accents and fonts; the playground remains the real interactive proof. The visual references do not authorize fictional product features or paid plans. See [UI/UX System](UI_UX_SYSTEM.md).
