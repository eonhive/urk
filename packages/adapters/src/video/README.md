# Video

`@urk/adapters/video` exposes `createVideoAdapter`, `VideoCapability`,
`VideoAdapterApi`, `VideoHandle`, and immutable `VideoSnapshot` values. This
entrypoint needs only core and browser media APIs; it does not import Three.js
or change the audio adapter.

```ts
import { createVideoAdapter, VideoCapability } from '@urk/adapters/video';

// Add createVideoAdapter() to the kernel configuration. Inside a controller:
const videos = ctx.require(VideoCapability);
const player = videos.register({ id: 'intro', element: videoElement });
ctx.scope.defer(() => videos.unregister(player.id));
ctx.scope.defer(player.subscribe((snapshot, event) => {
  // Native events include timeupdate, seeking, seeked, waiting, ended, and error.
  updateControls(snapshot);
}));

// Call directly from a user gesture, and handle rejection in the application.
await player.play();
player.pause();
player.seek(3);
await player.resume();
player.stop(); // Pause and rewind when metadata is available.
```

## Transport and observations

- Each registration has independent playback, volume, mute, rate, loop, source,
  and caption selection. `get(id)` and `getSnapshots()` inspect registrations.
- Use `setSource`, `setVolume` (0–1), `setMuted`, `setPlaybackRate` (positive,
  browser-supported), and `setLoop`. Invalid commands throw and surface a local
  error snapshot. Failed `play()` promises preserve the native error.
- Captions use native `<track>`/`TextTrack` support. `setTextTrack(index)` selects
  captions/subtitles, and `null` disables them. Metadata tracks remain untouched.
  The application supplies sources, language, labels, CORS settings, and tracks.
- `getSnapshot()` returns the same frozen object until an observed change.
  `subscribe` returns an unsubscribe function; read an initial snapshot yourself.
  Duration is `null` before metadata and may be `Infinity` for live sources.
- The existing runtime event bus receives `video:<event>` with the player
  snapshot as payload. The existing inspector sees these only while subscribed.
  There is no sampler, timer, or animation-frame loop in the adapter.

## Ownership and cancellation

Supplied elements default to **borrowed**. Unregister removes adapter listeners
and subscribers, cancels pending commands, and pauses playback initiated through
the handle. It preserves the node, source, text tracks, and settings. Playback
already running outside the handle remains application-owned. Use one adapter
registration per element; separate elements are independent players.

Omitting `element` creates an owned video. Explicit `ownership: 'owned'`
transfers an existing element's media/DOM cleanup to the adapter. Owned disposal
pauses, clears sources/`srcObject`, reloads to release media, and removes the
element. It does not stop externally supplied stream tracks or revoke caller URLs.
The application owns object URLs and must revoke them when no longer needed.

Concurrent `play()` calls share completion. Pause, stop, source replacement,
unregister, and kernel cancellation invalidate pending playback immediately with
`AbortError`. Late native promise settlement cannot activate the old request.
Shutdown does not wait for the browser's unresolved play promise. New work on a
disposed handle rejects; snapshots retain the terminal `disposed` state.
Subscribers receive one final `disposed` notification on unregister, then are
released. This also releases optional video-texture bindings immediately.

Kernel pause does **not** imply media pause. The proof controller explicitly
chooses its experience policy. The adapter never autoplays or resumes on its own.
Setting a source explicitly calls `load()`; registration without a source
preserves the element.

## Optional visibility and loading

```ts
const player = videos.register({
  id: 'intro', element: videoElement, src: '/intro.mp4',
  visibility: {
    target: experienceContainer,
    loadWhenVisible: true,
    pauseWhenOffscreen: true,
    pauseWhenHidden: true,
  },
});
```

All three flags default to false. `target` defaults to the video; use its
experience container for custom controls or a video hidden behind a 3D texture.
Offscreen means no positive intersection with the viewport. Intersection and
document visibility events drive these policies without polling.

`loadWhenVisible` defers only the supplied registration `src`, until the target
is visible in a visible document. It does not clear a borrowed source or suppress
browser loading of preexisting `src`, `<source>`, posters, or caption tracks.
An explicit `play()` loads synchronously within the user gesture; explicit
`setSource()` replaces any deferred source and loads immediately. Without
IntersectionObserver, loading falls back to document visibility and offscreen
pausing is unavailable. A hidden document still defers loading.

Configured pause conditions cancel pending playback and apply to native controls
as well as handle commands. Play rejects with `AbortError` while a configured
condition blocks it. Returning onscreen or to the tab **never resumes playback**;
the application or user must call Play again. Policies disconnect on cancellation
or unregister. Kernel pause remains an application decision.

## Limits and proof

Transport follows the [native media contract](https://html.spec.whatwg.org/multipage/media.html#media-elements).
`seek` requests a seek after metadata; completion is reported by native `seeked`.
Event-based time snapshots are not frame-perfect synchronization. The shared media
example composes cues and optional decoded-frame observation outside core.
Codec, autoplay, caption loading, volume, and playback-rate support
remain browser-dependent. No decoding, streaming provider, or global clock is added.

Run the standalone `/video-proof/` or website `/examples/video-proof/` example.
They share `packages/examples/src/video-proof/` and accept local files without
uploading them.
