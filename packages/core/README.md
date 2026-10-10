# @urk/core

Kernel bootstrap, runtime lifecycle, explicit phase state, registries, service lookup, and event routing.

## Public API

- `Kernel` - canonical kernel entrypoint
- `Runtime` - compatibility alias for `Kernel`
- `createKernel(config?)` - factory helper
- `RuntimeStore` - explicit phase store with subscriptions
- `AdapterRegistry`, `ControllerRegistry`, `ServiceRegistry`
- `EventBus` with targeted listeners plus `onAny(...)`
- `RuntimeInspector` via `kernel.getInspector()`
- `BrowserFrameScheduler`, `ManualFrameScheduler`
- `ResourceScope`, `CleanupError`
- `LifecycleState`, `LifecycleSnapshot`, `LifecycleListener` through kernel lifecycle observation
- `token<TApi>(name)`, `CapabilityToken<TApi>` for inferred adapter API lookup

## Runtime phases

- `boot`
- `loading`
- `ready`
- `transition`
- `paused`
- `error`

## Usage

```ts
import { createKernel } from '@urk/core';
import { createLoadingAdapter, createPointerAdapter, createUiWidgetsAdapter } from '@urk/adapters';

const kernel = createKernel({
  services: {
    'ui:host': document.querySelector('#overlay-host'),
  },
  adapters: [
    createPointerAdapter(),
    createLoadingAdapter(),
    createUiWidgetsAdapter(),
  ],
});

await kernel.boot();
kernel.pause();
kernel.resume();
await kernel.shutdown();
```

Controllers resolve capability APIs through `ctx.adapters.require(...)` and service dependencies through `ctx.services.require(...)`. The scheduler is kernel-owned, and shutdown is disposal rather than another runtime phase.

## Typed adapter capabilities

Define a token once in the module that owns a capability contract. Add it to the existing registration alongside its legacy ID and capability string:

```ts
import { createKernel, token, type AdapterRegistration } from '@urk/core';

interface CounterApi { increment(): number }
export const Counter = token<CounterApi>('counter');

const counter: AdapterRegistration<CounterApi> = {
  id: 'counter-adapter',
  capability: 'counter',
  token: Counter,
  setup() {
    let value = 0;
    return { increment() { value += 1; return value; } };
  },
};

const kernel = createKernel({ adapters: [counter] });
await kernel.boot();
kernel.getContext().adapters.require(Counter).increment(); // CounterApi, inferred
kernel.getContext().adapters.get(Counter); // CounterApi | undefined
kernel.getContext().adapters.require<CounterApi>('counter'); // existing string lookup
await kernel.shutdown();
```

Token identity is its unique symbol key. Names are display labels: creating another token named `counter` does not find this provider, and the label creates no additional string alias. Import the canonical contract token; do not recreate it in a consumer. Tokens are frozen, contain no API value, and acquire no browser resources.

`dependsOn` accepts tokens and existing strings. Required providers must be published; pending reservations do not satisfy dependencies. Configured startup defaults to stable sequential dependency order, with opt-in parallel batches described below. Valid existing orders stay intact; forward references are reordered. Missing providers, cycles, and alias/controller conflicts fail before acquisition. Dynamic registrations require published dependencies. Token identity is captured and reserved before hooks, publishes after successful uncancelled setup, and releases after failure or disposal. Conflicting providers reject without running hooks.

Annotate providers with `AdapterRegistration<Api>` or use `satisfies AdapterRegistration<Api>` to check their declared contract. The heterogeneous kernel configuration stores APIs as `unknown`; it cannot infer and validate every inline token/setup pair. Tokens infer lookup types rather than validating JavaScript API values at runtime. Existing unchecked generic string lookups remain supported. Typed services and the shared `ctx.get`/`ctx.require` lookup are available in v0.2. A per-kernel token reservation prevents competing adapter/service providers. Ambiguous legacy strings require an explicit registry; existing registry calls stay supported. [Built-in adapters](../adapters/README.md) now export and bind canonical tokens through their independent entrypoints, retaining legacy aliases.

The same canonical token works with separate installed copies of core because lookup uses its symbol key, without constructor checks or a global name registry. Independently created tokens remain distinct even across copies. Package tests cover duplicate copies of the same version; cross-version contract compatibility is not assumed.

## Lifecycle and ownership

Concurrent `boot()` calls share complete adapter/controller startup. Await boot before using pause/resume. Only successfully started controllers with an `update` hook receive frames. Startup failures roll back acquired resources and preserve the initiating error.

`shutdown()` immediately aborts `ctx.signal`, closes registration/activation, and stops scheduling. All callers share the same cleanup completion. Shutdown waits for outstanding tracked hooks, disposes controllers before adapters in reverse registration order, and runs each component's owned scope after its legacy disposer. Disposal is terminal; create a fresh kernel to run again. Fatal update/state-handler errors stop frames and prevent restart; the host must still await shutdown for cleanup.

Adapters and controllers receive a local `ctx.scope`. Register cleanup as soon as an owned resource is acquired:

```ts
const unsubscribe = ctx.events.on('example:changed', listener);
ctx.scope.defer(unsubscribe);
```

Scope cleanup runs once, in reverse order, and continues after errors. Services are borrowed: clearing their registry does not destroy supplied values. Give each acquisition one cleanup owner; do not register equivalent scope cleanup and legacy disposal for the same resource.

Shutdown rejects with `CleanupError` if cleanup fails; its `errors` property and `kernel.getCleanupErrors()` preserve the collected causes. Startup rollback continues to reject with the original startup error, with cleanup failures available separately.

Cancellation is cooperative. Hooks that never settle can keep shutdown pending. A hook can request shutdown but must return without awaiting a lifecycle completion that depends on that same hook. Legacy `setPhase()` remains synchronous, and async state-change handlers for separate changes can overlap.

