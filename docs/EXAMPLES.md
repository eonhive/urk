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
- `/examples/embedded-docs-demo/` in `apps/www` - shared motion widget with scrubbing, timing, and playback speed inside the existing docs runtime island; also live at `/docs/guides/astro-docs-embed/`

## Private proof workspace

The proof workspace lives at `examples/` and is started with:

```bash
corepack yarn workspace urk-examples dev
```

The public website surfaces the originals as a repo proof lab on `/examples/`, with source links and local route instructions. Audio Lab at `/examples/audio-proof/` and the standalone `/audio-proof/analysis.html` mount the same implementation from `packages/examples/src/audio-proof/`. It shares native controls, measured audio plots, a reactive Three scene, finite layout motion, diagnostics, and cleanup. The original transport proof remains local.

## Proof routes

- `/audio-proof/analysis.html` - the shared Audio Lab: waveform, spectrum, normalized meters, reactive Three visuals, and finite layout motion
- `/motion-lab/` - three DOM views, an Explore preset playground, seekable timelines with keyboard scrubbing, interrupted navigation, runtime controls, and fresh-kernel restart
- `/motion-widget/` - two reusable DOM widgets sharing one runtime, with keyboard/pointer scrubbing, per-instance timing/speed and opt-in settings memory, automatic offscreen suspension, independent sequence pause/replay/cancel, unmount/remount, and shared runtime cleanup
- `/motion-starter/` - minimal host with a copy-and-embed exporter that produces an independent project using copied widget source and packed local runtimes
- `/motion-playground/` - numeric/DOM motion, pause, replacement, reduced motion, and idle frame demand
- `/audio-proof/` - audio transport, staged loading, mute/volume, pause/resume, shutdown
- `/picking/` - DOM plus Three picking, keyboard movement, storage, overlay feedback
- `/loading-transition/` - staged loading, transition veil, replayable handoff
- `/app-shell/` - panel-state orchestration, pointer/input flow, persistence, lifecycle control
- `/react-starter/` - thin React wrapper around an existing kernel
- `/scrollytelling/` - Story Flow: native-scroll timeline seeking, selectable timed entrances, guided navigation/manual takeover, pause/reduced motion, and fresh-kernel restart
- `/runtime-inspector/` - bounded diagnostics snapshot for runtime, registries, and events

## Structure rule

Each proof folder should contain:

- `README.md`
- `index.html`
- `styles.css`
- `main.ts` or `main.tsx`

Shared utilities are allowed only when they remove real duplication without hiding how a proof works.

The standalone `/motion-widget/` proof and the website's Embedded Docs Demo share
`packages/examples/src/motion-widget/`. Its private `@urk/examples/motion-widget`
entrypoint exports a borrowed-context mount helper; the host registers the motion
adapter/controller and retains kernel ownership. Widget styles ship as a scoped
string in the owned root so compiled mounts need no external CSS copying. Widget
cleanup removes only its subtree and releases its motion/listeners/observers;
website shutdown retains static documentation and reset creates a fresh kernel.
Optional host controls remember only validated timing and speed under separate
local-storage keys. Saving starts after user opt-in; turning it off forgets saved
settings without changing live playback. Widget defaults remain unchanged when
memory is off. See `examples/motion-widget/README.md` for storage failure behavior.
The shared widget also offers versioned JSON import/export under Share settings.
It validates the whole record before committing timing/speed, preserves live
position and pauses, and stages new timing for replay. Presets contain no playback
state or saving consent; persistence remains an independent host choice.

`scripts/create-motion-starter.mjs <new-directory>` exports the Motion Embed
Starter without changing CLI scaffolding. It replaces the repo preview bridge
with canonical widget source and includes Core/adapters archives referenced by
relative file dependencies. The generated private project uses Node 22, Yarn,
and the existing standalone TypeScript/Vite build convention. It needs neither
the checkout nor `@urk/examples` after export. See `examples/motion-starter/README.md`.

- `/audio-starter/` - borrowed-runtime Canvas audio widget, original fixture, and independent-project exporter; see `examples/audio-starter/README.md`
