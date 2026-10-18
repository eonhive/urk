# Interactive Media

Run `corepack yarn workspace urk-examples dev` and open `/interactive-media/`. The website mounts the same controller at `/examples/interactive-media/`.

Play the original silent Orbit clip, jump between three chapters, use the timed signal hotspot or choose Explore/Create, and replay the alternate ending. Captions and all controls work with a keyboard. Position, branch, captions, and optional music/narration volume levels are saved through the storage adapter under `urk:media:bookmark`. Fresh kernels restore paused; blocked storage uses borrowed page memory and displays “Session only.” Experience pause and document hiding explicitly pause this film. Resume stays silent.

Implementation: `packages/examples/src/interactive-media/`. Shared helpers live in the private examples package at `src/media/`; they do not add public kernel APIs.

- `createVideoTimeSource(player)` subscribes to native events, with no polling. Optional `{ frames: true }` requests video frame callbacks only while playing, falling back to animation frames. Unsubscribe in the controller scope. Timing follows browser delivery and is not frame-perfect.
- `createTimeSource()` is a push source for audio seconds, controller frame seconds, normalized scroll progress, or external time. The caller chooses units and sends explicit `seek`, `reset`, or `ended` samples. No adapter is forced onto a global clock.
- `createCues()` runs ordered timestamp crossings or named events. Forward seeks skip missed actions; backward seeks re-arm repeating timestamps at/after the destination. `once` cues persist until explicit `reset()`. Visual state derives from current time so seeking updates overlays immediately. `trigger()` bridges application state/interaction events; `setActive(idOrGroup, false)` disables cues and cancels their work.
- Cue actions receive an `AbortSignal`. Seeks, group deactivation, suspension, and disposal abort relevant actions. Disposal unsubscribes immediately and waits for already-running actions to settle. Actions must cooperate and check cancellation before committing late results; unrelated async cues can overlap.

The sample uses event timing. Fine-grained video callbacks are opt-in, not needed for chapter UI. The optional gallery uses decoded-frame callbacks to redraw a Three.js video screen. The clip and captions are original EonHive assets shared with Video Proof.


Choose **Enable sound** to start the selected soundtrack. Explore/Create crossfade between two original loops. **Hear the guide** plays an original synthesized line, also triggered by the two-second cue while sound is enabled. Narration temporarily lowers music without changing its volume slider. A visible transcript accompanies the guide. Pause, normal seeking, replay, document hiding, disable, and shutdown stop sound and invalidate pending playback; explicit branch handoffs preserve music for their crossfade. Resume and fresh kernels never restart audio automatically.

`src/interactive-media/sound.ts` composes the optional `@urk/adapters/audio/mixer` transports. Native audio elements are acquired only after Enable sound; no audio analysis or continuous frame loop runs. Fades use finite animation frames; controllers own their cancellation and wait for pending native playback during disposal. Audio errors stay in the sound controls and leave the video usable. Programmatic volume depends on browser support; physical mobile devices have not been validated. See [asset provenance and generation](AUDIO_ASSETS.md).


Chapter titles now enter with finite native motion. When playback ends, the film hands off to a closing panel shaped by the selected branch. **Watch again** replays; **Return to film** returns paused at the beginning. Chapter selection, seeking, or replay can interrupt an unfinished handoff. Focus moves only when its current panel is hidden. Experience pause or document hiding pauses title motion and cancels the current panel handoff; resume can finish the requested visual handoff without restarting media.

`stage.ts` is application composition inside the existing controller. It holds explicit `film`/`ending` view state and emits `media:stage` on completed handoffs for existing event observers. Motion uses the public adapter; application handoffs retain a private helper:

- `ctx.require(MotionCapability).scoped(ctx.scope)`: `animate(element, keyframes, { durationMs, delayMs?, easing?, signal? })` returns a handle with pause/resume, finish/cancel, and a `finished` result. The group also has pause/resume and cancel controls. Scope and kernel shutdown cancel remaining work automatically. One animation per target; replacement starts from the supplied keyframes and settles the previous handle as cancelled. CSS owns final styles; effects are removed after completion. Reduced motion, zero duration, and missing Web Animations support complete immediately. See [motion contracts](../../packages/adapters/src/motion/README.md).
- `createTransitions(ctx.signal)`: `run(action)`, `cancel()`, and `dispose()`. A newer action aborts its predecessor. Actions must check their signal before committing after awaits; disposal waits for all admitted work to settle. This is a small cooperative handoff helper, with no state machine or additional runtime.

These helpers compose [native animation completion](https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished) and [cancellation](https://developer.mozilla.org/en-US/docs/Web/API/Animation/cancel). Motion is an optional public adapter; transitions remain private application composition. Neither adds an animation-frame loop, timers, library dependency, or kernel lifecycle state.

## Step into the gallery

After the film ends, choose **Enter 3D gallery**. Select the cyan Explore or violet Create object, use the matching buttons, or focus the scene and press **1 / 2**. Playback, captions, chapters, sound, and saved branch choices use the same media handle and controller. **Replay screen** stays in the gallery; **Return to film** pauses and releases the 3D scene while keeping the playback position.

The standalone `/experience-showcase/` and website `/examples/experience-showcase/` routes use a thin wrapper around this experience and enter the gallery automatically after the introduction. Fresh sessions always begin in the film, paused and silent.

The gallery module loads only on entry. Its child scope reuses Three adapter setup, then owns scene geometry, materials, textures, frame requests, and subscriptions. Failure releases partial resources without failing the film kernel. Return/disposal cancels pending activation and waits for imports to settle. Context loss pauses the film; restoration redraws without autoplay. Rendering follows video frames or explicit changes, with no idle render loop. DOM captions mirror native text-track cues.
