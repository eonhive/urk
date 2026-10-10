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
