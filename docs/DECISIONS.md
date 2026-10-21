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

D-028 embed follow-up: extract Canvas plots and temporary analysis frame reads
into the private Audio Widget example. Mount it with a borrowed host/context and
one host-registered track on the existing audio adapter. Keep track registration,
kernel lifetime, and final context disposal host-owned. Widget removal stops its
track and releases its child scope without shutting down the runtime. Analysis
remains opt-in through the Play gesture; unavailable analysis leaves ordinary
playback usable. Share those helpers with Audio Lab while retaining its optional
Three scene. A thin starter and exporter copy source, the original fixture, and
packed runtime builds into an independent project; no new public package or
runtime API is introduced.

D-028 docs integration: reuse the existing Embedded Docs Demo kernel for the
optional Audio Widget alongside motion. Register the audio adapter only where
native audio is supported, and register its study on the first explicit Add.
Add/remove controls and setup errors stay local to the audio host helper. Removal
stops that widget without shutting down motion; the parent keeps final adapter
cleanup. Audio playback still requires Play. Use the existing auto frame mode
for finite loading, motion, and audio reads; no additional kernel or scheduler.

D-028 transport follow-up: expose active-track `currentTime`, `duration`, and
`seek(seconds)` through the existing audio API, matching video's seconds/null/live
duration convention. Native progress notifications require no polling or analysis.
Reject invalid or unready seeks before changing playback; cancel pending
activation on a valid seek and preserve its requested position when a stale play
settles. Share a scoped native range control across Audio Lab and the Audio Widget.
Retain one source graph, existing runtime media policy, and adapter-owned cleanup.
No timeline editor, Core change, new context, or scheduler is introduced.

D-028 source follow-up: add `setSource(trackId, src)` to the existing audio
transport. Select the registered track paused, preserve its element/source-node
binding and settings, and invalidate old play/preload work before loading new
media. Clear its loaded cache and let native load reset timing. The example's
optional file control owns one object URL, restores its configured default on
early removal, and revokes old URLs through its scope. No upload, saved file,
audio editor, new context per file, or Core change. Apply the audio exporter's
content-based archive identity to the motion exporter as well.

D-028 reaction controls: keep visual tuning in the private examples layer. Share
one scoped control between Audio Lab and the Canvas widget, with overall intensity
and separate band responses from zero to two (default one). Renderers clamp the
scaled response to one without mutating measured snapshots, plots, or meters.
Input redraws the latest snapshot; it does not read analysis or schedule frames.
Reset changes only reactions. Each mount owns its values and restores defaults on
fresh setup; no persistence, public adapter API, DSP, or Core change is introduced.

D-028 settings memory follow-up: extend the private widget with validated initial
reaction values, immutable committed change callbacks, and a copied settings
getter. Following D-040, an optional scoped host helper owns explicit consent,
stable storage keys, versioned whole-record validation, forgetting, and local
failure reporting. Audio Lab and the starter demonstrate it; docs embeds remain
local by default. Save only the four visual responses on native change/reset,
skip duplicate writes, and prevent writes after scope/abort. Restoring never plays
audio. Forgetting preserves live settings; Reset retains consent and saves the
baseline. No persisted source/file, playback/analysis state, global fallback,
cross-tab synchronization, Core change, or new storage adapter is introduced.

## D-029 — Compose callback tweens and finite timelines through controller updates

Extend the existing motion adapter instead of adding a package or changing Core.
Share numeric interpolation between the compatible property-target API and the
new callback form (`ValueTweenOptions`). Register one explicit motion controller
to advance callback work with frame deltas. Preserve existing temporary-frame
property motion and native DOM playback, including their error outcomes. The
permanent motion controller keeps auto-mode frames active while idle.

Timelines schedule owned value tweens at absolute offsets, supporting sequences,
parallel work, and overlap without a builder language. Pause retains progress;
cancel settles children and handles; callbacks fail through existing controller
fatal-update handling after settlement. System reduction has an explicit adapter
override. No nested timelines, seeking, repeats, springs, or scene registry.

Motion Lab is one standalone DOM proof with latest-request navigation and a
generation guard. Application controllers own outgoing/incoming transitions,
ordered phase commands, visible/focus state, and cancellation restoration. Reconcile
application commands made during pause after the kernel restores its saved phase
on resume. Publication and framework-specific integrations remain separate.

D-029 reuse follow-up: migrate the existing standalone Scrollytelling proof to
public callback tweens for guided scrolling and finite timelines for chapter
entrances. Latest requests replace from current scroll position; manual input
and resize cancel guided work. Preserve loading, keyboard/pointer input, overlay
feedback, operational pause, and fresh-kernel ownership. This second consumer
requires no Core or motion API expansion and introduces no timeline seeking.

