# Shared Audio Lab

Website: `/examples/audio-proof/`. Standalone: `/audio-proof/analysis.html`.
Both hosts call `mountAudioProof` from the private `@urk/examples/audio-proof`
entrypoint. The original `/audio-proof/` transport proof remains available.

- `mount.ts`: one kernel, audio controls, analysis/frame demand, visibility policy,
  optional graphics ownership, diagnostics, restart, and teardown.
- `view.ts`, `styles.ts`, `plots.ts`: shared native controls and Canvas plots.
- `scene.ts`: the existing Three adapter, direct bass/mids/treble reactions, and
  scoped numeric tweens for Orbit/Row changes.
- `meta.ts`: catalog description and source example.

The first Play enables one analyser for the selected audio source. Its snapshot
feeds all visuals. Disable analysis to keep ordinary playback without analysis
frame demand. Layout tweens request frames only until completion. Reduced motion
holds reactive geometry still and completes layout changes immediately. Runtime
pause and hidden tabs pause audio; resuming does not autoplay. Start fresh awaits
old cleanup before creating another kernel. Teardown releases media, context,
frame callbacks, listeners, graphics, diagnostics, and the owned DOM.

The three-band fixture and bed/pulse/confirmation assets are served under `/audio/`
in both hosts. Keep copies in `examples/public/audio/` and `apps/www/public/audio/`
byte-identical. Standalone hosts may pass `assetBaseUrl` for another hosting path.

Use Node 22, run `node scripts/build.mjs @urk/examples`, then
`corepack yarn workspace urk-examples dev` or `corepack yarn workspace @urk/www dev`.
