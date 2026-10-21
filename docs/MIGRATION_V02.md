# URK v0.2 migration notes

Status: implemented v0.2 working tree; package publication and deployment are separate. These notes describe the supported implementation. The original [proposal](URK_V02_ARCHITECTURE_AND_PLAN.md) remains design history.

## Existing API compatibility

Keep using `@urk/core`, `Kernel`/`Runtime`, `createKernel`, `boot`, `pause`, `resume`, and `shutdown`. React/Next provider and hook APIs remain unchanged; the preferred package names are now `@urk/react` and `@urk/next`. Adapter and service string lookups through `ctx.adapters` and `ctx.services` remain supported; adapter lookups additionally accept typed tokens.

## Framework package names and UI overlay

UI Overlay now also supports `open()` handles for status, callout, and nonmodal
panel instances. Existing singleton methods stay supported; `getSnapshot()` and
`subscribe()` describe only managed instances opened through `open()`. Styles
remain bundled. See the [usage and cleanup contract](../packages/adapters/src/ui-widgets/README.md).

Replace `@urk/react-urk` with `@urk/react` and `@urk/next-urk` with `@urk/next` in dependencies and imports. Their implementations moved to `packages/react` and `packages/next`; Next depends on React. The `0.2.0` legacy-name packages under `packages/compat` forward every export, sharing React context and cleanup ownership with the new names when they resolve the same canonical package instance. Provider props, hook signatures, SSR behavior, and existing `react-urk:*` events, sources, and default reasons are unchanged.

Previously published `0.1.x` packages cannot be renamed or retroactively forwarded. Those installs continue to use their original implementation. Consumers retaining old imports must upgrade to the forwarding release; `^0.1.x` ranges will not select `0.2.0`. Mixing old `0.1.x` wrappers or independently installed canonical copies with the new packages does not guarantee shared React context. Website reference/package URLs retain their existing slugs for incoming links.

Registry preflight on 2026-10-12 returned E404 for `@urk/react` and `@urk/next`, and `0.1.1` for both legacy packages. No public package was found under either new name; availability and scope publish permission must be rechecked before any release. No package was published. A future release must publish the canonical packages and their required runtime versions before the legacy forwarders; npm names are separate packages.

Prefer `@urk/adapters/ui-overlay` with `createUiOverlayAdapter`, `UiOverlayCapability`, `UiOverlayAdapterApi`, and `UiOverlayCallout`. The existing `@urk/adapters/ui-widgets`, `createUiWidgetsAdapter`, `UiWidgetsCapability`, and API types remain supported. Factory and token aliases are identical objects; default ID `ui-widgets-adapter`, string capability `ui-widgets`, and token label stay unchanged. Use the shared token for lookup under the new naming. Register only one of the aliases. Root/DOM exports include both names, and the independent overlay import requires no Three.js.

`RuntimePhase` still contains `boot`, `loading`, `ready`, `transition`, `paused`, and `error`. `RuntimeStore`, `getState()`, and legacy phase writes remain supported. Operational lifecycle observation and typed adapter lookup are additive. Await lifecycle promises for successful operation completion instead of interpreting a legacy phase as proof of startup or shutdown completion.

## Intentional behavior fixes

| Area | Current contract |
| --- | --- |
| Concurrent boot | Callers share one complete startup operation, including controller starts |
| Shutdown during setup/start | Cancellation and disposal guards take effect immediately; tracked work settles before teardown completes |
| Concurrent shutdown | Callers share cleanup completion or its reported failure |
| Restart | Disposal is terminal; failed kernels cannot restart; create a fresh kernel after cleanup |
| Controller frames | Only successfully started controllers with update hooks participate; frame membership changes take effect on a later frame |
| Dynamic startup | Concurrent starts retain registration order; boot completes controllers registered while an asynchronous startup pass settles |
| Adapter conflicts | IDs and capability aliases reserve before asynchronous setup; failed setup releases reservations; late setup cannot publish after cancellation |
| Cleanup failures | Later cleanup still runs; all collected causes remain available without replacing an initiating startup error |
| Borrowed services | Registry cleanup releases references without destroying supplied values |
| Scheduler restart | Stale callbacks cannot create duplicate frame chains after stop/start |

