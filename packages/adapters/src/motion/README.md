<!--
Company: EonHive Inc. | Title: DOM Motion Adapter
Purpose: Document scoped native animation, playback outcomes, and presentation ownership.
Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-18
Notes: Vibe coded with Codex.
-->
# Motion

`@urk/adapters/motion` provides optional finite DOM animation through the Web
Animations API and numeric property tweens through URK frame scheduling. Register `createMotionAdapter()` and look up `MotionCapability`.
The factory and module imports acquire no browser resources. Setup observes the
system reduced-motion preference; playback acquires native animation effects.
All numeric forms share temporary frame work on the existing runtime scheduler.
There are no third-party dependencies, timers, or extra frame loops.
`createMotionController()` remains compatible but is optional and has no updater.

```ts
import { createKernel } from '@urk/core';
import { createMotionAdapter, MotionCapability } from '@urk/adapters/motion';

const kernel = createKernel({
  frameMode: 'auto',
  adapters: [createMotionAdapter()],
  controllers: [{
    id: 'panel',
    start(ctx) {
      const panel = document.querySelector<HTMLElement>('#panel')!;
      const motion = ctx.require(MotionCapability).scoped(ctx.scope);
      panel.hidden = false; // CSS defines the stable visible appearance.
      const playback = motion.animate(panel, [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' },
      ], { durationMs: 220, easing: 'ease-out' });
      void playback.finished.then(result => {
        if (result.status === 'failed') console.error(result.error);
      });
    },
  }],
});
await kernel.boot();
```

## API and outcomes

`motion.scoped(scope)` returns a group with `animate`, `tween`, `pause`, `resume`,
`cancel(target?)`, and a read-only `activeCount`. Repeated lookup with the same
scope returns the same group, with one cleanup registration for its lifetime.
Settled operations leave its active collection immediately. Scope disposal cancels
remaining work and rejects new animation requests. Kernel shutdown also cancels
all groups immediately through its abort signal. Elements are always borrowed.

`animate(element, keyframes, options)` returns a terminal playback handle:

- `pause()` / `resume()` control that operation. Group resume preserves individual pause.
- `finish()` releases the transient effect immediately and settles as `completed`.
- `cancel(reason?)` releases the effect immediately and settles as `cancelled`.
- `finished` resolves to `{ status: 'completed' }`, `{ status: 'cancelled', reason? }`,
  or `{ status: 'failed', error }`. It does not reject. Check the result before
  continuing a presentation or hiding/removing a panel.

Calling controls after settlement does nothing. Create a new operation to replay.
The native completion promise is always observed, including native `AbortError`
cancellation. Other native failures settle as `failed`.

Use at least two keyframes containing `opacity` (a finite number from 0 to 1),
`transform` (a CSS transform string), and optional nondecreasing `offset` values
from 0 to 1. Unsupported keyframe fields, invalid numeric values, timing, and
easing throw synchronously before existing playback is interrupted. Transform
syntax follows the browser's native keyframe handling.

Options are `durationMs`, optional `delayMs`, `easing` (`linear`, `ease-in`,
`ease-out`, `ease-in-out`), and an optional action `signal`. Durations and delays
must be finite and nonnegative. An already aborted action returns a cancelled
handle without replacing current playback. Later abort cancels only that operation.

## Styling and interruption

UI state/CSS owns the permanent appearance. Native `animate` playback never commits inline styles.
Completion, `finish`, and cancellation remove the native effect and reveal those
underlying styles. Set the stable destination before an entrance; after a successful
exit, hide the panel in the controller. Use an element or wrapper whose transform
you own.

One animation per element is allowed within an adapter, including across scopes.
A newer animation cancels the whole previous operation with reason `replaced`.
The supplied keyframes define its starting appearance: this release does not
sample the interrupted position, blend transforms, or replace individual properties.
Animations created outside this adapter are not controlled or cancelled.

Reduced motion finishes existing effects, including paused ones, and skips new
ones. Zero duration and missing Web Animations support also complete immediately.
These paths reveal the same UI-owned final state; they do not apply the final
keyframe as a persistent style. Application navigation must work in all paths.

## Experience policy

