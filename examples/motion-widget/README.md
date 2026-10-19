# Embedded Motion Widgets

Two independently owned DOM widgets share one kernel and motion adapter at `/motion-widget/`. Each has replay, sequence pause/resume, cancel,
and independent unmount/remount. The host can pause/resume or dispose the shared
runtime, then restart with a fresh kernel. Reduced motion follows the system
preference until the checkbox supplies an override.

The finite sequence composes public `fade`, `slide`, and `stagger` presets: three
overlapping entrances followed by a sequential final reveal. One temporary runtime callback advances runnable playback and releases its demand
when all widgets pause, settle, or go offscreen. Playback notifications update host
status without a polling updater. There are no CSS animations, native animation
effects, framework requirements, or extra tickers.

## Per-widget timing

Open **Timing settings** inside either widget to edit entrance duration, stagger,
and final reveal duration. Draft edits leave the current sequence and its pause
state untouched. **Apply & replay** commits the settings and starts a fresh
sequence. **Reset timing** restores the 700 / 140 / 320 ms defaults and replays.
Each field accepts whole milliseconds from 0 through 10,000, including zero for
an instant step. Total time is entrance + two stagger gaps + final reveal; the
default sequence remains 1,300 ms. Opacity finishes earlier than movement, keeping
the original entrance's fade lead. The final reveal starts after the last tile
arrives.

The time readout reports actual elapsed/total timeline time; the draft readout
previews the next configuration. Controls disable while the runtime is paused.
Applying while a sequence is locally paused intentionally replaces that sequence;
offscreen suspension still applies. Reduced motion completes the configured
sequence through the same engine. Settings belong to each widget instance;
unmount/remount or fresh-kernel restart uses the mount configuration again unless
the host's optional settings memory is enabled.

## Per-widget playback speed

Each widget has a **Playback speed** selector with 0.5×, 1×, and 2× presets.
Changes apply immediately to that widget's current and future work, preserving
its position, completion promise, and user/runtime/visibility pauses. The selector
stays available while the runtime is paused; changing speed cannot resume it.
Timing settings and elapsed/total readouts remain in authored milliseconds.

Mount with `playbackRate: 0.5`, or call `widget.setPlaybackRate(2)` after mounting.
The API accepts any finite positive rate; custom values appear in the selector
as a Custom option. Invalid rates throw before changing the current rate. Use
pause to freeze rather than setting a zero rate. `getSnapshot().playbackRate`
reports the scope's actual rate. Calls after teardown are inert.

Replay, Apply & replay, and Reset timing retain the selected speed. Remount and
fresh-kernel restart use the mount rate again (1× by default), or the saved rate
when settings memory is enabled. Reduced motion
still completes immediately at every rate. This reuses `ScopedMotion` rate
control; Core, the scheduler, and animation definitions are unchanged.

## Optional settings memory

Each host offers **Remember settings on this device**, off by default. Enabling
it saves that widget's committed timing and playback speed in local storage.
Saved settings survive widget remount, fresh-kernel restart, and page reload.
Signal and Studio use separate keys; the website/docs widget has its own key.
Storage belongs to each origin, so the standalone and website ports do not share
saved values. No network request, playback position, pause state, reduced-motion
override, draft edit, or DOM reference is stored.

Turning the checkbox off removes that record and stops saving. Current settings,
pose, and pause state stay unchanged; the next mount uses its defaults. **Reset
timing** still resets only timing and saves those defaults when memory is on.
Malformed, incomplete, unsupported-version, or invalid records restore nothing.
Unavailable storage disables saving, while failed writes/removals show a local
status message and leave playback usable. A failed removal explicitly warns that
old saved settings may return after reload. Cross-tab synchronization is not included.

The widget's optional `onSettingsChange(settings)` callback receives an immutable
copy after a successful timing/speed change. It has no initial notification and
ignores unchanged values and drafts. Synchronous observer errors do not interrupt
committed settings. The widget itself knows no storage keys or consent policy.
The example host opts into `mountWidgetPreferences` and wires it during start:

```ts
const preferences = mountWidgetPreferences(host, ctx.scope, 'my-app:signal');
widget = await mountMotionWidget(host, ctx, {
  title: 'Signal',
  ...preferences.restore(),
  onSettingsChange: preferences.changed,
});
preferences.changed(widget.getSnapshot());
```

Import both helpers from the copied widget entrypoint (or the private repository
subpath). The host scope removes the preference control/listener on disposal;
the saved record remains until the user turns memory off. No frame callback
persists data, and saved options never revive a disposed kernel or motion handle.