Configured adapters are preflighted and default to sequential dependency-first initialization; parallel batches are opt-in as described below. Valid legacy ordering stays intact; forward references are supported. Missing providers, cycles, and duplicate IDs/aliases/controllers reject before acquisition. Dynamic registrations require published dependencies. Continuous frame scheduling stays the default; opt into `frameMode: 'auto'` for demand-based scheduling.

## Track owned resources

Adapter and controller contexts now include `signal: AbortSignal` and a local `scope: ResourceScope`. If you construct `RuntimeContext` manually, supply both; normal kernel users receive them automatically. Honor the signal when supported by asynchronous work and register cleanup immediately after acquisition.

```ts
setup(ctx) {
  const unsubscribe = ctx.events.on('example:changed', listener);
  ctx.scope.defer(unsubscribe);
  return api;
}
```

Keep each resource under one owner. If a legacy `dispose` hook already releases it, either retain that hook or move the release to the scope. Do not keep equivalent cleanup in both places. Component disposers run before their scopes; controllers clean up before adapters, followed by the kernel scope and service-reference clearing. Scope callbacks run in reverse acquisition order, once each, even when another callback fails.

Scopes cannot clean up acquisitions they were never told about. Service borrowing does not override cleanup code inside an adapter: audit built-in and custom adapters before assuming externally supplied resources survive their own disposal logic.

## Typed adapter lookup

Export one `token<Api>('label')` from the capability contract module. Bind it with the new optional `token` registration field, retaining the existing `id` and `capability` strings. `ctx.adapters.require(Token)` returns `Api` and `get(Token)` returns `Api | undefined` without a generic argument. String calls and token-free registrations remain supported.

Declare providers as `AdapterRegistration<Api>` or use `satisfies AdapterRegistration<Api>` to check token/setup agreement. The heterogeneous `KernelConfig.adapters` list still erases APIs to `unknown`, so inline configuration does not validate every token/API pair. Tokens provide lookup inference rather than runtime schema checks. `dependsOn` now accepts tokens mixed with strings, requiring successful publication before the dependent setup. Configured forward references are planned before acquisition; dynamic registrations require providers to be published already.

Tokens are frozen identities with unique symbol keys. Equal labels do not identify the same provider or create string aliases. Recreating a token in a consumer will not find the provider; import its canonical token. Identity is captured and reserved before hooks, released after failed setup, and cleared on disposal. Required dependencies do not resolve while setup is pending. Existing callback receivers, alias collision rules, cancellation/cleanup guards, registration metadata, and inspector metadata remain intact.

Lookup does not use constructor checks or global name interning. A shared canonical token resolves across duplicate core copies of the same version; separately created tokens do not. No compatibility across arbitrary package versions is promised. Services now accept tokens and the common `ctx.get`/`ctx.require` facade resolves adapters or borrowed services. Built-in adapters now bind their exported tokens as described below.

## Independent adapter imports and built-in tokens

Use `@urk/adapters/audio`, `/input`, `/loading`, `/pointer`, `/storage`, `/three`, or `/ui-widgets` to import each existing factory, its API types, and its canonical token. Tokens are named `AudioCapability`, `InputCapability`, `LoadingCapability`, `PointerCapability`, `StorageCapability`, `ThreeCapability`, and `UiWidgetsCapability`. Built-in factories bind them automatically. After boot, `kernel.getContext().adapters.require(LoadingCapability)` infers `LoadingAdapterApi`; existing ID/string capability calls still work.

The root and DOM imports remain supported and re-export the same module identities. The DOM composite keeps its existing five adapters, excluding audio and Three; audio consumers can use its new subpath. Six non-Three subpaths and DOM resolve runtime and strict types without Three.js. Root/Three imports require the optional `three` peer, and their TypeScript consumers need `@types/three`.

Factory signatures and browser acquisition timing remain unchanged. Remapping only a factory's IDs/string capability does not remove its canonical token: a second provider for that token rejects. For existing custom multiple-instance registrations, spread the factory result and set `token: undefined`, or bind a separately exported `token<Api>(...)`. Do not recreate a built-in token by label in a consumer; separate contract module copies can also have distinct token identities.

Upgrade core, adapters, React/Next wrappers, and CLI to the local `0.2.0` manifests together. Public runtime peers use `^0.2.0`. These changes do not publish packages. No `sideEffects` metadata or general timing/bundle guarantee is added.

## Handle lifecycle completion and errors

Await `boot()` before pause/resume. A startup error triggers rollback and is rethrown unchanged. Inspect `kernel.getCleanupErrors()` if rollback also encountered cleanup failures.