## D-030 — Seek finite timelines without reviving terminal handles

Extend D-029 with a `TimelineHandle` exposing `durationMs`, `currentTimeMs`, and
`seek(timeMs)`. Clamp finite positions and reject nonfinite inputs. Seeking renders
repeatable numeric bindings immediately through the shared tween sampler, including
initial values for future clips on backward seeks. Reset future clips in reverse
start order, then render started clips in start/authored order. No property blending.

Seeking preserves pause state and does not settle the completion promise or fire
completion callbacks. Subsequent forward updates commit unreported child
completions at or behind the playhead; each callback fires at most once per handle.
Terminal handles stay terminal. Applications create another timeline for replay or
post-completion scrubbing. A generation invalidates stale frame delivery when a
callback seeks, while cancellation and error settlement retain existing ownership.

Motion Lab provides a native range input and independent sequence pause/resume.
Its fully transparent interactive bindings become inert, and navigation/disposal
release preview work. Keep Core, scheduler behavior, package boundaries, and legacy
DOM/property tween APIs. Reverse playback, repeats, nesting, and editors remain
deferred; this is a local implementation change, not package publication.

## D-031 — Keep scroll-driven seeking in the application

Story Flow composes D-030 with native scroll position. Hold one individually
paused timeline and seek its measured chapter tracks from normalized scroll
progress. Reuse it at either endpoint, without automatic completion or time-based
playback. Rebuild after layout changes; cancel on mode replacement, reduction,
and disposal. Runtime pause suppresses sampling until running again.

Make scroll position the default visual source and retain timed entrances as an
explicit alternative with replay. Only one source writes visual styles at a time.
Chapter text remains visible during scroll choreography. The status panel counts
owned paused bindings and identifies them as scroll-linked. Keep native scrolling,
navigation policy, preference overrides, and geometry measurement application-owned.
No Core, adapter API, scheduler, scroll capability, or package changes are needed.

## D-032 — Scale playback within a motion scope

Expose `ScopedMotion.playbackRate` and `setPlaybackRate(rate)`, defaulting to one.
Require finite positive rates; pause remains the explicit freeze operation.
Apply speed to current and future work in that group, including delays. Scale
controller-driven timeline time once at the parent and preserve absolute seek
positions. Legacy property playback scales its existing timestamp deltas; native
DOM effects use their playback-rate control. Rate changes preserve individual,
group, and runtime pause. Finish/reduction/cleanup stay explicit and immediate.
Motion Lab demonstrates the API with one speed selector. No Core or scheduler
changes, reverse playback, or global time manager are introduced.

## D-033 — Author presets as ordinary numeric timeline entries

Expose pure `fade`, `slide`, `scale`, and `stagger` helpers through the existing
motion entrypoint. Presets supply validated numeric defaults and callbacks, while
applications own rendering and transform composition. Stagger adds index-based
gaps to authored offsets without mutating entries. Helpers acquire no resources
and create no playback handles; the existing timeline owns execution, seeking,
speed, reduction, cancellation, and cleanup. Motion Lab consumes these helpers
without a separate preset runner, renderer binding layer, or scheduler.

## D-034 — Expand bounded timeline passes onto the existing clock

Add `TimelineOptions.iterations` (total passes, 1–100) and `yoyo`. Expand entries
into finite offsets rather than introducing another executor. Mirror alternating
passes' clip offsets, endpoints, easing, and child progress; apply the parent delay
once. Report and seek the total run duration. Preserve once-per-authored-child
completion effects and one parent completion. Finish/reduction use the final pass
pose; pause, speed, cancellation, and cleanup retain their existing owner.

Motion Lab demonstrates one/two/yoyo passes and keeps its per-pass diagram separate
from total progress. It uses one forward pass under reduced motion so content stays
visible. Infinite repetition, negative rates, nesting, per-pass events, and repeat
gaps remain deferred. Core and scheduler behavior do not change.

## D-036 — Bind numeric motion to borrowed DOM styles explicitly

Add an optional `createDomMotionBinding` helper to the existing motion entrypoint.
Compose numeric opacity, translation, rotation, and uniform scale into two inline
properties. Keep interpolation, preset definitions, and playback independent of
DOM binding internals. Applications choose one binding per element and share its
resource scope with playback; Motion Lab caches bindings across replays.

The binding owns only temporary writes to inline opacity/transform. Save their
values/priorities before rendering, restore them on scope or explicit disposal,
and ignore late callback writes. Validate a whole patch before changing the pose.
Applications retain element lifetime, other styles, focus, inert state, and
animation cancellation policy. Do not read computed styles, merge arbitrary CSS
transforms, add an observer/registry, or create a scheduler.