Operational pause automatically suspends both DOM playback and numeric progress.
Work requested during startup or pause waits for the runtime to run; finish,
zero-duration, and reduced-motion completion still apply immediately. Runtime
resume preserves individual and group pauses. Controllers retain explicit
visibility and experience-phase policy; changing a legacy phase alone does not
pause motion. Failure cancels pending motion; shutdown and owner disposal do too.

Interactive Media demonstrates this policy in `packages/examples/src/interactive-media/stage.ts`.
Run `node scripts/build.mjs @urk/examples`, then
`corepack yarn workspace urk-examples dev --host 127.0.0.1` and open
`http://127.0.0.1:5173/interactive-media/`. Chapter changes animate the overlay;
ending/replay interrupts panel handoffs; Pause experience, Resume experience,
Dispose, and Start fresh exercise ownership. The website uses the same controller
at `/examples/interactive-media/`.

## Numeric tweens

```ts
const motion = ctx.require(MotionCapability).scoped(ctx.scope);
const playback = motion.tween(mesh.position, { x: 2 }, {
  durationMs: 450,
  easing: 'ease-out',
  onUpdate: () => scene.render(),
});
```

Targets are borrowed objects with finite, own, writable numeric data properties.
Only the named properties change. Getters, setters, nested paths, colors, strings,
and nonfinite values are unsupported. A replacement starts from the current
values and cancels the whole prior operation if any named property overlaps,
including across groups. Disjoint properties can run independently. Cancellation
keeps the last written values; finish writes the exact destination. `onUpdate` is
synchronous, including immediate completion, so event-driven views redraw even
without a frame. Write/redraw errors settle the handle as failed.

One temporary frame callback serves all runnable tweens in the adapter, before
controller updates. The first runnable frame establishes the time baseline;
subsequent raw timestamps advance delay and duration. Paused intervals are excluded.
The four easings match the CSS timing curves used for DOM animation. All paused or
settled tweens release their frame demand; other controller demand is unaffected.
No new requestAnimationFrame loop is introduced.

Run `/motion-playground/` in the existing examples dev server to exercise numeric
replacement, pause, finish, cancellation, reduced motion, owner disposal, and a fresh
kernel. See runtime-driven timelines below for sequences and overlap. Numeric presets and finite seeking are documented below; springs and DOM interruption blending remain deferred.

## Runtime-driven value tweens and timelines

Callback tweens, finite timelines, and numeric property tweens share one temporary
callback on URK's existing scheduler. The adapter requests frames only while work
can advance. Completing, cancelling, pausing, reducing, or disposing the last
runnable operation releases its demand. Delayed playback remains runnable until
its delay expires. Other controllers keep their own frame demand.

Each operation's first runnable frame establishes its time baseline. Pause/resume
and retarget/seek reset that baseline, excluding time before the next sample even
when unrelated controllers keep frames running. Values update before controller
rendering, and callback-created work is admitted on a later frame.

`createMotionController()` remains an optional compatibility registration: it
checks for the motion capability at startup and has no permanent updater. Registering
it does not cause a second advance. Existing custom update loops that call
`motion.advance(frame.deltaMs)` should remove that call; ordinary playback is now
automatic. `advance(deltaMs)` remains an explicit additional synchronous step for
controlled/manual use, with the same validation and callback failure behavior.

```ts
import { createKernel } from '@urk/core';
import {
  createMotionAdapter, MotionCapability,
} from '@urk/adapters/motion';

const kernel = createKernel({
  frameMode: 'auto',
  adapters: [createMotionAdapter()],
  controllers: [{
    id: 'experience',
    start(ctx) {
      const motion = ctx.require(MotionCapability).scoped(ctx.scope);
      const handle = motion.tween({
        from: 0, to: 100, durationMs: 600, easing: 'ease-out',
        onUpdate(value, progress) {
          // Bind to DOM, canvas, scene data, or another numeric application value.
          console.log(value, progress);
        },
        onComplete() { console.log('Destination reached'); },
      });
      void handle.finished.then(result => console.log(result.status));
    },
  }],
});
await kernel.boot();
```