Await `shutdown()` when the host releases a kernel. It rejects with `CleanupError` if one or more cleanup operations failed; `errors` retains the collected causes. Repeated shutdown calls observe that same completion. Fatal controller update/state-handler failures stop frame execution, but the host must still invoke and await shutdown to finish cleanup.

Cancellation cannot force an arbitrary JavaScript hook to stop. A hook that ignores the signal and never settles can keep shutdown pending. A hook may request shutdown without awaiting it; it must not await an operation whose completion depends on that hook returning. The same self-await restriction applies to lifecycle and disposal callbacks.

## Inspector changes

`getInspector()` still returns the facade with `getSnapshot()` and `subscribe()`. Reading a snapshot creates no subscription or timer. Unchanged reads return the same frozen object; snapshots, nested records, and arrays are now readonly. Copy values before editing them. Use `revision` or object identity to detect changes; `updatedAt` remains a display timestamp and can repeat within one millisecond.

The first subscriber activates state/event observation and a 200 ms sampler for continuous frame metrics. State/event notifications can arrive immediately. Calling the last unsubscribe stops the sampler and releases upstream subscriptions. Shutdown captures a final frozen snapshot and detaches all observation; later reads stay stable.

Event history and `totalEvents` now cover subscribed intervals only. Subscribe before boot to capture boot events. Recent events retain type/source/timestamp metadata, with type/source strings limited to 200 characters. Payloads are omitted to avoid retaining live resources; direct event-bus listeners still receive payloads. Previously read history survives detach, but detached events are not added. Structural lists update on the next snapshot pull or sample when their registry revision changes; mutation within a borrowed service value does not increment that revision.

React's inspector hook now uses cached snapshot identity and stable callbacks. Shutdown creates one terminal snapshot even if diagnostics was unopened. No timing speedup or zero bundle overhead is claimed.

## Operational lifecycle snapshots

`kernel.getLifecycleSnapshot()` and `kernel.subscribeLifecycle(listener)` now expose operational state independently of experience flow. The frozen snapshot has readonly `state`, `revision`, `updatedAt`, and optional `reason` fields. `LifecycleState`, `LifecycleSnapshot`, and `LifecycleListener` are exported from `@urk/core` through its existing barrel.

States are `created`, `starting`, `running`, `paused`, `failed`, `disposing`, and `disposed`. Boot publishes `starting` synchronously and commits `running` after required startup succeeds. Shutdown commits `disposing` before abort listeners run and publishes after frames stop. It stays there while tracked work remains unsettled, then commits `disposed` after cleanup attempts finish, including when shutdown rejects with cleanup errors. Use the promise/error list to distinguish successful cleanup from attempted cleanup. Fatal failures after startup stay `failed` until the host shuts down; startup failure rolls back automatically.

Read the current snapshot before or after subscribing; subscription itself does not call the listener. Future transitions notify synchronously. Reads return the same frozen object until a transition, and revisions advance independently of wall-clock time. Observer exceptions are isolated. A reentrant transition suppresses older pending delivery, so observers can skip intermediate states but never receive revisions backwards. Unsubscribe is idempotent; disposal releases all listeners; later subscriptions are inert.

No legacy phase, phase callback timing, scheduler default, wrapper default, or factory signature is removed by lifecycle observation. Direct phase writes have no new lifecycle or scheduling effects. The existing inspector `disposed` flag continues to mark disposal intent; the new lifecycle `disposed` state marks completed cleanup attempts. Observation adds no framework hook or transition queue; token/adapter additions are documented separately above.

## Ordered phase commands and parallel startup

Use `await ctx.state.transition('ready', 'content:loaded')` when application flow needs ordered notifications. Commands commit in request order, notify subscribers immediately, and wait for all returned promises, including controller `onStateChange` handlers, before the next command commits. Matching phase/reason commands are no-ops. Rejection closes the command queue; controller failures also fail the kernel. Shutdown rejects active and queued commands immediately but waits for active handlers before disposing resources. Standalone stores expose `cancelTransitions(error?)`, which closes commands and returns notification completion.

Legacy `setPhase()` remains synchronous and bypasses the queue, as do kernel boot/pause/resume compatibility writes. Use one command path for flows requiring serialization. A handler may enqueue another command without awaiting it; awaiting a command behind its own handler would deadlock. Cooperative cancellation still applies. These commands manage experience phases, not operational lifecycle.

