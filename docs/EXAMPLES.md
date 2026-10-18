# URK Examples

URK has two example surfaces with different jobs.

- `packages/examples` contains private, internal, unstable runtime examples consumed by the public website in `apps/www`.
- `examples/` contains private repo proof routes used for broader manual validation and developer understanding.

Neither example surface is published as a stable public npm API.

## Website examples package

The website examples package lives at `packages/examples/` and is imported by `apps/www` as `@urk/examples`.

Current role:

- provide the runtime example catalog for public website pages
- provide the mount contract used by runtime islands
- keep non-current entries labeled as planned or experimental if new entries are added
- keep demo behavior out of Astro presentation components
- present each current example with a distinct visual summary on `/examples/`

Current runnable public examples:

- `/examples/audio-proof/` in `apps/www` - shared reactive Audio Lab with measured audio and Three visuals
- `/examples/minimal-runtime/` in `apps/www`
- `/examples/adapter-registration/` in `apps/www`
- `/examples/controller-orchestration/` in `apps/www`
- `/examples/runtime-state/` in `apps/www`
- `/examples/event-routing/` in `apps/www`
- `/examples/scene-ui-bridge/` in `apps/www`
- `/examples/pointer-input-overlay/` in `apps/www`
- `/examples/embedded-docs-demo/` in `apps/www`

## Private proof workspace

The proof workspace lives at `examples/` and is started with:

```bash
corepack yarn workspace urk-examples dev
```

The public website surfaces the originals as a repo proof lab on `/examples/`, with source links and local route instructions. Audio Lab at `/examples/audio-proof/` and the standalone `/audio-proof/analysis.html` mount the same implementation from `packages/examples/src/audio-proof/`. It shares native controls, measured audio plots, a reactive Three scene, finite layout motion, diagnostics, and cleanup. The original transport proof remains local.

## Proof routes

- `/audio-proof/analysis.html` - the shared Audio Lab: waveform, spectrum, normalized meters, reactive Three visuals, and finite layout motion
- `/motion-playground/` - numeric/DOM motion, pause, replacement, reduced motion, and idle frame demand
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