`ValueTweenOptions` describes this callback form; the existing `TweenOptions`
continues to describe the compatible property-target form. The callback form is
available on both the adapter and a scoped group. Direct adapter work belongs to
the adapter scope; prefer `scoped(ctx.scope)` for controller-owned bindings.
`MotionHandle` adds `status` and uneased `progress` to the existing playback controls.

A new value tween is `pending` until its delay has elapsed on a runtime frame.
It becomes `running` when its first value is delivered. `pause()` or group/runtime
suspension reports `paused`; resume restores pending/running status at the retained
position. A zero-duration tween respects its delay and delivers the destination
once on the first eligible update. Overshoot also delivers the exact destination
once. `finish()` and reduced motion skip delays and complete synchronously.
Completion callbacks run after the final value; terminal status becomes `completed`
after those callbacks succeed. Cancellation retains progress, reports `cancelled`,
and settles `finished` without another write or a completion callback. Terminal
controls are idempotent. Four CSS-compatible cubic easings are available, plus a
custom finite easing function on callback tweens. Raw progress always stays in [0, 1].

```ts
const sequence = motion.timeline({
  delayMs: 100,
  tweens: [
    { atMs: 0, from: 0, to: 1, durationMs: 400, onUpdate: fadeOut },
    { atMs: 200, from: 0, to: 1, durationMs: 500, onUpdate: reveal },
    { atMs: 700, from: 0, to: 1, durationMs: 300, onUpdate: settle },
  ],
  onUpdate(progress) { console.log(progress); },
  onComplete() { console.log('All scheduled work completed'); },
});
sequence.pause();
sequence.resume();
// sequence.cancel('navigation-changed');
```

`TimelineOptions.tweens` uses absolute `atMs` offsets (default zero), with each
entry's `delayMs` added to its offset. Equal offsets run in parallel; adjacent
ranges make a sequence; intersecting ranges overlap. Timeline delay shifts all
children. Progress includes offsets and delays and reaches one at the last child
end. An empty timeline completes on its first update after its delay. The timeline
owns its children; its handle and optional abort signal control the entire group.
Children share the same clock and the existing tween interpolation implementation.
Large deltas visit start/end boundaries in order; coincident entries follow their
start order, with authored order breaking ties. Conflicting callback writes are
application-owned and are not blended. Pause preserves the timeline position;
cancel settles all children and suppresses later callbacks. `activeCount` counts
unfinished tween children, including delayed/paused ones, plus other active motion.

Requests validate before admission. Numeric endpoints, durations, delays, offsets,
and total timeline duration must be finite; time fields must be nonnegative.
Invalid requests throw without disturbing active work. Exceptions in callback
bindings, custom easing, or completion callbacks settle affected handles as
`failed` and propagate from controller updates into URK's existing fatal-update
policy. Remaining motion is cancelled by lifecycle cleanup. Explicit `finish()`
and synchronous reduced-motion callbacks can throw to their caller after settlement.
The compatible property-target and native DOM APIs retain their existing failed
result handling. Work added during a callback first advances on the next update;
work cancelled during a callback receives no later writes.

`motion.setReducedMotion(true | false | undefined)` overrides the system preference
or restores it with `undefined`. Enabling reduction finishes active work, including
paused work, and completes new work synchronously. Callback bindings own persistent
values/styles; this differs from native `animate`, which releases transient effects.

`motion.reducedMotion` reads the effective mode, including an explicit override.
`motion.subscribeReducedMotion(listener)` observes changes to that effective mode
without registering frame work. Read the getter for the initial value; registration
does not call the listener. Store its idempotent release in your owning scope:

```ts
const syncControls = () => { scrubber.disabled = motion.reducedMotion; };
syncControls();
ctx.scope.defer(motion.subscribeReducedMotion(syncControls));
```

Unchanged effective values do not notify. Observer exceptions are isolated like
lifecycle observers; they cannot interrupt motion completion or other observers.
Reentrant mode changes suppress stale delivery, and disposal clears subscribers
and detaches the system listener. New subscriptions after disposal are inert.
Animation update/completion callbacks retain their existing error behavior.

Run `/motion-lab/` for three DOM views with outgoing/incoming timelines, sequential
and overlapping content, runtime pause/resume, cancellation, and fresh-kernel restart.
Its reusable application helper is `examples/motion-lab/navigation.ts`: latest
request wins, a generation guard prevents stale commits, and explicit cancellation
restores the last committed view. It uses ordered `transition` / `ready` commands
outside state-change handlers and reconciles commands made during runtime pause.
Navigation policy remains application-owned. No scene manager is added.

