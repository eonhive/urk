# Scrollytelling Proof

Route: `/scrollytelling/`

Story Flow is the second application of URK's controller-driven motion API. It
reuses the existing four-chapter proof, pointer/input navigation, loading, and UI
Overlay. Guided scrolling, reversible scroll choreography, and finite entrances
use the public `@urk/adapters/motion` capability; there is no native smooth-scroll animation,
CSS transition/keyframe animation, frame-counted wave, or separate ticker.

From the repository root, with Node 22 and installed workspace dependencies:

```bash
corepack yarn build:runtime
corepack yarn workspace urk-examples dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/scrollytelling/`.

## Behavior

- Chapter buttons and keys 1–4 start a numeric scroll tween. New requests replace
  old ones from the currently rendered position. Ordered `transition` / `ready`
  commands describe the journey independently of operational lifecycle.
- ArrowUp/ArrowDown move between chapters when focus is inside the story stage.
  Buttons retain native Enter/Space behavior. Keyboard focus stays on the
  activated button; mouse focus follows the browser's platform convention.
- Wheel, touch, pointer, or native page-scrolling keys interrupt guided scrolling
  without snapping back. Resize cancels a journey whose measured endpoint may
  have changed. Manual scrolling chooses the visible chapter directly.
  The interrupting gesture cancels guided travel at its rendered position;
  native wheel delivery and movement during that gesture remain browser-owned.
  Subsequent wheel gestures scroll the story normally.
- **Scroll position** is the default motion source. One individually paused
  timeline maps the scrollable range to 0–1,000 ms. Chapter cards have overlapping
  tracks measured against their positions and the viewport. Scrolling forward or
  back seeks that timeline, restoring the same pose at the same position without
  a completion side effect. Chapter text stays fully visible. Guided travel also
  samples from its actual rendered scroll position.
- Choose **Timed entrance** for the original overlapping content/card/list
  entrances. Replay entrance is enabled only in this mode. Changing sources
  cancels the previous visual work and restores its styles before starting the
  replacement, so the two modes never compete for an element.
- Cancel navigation retains the current scroll position and restores a ready
  experience. In scroll mode the paused timeline remains owned even at 100%:
  scrolling back reuses it. The animation count includes these five held bindings;
  `scroll-linked` describes their position source rather than autonomous playback.
- Pause freezes both guided scrolling and entrances. Resume retains progress.
  Pausing during loading preserves loading. The system reduced-motion setting
  skips visual travel; the checkbox supplies an explicit override for that run.
  Reduced scroll mode has no held timeline and restores static cards. Re-enabling
  motion constructs a fresh timeline at the current scroll position. The system
  preference remains live until the user supplies an override.
- Resize remeasures scroll ranges and replaces the preview timeline at the actual
  retained position. A resize during pause is reconciled on the next running
  update. Diagnostic value slots have stable heights, and transformed cards are
  contained so visual updates cannot alter the range driving them. Mode controls
  and native scroll mutation are locked while paused.
- Shutdown cancels motion and releases runtime listeners. Restart builds a fresh
  kernel at the introduction. Page exit and hot replacement release the host.

The metrics show real lifecycle, phase, animation count, playback status, and
progress. Scroll is locked during loading, pause, and disposal. Static sidebar
feedback uses the existing UI Overlay adapter without obscuring chapter content.

## Implementation

- `index.html` / `styles.css`: accessible shell and static presentation.
- `main.ts`: adapter/controller composition, DOM bindings, section timelines,
  input policy, and host ownership.
- `scroll-motion.ts`: application-local, renderer-independent latest-request
  scroll orchestration. Numeric reads/writes remain supplied callbacks.
- `scroll-timeline.ts`: application-local normalized-progress binding. It holds
  one paused public timeline, skips unchanged samples, blocks sampling while the
  runtime is paused, and settles owned work on reset/disposal.

The motion adapter advances playback through temporary frame work.
`createMotionController()` remains optional for compatibility. Story Flow's other
application updater controllers retain their own frame demand.
The story uses the same public capability as Motion Lab. Native scroll selection
stays application state; the selected motion source only changes visual bindings.
There is no scroll capability, new ticker, scroll hijacking, or Core extension.
Nested timelines, repeat/yoyo, springs, and renderer-specific wrappers remain deferred.

## Validation

```bash
node --test examples/tests/scroll-motion.test.mjs examples/tests/scroll-timeline.test.mjs
corepack yarn workspace urk-examples lint
corepack yarn workspace urk-examples build
corepack yarn workspace urk-examples test:browser --config playwright.motion.config.ts
```

The browser configuration covers Story Flow, Motion Lab, and the existing Motion
Playground. Desktop/mobile screenshots are written under `.codex/validation/`.
Story Flow checks include native wheel/Home/End input, reversible exact poses,
endpoint ownership, pause/resume, layout changes, mode replacement, system/user
reduced motion, cancellation, and fresh-kernel restart.

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