Set `adapterStartup: 'parallel'` to start independent configured adapters together. Dependency batches are preflighted before acquisition; a consumer starts only after the preceding batch succeeds. Declare every setup dependency, including side-effect ordering previously implied by the array. The default remains `sequential`. Published siblings retain planned order even when setup finishes out of order, and dispose in reverse order. Cancelled unpublished acquisitions clean up when their hooks settle. Startup failure signals cancellation before partial cleanup and retains its original error. Parallel batching overlaps asynchronous work; it does not make synchronous JavaScript run on multiple threads.

## React and Next cleanup ownership

`UrkProvider` adds `ownership?: 'legacy' | 'external' | 'provider'`. The default remains `legacy`: the first provider requesting boot in the `boot` phase claims cleanup. Prefer `external` when a host shares an existing kernel and `provider` when the provider owns it. External consumers never initiate shutdown, even if they requested boot. An explicit provider owner cleans up an unbooted kernel too. Competing explicit owners reject; a second legacy consumer does not acquire cleanup ownership. Changing ownership or kernel identity after mount rejects.

`UrkNextProvider` now defaults to provider ownership because it creates the kernel it hosts. Factory and hook signatures remain unchanged. Factories can run during server rendering and must construct inert kernels; browser acquisitions belong in lifecycle hooks.

Boot requests and ownership cleanup use separate effects. Changing reason props or toggling `autoBoot` does not dispose a kernel. Enabling auto-boot requests startup once. Unmount retains the zero-delay cleanup grace for synchronous effect replay; when that task runs, cancellation is signaled without awaiting startup. The wrapper shutdown-requested event follows this cancellation signal. Boot-completion events are suppressed for an unmounted or cancelled provider. Cleanup still waits for noncooperative hooks to settle.

The regular React runtime snapshot hook now caches by store revision and memoizes its callbacks. Equal timestamps or a phase round trip no longer hide a revision. Its return type and the legacy phase store remain unchanged.

Adapter registration event metadata now uses the identity reserved before setup. Controller startup uses the ID captured before registration observers run. Controller initialization/start guard failures again return rejected promises instead of throwing synchronously. Receivers and execution order are preserved.

## Validation and next work

Core has deterministic regression tests, including a manual frame scheduler, diagnostics ownership/caching tests, lifecycle observation tests, and typed adapter reservation/dependency tests. Its test command also checks inferred public declarations and independently installed packed copies. Adapters now have real public type, contract, and isolated packed-export checks. The private proof workspaces add React/Next SSR tests and Playwright browser ownership tests. See [validation evidence](VALIDATION.md) for results and remaining gaps. The shared v0.2 experience exercises actual loading/pointer/UI cleanup in standalone/React/Next hosts. A repeatable runtime measurement covers frame modes; wider profiling and external-library failure cases remain documented limitations.

## Preferred v0.2 APIs

Use `ctx.require(Token)` and `ctx.get(Token)` for adapter or service values. Register borrowed typed values with `kernel.registerService(Token, value)` or `serviceBindings: [{ token: Token, value }]`. One token has one provider per kernel across both registries. Services retain their token display name as a legacy service alias. If a string is used by both registries, the common facade rejects ambiguity; explicit `ctx.adapters`/`ctx.services` calls remain valid. Manually constructed contexts must supply the new lookup methods.

Use `frameMode: 'auto'` for event-driven hosts. It leaves an idle kernel operationally running without a controller frame loop and wakes after an update controller starts. The compatibility default is `continuous`; explicit scheduler calls keep their contract. Raw timing and first-frame behavior are unchanged. React's `useLifecycleSnapshot()` consumes the cached operational snapshot.

Built-in resource ownership now uses scopes rather than factory-level teardown slots. Partial acquisition failures clean up even without a published API. Pointer bindings and UI destruction remain idempotent for early manual release. Audio preload cancels with the kernel signal and late playback completion stops instead of publishing activity. Borrowed hosts/storage are not destroyed.

Run `corepack yarn dev:v02` for the shared standalone/React workbench, `/v02` in the Next proof, or `/v02/` in the website. [Deferred scope](DEFERRED.md) and [performance evidence](PERFORMANCE.md) describe the limits of this version.

## Architecture simplification within v0.2

