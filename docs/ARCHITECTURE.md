# URK Architecture

URK is a standalone browser runtime built around **adapters, controllers, and explicit state**. The kernel coordinates their lifecycle. Frameworks host the kernel; rendering, product behavior, and application flow stay outside it.

This document describes the v0.2 foundation and the first v0.3 interactive rendering/UI integration slice. The original v0.2 proposal is design history, and [deferred work](DEFERRED.md) is not an additional implementation layer.

## Dependency direction

```text
Standalone / React / Next / website host
                   |
          experience composition
        (adapters + controllers)
                   |
              @urk/core
  Kernel -> lifecycle, registries, scheduler
         -> resource scopes, state, events
         -> optional inspector observation
```

The shared private examples package contains experience logic. Hosts choose ownership and provide mount surfaces. UI and scene coordination belong in controllers and adapters; neither requires another generic core subsystem. The CLI scaffolds projects and is not a runtime dependency.

The optional `@urk/player` Web Component hosts a compiled export in a separate-origin
iframe. It owns only the iframe, loading checks, and host controls. The embedded
application keeps its existing kernel and lifecycle ownership; the Player imports
no Core/adapters and adds no runtime or lifecycle bridge. See D-024 and the
[Player reference](../packages/player/README.md) for its trusted-export boundary.

## Responsibilities

| Component | Owns | Does not own |
| --- | --- | --- |
| `Kernel` | Context, complete boot/shutdown operations, cancellation, frame demand, failure handling | Application transitions, rendering, framework state |
| `LifecycleStore` | The authoritative operational state and immutable revisioned snapshots | Experience phases or resource acquisition |
| `AdapterRegistry` | Reserved providers, successful acquisitions, direct capability lookup, reverse cleanup | Borrowed service lifetime |
| `ControllerRegistry` | Controller startup, ordered active update entries, pending hooks, reverse cleanup | Frame requests or adapter implementation |
| `ServiceRegistry` | Borrowed values and typed/string lookup | Destruction of supplied values |
| `ResourceScope` | Once-only reverse cleanup of explicitly owned acquisitions | Discovering untracked resources or forcibly cancelling JavaScript |
| Frame scheduler | One frame request chain and raw frame timing | Controller membership or application logic |
| `RuntimeStore` / `EventBus` | Legacy experience phases and event delivery | Operational lifecycle decisions |
| Runtime inspector | Cached read-only snapshots and optional sampled observation | Runtime control or cleanup ownership |

Implementation folders follow these responsibilities. Existing public re-export files remain compatibility entrypoints; internal kernel imports name the implementation they use directly.

## One operational state

The kernel reads `LifecycleStore` to decide whether work can activate. It does not maintain separate paused, failed, and disposed booleans. Its retained `booted` flag is historical metadata: successful startup stays observable after shutdown.

The operational path is `created -> starting -> running <-> paused`. Fatal failures enter `failed`; shutdown enters `disposing -> disposed`. Disposal is terminal. Construct a new kernel for another run.

Boot and shutdown install shared completion promises before user callbacks can reenter. Boot resolves after all admitted startup work succeeds. Shutdown immediately closes activation, signals `ctx.signal`, and stops scheduling, then awaits pending work and cleanup. Startup errors trigger rollback without replacing the initiating error. Fatal errors after startup stop the loop; the host still awaits shutdown for cleanup.

State is committed before injected scheduler or cancellation callbacks run, then published at the operation boundary. Lifecycle listeners receive frozen snapshots with monotonic revisions. Reentrant transitions suppress older pending notifications; observer errors cannot interrupt lifecycle work. This is current-state observation, not guaranteed delivery of every intermediate state.

Legacy `boot`, `loading`, `ready`, `transition`, `paused`, and `error` phases describe experience flow. Direct `setPhase` writes retain their synchronous timing and may overlap async handlers. The explicit `ctx.state.transition(phase, reason?)` command queues the commit and awaits its notifications before admitting the next command. Shutdown rejects outstanding commands immediately, then waits for active notifications before cleanup. Neither API controls the scheduler.

## Capabilities and ownership

