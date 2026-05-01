# URK Examples

URK proves its API through repo-only examples, not through published example packages.

## Private proof workspace

The proof workspace lives at `examples/` and is started with:

```bash
corepack yarn workspace urk-examples dev
```

## Proof routes

- `/audio-proof/` - audio transport, staged loading, mute/volume, pause/resume, shutdown
- `/picking/` - DOM plus Three picking, keyboard movement, storage, overlay feedback
- `/loading-transition/` - staged loading, transition veil, replayable handoff
- `/app-shell/` - panel-state orchestration, pointer/input flow, persistence, lifecycle control
- `/react-starter/` - thin React wrapper around an existing kernel
- `/scrollytelling/` - section orchestration, internal scroll, pointer/input navigation
- `/runtime-inspector/` - bounded diagnostics snapshot for runtime, registries, and events

## Structure rule

Each proof folder should contain:

- `README.md`
- `index.html`
- `styles.css`
- `main.ts` or `main.tsx`

Shared utilities are allowed only when they remove real duplication without hiding how a proof works.
