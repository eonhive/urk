# Audio Embed Starter

One registered source drives waveform, frequency spectrum, normalized level and
bass/mids/treble meters, and a coordinated Canvas pulse. Play, pause, restart,
mute/volume, playback position/seek, optional analysis, FFT, and smoothing controls share the existing
audio adapter. No Three.js, motion adapter, or visualization dependency is needed.

## Run the repository preview

Use Node 22 and Yarn 3.8.7. From the URK repository root:

```bash
node scripts/build.mjs @urk/examples
corepack yarn workspace urk-examples dev
```

Open `http://127.0.0.1:5173/audio-starter/` (use the port printed by Vite).
The page owns its runtime, track registration, pause/resume, disposal, and fresh
starts. Resume never starts audio. The host caption survives widget disposal.

## Export an independent project

From the repository root, choose a new destination:

```bash
node scripts/build.mjs @urk/adapters
node scripts/create-audio-starter.mjs /tmp/my-audio-widget
cd /tmp/my-audio-widget
corepack yarn install
corepack yarn dev
```

The exporter refuses existing destinations. It copies widget source, the original
eight-second synthetic three-band study, and current Core/adapters archives into
`vendor/`. That fixture is generated in the URK repo by
`examples/audio-proof/generate-analysis-audio.py`; it contains synthesized tones
and seeded noise. There is no external music source.

Runtime archive filenames include their content digest so separate exports cannot
reuse a stale local dependency from Yarn's cache under the same package version.

The resulting project uses relative file dependencies, Node 22, and Yarn.
It needs neither the repository nor unpublished npm versions nor the private
`@urk/examples` package. Move the whole directory, including `vendor/`, as needed.

## Use an existing runtime

Choose **Choose audio file** in the starter to play your own local file. Selection
replaces the study source and stays paused until Play. **Use demo audio** restores
the bundled study, also paused. Files are neither uploaded nor saved; a fresh
runtime starts with the study. Browser codec support determines which files play.

The host enables this with `localFiles: { defaultSource: studyUrl }` in the widget
options. Other hosts can omit that option. The scoped picker owns one object URL,
revokes it on replacement/reset/removal, and restores the configured default on
early widget teardown. The audio adapter retains the same element and context
binding until host shutdown. Analysis and position controls work for the new file
once its metadata loads, without another kernel or render loop.

The generated `widget/` directory can also be copied into an existing project:

```ts
import { AudioCapability } from '@urk/adapters/audio';
import { mountAudioWidget } from './widget/index.js';

// Inside an existing controller start(ctx), with createAudioAdapter() registered:
const audio = ctx.require(AudioCapability);
audio.registerTrack({ id: 'music', label: 'My music', src: '/music.wav', loop: true });
const widget = await mountAudioWidget(host, ctx, { trackId: 'music', title: 'My signal' });

// Optional early removal; runtime cleanup also releases the widget.
await widget.teardown();
```

Remove the early teardown line to keep the widget mounted. Mounting creates no
kernel, audio context, or frame loop. The host registers tracks and owns adapter
disposal. One widget controls one audio transport; do not mount competing widgets
on the same adapter. Widget removal stops its track and disables analysis but
leaves the adapter and registered track reusable. Full runtime shutdown closes
the adapter's captured context. The host's original DOM is borrowed and preserved.

`play()`, `pause()`, `restart()`, `getReactionSettings()`, and `teardown()` are
available on the handle. The settings getter returns a frozen copy.
Call play/restart from a user interaction. Analysis opts in on Play and may be
disabled for ordinary playback. Read buffers are reused; sample arrays never
travel over the event bus. Frame demand stops while paused, muted, at zero volume,
with analysis disabled, or after teardown. Runtime pause and hidden tabs pause
audio; returning/resuming never autoplays. Reduced motion freezes the pulse while
plots/meters remain available. Bands retain adapter defaults: bass 20–250 Hz,
mids 250–2,000 Hz, treble 2,000–20,000 Hz, bounded by the source's Nyquist limit.
These measurements are not beat or BPM detection.

**Visual response** adjusts overall intensity, bass pulse, mids color, and treble
detail from 0% to 200%. All default to 100%, preserving the original appearance.
Each visual band uses `min(1, measuredBand × intensity × bandResponse)` so stronger
settings stay within the existing visual range. Zero holds that response at its
base appearance; it does not change volume, waveform, spectrum, or meters.
**Reset reactions** restores only these four controls. Values belong to this
widget and survive audio source changes. Without host settings memory, new mounts
restore defaults. Reduced motion still takes priority.
Changing these controls redraws the latest snapshot without starting sound or
acquiring frame demand. The independent export includes the same controls.

The starter offers **Remember visual response on this device**, initially off.
Opting in saves only intensity and the three band responses. Committed slider
changes and Reset update that record; dragging and frame rendering do not write
storage. A valid saved record restores on restart/reload without starting sound.
Turning memory off forgets it while preserving current values. Reset keeps memory
enabled and saves the 100% baseline. Invalid records use defaults; storage failures
report beside the checkbox while playback and live controls keep working. Files,
URLs, position, volume, analysis settings, and playback state are never saved.

Hosts can set initial values through `reactions` and observe committed changes
through `onReactionsChange`. Values must be finite numbers from 0 to 2; omitted
fields default to 1. Invalid initial values reject before widget setup. Callbacks
receive frozen copies, run only on native slider change/reset, and cannot interrupt
already committed controls. A widget does not access storage by itself.

```ts
import { mountAudioPreferences, mountAudioWidget } from './widget/index.js';

const preferences = mountAudioPreferences(host, ctx, 'my-site:music-reactions');
const widget = await mountAudioWidget(host, ctx, {
  trackId: 'music',
  reactions: preferences.restore() ?? { intensity: 0.8, bass: 1.2 },
  onReactionsChange: preferences.changed,
});
preferences.changed(widget.getReactionSettings());
```

Use a stable, distinct key for each independent widget on an origin. The preference
control belongs to the host's runtime scope; widget removal alone does not remove
it. Omit the helper to omit persistence. It follows the existing host preference
pattern, handles browser storage locally, and adds no storage adapter requirement
to audio. There is no cross-tab synchronization or in-memory storage fallback.

After Play or file selection selects the track and metadata loads, **Audio position**
shows elapsed/duration and supports pointer and keyboard seeking. Seeking keeps
a paused track paused and normally leaves playing audio playing. If a play request
is still pending, a seek cancels that activation and leaves audio paused. Unknown
or unbounded durations disable the finite scrubber. Progress uses native media
events even with analysis disabled; it does not acquire another frame loop.

Replace `public/audio/analysis.wav` and its import/registration in `main.ts` for
your own source. Same-origin files work directly; remote analysis requires a
server permitting CORS and a track registered with `crossOrigin: 'anonymous'`.
If analysis is unavailable, the widget reports it and keeps ordinary playback.

## Build and embed

```bash
corepack yarn build
python3 -m http.server 8080 --directory dist
```

Deploy the whole `dist/` directory. Relative asset paths support root or nested
hosting; visitors need only a browser. Use HTTP rather than opening files directly.

```html
<iframe title="Audio reactive widget" src="https://your-site.example/widgets/audio/"
  width="100%" height="1200" style="border:0"></iframe>
```

Choose a height for your page or allow normal iframe scrolling. There is no
automatic frame resize or cross-frame API. The repository preview's small
`widget/index.ts` bridge is replaced with canonical source during export.
