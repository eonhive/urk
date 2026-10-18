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

## D-019 - Shorten framework package names and clarify the existing overlay

Use `@urk/react` and `@urk/next` from `packages/react` and `packages/next`; Next depends on React. Supersede earlier package-name preservation for this explicit rename while retaining provider/hook APIs, lifecycle event strings, ownership, and SSR. Keep the published old names as v0.2 forwarding packages under `packages/compat`, with one canonical React context and ownership implementation. Existing npm versions remain untouched; forwarding releases and new names require separate publication.

Expose `@urk/adapters/ui-overlay` and matching factory/type/token aliases by re-exporting the existing UI widget implementation. Preserve `ui-widgets` imports, factory/token identity, and registration strings. Keep Three.js independent and all existing adapter subpaths available. No UI framework, rendering engine, renderer registry, or extra orchestration layer is required.

## D-020 — Extract scoped DOM motion before extending scheduling

Promote the private native motion helper into optional `@urk/adapters/motion`, using `createMotionAdapter`, `MotionCapability`, existing resource scopes, and terminal playback outcomes. Keep `durationMs`/`delayMs` explicit. Support opacity/transform keyframes, individual and group pause, finish, cancellation, reduced motion, and whole-element replacement. Supplied keyframes define replacement's start; continuous handoff and property blending are not promised.

Stable appearance belongs to UI state/CSS. Playback releases native effects and never persists inline styles. Expected cancellation resolves as cancelled; genuine native failures resolve as failed; invalid inputs throw before replacing active work. Reuse one group/cleanup per scope and remove settled operations immediately.

Migrate Interactive Media and its shared Showcase host to the adapter. Controllers retain explicit pause/visibility/media policy; shutdown cancels automatically. Preserve the kernel and scheduler. Numeric tweening and removable frame demand require a separate tested contract; presets, composition, and automatic operational pause are deferred. Package versions and publication remain unchanged.

## D-021 — Extend the existing overlay through owned instances

Use URK UI as the umbrella vocabulary and UI Overlay as the concrete capability.
Add typed status/callout/panel handles, immutable managed-instance snapshots, and
scoped light/dark presentation to the existing adapter. Preserve the legacy
factory, token, strings, singleton methods, and bundled styling. Custom panel
content mounts once and supplies synchronous cleanup; duplicate active IDs reject
and stale handles cannot act on reused IDs. Nonmodal panels have local dismissal
and no implicit kernel/media policy. Core and framework packages stay unchanged.

Prove reuse through Scene/UI Bridge and Project Selection. Their shared private
controller owns selection, real actions, cancellation, retry, and stale-result
protection. Keep dialogs, notifications, anchoring, docking, new registries, and a
public UI package deferred. See [Runtime UI & Interaction](RUNTIME_UI_UX_SYSTEM.md).

## D-022 — Export browser experiences through the existing CLI and Vite

Portable Experiences milestone 1 adds `urk export` to `@urk/cli`, using the existing
Vite 5 toolchain to emit a static browser distribution with a relative base by
default. Core, adapters, lifecycle ownership, and package names remain unchanged.
The existing Picking proof and generated starter validate independent static
hosting and ordinary iframe embedding. Nonempty output requires `--overwrite`;
failed builds preserve previous output. Runtime URL policy, remote services, and
browser permissions remain application/host concerns. Server conversion, embed
messaging, new players, marketplace, and cloud hosting are outside this milestone.

## D-023 — Distribute compiled web exports as ZIP-compatible packages

Keep `.urkpkg` packaging in `@urk/cli`, using zip.js for standard ZIP reading,
writing, and checksum validation. Format 1 places a small `urk.json` beside the
unchanged exported `index.html` and assets. Name, experience version, and type
come from CLI defaults/flags; type is metadata, not another runtime.

`pack` packages compiled output without rebuilding. Package-aware `inspect`
preserves the existing no-argument project report. `unpack` validates bounded,
safe regular-file contents into temporary storage before publishing to an absent
or empty directory. Packaging does not execute application code, grant ZIP file
permissions, or change Core/adapters. Hosts serve extracted files over HTTP;
direct archive execution, signing, launchers, marketplaces, and cloud services
remain outside this MVP. See the CLI README for format and extraction limits.

## D-024 — Optional Web Player hosts trusted exports on a separate origin

