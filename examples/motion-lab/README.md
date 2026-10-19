# URK Motion Lab

Playback speed offers 0.5×, 1×, and 2× for this demo's scoped motion. Changing speed
preserves the current pose, pause state, and absolute scrub positions. The selected
speed is retained when restarting with a fresh kernel.

Explore composes public `fade` and `slide` presets with `stagger`; Connect uses
`scale` and `stagger`. These return plain numeric timeline entries, so the same
scrub, speed, reduced-motion, and ownership controls apply. The example callbacks
bind values to the DOM and keep invisible interactive objects inert.

Open **Preset playground** below the timeline to adjust Explore's entrance distance
(0–80 px), duration (100–2,000 ms), and stagger (0–400 ms). Native sliders support
arrow keys and Home/End. Their readouts and draft per-pass duration update while
editing; **Apply & replay** commits all three settings to a fresh content timeline.
The running sequence and timeline diagram retain the applied settings until then.
Zero distance produces a fade-only entrance with no rotation. **Reset presets**
restores the original 38 px / 860 ms / 160 ms settings and replays.

The playground edits only Explore and is disabled while paused, navigating, or
disposed. Applied settings survive view changes and fresh-kernel restart within
this page session; a page reload resets them. Replay, scrubbing, repeat/yoyo,
and speed use the applied settings. Reduced motion still finishes one forward
pass immediately, keeping all cards visible and usable. Create and Connect keep
their own authored choreography. This is a small preset demonstration, not a
general timeline editor.

Explore cards and Create shapes use `createDomMotionBinding` to compose independent
opacity/position/scale/rotation updates. Bindings are cached for the controller's
lifetime and restore their previous inline styles on shutdown. The application
still owns inert state and focus; the binding adds no playback clock.

Card hover/focus/selection feedback retargets an active callback tween from its
current value. Rapid changes preserve its handle and completion promise; completed
feedback starts a fresh tween. Pause holds the rendered pose while remembering
the latest requested goal for resume.

**One action, three handles** demonstrates shared cancellation. Position and
progress tweens plus a two-step scale timeline use the same `AbortSignal`.
Cancel action freezes only that bundle, including while the runtime is paused.
Other view/feedback work retains its current state. Run again replaces the
previous bundle through a fresh controller; a generation guard suppresses stale
aggregate results. Completion waits for every handle, reduced motion finishes
the bundle immediately, and kernel disposal settles it. Restart resets the panel.
The pattern is application orchestration using existing APIs, with no new engine.

Sequence playback offers Once, Twice, and Out and back (two yoyo passes).
Changing it replays the content sequence. The diagram follows each pass while
the status/range control measures total run time. Out and back returns to the
initial pose, including making initially hidden objects inert again. Reduced
motion disables repetition and renders one forward pass to keep content visible.

Three standalone DOM views demonstrate `@urk/adapters/motion` without Three.js,
React, native Web Animations, or CSS transitions/keyframes. Motion values advance through one temporary URK frame callback. The adapter
releases demand when the last operation pauses or settles; playback callbacks
update the status panel without an idle UI updater. `createMotionController` is
optional for compatibility and does not advance motion a second time.

From the repository root, using Node 22:

```bash
corepack yarn install
corepack yarn build:runtime
corepack yarn workspace urk-examples dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/motion-lab/`.

- Explore: staggered cards, hover/focus feedback, keyboard selection.
- Create: position, scale, opacity, and a sequential final ring after overlapping shapes.
- Connect: synchronised nodes, path drawing, and an interactive signal pulse.

Next/Previous and view buttons use outgoing and incoming motion timelines.
`navigation.ts` is an application helper with latest-request cancellation,
generation guards, committed-view restoration, and ordered experience phases.
It is reusable with other view IDs and renderer callbacks; it is not a scene manager.
Cancelling restores the last committed view. Replay runs that view's content again.
Pause freezes the runtime, Resume preserves its position, and Unmount/Restart proves
terminal disposal followed by a fresh kernel. The range control previews the content timeline in either direction. Scrubbing
pauses that sequence; Resume sequence plays from the retained position. Pointer
input and Home/End/arrow keys work, including when previewing a fresh timeline
after a previous run completed. Explicit seeks can redraw while the runtime is
paused; they do not restart its clock. Navigation/disposal cancel the owned preview.
The control is disabled during view transitions and reduced motion. Fully
transparent cards/nodes are inert.

The reduced-motion checkbox starts
from the system preference; changing it provides an explicit override.

The status panel shows committed view, lifecycle, phase, unfinished animation count,
current timeline progress, playback state, and kernel instance. Timelines own their
children and the controller scope owns its motion. Host controls survive kernel
disposal to permit restart; page exit and hot-module replacement release the host.
Inactive views are hidden and inert. Controls are native buttons with focus indicators.

Validation from the repository root after building runtime dependencies:

```bash
corepack yarn workspace @urk/adapters test
node --test examples/tests/motion-navigation.test.mjs
corepack yarn workspace urk-examples lint
corepack yarn workspace urk-examples build
corepack yarn workspace urk-examples test:browser --config playwright.motion.config.ts
```

The focused Playwright configuration starts only the examples host on port 5174.
It covers this demo, Story Flow, and the compatible Motion Playground. Desktop/mobile screenshots
are written to `.codex/validation/`.

Run the focused checks in all three browser engines:

```bash
# Install the pinned Playwright browsers if they are not already available.
corepack yarn workspace urk-examples exec playwright install chromium firefox webkit
URK_BROWSER_MATRIX=1 corepack yarn workspace urk-examples test:browser --config playwright.motion.config.ts
```

Without `URK_BROWSER_MATRIX=1`, the existing configuration runs Chromium only.
Each screenshot now uses Playwright's per-test/project output directory under
`.codex/validation/motion-browser/`, so engine captures do not overwrite one another.
Traces are retained on failure. These desktop-engine checks include narrow
viewports; they do not establish physical mobile-device or assistive-technology
coverage.