Adapters expose APIs; controllers orchestrate them. Prefer `ctx.get(Token)` and `ctx.require(Token)` for inferred adapter or borrowed-service values. Existing explicit registries and string lookups remain supported. Ambiguous strings in the common facade reject.

`token<T>(name)` provides symbol identity, not global name interning. Import the canonical token. Adapter token labels are not extra aliases; service token labels retain their legacy service alias. One per-kernel reservation set prevents the same token being supplied by an adapter and a service. Each registry retains its own ownership records.

The adapter registry has one ordered acquisition list and one direct index from IDs, capability aliases, and token symbols to those records. Pending reservations are separate from published APIs. Identity is captured before hooks, conflicts reject while setup is pending, and publication follows successful uncancelled setup. Cleanup releases reservations and references.

Configured startup preflights duplicate providers/controllers, missing dependencies, and cycles before acquisition. Sequential setup remains the default. `adapterStartup: 'parallel'` groups independent adapters by dependency depth; each batch completes before the next begins. Siblings retain planned registration order regardless of completion timing, with reverse disposal after controllers. Setup failure cancels sibling work before awaiting partial cleanup and boot preserves the initiating error. Dynamic registration requires already-published dependencies.

Each adapter/controller receives a local `ctx.scope`. Register cleanup immediately after acquisition, before subsequent work can fail. Cleanup runs controllers first, then adapters, then the kernel scope, reversing the relevant registration/acquisition order. Each legacy disposer runs before its scope. Cleanup continues after failures and exposes all causes through `CleanupError` and `kernel.getCleanupErrors()`.

Give an acquisition one cleanup owner. Supplied services, hosts, and storage remain borrowed. Cancellation is cooperative: an unresolved hook can keep cleanup pending, and a hook must not await a lifecycle operation that depends on that hook returning.

## Frame execution

The controller registry inserts one compact update entry when an update-capable controller successfully starts. An entry contains registration order, the callback receiver, and its initialized context. Sequential starts append; out-of-order concurrent starts insert at their original position. Startup no longer scans all controllers to rebuild the update list after each completion.

Frames deliver temporary work first, then iterate only these controller entries, preserving callback receivers, arguments, and registration order. Startup completion occurs in a microtask, so new membership becomes eligible on a later synchronous frame. Shutdown interrupts remaining delivery immediately. The pending-start check reads records directly instead of allocating diagnostic lists.

`frameMode: 'auto'` schedules only when a started updater or registered temporary frame callback needs frames. An event-driven kernel can be operationally running with no frame requests. `continuous` remains the compatibility default. Dynamic activation does not restart an already-running scheduler. Pause/resume follows operational state and frame demand.

Browser scheduler generations invalidate stale callbacks and prevent callback-triggered stop/start from creating duplicate chains. `ManualFrameScheduler` accepts explicit timestamps. Neither mode controls external library tickers or changes raw timing/first-frame behavior.

## Diagnostics and framework hosts

Inspector construction acquires no subscriptions, history, sampler, or structural snapshots. Snapshot reads return cached immutable values, with revisions independent of timestamps. Structural lists rebuild only when their registry revision changes. Frames do not publish inspector snapshots.

The first subscriber attaches state/event observation and a 200 ms sampler; the last unsubscribe or shutdown releases them. History retains at most 60 bounded metadata entries by default, without payload graphs, and covers only subscribed intervals. Shutdown captures a terminal snapshot even when diagnostics was unopened. Diagnostics are lazy at runtime, not absent from the exported bundle.

React `UrkProvider` supports `legacy` ownership inference, explicit `external` ownership, and one explicit `provider` owner per kernel. Identity and ownership stay fixed for the mount. Reason/auto-boot changes do not dispose a kernel. A cancellable zero-delay task allows effect replay, then invokes shutdown immediately on actual unmount, including during pending boot. Stale boot completion is suppressed.

Next defaults to provider ownership. Factories remain inert, including during server rendering; browser acquisition belongs in lifecycle hooks. React's phase, lifecycle, and inspector hooks use stable subscriptions and revisioned snapshots. Wrappers add host integration, not another lifecycle coordinator.

