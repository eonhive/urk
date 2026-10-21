# Audio Adapter

Provides browser-native audio transport orchestration for URK.

## Requires

- no required host service

## Exposes

- `registerTrack(...)`
- `setSource(trackId, src)`
- `preload(...)`
- `play(...)`
- `pause()`
- `stop()`
- `seek(seconds)`
- `setMuted(...)`
- `setVolume(...)`
- `getSnapshot()`
- `subscribe(...)`

## Playback position and seeking

`getSnapshot()` includes `currentTime` in seconds and `duration` in seconds
(`null` until known, `Infinity` for an unbounded source), following the video
adapter's convention. Before a track is active, position is zero and duration is
unknown. `getSnapshot()` reads the active element's current clock; subscribers
also receive native metadata, duration, time-update, and seek changes. These
updates require no render loop and continue when analysis is disabled or muted.
Inactive-track timing events do not replace the active track's snapshot.

```ts
// After play has selected a track and its metadata is available:
audio.pause();
audio.seek(2.5); // Remains paused. A playing track remains playing.
const { currentTime, duration } = audio.getSnapshot();
```

Seek rejects non-finite/negative times, positions beyond a known finite duration,
missing active tracks, and unloaded metadata. It does not call play or enable
analysis. Seeking during a pending native play cancels that activation and leaves
the track paused; a late play result cannot rewind the requested position or
start sound. Mixer channels inherit the same API. Native seeking/progress is not
sample-accurate; browsers determine seek completion and event frequency.

Both Audio Lab and the reusable Audio Widget provide the same keyboard-accessible
position control. It stays disabled until an active source has a positive finite
duration, and while the runtime is paused. Live/unknown durations have no finite
scrubber. Its listeners and subscriptions use the owning resource scope.

## Replace a source

`setSource(trackId, src)` replaces a registered track's URL on its existing audio
element, selects that track, and leaves it paused. It stops the previous active
track, clears the replaced track's loaded cache, resets timing through native
`load()`, and detaches analysis until playback. It preserves track identity,
loop/volume settings, CORS mode, and the existing context/source-node binding.
It creates no new element or Web Audio context and never calls play.

```ts
audio.setSource('music', '/another-track.wav');
// New source is selected and paused; Play remains an explicit user action.
```

Unknown tracks and empty URLs reject before changing playback. Pending play is
invalidated; pending preloads for the replaced source reject with `AbortError`
and release their listeners. A stale result cannot mark the new source loaded
or restart it. Native load/decode failures remain ordinary transport errors.
Remote sources must satisfy the registered track's CORS mode and analysis rules.
Callers own any object URLs they pass and revoke them after replacement or final
cleanup. The local-file controls below manage that ownership for the examples.

Audio Lab and Audio Embed Starter offer Choose audio file and Use demo audio.
The picker holds one object URL, reuses the registered study track, and revokes
the previous URL on replacement/reset/removal. Early widget removal restores
the configured demo source; runtime shutdown clears the element through the
adapter scope. Chosen files are not uploaded or persisted. Unsupported codecs
surface as native media errors. Analysis and seek keep using the same APIs.

## Example

- `examples/audio-proof/`

## Optional mixer

Import `createAudioMixerAdapter` and `AudioMixerCapability` from `@urk/adapters/audio/mixer`. The independent subpath composes existing audio transports without Three.js or a Web Audio dependency. Configure named channels in `music`, `narration`, `effects`, or `ambience` groups. Factories and setup do not create media elements; register tracks when the application needs them.

```ts
const adapter = createAudioMixerAdapter({ channels: [
  { id: 'bed', group: 'music' },
  { id: 'guide', group: 'narration' },
] });
// Inside a controller, after registering the adapter:
const mixer = ctx.require(AudioMixerCapability);
const bed = mixer.channel('bed');
bed.registerTrack({ id: 'loop', label: 'Music', src: '/music.wav', loop: true });
mixer.setGroupVolume('music', 0.4);
// Invoke native playback directly from an explicit user interaction.
await bed.play('loop');
await mixer.fadeGroup('music', 0.25, 160, ctx.signal); // Duck to 0.1 effective volume.
await mixer.fadeGroup('music', 1, 250, ctx.signal);    // Restore the user's 0.4 volume.
```

Effective volume is track volume × channel level × group volume × group fade level. Channel snapshots report the channel level. `getGroupSnapshot()` exposes the independent user volume and fade level. Compose two `fadeChannel()` calls for a crossfade; the controller decides when to stop the outgoing track. The shared interactive-media example demonstrates both crossfades and narration ducking.