Existing factories, registrations, imports, callback receivers, ownership, and cleanup order remain supported. Operational decisions now read the lifecycle store directly. Injected schedulers see the committed `running`, `paused`, `failed`, or `disposing` state when their start/stop methods run; ordinary lifecycle observers still publish at the operation boundary. Dynamic controller activation no longer calls `start()` on an already-running scheduler. Explicit calls to `ctx.scheduler.start()` retain their behavior.

Controller startup inserts compact update entries in registration order instead of repeatedly rebuilding the list. Adapter IDs, aliases, and tokens now index their acquisition records directly. No consumer migration is required for these internal changes. [Performance evidence](PERFORMANCE.md) compares the actual saved before/after builds.


## Optional motion and audio analysis additions

Use matching Core/adapter builds from this checkout. RuntimeContext now also
provides `getLifecycleSnapshot`, `subscribeLifecycle`, and `registerFrameWork`;
manual context implementations need these methods. Temporary frame work runs
before controller updates; its release function is idempotent and belongs in the
owner's cleanup scope. Auto mode now wakes for temporary demand as well as updaters.
Continuous mode and raw scheduler timing are unchanged.

The motion adapter adds `scoped(scope).tween(target, properties, options)` and
suspends DOM/numeric motion during operational pause/startup. Explicit group and
individual pauses remain independent. Legacy phase changes retain application
policy. See [motion semantics](../packages/adapters/src/motion/README.md).

Audio playback consumers need no change. `AudioAdapterApi` adds `analysis`, so
handwritten API mocks must supply it. Real consumers opt in with
`audio.analysis.enable()` from a gesture and read reusable snapshots in their
controller. See [analysis API and ownership](../packages/adapters/src/audio/README.md).
These are local additions, not a package publication or version bump.


## Motion frame demand

The motion release candidate is `@urk/adapters@0.2.1`. Core remains `0.2.0`;
the adapter's `^0.2.0` Core peer and existing entrypoints remain compatible.

Callback tweens and timelines now advance automatically through the same temporary
frame work as property tweens. `createMotionController()` can stay registered but
is no longer required and has no updater. Remove custom per-frame calls to
`motion.advance(...)` to avoid applying an additional time step. Direct manual
advance remains available for controlled synchronous use.

Idle/paused motion releases its own frames; delayed runnable work keeps them.
Per-operation baselines begin on the first runnable frame and reset on resume,
retarget, or seek. Unrelated updater controllers continue to request frames under
the existing Core contract. See D-041 and the motion README for timing details.

Callback tweens use `ValueTweenOptions`; `TweenOptions` retains the compatible
property-target API. `ValueTweenHandle` adds sampled-value retargeting, while
`TimelineHandle` adds absolute seeking. Do not substitute a timeline for a numeric
entry or expect seeking to revive a terminal handle. Scope speed and reduced-motion
observation preserve the existing playback/scoped ownership rules.

Motion Lab, widget settings/presets, and the private examples package are application
proofs rather than new public packages. For external reuse, the Motion Embed
Starter copies the widget source and packs local runtime builds. See the
[motion release notes](MOTION_RELEASE.md) for the public surface and focused gate.

## Audio position and seeking

Audio snapshots now include `currentTime: number` and `duration: number | null`
in seconds; duration can be `Infinity` for an unbounded source. Custom snapshot
fixtures should initialize them to `0` and `null`. Implementations typed as
`AudioAdapterApi` also need the new `seek(seconds): void` method; the factory and
mixer channels supply it. Existing playback call signatures are unchanged.

Seek requires an active track and loaded metadata. It rejects invalid/out-of-range
times, never starts playback, and leaves a pending play cancelled and paused.
Subscriptions now also observe native metadata/time/seek changes. Do not treat
every snapshot notification as a new transport action or add a frame loop for
progress. See the audio adapter README for the native seeking contract.

## Audio source replacement

`AudioAdapterApi` implementations now also provide `setSource(trackId, src): void`.
The factory and mixer channels supply it. Unlike registering another track,
replacement reuses the element and its Web Audio source binding. It selects the
target paused, stops prior playback, cancels the replaced source's preloads with
`AbortError`, and clears its loaded cache. It never calls play. Source selection
can therefore make metadata/seek available before the first Play.

Callers supplying blob URLs own their revocation. The example widget can opt in
with `localFiles: { defaultSource }`; its scope manages URL replacement/reset and
restores that source on early removal. Default widget hosts keep their existing
host-registered source policy. Remote replacements retain the registered CORS mode.
