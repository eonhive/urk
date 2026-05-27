# Changelog

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
