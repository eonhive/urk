# Changelog

## v0.3 interactive rendering/UI integration slice - unpublished - 2026-10-13

- Extended the shared v0.2 experience with native layout/rotation controls, hover feedback, finite Row/Arc transitions, reduced motion, and pause/resume that preserves transition progress.
- Made narrow scenes keep overlay feedback clear of selectable objects; status feedback now has accessible live-region semantics.
- Added changed-size notifications to the existing Three adapter, preserved unchanged drawing buffers, and fixed picking before rendering. Input resets on focus loss and cancellation; pointer/Three calls stop at abort.
- Added Three context-loss/restoration events and shared-scene recovery feedback. Restoration redraws the existing scene while preserving selection, rotation, pause state, and unfinished transition progress; shutdown suppresses late recovery and releases listeners.
- Added scoped pixel-ratio monitoring for fixed-size Three hosts. Resolution changes use the existing resize event and paused redraw path, retain the 2x cap, and apply the latest ratio after context recovery without polling or duplicate listeners.
- Made shared-playground touch feedback tap-only while preserving native clicks and vertical scrolling. Mouse/pen hover remains available; leaving, pausing, or losing graphics clears the transient cursor. Added touch, cancellation, and listener-cleanup regressions without changing the pointer adapter contract.
- Made active playground transitions honor live reduced-motion changes on their existing frames. Paused/unavailable scenes retain frozen progress until eligible to resume; idle preference changes add no frames or listeners. Added cross-host recovery, queued-layout, and cleanup regressions.
- Preserved keyboard focus when shared host controls are replaced during restart or setup-failure recovery, without overriding focus moved elsewhere. Prevented old control cleanup from removing the replacement's layout class; final teardown still releases it. Added cross-browser focus and responsive-layout regressions.
- Kept focus on the available Pause/Resume button after local keyboard activation. External lifecycle updates and unfocused actions leave focus alone, including focus redirected by application observers. Added native Enter/Space and tab-navigation regressions across all three hosts and browser engines.
- Added a native selection-details disclosure with a real per-object Wireframe action. Closing preserves selection; hover stays separate. Pause and graphics loss disable material changes, recovery preserves them, and fresh kernels reset them. Scoped listeners and existing scene disposal own cleanup; no public overlay API or rendering layer was added.
- Kept React/Next ownership and SSR behavior; stabilized the Next proof's factory across rerenders. Added browser regressions for interactions, resize, idle drawing, and cancellation cleanup.
- Kept package versions at `0.2.0`, independent adapter subpaths, legacy aliases, and existing shared-experience routes/exports. No new runtime layer or dependency.

## Package naming cleanup - unpublished - 2026-10-12

- Moved the wrapper implementations to `packages/react` and `packages/next`, named `@urk/react` and `@urk/next`; Next depends on React.
- Retained the published old names as v0.2 forwarding packages under `packages/compat`, sharing context, providers, and hooks.
- Added `@urk/adapters/ui-overlay` and matching factory/type/token aliases without changing the legacy UI widget capability identity or Three.js adapter.
- Updated workspaces, builds, CLI detection, examples, and affected docs. Existing `0.1.x` installs are not rewritten; publication remains separate.

## URK 0.2.0 — implemented, unpublished — 2026-10-07

- Added typed context lookup for adapters and borrowed services, with per-kernel provider collision guards.
- Added configured dependency preflight and stable sequential startup planning.
- Added auto frame mode alongside continuous compatibility scheduling.
- Completed scoped built-in acquisition cleanup, partial setup rollback, and audio cancellation.
- Added independent adapter imports, operational lifecycle observation, lazy diagnostics, and explicit React/Next ownership.
- Added `useLifecycleSnapshot()` and one shared interactive experience in standalone, React, Next, and website hosts.
- Updated CLI scaffolds to inferred lookups/auto mode and packaged dependency settings.
- Added dependency-aware workspace builds and real root static checks.
- Versioned runtime/tooling manifests together at `0.2.0` with compatible `^0.2.0` peers; retained Node 22 and Yarn.

This is the local implementation. Package publication, a Git release tag, and website deployment have not been performed.

## Published npm packages - 2026-05-31

URK package publication is now reconciled with npm latest.

- Published `@urk/core@0.1.2` as the current kernel package.
- Published `@urk/adapters@0.1.4` as the current adapter package.
- Published `@urk/react-urk@0.1.1`, `@urk/next-urk@0.1.1`, and `@urk/cli@0.1.1`.
- Kept `@urk/examples` and `@urk/www` private and unpublished.
- Public website deployment remains a separate follow-up gate.

## Public release candidate - 2026-05-25

This release candidate prepares URK for public-facing package and site release review. It does not publish npm packages or deploy the public website by itself.

### Public site and docs

- Added `apps/www` as the public Astro/Starlight website for URK docs, package pages, examples, playground shell, brand assets, and runtime island presentation.
- Expanded public docs into the canonical information architecture: Introduction, Getting Started, Core Concepts, Guides, Examples, Reference, and Project.
- Reconciled package pages and reference docs around the real current package surfaces.
- Kept `@urk/schema` and `@urk/inspector` as deferred ideas, not package pages.

### Runtime examples

- Added private website-consumed runtime examples under `@urk/examples`.
- Promoted eight runnable public examples: Minimal Runtime, Adapter Registration, Controller Orchestration, Runtime State, Event Routing, Scene/User Interface Bridge, Pointer/Input Overlay, and Embedded Docs Demo.
- Kept `@urk/examples` private, internal, unstable, and consumed only by `apps/www`.
- Kept `examples/` and `apps/next-proof` as repo-only proof workspaces.

### CLI and package boundaries

- Added `@urk/cli` as publishable developer tooling with the `urk` bin.
- Added publish prep metadata for first public npm release of `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Kept `@urk/core` at `0.1.1` and `@urk/adapters` at `0.1.3`; those versions already exist on npm and are not part of the first unpublished-package publish set.
- Kept package versions unchanged for this release-prep step.
- Kept raw `src/` excluded from runtime and wrapper package tarballs. `@urk/cli` intentionally packs `src/templates/**` because those files are scaffold assets.

### Release readiness

- Switched the repo to Yarn `nodeLinker: node-modules` on Node 22 while preserving tracked Yarn cache artifacts.
- Removed PnP loader artifacts from the release candidate.
- Hardened private proof workspace chunking so the intentional Three.js proof no longer emits Vite chunk-size warnings.
- Recorded release staging, package dry-run, generated-link audit, and release-handoff details under `BUILD_STATUS.md` and `codex/`.

### Known release risks

- This is release preparation, not an npm publish, git tag, push, or site deploy.
- `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli` still require explicit publish execution.
- Public site deployment still requires a separate hosting/deploy decision.
- `.yarn/install-state.gz` remains intentionally unstaged unless release policy changes.
