# Runtime Inspector Proof

Route: `/runtime-inspector/`

This proof shows the bounded diagnostics surface exposed by `kernel.getInspector()`: runtime state, registry visibility, service summaries, and recent events.

## Uses

- `@urk/core`
- `@urk/adapters/dom`
- `kernel.getInspector()`

## Files

- `index.html` - static shell
- `styles.css` - proof styling
- `main.ts` - runtime setup, inspector projection, and marker controls