## Portable JSON presets

Open **Share settings** in either widget. **Export JSON** fills and selects the
editable text area with committed timing and playback speed. Copy it into another
widget or host, then choose **Import JSON**. This works without clipboard access,
downloads, or saved-settings consent. The website/docs widget has the same controls.

```json
{
  "version": 1,
  "timing": { "entranceMs": 700, "staggerMs": 140, "revealMs": 320 },
  "playbackRate": 1
}
```

Import validates the entire record before committing both settings and notifying
the host once. Invalid JSON, incomplete/unsupported records, invalid timing, and
non-positive or non-finite rates leave settings, live motion, and saved settings
unchanged. Input is limited to 4,096 characters. Errors appear beside the editor
with an accessible invalid state. Successful import/export clears that state.

Import preserves the playhead, runtime pause, user pause, and visibility suspension.
Speed applies immediately; imported timing is staged for the next replay, so a
live timeline retains its authored duration. Import does not start playback.
Exports omit drafts, playhead, pause state, DOM references, host storage keys, and
saving consent. Import saves settings only when the host's memory checkbox is
already enabled. Reset timing retains its existing behavior.

`widget.exportPreset()` returns the same JSON; `widget.importPreset(json)` applies
it with the same validation and playback semantics. Import after teardown is inert.
The private example entrypoint also exports `parseWidgetPreset(json)` and
`serializeWidgetPreset(settings)` for hosts that provide their own controls.
Both reuse the existing settings validator, keeping the motion adapter unchanged.

## Timeline scrubbing

Each widget has a **Scrub sequence** range control. Drag it or use arrow keys and
Home/End to preview the sequence. Seeking pauses only that sequence and redraws
the complete pose, including resetting later clips when moving backward. The
time readout and accessible value describe actual authored milliseconds, independent
of playback speed. **Resume sequence** continues from the selected position.

`widget.seek(650)` provides the same behavior with an absolute millisecond value.
Finite times clamp to the sequence bounds; non-finite values reject before changing
playback. A live timeline retains its handle, promise, and authored timing. After
completion or cancellation, seeking creates a fresh paused preview using the latest
configured timing. It never revives the terminal handle. Endpoint previews remain
paused until resumed, cancelled, replaced, or disposed, so they stay seekable.

Explicit seeking can redraw while the kernel is paused without restarting its
clock. Kernel resume leaves the sequence's user pause intact; offscreen suspension
also remains independent. Scrubbing disables for reduced motion and zero-duration
sequences. Effective system preferences and host overrides update this control
immediately through the motion adapter's preference observer. Seeking after teardown
is inert, and scope cleanup settles owned previews and removes their input listener.

## Offscreen suspension

Widgets automatically pause their motion group when their root leaves the
viewport, then continue from the retained position when it intersects again.
`IntersectionObserver` supplies measurements, including an initial measurement
before playback can advance. An offscreen replay waits at its starting pose;
the host's **Replay both widgets** control makes this visible on narrow layouts.
The badge shows `offscreen` for automatically held work.

Visibility pauses the scoped motion group; a user pause belongs to the individual
timeline, and runtime pause remains kernel-owned. Returning to the viewport
releases only the visibility pause. It cannot clear an explicit user pause or
resume a paused runtime. Replay intentionally starts a fresh, unpaused sequence,
which still waits if offscreen. Reduced motion finishes held work immediately.

Pass `suspendWhenOffscreen: false` in the mount options to opt out. Without
`IntersectionObserver`, widgets continue normal playback. This policy measures
viewport intersection; it does not detect covering elements or CSS opacity.
When every widget is offscreen, motion releases its frame demand; unrelated
application updater controllers retain theirs.

## Embed the widget

For a complete small host, use `examples/motion-starter/README.md`. Its exporter
copies these shared files into an independent project with packed local runtimes,
working lifecycle controls, and a relative-base static build.

The shared implementation is `packages/examples/src/motion-widget/`:
`index.ts`, `timing.ts`, `styles.ts`, `preferences.ts`, and `presets.ts`. Both this standalone proof and the
website's Embedded Docs Demo use it. `examples/motion-widget/widget.ts` only
re-exports the private `@urk/examples/motion-widget` entrypoint. Copy the shared
files into an application; this is an internal example, not a stable npm API or
new adapter. Its runtime dependencies are only `@urk/core` and
`@urk/adapters/motion`. Styles travel with the compiled JavaScript and belong to
the widget root, so hosts need no CSS asset copying or global style registration.
Register one motion adapter/controller in your application, then call the helper
from a controller's start hook:

```ts
import { createKernel } from '@urk/core';
import { createMotionAdapter } from '@urk/adapters/motion';
import { mountMotionWidget, type MotionWidget } from './motion-widget/index.js';

let widget: MotionWidget | undefined;
const kernel = createKernel({
  frameMode: 'auto',
  adapters: [createMotionAdapter()],
  controllers: [
    {
      id: 'embedded-signal',
      async start(ctx) {
        widget = await mountMotionWidget(host, ctx, {
          title: 'Signal',
          tone: 'cyan',
          playbackRate: 1,
          timing: { entranceMs: 700, staggerMs: 140, revealMs: 320 },
        });
      },
    },
  ],
});
await kernel.boot();
await kernel.getContext().state.transition('ready');
const outcome = await widget!.replay(); // completed, cancelled, or failed
```

Mount's optional `timing` field accepts a partial configuration. After mounting,
`widget.setTiming({ staggerMs: 80 })` validates and stages a partial update for the
next replay. It does not cancel, seek, resume, or otherwise change current playback,
even while paused. Invalid, fractional, non-finite, out-of-range, or unknown timing
fields reject before changing settings. Configuration and frozen snapshot values
are copied, so instances and caller objects do not share mutable timing state.
`getSnapshot()` includes configured `timing` plus the current timeline's
`currentTimeMs` and `durationMs`; staged settings can differ from a running
timeline's timing until replay. Disposed setters are inert.

Supply your own `host: HTMLElement`. Mount does not launch playback during kernel
startup; replay after boot. Call `pause()`, `resume()`, or `cancel()` for just this
widget; `getSnapshot()` returns its status, normalized progress, `offscreen`, and
`userPaused` flags. Its status remains the underlying motion status; visibility
and user intent are separate fields. `replay()` replaces earlier playback, settles
the previous promise, and guards against stale results. Cancellation retains the
rendered pose. Pausing the kernel suspends all widgets while preserving any
explicit sequence pauses.

`await widget.teardown()` cancels pending work, aborts its control listeners,
disconnects its visibility observer, unsubscribes lifecycle observation, restores
binding styles, and removes only the widget root. Parent scope disposal performs
the same cleanup automatically.
The host and its original children remain borrowed. Teardown is idempotent;
disposed methods cannot start new work. Mount again for a fresh instance. Widgets
use root-local queries and scoped CSS class names, with no global IDs or singleton
state. They do not create or dispose a kernel or change experience phases.

## Run and validate

From the repository root with Node 22:

```bash
corepack yarn install
corepack yarn build:runtime
corepack yarn workspace urk-examples dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/motion-widget/`.

For the website host, run `corepack yarn workspace @urk/www dev --host 127.0.0.1`
and open `http://127.0.0.1:4321/examples/embedded-docs-demo/` or
`http://127.0.0.1:4321/docs/guides/astro-docs-embed/`. The existing host owns the
kernel, lazy mounting, pause/resume, shutdown, local error boundary, and fresh
restart. Shutdown removes the scoped widget while static docs remain visible.
The standalone and website mounts share one implementation, not separate engines.

```bash
corepack yarn workspace urk-examples lint
node --test examples/tests/widget-timing.test.mjs
node --test examples/tests/widget-preferences.test.mjs
node --test examples/tests/widget-presets.test.mjs
corepack yarn workspace urk-examples test:browser --config playwright.motion.config.ts motion-widget.spec.ts
corepack yarn workspace urk-examples test:browser --config playwright.widget-host.config.ts
```

The focused Chromium checks cover independent playback, real viewport scrolling,
separate visibility/user/runtime pauses, unmount/remount, retained host content,
reduced motion, fresh-kernel restart, and timing configuration including zero
duration. The targeted speed proof checks independent pacing, paused speed
changes, replay retention, reduced motion, remount defaults, and narrow layout.
The targeted scrubbing proof checks keyboard/pointer preview, terminal timelines,
runtime pause, retained speed, reduced-motion availability, and cleanup.
Small Node tests check timing isolation and validation.
The stylesheet uses scoped selectors rather than Shadow DOM isolation; a host's
global CSS can still affect it. Native buttons, focus indicators, labelled regions,
and progress elements provide keyboard and assistive semantics.


`MotionWidgetOptions.onChange` optionally observes rendered playback/visibility
changes so a host can update its diagnostics without its own permanent updater.
Observer errors are isolated. The callback acquires no frame work. Embedded Docs
similarly releases its own loading callback once that finite sequence completes.