`@urk/player` is a small browser-only Web Component with no runtime dependencies.
It hosts the existing exported application in an iframe; the application retains
all kernel, adapter, controller, and lifecycle ownership. Play focuses/loads,
Reload replaces the document, and Unload/removal discards the browsing context.
There is no application lifecycle or privileged host messaging bridge.

Require a different HTTP(S) origin for the experience, as selected for this MVP.
Sandbox scripts and the experience's own origin remain enabled for modules,
storage, and current proofs; top navigation/popups/downloads are not granted.
This supports trusted exports, not hostile marketplace code. Hosting must not
redirect/navigate onto the parent's origin. Browser-side ZIP mounting and native
filesystem access remain excluded.

Iframe navigation cannot reliably report cross-origin HTTP/application failures.
Use `loaded` for navigation, a bounded loading timeout, and optional `check-src`
CORS HEAD validation for hosts that permit it. Fullscreen and audio remain subject
to browser permissions and user activation. Two plain HTML Player instances and
a plain iframe fallback prove the feature without changing existing experiences.

## D-025 — Generate static embed hosts through the existing CLI

`urk embed <experience-url>` generates ordinary HTML, a plain iframe fallback,
hosting notes, and a byte-for-byte copy of the existing `@urk/player` browser
module. The CLI declares the Player as a dependency and resolves its built file
without importing browser code into Node. No repository path, CDN, project build,
network fetch, deployment, or extra bundler is involved in generation.

Support title, constrained CSS height, fullscreen, and optional CORS HEAD checking.
Escape HTML values and publish staged files only to absent/empty safe directories.
Preserve D-024's trusted-export, separate-origin hosting boundary. Generated
files can move under a static hosting subpath; no application/Core/adapter changes
or new runtime/lifecycle bridge are introduced.

## D-026 — Use the scaffold's existing Vite build for the complete portable workflow

Set `base: './'` in newly scaffolded Vite configurations. Keep the existing
`tsc --noEmit && vite build` script as the normal production path; its compiled
output feeds the already-implemented iframe, package, inspection, unpack, and
Player flows unchanged. Preserve the prior optional `urk export` command and
script for compatibility, without requiring it or adding another build system.

The ordered acceptance proof creates a fresh project, installs packed local
packages while changes are unpublished, then verifies static hosting and plain
iframe interaction before packaging and playing its extracted manifest entrypoint.
Core, adapters, and the Player implementation are unchanged by this completion.


## D-027 — Add numeric motion with temporary demand on the existing scheduler

Extend D-020 with finite numeric property tweens and automatic operational pause
integration. Keep one generic removable frame callback API in Core, ordered before
controller updates, with existing scheduler timing and failure handling. Expose
existing lifecycle lookup/subscription on RuntimeContext. Each motion adapter shares
one callback across runnable tweens; no second scheduler or permanent updater.

Targets remain borrowed. Overlapping properties replace whole operations from
current values; disjoint properties coexist. Reduced motion and explicit finish
apply destinations synchronously with redraw notification. DOM styling ownership
and authored replacement keyframes retain D-020 semantics. Presets, composition,
springs, timelines, and DOM blending remain deferred; manifests/publication unchanged.

## D-028 — Keep audio analysis optional inside the audio adapter

Expose `audio.analysis` through the existing AudioCapability. Lazily create one
owned context/analyser per opted-in transport, caching media source bindings and
reusing snapshot buffers. Use AnalyserNode for waveform, spectrum, normalized RMS,
and configurable coarse band magnitudes. Preserve native playback controls and
user-gesture timing; CORS analysis is explicit. Disable bypasses analysis, while
adapter disposal disconnects nodes and closes its context. Playback-only users
create no Web Audio resources. No audio-specific Core change or new package.

A focused Canvas proof beside the existing Audio Proof reads once per temporary
URK frame while active. Rendering and media policy remain controller-owned; no sample
arrays travel over the event bus. Beat/BPM estimation, recording, worklet DSP,
history, editors, and preset systems remain deferred.


D-028 integration follow-up: the Audio Lab now shares its controller, controls,
plots, and optional Three scene between website and standalone hosts. Direct
analysis values drive continuous reactions; existing numeric tweens handle finite
Orbit/Row transitions. Graphics setup uses the existing isolated child-scope
pattern. Host navigation and page-history cleanup reuse the website media host.
No additional public runtime API or Core change is needed for this integration.