## Packages and proof

Keep `@urk/core`, `@urk/adapters`, `@urk/react`, `@urk/next`, and `@urk/cli`. The private examples package shares a single v0.2 experience across standalone, React, Next, and website hosts. It demonstrates loading, interaction, overlays, pause/resume, diagnostics, unmount, setup failure, and fresh-kernel recovery.

That same experience now demonstrates native layout/rotation controls, hover feedback, and a finite Row/Arc transition. Its scene owns and cancels its animation frames and GPU geometry/materials. Operational lifecycle observation freezes animation independently of application phases; resize/theme changes may repaint the frozen view. The Three adapter owns renderer sizing and emits `three:resize` so consumers can redraw without duplicate resize observers. Picking refreshes world matrices before rendering. Native controls retain their keyboard behavior, and input/pointer delivery stops at cancellation. The existing v0.2 routes, exports, and package versions remain in place; this is not a v0.3 release.

Three context loss is capability-local, not a kernel lifecycle transition. The adapter emits host/canvas-scoped loss/restoration events and suppresses drawing, resizing, and picking while unavailable. Three.js owns its native renderer recovery; URK retains the existing scene and renderer identities. The shared scene cancels frames, freezes transition timing, and requests a redraw after restoration, including a static redraw when operationally paused. Its controller owns recovery feedback and temporarily disabled scene controls. Abort suppresses late events, and scoped cleanup removes listeners. No recovery coordinator or retry loop is introduced.

`@urk/react` lives in `packages/react`; `@urk/next` lives in `packages/next` and depends on `@urk/react`. The published legacy names are forwarding packages under `packages/compat`. They re-export the same providers, hooks, React context, and ownership state. Next keeps its client boundary and inert SSR factory behavior.

Adapters export independent audio, video, input, loading, pointer, storage, three, and ui-overlay modules plus compatible root/DOM composites. The ui-widgets path remains supported; both overlay names share one factory and token, retaining the legacy registration strings. Non-Three subpaths and DOM resolve without Three.js. Root/Three consumers retain the optional peer requirement. Factories acquire nothing until lifecycle hooks or explicit API calls. The overlay owns status/callout DOM and managed nonmodal panel shells with application content cleanup; Three owns its existing scene capability. Neither introduces a rendering engine, generic UI framework, renderer registry, or additional coordinator.

Node 22, Yarn, legacy aliases, and thin wrappers remain. Workspace builds resolve local dependencies once. Package manifests are 0.2.0; publication is separate. See [migration](MIGRATION_V02.md), [performance](PERFORMANCE.md), and [validation](VALIDATION.md) for exact behavior and evidence.

The video capability exposes independent native media handles with event-driven snapshots. Supplied video elements are borrowed by default; adapter-created or explicitly transferred elements are owned. Playback cancellation follows the kernel abort signal, while kernel pause has no implicit media policy. Video Proof controllers own local object URLs, captions, controls, and explicit experience pause behavior. No decoding, media clock, or separate diagnostics system is added to core.

Interactive Media composes video, storage, and an optional audio mixer through a controller. Its cue and time-source helpers remain inside the private examples package: application events and explicitly selected time sources drive cancellable actions; visual chapter state derives from current media time. Branches, bookmarks, pause policy, and overlays stay application-owned. Standalone and website hosts mount the same implementation.


`@urk/adapters/audio/mixer` composes existing audio transports in adapter-owned child scopes. Named channels expose the legacy transport API; group volumes and finite cancellable channel/group fades remain outside core. Controllers decide crossfade, narration ducking, opt-in, pause, and visibility policies. No global clock, analysis loop, or additional kernel lifecycle is introduced. The interactive-media controller waits for pending native audio play results before releasing adapter resources.