## Observe operational lifecycle

`kernel.getLifecycleSnapshot()` returns a cached, frozen snapshot containing `state`, `revision`, `updatedAt`, and an optional `reason`. Its states are `created`, `starting`, `running`, `paused`, `failed`, `disposing`, and `disposed`. Repeated reads return the same object until the next operational transition; use identity or revision, rather than timestamps, to detect changes.

```ts
const unsubscribe = kernel.subscribeLifecycle((snapshot) => {
  console.log(snapshot.state, snapshot.revision);
});

console.log(kernel.getLifecycleSnapshot().state); // created
await kernel.boot(); // starting -> running
await kernel.shutdown(); // disposing -> disposed
unsubscribe();
```

Subscriptions receive future transitions synchronously; read the current snapshot separately. Unsubscribe is idempotent. Observer exceptions do not interrupt sibling delivery or kernel work. Reentrant transitions suppress older notifications rather than delivering revisions backwards; a subscriber can therefore skip an intermediate state. Final disposal releases subscribers, and subscribing after disposal is inert.

`starting` lasts through required adapter/controller startup. `disposing` is visible before abort callbacks run and lasts until tracked hooks settle and cleanup attempts finish. `disposed` does not imply every disposer succeeded: await shutdown and inspect `getCleanupErrors()` for that result. Fatal update/state-handler failure stays `failed` until the host invokes shutdown; startup failure rolls back automatically.

Operational lifecycle is independent of application phases. `getState()`, `RuntimeStore`, and phase notification timing retain their existing behavior. Direct phase writes do not pause/resume scheduling or change the lifecycle snapshot. The inspector's legacy `disposed` flag still marks disposal intent; use the lifecycle `disposed` state to observe finished cleanup attempts. No lifecycle timers or frame subscriptions are acquired by reads or subscriptions.

The runtime inspector exposes a bounded read-only view of:

- runtime phase and reason
- scheduler running state
- cumulative frame count
- registered adapters, controllers, and services
- recent events observed while subscribed, containing type/source/timestamp metadata

Service values stay hidden in inspector snapshots. Only service names and safe kind summaries are exposed.

Snapshot reads acquire no subscriptions or timers and return the same frozen value until observed data changes. Use snapshot identity or `revision` for change detection; `updatedAt` is a display timestamp. Registry revision counters keep unchanged structural arrays cached.

The first subscriber activates event/state observation and a 200 ms sampler for frame metrics. The last unsubscribe releases them. Subscribe before boot if you need boot history; event payloads are omitted from diagnostics while ordinary event listeners still receive them. Shutdown detaches observation and captures a final frozen snapshot. No inspector snapshots are published from the kernel frame loop.

## Internal structure

The implementation now mirrors the canonical runtime layers:

- `src/kernel/`
- `src/runtime/`
- `src/events/`
- `src/adapters/`
- `src/controllers/`
- `src/scheduler/`
- `src/resources/`
- `src/capabilities/`

Root `src/*.ts` files stay as stable public re-export surfaces.

## Validation

Run `corepack yarn workspace @urk/core test` to build core, check public token declarations, and run its regression suite, including isolated packed-package checks. These pack/unpack through local npm/tar without downloading dependencies. `ManualFrameScheduler.step(timeMs)` drives deterministic frames without waiting for browser timing. Type-check/build and the private proof routes under `examples/`, including `/runtime-inspector/`, cover additional integration surfaces. See [validation evidence](../../docs/VALIDATION.md) for the commands actually run and any gaps; placeholder scripts do not establish coverage.

## Architecture

See [architecture](../../docs/ARCHITECTURE.md) and [migration notes](../../docs/MIGRATION_V02.md). Core and its public companions are versioned `0.2.0` with compatible `^0.2.0` peers. The implementation is local until publication; see the shared v0.2 workbench and migration guide.

## Ordered commands and parallel setup

```ts
const kernel = createKernel({ adapterStartup: 'parallel', adapters });
await kernel.boot();
const { state } = kernel.getContext();
await state.transition('transition', 'scene:leave');
await state.transition('ready', 'scene:enter');
```

`transition` queues the state commit and awaits asynchronous subscribers and controller handlers before the next command. Shutdown rejects commands immediately and waits for active handlers before releasing resources. Handler rejection closes the queue. Keep legacy synchronous `setPhase` writes out of flows that require serialization; never await a queued command from its own transition handler.

Parallel startup is opt-in. Declare setup dependencies with `dependsOn`; independent adapters start together in dependency batches. Published siblings retain planned order for reverse cleanup regardless of completion timing. Sequential startup remains the default. The shared v0.2 experience uses both APIs.

## v0.2 dependency access and idle scheduling

```ts
const Preferences = token<{ volume: number }>('preferences');
const preferences = { volume: 0.5 };
const kernel = createKernel({
  frameMode: 'auto',
  serviceBindings: [{ token: Preferences, value: preferences }],
});
await kernel.boot();
kernel.getContext().require(Preferences).volume = 0.8;
await kernel.shutdown(); // preferences remains borrowed and usable
```

`registerService(Token, value)` also infers its value type. Services retain named aliases and never acquire an implicit disposer. Token identity is shared across adapter/service reservations within a kernel; display names alone do not resolve another token. Manually constructed `RuntimeContext` values must now provide `get` and `require` too.

`frameMode` accepts `auto` or `continuous` (the compatibility default). Auto starts the automatic controller loop only when a successfully started controller has `update`; dynamic startup wakes it, pause stops it, and resume checks demand again. An event-driven kernel can be operationally running with no frame requests. Explicit calls to the injected scheduler retain their existing contract. No frame timing clamp or fixed-step behavior is added.
