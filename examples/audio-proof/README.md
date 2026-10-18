# Audio Proof

Route: `/audio-proof/`

Public adaptation: `/examples/audio-proof/` on the website, with source in `packages/examples/src/audio-proof/`. This original keeps the broader pointer/input/widget integration for local validation.

This proof shows the smallest useful URK audio stack: kernel lifecycle, staged loading, pointer and keyboard controls, and overlay feedback.

## Uses

- `@urk/core`
- `@urk/adapters`:
  - `audio`
  - `loading`
  - `pointer`
  - `input`
  - `ui-widgets`

## Files

- `index.html` - static shell
- `styles.css` - proof styling
- `main.ts` - runtime setup, controllers, and rendering


## Focused audio analysis proof

Run with Node 22 from the repository root:

```sh
node scripts/build.mjs @urk/examples
corepack yarn workspace urk-examples dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/audio-proof/analysis.html` and click Play. This thin host
mounts `@urk/examples/audio-proof`, the same Audio Lab used on the website.
It includes waveform/spectrum, four meters, a reactive Three scene, finite Orbit/Row
motion, analysis controls, mute/volume, pause/stop/restart, diagnostics, and fresh
runtime ownership. The original transport proof remains at `/audio-proof/`.

The original eight-second fixture can be regenerated with
`python3 examples/audio-proof/generate-analysis-audio.py`. Keep its website copy
at `apps/www/public/audio/analysis.wav` identical. See the shared package README
for lifecycle and rendering boundaries.