The second application is `/scrollytelling/` (Story Flow). Callback tweens drive
guided scrolling. In its default scroll mode, native position seeks a paused finite
timeline with measured, overlapping chapter-card tracks; moving backward restores
the earlier pose, including after an endpoint preview. A selectable timed mode
retains finite chapter entrances and replay. Native wheel/touch scrolling cancels
guided travel at the retained position; manual chapter selection remains application
state. Its local `scroll-motion.ts` and `scroll-timeline.ts` helpers own navigation
and scroll sampling without extending the public motion API or adding a scheduler.
The application cancels/rebuilds the preview for resize, reduced motion, and source
replacement, and its scope settles paused endpoint work at shutdown.

## Finite timeline seeking

`timeline(...)` returns a `TimelineHandle`, which extends `MotionHandle` with
`durationMs`, `currentTimeMs`, and `seek(timeMs)`. Positions include timeline delay,
entry offsets, and entry delays. Finite positions clamp to `[0, durationMs]`;
nonfinite positions throw `RangeError` before changing the timeline.

```ts
const sequence = motion.timeline({ tweens: [
  { from: 0, to: 100, durationMs: 500, onUpdate: setPosition },
  { atMs: 250, from: 0, to: 1, durationMs: 500, onUpdate: setOpacity },
] });
sequence.pause();
sequence.seek(sequence.durationMs / 2); // Synchronous preview; stays paused.
console.log(sequence.currentTimeMs, sequence.progress);
sequence.resume(); // Continue from the preview using the next controller delta.
```

Seeking renders all scheduled bindings at the selected position, including `from`
values for future children and exact destinations for children whose ends were
passed. This makes backward scrubbing restore the whole pose. Future children
reset in reverse start order; started children then render in start order, with
original array order breaking ties. Later started clips therefore take precedence
when callbacks write the same property. There is no property blending. Use
repeatable renderer bindings in `onUpdate`, since seeking may call them many times
and in either direction. The existing easing and numeric interpolation are shared
with tween playback.

A seek preserves individual/group/runtime pause and never resumes the clock.
Explicit seeking can render while the runtime is paused, like explicit `finish`.
Running timelines continue from the selected position on their next update.
Seeking from an update callback invalidates the remainder of that old frame;
cancellation during a seek suppresses remaining bindings immediately.

`seek` calls binding and timeline `onUpdate` callbacks, but never `onComplete` and
never settles `finished`, even at the endpoint. Normal playback subsequently
commits any unreported child completions at or behind the playhead, then completes
the parent at its end. Each child and parent completion callback runs at most once
per handle, including after backward seeks. `finish()` and reduced motion commit
remaining completion callbacks synchronously. A paused endpoint preview remains
owned work until playback, finish, cancellation, or cleanup settles it. Active
counts include children still needing rendering or a completion commit.

Completed, cancelled, and failed handles remain terminal: a finite seek has no
effect and cannot revive their resources or promises. Construct a fresh timeline
to scrub again after completion. Empty/zero-duration timelines can be previewed at
zero; normal advancement or explicit finish commits completion. Seek callback
errors settle the handle as failed before throwing to the caller; a seek performed
inside an update follows the existing fatal controller-update policy.

Motion Lab's range control demonstrates keyboard/pointer scrubbing. Input pauses
the content sequence, renders the selected time, and leaves the kernel running.
Resume sequence continues that timeline independently of runtime pause/resume.
After completion, the first scrub creates a new paused timeline. Navigation and
shutdown cancel it through the existing owner scope. Scrubbing is disabled during
view transitions, disposal, and reduced motion. Fully transparent card/node
bindings are inert until visible again.

This phase adds no nested timelines, negative-rate playback, infinite repeats, spring solver,
visual editor, new scheduler, or Core API.

## Scoped playback speed

Groups expose `playbackRate` (default `1`) and `setPlaybackRate(rate)`:

```ts
const group = motion.scoped(ctx.scope);
group.setPlaybackRate(0.5); // Half speed, including delays.
group.setPlaybackRate(2);   // Double speed from the retained position.
```

The finite positive rate affects current and future callback tweens, timelines,
property tweens, and native DOM playback in that group. Changes apply to subsequent
clock updates without resetting progress or resuming paused work. Timeline children
share one scaled parent delta; seek positions and durations stay in absolute
animation milliseconds. Explicit finish, reduced motion, cancellation, and cleanup
retain their existing behavior. Use pause to freeze; zero, negative, and nonfinite
rates reject before mutation. Negative-rate playback remains unsupported.

Property tweens retain their timestamp baseline. Native effects use
`Animation.updatePlaybackRate`; no additional scheduler is created. Motion Lab's
speed selector controls its content, feedback, and transitions through one group
and retains the selected rate when constructing a fresh kernel.

## Numeric presets and stagger

`fade`, `slide`, and `scale` return ordinary `TimelineEntry` definitions.
They acquire no resources and invoke no callbacks until playback or seeking.
Rendering stays in the supplied callback; the presets import no DOM or Three.js.

```ts
import { fade, slide, scale, stagger } from '@urk/adapters/motion';

const entrance = motion.timeline({
  tweens: [
    ...stagger(cards.map(card => fade({
      durationMs: 500,
      onUpdate: value => { card.style.opacity = String(value); },
    })), 100),
    slide({ from: 40, onUpdate: value => {
      title.style.transform = `translateY(${value}px)`;
    } }),
    scale({ atMs: 200, onUpdate: value => {
      badge.style.transform = `scale(${value})`;
    } }),
  ],
});
```

Defaults use `ease-out`: fade is 0→1 over 300ms, slide is 24→0 over 400ms,
and scale is 0.9→1 over 350ms. `MotionPresetOptions` accepts overrides for
endpoints, duration, easing, delay, offset, and callbacks. Fade endpoints must
stay within [0,1]; scale endpoints must be nonnegative. Slide units are chosen
by the caller. Invalid timing, offsets, and nonfinite endpoints fail at definition.

`stagger(entries, gapMs = 100)` returns fresh entries with `index * gapMs` added
to each existing `atMs`. It preserves durations, delays, callbacks, and inputs.
A zero gap permits parallel starts; durations longer than the gap overlap.
The timeline supplies pause, speed, seeking, reduction, and cancellation.
Each callback owns its writes; multiple transform bindings require
application-owned composition.

## Finite repeat and yoyo

```ts
const pulse = motion.timeline({
  iterations: 2, // Total passes, including the first. Default: 1; maximum: 100.
  yoyo: true,   // Mirror every other pass. Default: false.
  tweens: [scale({ from: 1, to: 1.1, onUpdate: setScale })],
});
```

Repetition expands scheduled entries onto the same timeline clock. Each pass
preserves authored offsets and child delays; the timeline's own `delayMs` applies
once before the first pass. Yoyo mirrors clip offsets, endpoints, easing, and
the child's reported progress. Leading delay becomes trailing delay on a mirrored
pass. Use independent property bindings or intentionally compose their writes.

`durationMs`, `currentTimeMs`, `progress`, and `seek` cover the complete finite run.
`finish()` and reduced motion render its final pose: an even number of yoyo passes
ends at the initial pose, while an odd number ends at the destination. Each authored
child `onComplete` runs at most once per handle, at its first committed completion;
the parent completes once after all passes. Seek still fires no completion effects.
Active counts include scheduled work from future passes. Speed, pause, abort,
cancellation, and cleanup use the existing owner and executor.

Iterations must be integers from 1 through 100, with a finite total duration;
`yoyo` must be a boolean. Infinite loops, per-pass events, repeat gaps, nesting,
and negative-rate playback are not included. Motion Lab offers Once, Twice, and
Out and back; reduced motion uses one forward pass so its content stays visible.

## Optional DOM property binding

`createDomMotionBinding(element, scope, initial?)` composes opacity and a single
transform from numeric `x`, `y`, `scale`, and `rotate` properties. Coordinates use
pixels, rotation uses degrees, scale is uniform, and opacity stays within [0,1].
Defaults are opacity/scale 1 and translation/rotation 0. Creation renders these
explicit values; it does not read or decompose computed styles.