The optional `@urk/adapters/motion` capability owns finite native DOM animation through resource scopes. Its playback handles settle as completed, cancelled, or failed; one active animation per element is replaced as a whole, and caller keyframes define the new start. UI state/CSS owns stable appearance, so completion and cancellation release effects without committing inline styles. Reduced motion skips new effects and finishes active ones. A group registers one scope cleanup and removes settled operations. Operational lifecycle observation suspends DOM and numeric work on pause, preserving explicit group/individual pauses; failure or shutdown cancels pending work. Numeric tweens share one temporary callback on the existing scheduler and release demand when paused or settled. Their values update before controller rendering; no second loop is introduced.

`interactive-media/stage.ts` composes this public motion capability with the private cancellable transition helper for chapter titles and film/ending handoffs. Its view state stays outside kernel lifecycle state, and cancelled or failed playback cannot commit a later scene. The former private motion helper has been removed. There is no Stage runtime or extra scheduler.

The optional `@urk/adapters/three/video` binding borrows a video handle and owns only its texture/subscriptions. The shared media gallery reuses Three adapter setup in an independently cancellable child scope, keeping optional graphics failure local to the experience. Interactive Media and Experience Showcase share that composition; decoded-frame observation and coalesced rendering stop on suspension/exit. Neither adds a kernel updater, lifecycle state, or second runtime.


`RuntimeContext.registerFrameWork(callback)` returns an idempotent release function.
Callbacks run in registration order before controller updates; additions wait until
the next frame and removals suppress remaining delivery. Register the release with
an owning scope for early disposal. Shutdown/failure clears all remaining work;
callback exceptions use the existing runtime failure path. Context lifecycle
lookup/subscription delegate to the kernel's authoritative store.

Optional `audio.analysis` lazily routes the existing HTML audio transport through
one owned Web Audio context and one active analyser. Source nodes are reused per
media element. Waveform, spectrum, RMS, and coarse band magnitudes are pulled into
reusable buffers by controllers, never broadcast per frame. Pause/stop/source change
detach analysis; disable bypasses it, preserving playback. Adapter scope cleanup
disconnects every node and closes the context. Rendering and media policy stay in
controllers. `/audio-proof/analysis.html` demonstrates demand-based Canvas rendering.


The Audio Lab now lives in `packages/examples/src/audio-proof`. Standalone and
website mounts share its controls, Canvas plots, reactive Three scene, and media
policy. An optional child scope reuses Three adapter setup so graphics failure
stays local. Audio snapshots directly update visual properties; finite layout
changes use the existing motion capability. Both share Core frame demand.
The website uses its existing media-host connection/history cleanup path.

Callback value tweens, property tweens, and finite timelines share the same motion
adapter's temporary frame work. Each operation establishes its timestamp baseline
on its first runnable frame; pause/resume and explicit retarget/seek reset it.
One admitted snapshot prevents callback-created work from advancing in that frame.
Completion, cancellation, pause, reduction, and disposal release demand when no
runnable motion remains. Delayed playback retains demand through its delay.
`createMotionController` remains a startup capability check for compatibility,
without an updater or duplicate advancement. Explicit `advance(deltaMs)` is still
an additional manual time step; application frame loops should not call it for
ordinary playback. Callback failures settle handles before following the kernel's
existing frame failure path. Motion Lab and widget host diagnostics update from
playback callbacks. Embedded Docs releases its finite loading callback after startup.
Other application updater controllers retain their existing frame demand.
Kernel lifecycle, selected view, phase, and playback retain separate ownership.

Story Flow reuses that callback/timeline API in the existing scrollytelling proof.
Application-local scroll bindings replace native smooth scrolling and finite
section entrances replace CSS transitions and a frame-counted wave. Wheel/touch
input and resizing cancel guided work at its rendered position. The application
retains section selection and input policy; Core and the public motion API need
no changes. Its selectable scroll mode now binds native position to a paused
finite timeline through public seeking. Application code maps measured chapter
ranges onto the normalized playhead, keeps content readable, and rebuilds bindings
after layout changes. Timed entrances remain a separate selectable mode; switching
cancels the previous visual owner before restoring styles. Reduced motion releases
the preview and uses static cards. Runtime pause blocks native sampling, while
scope cleanup settles endpoint previews that remain available for backward seeks.
There is no generic scroll subsystem or additional scheduling mechanism.

