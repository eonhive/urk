# App Shell Proof

Route: `/app-shell/`

This proof shows a generic DOM-first shell driven by runtime state, pointer/input navigation, persisted layout chrome, and lifecycle control.

## Uses

- `@urk/core`
- `@urk/adapters`:
  - `loading`
  - `pointer`
  - `input`
  - `storage`
  - `ui-widgets`

## Files

- `index.html` - static shell
- `styles.css` - proof styling
- `main.ts` - runtime setup, shell state, persistence, and controls
