# Public Audio Lab

Website route: `/examples/audio-proof/`. Guide: `/docs/examples/audio-proof/`.

- `meta.ts`: catalog entry and source excerpt.
- `mount.ts`: kernel plus one audio controller, playback, pause, disposal, and error handling.
- `view.ts`: reads the site-owned DOM and renders adapter snapshots.
- `apps/www/src/components/urk-runtime/AudioProofSurface.astro`: static controls, record illustration, responsive styles, and reduced-motion behavior.
- `apps/www/public/audio/`: copies of the three WAV files in `examples/public/audio/`. Keep the copies byte-identical when updating the proof assets.

Run `corepack yarn build:www`, then `corepack yarn workspace @urk/www preview` and open the route. No public package exports or dependencies are added. The audio adapter is imported from `@urk/adapters` because the current `/dom` export does not include audio.

Check all three tracks, pause, stop, volume, mute, runtime pause/resume, shutdown, and repeated reset. A failed media request should show a local error and allow another attempt. Nothing autoplays on mount or restart. Record rotation reflects playback status, not measured audio output.

The original `examples/audio-proof` stays intact as a broader local integration proof.