Finite timeline seeking adds absolute-time sampling to that same capability.
`TimelineHandle` reports duration/current time and renders a clamped `seek(timeMs)`
without resuming the clock or committing completion. Timeline-owned child records
share the tween sampler; callbacks can invalidate an in-flight frame by seeking
or cancelling. Completion remains once-only and terminal handles cannot revive.
Motion Lab owns its scrub UI and creates a fresh paused timeline after a prior
handle settles. Core, scheduler demand, and native/property playback stay unchanged.

Motion scopes now own a finite positive playback rate for their current and future
operations. Callback tweens and timelines scale controller deltas once; property
tweens scale their compatible timestamp deltas and native effects use playback-rate
controls. Absolute seek positions, pause ownership, and immediate cleanup remain
unchanged. This requires no additional clock or Core behavior (D-032).

Motion presets are pure helpers returning validated numeric timeline entries.
Fade/slide/scale defaults and index-based stagger offsets reuse the existing
timeline executor; application callbacks still render values and compose
properties. They add no runtime ownership or scheduling layer (D-033).

Finite timeline repetition expands 1–100 authored passes into ordinary scheduled
entries. Yoyo mirrors alternating passes, including easing; the same executor owns
boundary delivery, total-time seeking, speed, pause, and cleanup. Completion effects
remain once per authored child and once for the whole timeline (D-034).

An optional DOM property binding composes numeric callbacks into inline opacity
and one transform. It borrows the element, restores prior inline styles through
its resource scope, and ignores late writes after disposal. Numeric playback and
presets retain their renderer-independent implementation; applications own element
lifetime, focus, inert state, and binding reuse. There is no new ticker or binding
registry (D-036).

Callback value tweens can retarget a live segment from its sampled value while
retaining playback ownership and the completion promise. Segment time/progress
reset, while pause, scoped speed, and terminal settlement remain unchanged.
Retargeting requires no target registry or additional clock (D-037).

Application action bundles compose existing `AbortSignal` support across handles.
The controller owns replacement generations and aggregate result/status handling;
the motion scope retains playback ownership and cleanup. Motion Lab proves
cancellation without disposing unrelated work or adding a batch runtime (D-038).

Effective reduced-motion mode is readable and observable directly from the motion
adapter. Preference observers are scope-released, notify only changes, isolate
failures, and register no frame work. Widget scrubbing uses this source to keep
controls consistent with the adapter's playback policy. A widget seek reuses a
live timeline or owns a fresh paused preview after terminal playback; no handle
is revived and Core, experience phases, and scheduling stay unchanged (D-039).

The reusable motion widget lives in the private examples package and is mounted
by both the standalone proof and the website's existing Embedded Docs Demo.
It borrows controller context/scope and appends only its own subtree and styles.
The website retains its existing lazy mount, local error boundary, lifecycle
controls, and fresh-kernel restart. Shutdown removes the widget while static docs
remain readable. This reuse adds no runtime API, framework wrapper, or scheduler.
Optional widget settings memory remains host-owned: the widget observes committed
timing/speed changes through an immutable callback, while a scoped host control
owns opt-in, storage keys, validation, and forgetting. It persists no playback
position, phase, or pause state and performs no frame-driven writes. Storage
failures remain local to the preference control (D-040).


Portable widget presets reuse that versioned timing/speed validator in the private
examples package. JSON import validates before one combined settings commit and
host notification. It preserves live position and pause ownership, applies speed
immediately, and stages timing for replay. Export excludes playback state and
persistence consent. The native text editor/control listeners share the widget
scope; Core, adapters, and scheduling are unchanged (D-042).


Motion Embed Starter is a small example host, with a repository exporter that
copies the canonical widget source and packs current Core/adapters builds into
relative file dependencies. Its preview bridge is not part of exported projects.
The independent project has no private example dependency or workspace alias;
the page explicitly owns kernel creation, scopes, lifecycle controls, and restart.
Its ordinary TypeScript/Vite build produces a relative-base static site usable in
an iframe. Existing CLI scaffolds and runtime APIs remain unchanged (D-043).