Fades use native media volume and request frames only until completion. Replacing a fade, stopping its channel/group mixer, aborting its signal, or disposing rejects pending fades with `AbortError` and cancels their frames. Handle these promises. `stop()` preserves volume settings; kernel pause does not impose a media policy. Controllers explicitly stop/mute their media on pause or visibility loss. Browser support for programmatic media volume varies, including mobile browsers; this is not sample-accurate mixing or synchronization.

The original audio API remains available unchanged. `play()` calls native playback before awaiting anything, sharing an identical pending request. Pause, stop, and shutdown invalidate pending activation and silence late results. Native playback promises still settle cooperatively; controllers that retain pending work should await it during cleanup. A late preload cannot replace a newer playback status. Autoplay/source failures remain transport errors for the application to present locally. No playlists, analysis loop, or global clock is introduced.


## Optional analysis

`audio.analysis` is part of the existing `AudioCapability`. `enable(options?)`
opts in and returns a promise for Web Audio resumption. Call it from a user gesture;
start playback in that same gesture (do not await enable before calling play):

```ts
const audio = ctx.require(AudioCapability);
audio.registerTrack({ id: 'music', label: 'Music', src: '/music.wav', loop: true });
// In a click handler:
await Promise.all([
  audio.analysis.enable({ fftSize: 2048, smoothing: 0.8 }),
  audio.play('music'),
]);
// Inside an existing controller update or temporary frame callback:
const snapshot = audio.analysis.read();
visual.scale = 1 + snapshot.bass * 0.15;
```

`configure(options?)` changes settings without enabling analysis. `disable()`
bypasses the analyser while preserving playback. `enabled` reports opt-in state;
an enabled analyser can return silence while paused or waiting for browser permission.
Neither reading nor enabling schedules frames. An event-driven controller may use
`ctx.registerFrameWork(callback)` while playback is active, retaining its release
function and releasing it on pause, stop, disable, or controller disposal. Do not
send the sample arrays through the event bus.

The borrowed snapshot and its arrays are reused. Copy data if retaining it across
reads; do not mutate it. Changing FFT size replaces the arrays. Before configuration
or enable, arrays are empty. Disabled, paused, stopped, muted, ended, or disposed
analysis reads as zero. Fields are:

- `waveform`: `Float32Array`, mono time-domain samples, normally −1 to 1.
- `spectrum`: `Uint8Array`, 0–255 magnitudes, `fftSize / 2` bins. Bin spacing is
  `sampleRate / fftSize` Hz; `sampleRate` is included in the snapshot.
- `level`: RMS amplitude clamped to 0–1, not perceptual loudness or LUFS.
- `bass`, `mids`, `treble`: mean byte-spectrum magnitude divided by 255 in each
  frequency band, not physical power or musical beat detection.

Defaults: FFT 2048; smoothing 0.8; bass [20, 250), mids [250, 2000), treble
[2000, 20000) Hz. `bands: { bass: [lowHz, highHz], ... }` overrides selected ranges.
Bands use bin center frequencies and clip at Nyquist; empty ranges return zero.
FFT must be a power of two from 32 to 32768; smoothing is 0–1. Analyser decibel
mapping retains Web Audio's −100/−30 dB defaults. Smoothing applies to the spectrum;
RMS follows the current waveform window.

Playback-only users acquire no context or nodes. The first enable creates one
adapter-owned AudioContext and one analyser; all outputs share that analyser for
the active source. Each captured media element keeps its source node because
browsers prohibit capturing it twice. Source changes, pause, stop, and disable
disconnect the analysis path. Already captured sources bypass directly to the
same context's output; the context is retained until adapter-scope disposal closes
it and disconnects all nodes. Enable/re-enable never creates another context.
Mixer channels inherit the same optional API and lazily own their own contexts
only if explicitly enabled. The controller still owns runtime pause/visibility
media policy; the host must await shutdown to release resources after failure.

Use same-origin assets or register `crossOrigin: 'anonymous'` (or
`'use-credentials'`) before a remote source loads, with matching server CORS headers.
Known cross-origin URLs without this opt-in reject before capture. Redirects and
server permissions remain the host's responsibility: the
[Web Audio security rule](https://www.w3.org/TR/webaudio-1.0/#MediaElementAudioSourceOptions-security)
requires inaccessible media sources to output silence. Unsupported Web Audio
rejects enable; ordinary HTML audio playback remains available.

The focused proof is `/audio-proof/analysis.html`; see
[run instructions](../../../../examples/audio-proof/README.md). No microphone,
tempo/beat-grid tracking, worklet DSP, rendering API, or extra package is introduced.
