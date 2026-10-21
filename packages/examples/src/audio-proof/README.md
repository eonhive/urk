# Shared Audio Lab

Website: `/examples/audio-proof/`. Standalone: `/audio-proof/analysis.html`.
Both hosts call `mountAudioProof` from the private `@urk/examples/audio-proof`
entrypoint. The original `/audio-proof/` transport proof remains available.

- `mount.ts`: one kernel, audio controls, analysis/frame demand, visibility policy,
  optional graphics ownership, diagnostics, restart, and teardown.
- `view.ts`, `styles.ts`: shared native controls and visual surfaces.
- `../audio-widget/plots.ts`, `../audio-widget/frames.ts`: Canvas plots and
  temporary analysis reads reused by the borrowed-runtime Audio Widget.
- `../audio-widget/position.ts`: shared native-event progress and seek control.
- `../audio-widget/reactions.ts`: shared visual response sliders and reset.
- `../audio-widget/preferences.ts`: host-owned opt-in visual settings memory.
- `scene.ts`: the existing Three adapter, direct bass/mids/treble reactions, and
  scoped numeric tweens for Orbit/Row changes.
- `meta.ts`: catalog description and source example.

Audio settings opens volume, analysis enablement, FFT, and smoothing in a managed
UI Overlay panel over the plots. Transport, source, mute, and scene layout stay
inline. The helper in `../media/settings-panel.ts` is shared with Video Proof.
Opening and closing reuses the same native controls and preserves playback and
values. Runtime pause disables settings; Close remains usable. Fresh start resets
defaults. Controller scopes release bindings and the panel shell through the
existing adapter lifetime.

The first Play enables one analyser for the selected audio source. Its snapshot
feeds all visuals. Disable analysis to keep ordinary playback without analysis
frame demand. Layout tweens request frames only until completion. Reduced motion
holds reactive geometry still and completes layout changes immediately. Runtime
pause and hidden tabs pause audio; resuming does not autoplay. Start fresh awaits
old cleanup before creating another kernel. Teardown releases media, context,
frame callbacks, listeners, graphics, diagnostics, and the owned DOM.

Visual response offers overall intensity and separate bass pulse, mids color, and
treble detail sliders. Values range from 0% to 200%, defaulting to 100%. Each
rendered band is `min(1, measuredBand × intensity × bandResponse)`: zero returns
that property to its base appearance, and amplification stays within the scene's
existing visual range. Plots, meters, audio volume, and analysis stay unchanged.
Reset reactions restores only those four values. Settings are local to this mount,
survive source changes, and normally reset on Start fresh. The same
scoped controls drive the Canvas widget/starter. Input redraws the latest snapshot
without another analysis read, tween, or frame loop; reduced motion still applies.

Remember visual response on this device is off until opted in. It saves only the
four visual settings under the host's `urk:audio-lab:reactions` key; valid saved
values restore on Start fresh/reload without playback. Only committed slider
changes/reset write settings, with duplicate writes skipped. Turning memory off
forgets the record and preserves live values; Reset keeps memory enabled and saves
the baseline. Invalid/incomplete/version-mismatched records use defaults. Storage
access/write/removal failures report locally without blocking audio. Files, URLs,
volume, analysis, position, and playback state are not saved. Host scope/abort
releases controls/listeners and prevents later writes. The independent starter
uses its own key; docs widgets omit this host feature by default (D-040).

After Play or file selection selects a source and metadata loads, Audio position shows elapsed
time and duration with a keyboard/pointer scrubber. Seeking preserves paused
playback; seeking during a pending play cancels that activation and remains paused.
Finite progress uses native media events, including when analysis is disabled.
Unknown/live duration and runtime pause disable the scrubber. This is native
media seeking, not sample-accurate editing.

Choose audio file replaces the study's source on its existing element and selects
it paused. Its Source option displays the local filename. Use demo audio restores
the study; the other presets stay available. The shared file control owns one
object URL and revokes it on replacement, reset, or shutdown. No file is uploaded
or remembered across fresh starts. Unsupported codecs use the existing error UI.

The three-band fixture and bed/pulse/confirmation assets are served under `/audio/`
in both hosts. Keep copies in `examples/public/audio/` and `apps/www/public/audio/`
byte-identical. Standalone hosts may pass `assetBaseUrl` for another hosting path.

Use Node 22, run `node scripts/build.mjs @urk/examples`, then
`corepack yarn workspace urk-examples dev` or `corepack yarn workspace @urk/www dev`.

For a smaller Canvas embed using an existing runtime, see
`examples/audio-starter/README.md` and the private `@urk/examples/audio-widget`
entrypoint. The exporter copies that widget's source into an independent project;
Audio Lab retains its existing controls, diagnostics, and optional Three scene.