```ts
import { createDomMotionBinding, fade, slide, scale } from '@urk/adapters/motion';

const group = motion.scoped(ctx.scope);
const card = createDomMotionBinding(element, ctx.scope, { opacity: 0, y: 24, scale: 0.9 });
group.timeline({ tweens: [
  fade({ onUpdate: card.property('opacity') }),
  slide({ onUpdate: card.property('y') }),
  scale({ onUpdate: card.property('scale') }),
] });
```

`property(name)` returns a numeric callback for presets/tweens. `set(patch)` updates
several properties together, preserving all other values and composing
`translate(x,y) rotate(angle) scale(value)` in that order. `getSnapshot()` returns
an immutable copy. Unsupported keys, nonfinite numbers, invalid opacity, and
negative scale fail before changing the pose.

Use one binding per element and the same scope for binding and playback. The
binding exclusively controls inline opacity/transform while active; use a wrapper
if another owner needs to transform the same content. On scope cleanup or explicit
`dispose()`, the binding restores the original inline values and priorities and
ignores later callback writes. Other styles, classes, listeners, focus, and inert
state remain application-owned. Explicit binding disposal does not cancel unrelated
timeline work; scope disposal settles playback through its existing motion group.

The helper imports no browser globals during module evaluation, owns no element,
and creates no animation or ticker. Numeric interpolation/presets remain
renderer-independent. Motion Lab uses one cached binding per card/shape, rather
than registering new cleanup on every replay.

## Live value-tween retargeting

Callback `tween(options)` returns a `ValueTweenHandle` with a numeric `value`
and `retarget(to, { durationMs?, easing? }?)`:

```ts
const follow = motion.tween({
  from: 0, to: 100, durationMs: 300,
  onUpdate: card.property('x'),
});
follow.retarget(240); // New segment starts at follow.value without a position jump.
```

A successful retarget returns `true`, retains the handle/`finished` promise and
completion callback, and resets segment progress to zero. The new segment starts
from the current sampled value (the configured `from` before the first update).
Duration/easing default to the previous segment's settings; the original delay is
not repeated. Retargeting writes no value immediately and preserves individual,
group, and runtime pause plus scoped speed. Zero duration completes on the next
eligible clock update; explicit finish remains immediate.

Completed, cancelled, and failed handles return `false` and remain terminal.
Invalid endpoints/timing/easing throw before mutation, including on terminal
handles. Retargeting from an intermediate update callback is supported; the final
update is already a committed completion and cannot revive that handle. Abort,
reduced motion, and cleanup still settle the same promise. This preserves position
continuity without preserving velocity or adding spring physics.

Property-object tweens, native DOM playback, and timeline handles retain their
existing interfaces. Motion Lab uses live retargeting for card feedback and
constructs a fresh tween only after the old handle has settled.

## Cancelling one application action

Give all handles belonging to an action the same standard `AbortSignal`. Other
work in the motion scope remains independent:

```ts
const action = new AbortController();
const signal = action.signal;
const handles = [
  group.tween({ from: 0, to: 100, durationMs: 600, signal, onUpdate: setPosition }),
  group.timeline({ signal, tweens: [scale({ onUpdate: setScale })] }),
  group.tween({ from: 0, to: 1, durationMs: 600, signal, onUpdate: setProgress }),
];

action.abort(); // Call when the user cancels or replaces this action.
const results = await Promise.all(handles.map(handle => handle.finished));
```

Cancellation settles each handle with a `cancelled` result, including while the
runtime is paused, and suppresses further updates. An already-aborted signal
creates cancelled handles without rendering. Signals are terminal: construct a
fresh controller for the next run. Kernel/scope cleanup also cancels owned work;
there is no need to dispose the scope merely to cancel one action.

Applications own action status and replacement policy. Guard aggregate completion
with a request generation so cancelled/replaced results cannot overwrite the newest
status; abort partially created work if setup throws. Motion Lab demonstrates
this in its **One action, three handles** panel. Cancellation retains the orb's
pose/progress; the next Run resets it. View navigation and other motion remain
independent. This pattern uses existing signals and handles, without a batch
executor, cancellation registry, or new public API.
