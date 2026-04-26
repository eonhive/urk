# @urk/examples

Minimal working examples demonstrating the current URK kernel contracts.

## Included examples

- `packages/examples/audio-proof.html` + `src/audio-proof.ts` - standalone DOM-first audio transport proof
- `packages/examples/index.html` + `src/main.ts` - standalone DOM + Three picking proof
- `packages/examples/loading-transition.html` + `src/loading-transition.ts` - standalone DOM-first loading and transition proof
- `packages/examples/app-shell.html` + `src/app-shell.ts` - standalone DOM-first app-shell proof
- `packages/examples/react-starter.html` + `src/react-starter.tsx` - standalone React wrapper proof around an existing URK kernel
- `packages/examples/scrollytelling.html` + `src/scrollytelling.ts` - standalone DOM-first scrollytelling proof

The audio proof proves:

- boot enters `loading`
- staged loading progress is visible and monotonic
- the runtime reaches `ready`
- three local proof tracks are preloaded through the audio adapter
- no track starts automatically at `ready`
- pointer and keyboard controls drive the same transport path
- mute and volume stay explicit and visible
- pause and resume freeze and restore scheduler activity plus audio playback
- shutdown disables controls and halts further visible updates

The picking proof proves:

- boot enters `loading`
- staged loading progress is visible and monotonic
- the runtime transitions into `ready`
- two DOM targets are bound through the pointer adapter
- one Three scene surface mounts through the `three` adapter
- two Three objects are raycast-pickable through the same interaction controller
- the DOM targets and the Three objects share the same scene state
- one keyboard-first input adapter drives bounded movement and selection
- one storage adapter persists and restores the scene state through explicit local/session actions
- hover and select feedback appears through the overlay adapter for both DOM targets and scene raycasts
- a frame tick, DOM idle pulse, and Three scene animation visibly stop on pause and resume on unpause
- pause, resume, and shutdown run against the real kernel lifecycle

The loading/transition proof proves:

- boot enters `loading`
- staged loading progress is visible and monotonic
- the runtime enters `transition` before `ready`
- a transition veil becomes visibly active during the handoff
- a ready-state panel appears only after the transition completes
- pause and resume freeze and restore tick/countdown activity
- replay reruns `loading -> transition -> ready` without refreshing the page
- shutdown disables controls and halts further visible updates

The app-shell proof proves:

- boot enters `loading`
- staged loading progress is visible and monotonic
- the runtime reaches `ready`
- pointer-driven shell navigation switches the active view
- keyboard shortcuts switch views and toggle shell chrome state
- sidebar and inspector state persist automatically through storage
- one explicit reset action clears persisted layout and restores defaults
- pause and resume freeze and restore scheduler-driven shell activity
- shutdown disables controls and halts further visible updates

The React starter proof proves:

- `@urk/react-urk` can wrap an existing kernel instance instead of hiding kernel creation
- `UrkProvider` can auto-boot the kernel cleanly on mount
- `useRuntimeSnapshot()` can subscribe to `RuntimeStore` through `useSyncExternalStore`
- `useEventBus()` can drive visible React updates from kernel/controller events
- pause, resume, and shutdown stay kernel-owned while React remains a thin consumer

The scrollytelling proof proves:

- boot enters `loading`
- staged loading progress is visible and monotonic
- the runtime reaches `ready`
- one internal scroll surface activates sections in order
- pointer nav and keyboard shortcuts jump across sections
- a local section-progress indicator stays explicit and visible
- pause and resume freeze and restore motion plus scroll mutation cleanly
- shutdown disables controls and halts further visible updates

## Running locally

```bash
corepack yarn workspace @urk/examples dev
```

Or from the repo root:

```bash
corepack yarn dev
```

Then open:

- `/audio-proof.html` for the DOM-first audio transport proof
- `/` for the DOM + Three picking proof
- `/loading-transition.html` for the DOM-first loading/transition proof
- `/app-shell.html` for the DOM-first app-shell proof
- `/react-starter.html` for the React wrapper starter proof
- `/scrollytelling.html` for the DOM-first scrollytelling proof

## Audio proof acceptance checklist

1. Load `/audio-proof.html` and confirm the phase starts in `loading`.
2. Confirm progress only increases and stage labels advance through bootstrap, preload, and activate.
3. Confirm the runtime reaches `ready`.
4. Confirm no track starts automatically when the proof becomes ready.
5. Click each track card and confirm the expected track becomes active and playback starts.
6. Press `1`, `2`, and `3` and confirm each corresponding track starts.
7. Press `Space` and confirm the active track pauses and resumes.
8. Click `Mute` and press `M` and confirm mute state changes visibly.
9. Move the volume slider and press `ArrowUp` / `ArrowDown` and confirm volume changes visibly while remaining clamped.
10. Click `Stop` and press `S` and confirm playback stops while transport returns to `ready`.
11. Confirm the overlay status/callout reflects the current track and playback state.
12. Click kernel `Pause` and confirm the frame tick freezes while active playback pauses.
13. Click kernel `Resume` and confirm the frame tick restores and the paused track resumes.
14. Let a non-looping track finish and confirm the transport returns to `ready` with a completion update.
15. Click `Shutdown` and confirm controls disable and no further visible updates or playback occur.

## Picking proof acceptance checklist

1. Load the example and confirm the phase starts in `loading`.
2. Confirm progress only increases and eventually reaches `100%`.
3. Confirm the phase settles in `ready`.
4. Confirm a real Three canvas mounts into the stage.
5. Confirm two DOM targets render.
6. Confirm two Three objects are visibly rendered and animated.
7. Hover a DOM target and confirm the overlay callout updates.
8. Click a DOM target and confirm selection feedback appears in the overlay.
9. Hover a Three object and confirm the overlay updates through the scene raycast path.
10. Click a Three object and confirm selection feedback appears in the overlay.
11. Press the arrow keys and confirm the currently selected target moves in both the DOM and the Three scene.
12. Press `Enter` or `Space` and confirm keyboard selection feedback appears in the overlay.
13. Press `Escape` and confirm the selection clears.
14. Click `Save Local`, move a selected target again, then click `Load Local` and confirm the earlier multi-target scene state is restored.
15. Click `Save Session`, change the scene state, then click `Load Session` and confirm the saved session state is restored.
16. Click `Clear Saved` and confirm the storage status shows both slots as empty.
17. Click `Pause` and confirm the frame tick stops increasing, the DOM motion freezes, the Three scene animation freezes, and keyboard movement or storage controls no longer mutate the scene.
18. Click `Resume` and confirm the frame tick restarts, the DOM motion resumes, the Three scene animation resumes, and keyboard/storage actions work again.
19. Click `Shutdown` and confirm controls disable, the Three canvas is removed, and no further frame activity occurs.

## Loading/transition proof acceptance checklist

1. Load `/loading-transition.html` and confirm the phase starts in `loading`.
2. Confirm progress only increases and stage labels advance.
3. Confirm the runtime enters `transition` before `ready`.
4. Confirm the transition veil becomes visibly active during the handoff.
5. Confirm the ready panel appears only after the transition completes.
6. Click `Pause` and confirm the frame tick and transition countdown freeze.
7. Click `Resume` and confirm the frame tick and countdown restore from the paused point.
8. Click `Replay Flow` from `ready` and confirm the proof restarts from `loading` without a page refresh.
9. Click `Shutdown` and confirm controls disable and no further visible updates occur.

## App-shell proof acceptance checklist

