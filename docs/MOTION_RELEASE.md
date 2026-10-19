# Motion v0.2.1 release candidate

Updated: 2026-10-19. This describes the local release candidate, not a published release.
`@urk/adapters` is versioned `0.2.1`; Core remains `0.2.0` with the existing
`^0.2.0` peer range. Other runtime packages keep their versions.

The patch version keeps this compatible adapter extension on the v0.2 line.
Existing imports, factories, property/native playback signatures, and completion
results remain available. The scheduling migration below still applies to custom
controllers that explicitly advance motion. No tag, publication, or deployment
is performed by these checks.

## Public surface

Use `@urk/adapters/motion` for the motion factory, capability, controls, numeric
presets, and optional DOM bindings. It imports without Three.js or browser globals.
The legacy package root retains its optional Three peer requirement; the existing
DOM composite also re-exports motion with the same token identity.

- Callback numeric tweens use `ValueTweenOptions` and return `ValueTweenHandle`.
  `TweenOptions` keeps its existing property-target meaning.
- Finite timelines use offset entries and expose seek/progress, pause/resume,
  cancellation, and settled completion results. Bounded repetition is optional.
- Scoped playback speed, retargeting, reduced-motion observation, and numeric
  fade/slide/scale/stagger presets reuse the same capability and scopes.
- `createDomMotionBinding` borrows inline styles and restores them on cleanup.
  Native `animate` playback instead releases transient effects to UI-owned CSS.

See [motion API and lifecycle](../packages/adapters/src/motion/README.md) and
[migration guidance](MIGRATION_V02.md#motion-frame-demand).

## Scheduling compatibility

All numeric forms now use temporary runtime frame work. Delayed runnable work
retains demand; fully paused or settled motion releases its own demand. Other
updater controllers keep their existing behavior. The first runnable frame sets
the baseline, and resume/retarget/seek reset it.

`createMotionController()` remains a compatible startup capability check with no
updater. Remove routine custom update calls to `motion.advance(frame.deltaMs)`:
normal playback already advances, so that call adds an extra step. Explicit manual
advance remains available. Experience phases and selected views stay application-owned.

## Examples and distribution

| Surface | Role |
| --- | --- |
| `/motion-lab/` | Interactive views and interrupted application navigation |
| `/motion-widget/` | Independent widgets, settings memory, and portable JSON presets |
| `/scrollytelling/` | Application-owned native-scroll sampling and guided motion |
| `/motion-starter/` | Small copy-and-embed host and independent-project exporter |
| Website Embedded Docs Demo | Shared widget in the existing Astro/MDX runtime island |

`@urk/examples` and these proof routes remain private. The starter exporter copies
canonical widget source and packs local public runtimes into movable relative file
dependencies. It requires Node 22/Yarn and does not depend on registry publication.
Archive filenames include their content digest so exports of unpublished builds
cannot reuse stale same-version files from Yarn's cache.
See [starter instructions](../examples/motion-starter/README.md).

## Focused package gate

From the repository root with Node 22:

```bash
node scripts/build.mjs @urk/adapters
corepack yarn workspace @urk/adapters test:types
node --test packages/adapters/tests/packaged-exports.test.mjs
```

The packed check runs strict public types and deterministic numeric playback in
an isolated fixture without Three.js, then checks legacy root/Three imports with
the existing peer. It does not replace a full runtime/browser/release gate.
Actual gate results are recorded in [validation](VALIDATION.md). This focused gate
does not repeat the browser checks from earlier development phases.

## Source scope and release gates

The release branch is `thehive/urk-motion-v0.2.1`, based on
`ee4072652e5dfa280f28e87c82af51fcdaa0eaac`. It keeps the motion implementation,
its focused tests, shared widget,
Motion Lab, Story Flow, embed starter/exporter, website island, and canonical motion
notes together. Shared configuration includes only those routes and exports.
New audio/video features, overlay host changes, desktop notes, and the separate
Interactive Media/Showcase preset adoption remain outside this changeset. Existing
features already present at the base commit remain part of that baseline.

The earlier ignored `motion-changeset` patch is historical review evidence for the
0.2.0 development snapshot. This candidate additionally records the adapter version
and the exporter's content-addressed archives. Use this branch's source for builds.

```bash
corepack yarn install --immutable
node scripts/build.mjs @urk/examples @urk/react
corepack yarn workspace urk-examples lint
corepack yarn workspace urk-examples build
corepack yarn workspace urk-examples dev --host 127.0.0.1
```

Open `http://127.0.0.1:5173/motion-lab/` or `/motion-starter/`.
The development checkout's concurrent work stays outside this branch. Run the
broader CI/release gates on the candidate before tagging or distributing packages.
The earlier `motion-release` archives contain the mixed development tree and must
not substitute for packages built from this candidate.
