<!--
Company: EonHive Inc. | Title: DOM Motion Adapter
Purpose: Document scoped native animation, playback outcomes, and presentation ownership.
Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
Notes: Vibe coded with Codex.
-->
# Motion

`@urk/adapters/motion` provides optional finite DOM animation through the Web
Animations API and numeric property tweens through URK frame scheduling. Register `createMotionAdapter()` and look up `MotionCapability`.
The factory and module imports acquire no browser resources. Setup observes the
system reduced-motion preference; playback acquires native animation effects.
There are no third-party dependencies, timers, permanent controller updaters, or extra frame loops.

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

UI state/CSS owns the permanent appearance. Motion never commits inline styles.
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
kernel. Presets, sequences, seeking, springs, and DOM interruption blending remain deferred.