1. Load `/app-shell.html` and confirm the phase starts in `loading`.
2. Confirm progress only increases and stage labels advance.
3. Confirm the runtime reaches `ready`.
4. Click `Overview`, `Runtime`, and `Activity` in the sidebar and confirm the active view changes.
5. Press `1`, `2`, and `3` and confirm the active view changes by keyboard.
6. Press `B` and confirm the sidebar collapses and expands.
7. Press `I` and confirm the inspector opens and closes.
8. Press `Escape` and confirm the inspector closes.
9. Confirm the overlay status/callout reflects the current shell state.
10. Change the active view and shell chrome state, reload the page, and confirm the persisted layout restores automatically.
11. Click `Reset Layout` and confirm the shell returns to the default layout state.
12. Click `Pause` and confirm the frame tick and activity tick freeze while view/layout mutations are blocked.
13. Click `Resume` and confirm ticking and interaction restore from the paused point.
14. Click `Shutdown` and confirm controls disable and no further visible updates occur.

## React starter proof acceptance checklist

1. Load `/react-starter.html` and confirm the proof boots into `loading`.
2. Confirm staged progress is monotonic and reaches `ready`.
3. Confirm phase, reason, loading stage, loading progress, latest event, and frame tick all render through React.
4. Confirm the visible tick advances while the runtime is active.
5. Click `Pause` and confirm the runtime enters `paused` and the tick stops advancing.
6. Click `Resume` and confirm the runtime returns to `ready` and the tick resumes.
7. Click `Shutdown` and confirm controls disable and the tick stops changing.
8. Reload the page and confirm a fresh kernel instance boots cleanly through the same React wrapper path.

## Scrollytelling proof acceptance checklist

1. Load `/scrollytelling.html` and confirm the phase starts in `loading`.
2. Confirm progress only increases and stage labels advance.
3. Confirm the runtime reaches `ready`.
4. Scroll the internal story surface and confirm the active section changes in order.
5. Click the section nav buttons and confirm the story jumps to the selected section.
6. Press `1`, `2`, `3`, and `4` and confirm the story jumps to each corresponding section.
7. Press `ArrowDown` and `ArrowUp` and confirm the story moves section-to-section.
8. Confirm the overlay status/callout reflects the current section and runtime state.
9. Click `Back To Top` and confirm the story returns to the intro section.
10. Click `Pause` and confirm the frame tick and story motion freeze while scroll/nav mutation is blocked.
11. Click `Resume` and confirm ticking and section navigation restore.
12. Click `Shutdown` and confirm controls disable and no further visible updates occur.

## Duplicate-registration verification

While the example is running, open the browser console and run:

```js
await window.__URK_DOM_PROOF__.kernel.registerAdapter(
  window.__URK_DOM_PROOF__.createPointerAdapter('pointer-adapter-duplicate'),
);
```

Expected result: a clear duplicate-capability error for `pointer`.

Then run:

```js
await window.__URK_DOM_PROOF__.kernel.registerAdapter(
  window.__URK_DOM_PROOF__.createInputAdapter('input-adapter-duplicate'),
);
```

Expected result: a clear duplicate-capability error for `input`.

Then run:

```js
await window.__URK_DOM_PROOF__.kernel.registerAdapter(
  window.__URK_DOM_PROOF__.createStorageAdapter({ id: 'storage-adapter-duplicate' }),
);
```

Expected result: a clear duplicate-capability error for `storage`.

Then run:

```js
await window.__URK_DOM_PROOF__.kernel.registerAdapter(
  window.__URK_DOM_PROOF__.createThreeAdapter('three-adapter-duplicate'),
);
```

Expected result: a clear duplicate-capability error for `three`.

Then run:

```js
await window.__URK_DOM_PROOF__.kernel.registerController({
  id: 'loading-controller',
});
```

Expected result: a clear duplicate-controller error for `loading-controller`.

The picking example exposes `window.__URK_DOM_PROOF__` only to support this browser-proof workflow in the current milestone.

## Validation model

This milestone uses build/type-check plus browser acceptance. It does not add an automated browser test framework yet.

## Architecture

See `/docs/07_URK/URK_ARCHITECTURE.md`
