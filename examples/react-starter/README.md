# React Starter Proof

Route: `/react-starter/`

This proof shows the intended React integration shape: create a kernel once, hand it to `UrkProvider`, and consume runtime state and inspector data through thin hooks.

## Uses

- `@urk/core`
- `@urk/adapters/dom`
- `@urk/react-urk`

## Files

- `index.html` - root mount shell
- `styles.css` - proof styling
- `main.tsx` - kernel creation, provider wiring, and React view