## D-037 — Retarget active callback tweens at their sampled value

Return a `ValueTweenHandle` with `value` and `retarget(to, options?)` from callback
tweens. Reuse the existing interpolation record, handle, promise, scope, and
completion callback. Reset segment progress/time without writing immediately,
reapplying delay, or changing pause/speed. Validate before mutation; terminal
handles return false and require fresh work. Retargeting preserves position,
not velocity. Native/property playback and timeline handles keep their interfaces.
Motion Lab reuses active card-feedback tweens instead of replacing them on every
input change. No scheduler, target registry, or physics system is introduced.

## D-038 — Compose cancellable actions from existing signals

Use one standard `AbortController` per application action and pass its signal to
every participating tween/timeline. Aggregate handle results, abort on replacement
or partial setup failure, and guard status commits with a request generation.
Keep unrelated work in the same motion scope independent. Motion Lab demonstrates
this with position, scale, and progress, including paused cancellation and fresh
restart. Existing operation/scope cleanup supplies ownership; no new public API,
batch executor, cancellation registry, scheduler, or runtime phase is needed.

## D-039 — Observe effective motion preferences for interactive controls

Expose the motion adapter's existing effective reduced-motion value through a
readonly getter and a scoped subscription. Register no additional frame work.
Notify only changes, isolate observer failures, suppress stale reentrant delivery,
and clear subscriptions on disposal. Keep animation callback errors unchanged.
Applications can disable timeline scrubbing from the same preference source that
finishes playback, including host overrides and system preference changes.

The widget's seek helper pauses live timelines and creates a fresh paused preview
after terminal playback. It reuses the existing absolute seek API and retains
independent user, visibility, and kernel pause ownership. Core, experience phases,
and scheduling remain unchanged.

## D-040 — Keep optional widget settings memory in the host

Let the example widget report committed timing/speed changes through an immutable
callback. Keep browser storage, stable per-widget keys, explicit opt-in, and
forgetting in a scoped example-host helper. Save settings only on committed
changes; do not persist drafts, playhead, pause state, DOM, or kernel lifecycle.
Turning memory off preserves live playback and restores defaults on the next mount.

Validate complete versioned records atomically before restoring them. Corrupt or
unsupported records use defaults; storage access/write/removal failures report
locally without breaking motion. Scope disposal releases controls/listeners and
blocks later writes. No global memory fallback, cross-tab synchronization, new
storage adapter, or runtime API is introduced.


## D-041 — Share temporary frame demand across numeric motion forms

Supersede D-029's permanent controller clock with the existing temporary Core frame
API. Property tweens, callback tweens, and timelines share one adapter-owned callback;
operation start/resume wakes it and pause/settlement releases it when no runnable
work remains. Delayed work keeps demand. Snapshot admission precedes callbacks;
per-operation timestamp baselines exclude paused intervals and reset on retarget
or seek. Retain explicit manual advance as an additional synchronous step.

Keep `createMotionController()` as a compatible startup capability check with no
update method, avoiding double advancement and idle demand. Existing custom frame
loops should remove routine calls to `advance`. Preserve ordering before application
render controllers, playback outcomes, speed, reduction, seeking, and scope cleanup.
Callback errors settle handles before using existing fatal frame handling.

Remove status polling from Motion Lab and the standalone widget host; the private
widget's optional change callback updates its host. Embedded Docs owns a finite
loading callback that releases itself when complete. Other updater controllers
retain their existing scheduling contract. No Core change or new scheduler.


## D-042 — Share widget settings through small validated JSON presets

Reuse the widget settings validator and version-1 timing/speed record for manual
JSON import/export. Keep controls and serialization in the private examples
package. Validate the whole import before committing both settings and emit one
settings notification, so opted-in persistence never saves an intermediate pair.
Limit input to 4,096 characters and present errors locally.

Preserve the active playhead and every pause owner. Apply speed immediately and
stage timing for the next replay; importing never starts playback. Export no
drafts, playback state, DOM, storage keys, or saving consent. Clipboard access,
file pickers, named preset libraries, and a new motion API are not required.


## D-043 — Export the canonical widget into a small independent host

Keep one widget implementation in the private examples package. Preview the
starter through a small repo bridge; replace that bridge with copied canonical
source when exporting. Include packed Core/adapters builds under relative file
dependencies so current unpublished changes work outside the workspace and the
project remains movable. Refuse existing destinations and publish staged output
only when copying and packing succeed.

Reuse Node 22, Yarn, and the existing TypeScript/Vite scaffold build convention.
The page owns its kernel and controls; compiled relative-base output can be
hosted directly or framed. Add no runtime API, package, framework wrapper,
generic generator, or change to the existing CLI create command.
