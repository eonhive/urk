# SESSION_HANDOFF.md

## Current status

URK public-site example work is in a validated state. The public website now has eight runnable examples: `minimal-runtime`, `adapter-registration`, `controller-orchestration`, `runtime-state`, `event-routing`, `scene-ui-bridge`, `pointer-input-overlay`, and `embedded-docs-demo`.

There are no remaining entries in `packages/examples/src/planned.ts`.

The focused public-docs status audit is complete. Canonical docs no longer describe promoted examples as `later` or `When implemented`.

The focused public-site accessibility and responsive QA pass is complete. The shell, examples index, runtime panels, and shared example progress updates now expose stronger keyboard/focus, status, log, and mobile-friendly semantics.

The experimental `/playground/` MVP shell is hardened. It validates known-example JSON config, updates local preview/state/adapters/controllers/event panels from example metadata, rejects custom JavaScript, and links runtime execution to the dedicated example routes.

The public Project docs are synced with the current root canon. Public architecture, boundary, decisions, deferred features, and roadmap pages now mirror the canonical root docs while keeping `docs/07_URK/` as archive/reference material.

The production readiness hardening pass is complete. The private proof workspace builds without the prior Vite chunk-size warning, publish dry-runs passed for publishable packages only, and the generated-site internal link audit passed with `missing: []`.

The first final-release hygiene step is complete. `codex/RELEASE_HYGIENE.md` now separates release-intended source changes, explicit staging decisions, generated/local-only artifacts, validation baseline, remaining release blockers, and do-not-redo notes. `corepack yarn install --immutable` passed under Node 22 on 2026-05-22 with warnings only.

The release-candidate cleanup after staged diff review is complete. The unintended `"default"` export-map conditions were removed, `.yarn/install-state.gz` remains intentionally unstaged, and build/package verification passed again under Node 22.

The final staged release-candidate review found no blockers. The selected release path is commit-only: keep existing package versions unchanged, create a local release-candidate commit, and do not tag, push, publish, or deploy in this step.

The workspace is intentionally dirty from prior repo-shape, docs, public-site, package-page, and example tasks. Do not assume unrelated modified or untracked files are safe to revert.

## Completed work

- Promoted `/examples/adapter-registration/` from planned to current.
- Promoted `/examples/controller-orchestration/` from planned to current.
- Promoted `/examples/runtime-state/` from planned to current.
- Promoted `/examples/event-routing/` from planned to current.
- Promoted `/examples/scene-ui-bridge/` from planned to current.
- Promoted `/examples/pointer-input-overlay/` from planned to current.
- Promoted `/examples/embedded-docs-demo/` from planned to current.
- Added a private `packages/examples/src/runtime-panel.ts` helper for shared live-example panel wiring.
- Refactored `minimal-runtime` and `adapter-registration` to use the shared runtime-panel helper.
- Added controller orchestration metadata and runtime mount using `loading`, `ui-widgets`, `ui:host`, `primary-controller`, and `telemetry-controller`.
- Added runtime state metadata and runtime mount using `loading` and `state-demo-controller`.
- Added event routing metadata and runtime mount using `loading`, `event-listener-controller`, and `event-source-controller`.
- Added scene/UI bridge metadata and runtime mount using `loading`, `ui-widgets`, `pointer`, `scene-controller`, and `ui-bridge-controller`.
- Added pointer/input overlay metadata and runtime mount using `loading`, `pointer`, `input`, `ui-widgets`, and `pointer-overlay-controller`.
- Added embedded docs demo metadata and runtime mount using `loading`, `docs:host`, and `docs-embed-controller`.
- Updated public docs pages and package-page related-example labels from `Planned` to `Current` for promoted examples.
- Updated runtime-state docs and public-site IA status text from planned/later to current.
- Updated event-routing docs and public-site IA status text from planned/later to current.
- Updated scene/UI docs, concept, guide, package labels, and public-site IA status text from planned/later to current.
- Updated pointer/input overlay docs, package labels, and public-site IA status text from planned to current.
- Updated embedded docs/static website guide docs, examples reference docs, public-site plan, and documentation IA for the current embedded docs demo.
- Audited stale planned-example wording in canonical/public docs and updated promoted examples to current status language.
- Fixed runtime panel entity/event rendering to escape HTML-like values such as `HTMLElement(<div>)`.
- Completed a focused public-site accessibility/responsive QA pass for `apps/www`.
- Added a visible skip-link implementation, active nav `aria-current`, external GitHub nav labeling, copy-button ARIA feedback, runtime progressbar semantics, grouped runtime controls, live status regions, log labels, and alert semantics.
- Hid the non-current examples section on `/examples/` when no non-current examples exist.
- Added responsive CSS hardening for the public shell, examples index, code blocks, runtime logs, and runtime entity lists.
- Updated public-site plan and UI/UX system docs with the completed accessibility QA note.
- Hardened `/playground/` from a disabled placeholder into an experimental known-example config shell.
- Added playground JSON validation for current example IDs, adapter/controller metadata, and the no-custom-code boundary.
- Added local playground preview/state/adapters/controllers/event panel updates plus config reset and live-example route linking.
- Updated the public playground starter docs and public-site plan to describe the current shell honestly.
- Synced public Project docs with root canon for architecture layers, package ownership, boundary ownership/exclusions, accepted decisions, deferred scope, and current roadmap status.
- Updated `docs/PUBLIC_SITE_PLAN.md` to record the public Project docs sync and clarify that root docs remain canonical while public Project docs are onboarding summaries.
- Added proof-workspace Rollup vendor chunking for `vendor-three`, `vendor-react`, and `vendor-urk` in `examples/vite.config.ts`.
- Scoped `build.chunkSizeWarningLimit` to `650` for the repo-only proof workspace so the intentional Three.js proof chunk no longer makes full builds look unhealthy.
- Reran publish dry-runs for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Confirmed runtime and wrapper tarballs exclude raw `src/`, with `@urk/cli` intentionally packing `src/templates/**` scaffold assets.
- Ran the generated-site internal link audit over `apps/www/dist` and confirmed `missing: []`.
- Updated `BUILD_STATUS.md`, `codex/PLANS.md`, and this handoff with production readiness results, remaining risks, and do-not-redo notes.
- Added `codex/RELEASE_HYGIENE.md` as the dirty-worktree release inventory.
- Classified release-intended source changes, explicit staging decisions, generated/local-only artifacts, current validation baseline, and remaining release blockers.
- Reran `corepack yarn install --immutable` under Node 22; it passed with warnings only.
- Updated `BUILD_STATUS.md`, `codex/PLANS.md`, and this handoff with the release-hygiene and immutable-install result.
- Removed unintended `"default"` export conditions from package export maps after staged diff review.
- Kept `.yarn/install-state.gz` unstaged by release-policy decision.
- Updated `codex/RELEASE_HYGIENE.md`, `codex/PLANS.md`, and this handoff with release-candidate cleanup results.
- Restaged only the edited package manifests and codex docs after cleanup.
- Completed final staged release-candidate review with no blockers.
- Chose the commit-only release-candidate path: package versions stay unchanged, `.yarn/install-state.gz` stays unstaged, and no tag, push, npm publish, or site deploy is part of this step.

## In-progress work

- No active implementation task is currently in progress.
- The initial planned public example catalog is fully promoted; next work should not assume another planned example exists.
- Production readiness verification, final-release hygiene inventory, intentional staging, staged diff review, release-candidate cleanup, and final staged release-candidate review are complete; next work should be versioning/changelog/publish/deploy planning after the local commit, not more runtime or package surface scope.

## Changed files

- `packages/examples/src/runtime-panel.ts`
- `packages/examples/src/minimal-runtime/mount.ts`
- `packages/examples/src/adapter-registration/mount.ts`
- `packages/examples/src/adapter-registration/meta.ts`
- `packages/examples/src/controller-orchestration/meta.ts`
- `packages/examples/src/controller-orchestration/mount.ts`
- `packages/examples/src/runtime-state/meta.ts`
- `packages/examples/src/runtime-state/mount.ts`
- `packages/examples/src/event-routing/meta.ts`
- `packages/examples/src/event-routing/mount.ts`
- `packages/examples/src/scene-ui-bridge/meta.ts`
- `packages/examples/src/scene-ui-bridge/mount.ts`
- `packages/examples/src/pointer-input-overlay/meta.ts`
- `packages/examples/src/pointer-input-overlay/mount.ts`
- `packages/examples/src/embedded-docs-demo/meta.ts`
- `packages/examples/src/embedded-docs-demo/mount.ts`
- `packages/examples/src/catalog.ts`
- `packages/examples/src/planned.ts`
- `apps/www/src/content/docs/docs/index.mdx`
- `apps/www/src/content/docs/docs/examples/adapter-registration.mdx`
- `apps/www/src/content/docs/docs/examples/controller-orchestration.mdx`
- `apps/www/src/content/docs/docs/examples/runtime-state-panel.mdx`
- `apps/www/src/content/docs/docs/examples/event-routing-demo.mdx`
- `apps/www/src/content/docs/docs/examples/scene-ui-coordination.mdx`
- `apps/www/src/content/docs/docs/examples/pointer-input-overlay.mdx`
- `apps/www/src/content/docs/docs/concepts/scene-ui-bridge.mdx`
- `apps/www/src/content/docs/docs/guides/scene-ui-bridge.mdx`
- `apps/www/src/content/docs/docs/guides/astro-docs-embed.mdx`
- `apps/www/src/content/docs/docs/guides/static-website-embed.mdx`
- `apps/www/src/content/docs/docs/reference/examples.mdx`
- `apps/www/src/content/docs/docs/project/roadmap.mdx`
- `apps/www/src/data/packages.ts`
- `apps/www/src/components/docs/CodeBlock.astro`
- `apps/www/src/components/layout/BaseLayout.astro`
- `apps/www/src/components/layout/SiteHeader.astro`
- `apps/www/src/components/layout/ThemeToggle.astro`
- `apps/www/src/components/urk-runtime/LiveURKExample.astro`
- `apps/www/src/components/urk-runtime/PreviewPanel.astro`
- `apps/www/src/components/urk-runtime/RuntimeLogPanel.astro`
- `apps/www/src/components/urk-runtime/RuntimeStatePanel.astro`
- `apps/www/src/data/examples.ts`
- `apps/www/src/pages/examples/index.astro`
- `apps/www/src/pages/playground.astro`
- `apps/www/src/styles/global.css`
- `apps/www/src/content/docs/docs/examples/playground-starter.mdx`
- `apps/www/src/content/docs/docs/project/architecture.mdx`
- `apps/www/src/content/docs/docs/project/boundary.mdx`
- `apps/www/src/content/docs/docs/project/decisions.mdx`
- `apps/www/src/content/docs/docs/project/deferred-features.mdx`
- `apps/www/src/content/docs/docs/project/roadmap.mdx`
- `docs/EXAMPLES.md`
- `docs/DOCUMENTATION_IA.md`
- `docs/PUBLIC_SITE_PLAN.md`
- `docs/UI_UX_SYSTEM.md`
- `examples/vite.config.ts`
- `BUILD_STATUS.md`
- `packages/core/package.json`
- `packages/adapters/package.json`
- `packages/react-urk/package.json`
- `packages/next-urk/package.json`
- `packages/examples/package.json`
- `codex/RELEASE_HYGIENE.md`
- `codex/SESSION_HANDOFF.md`
- `codex/PLANS.md`

There are many unrelated pre-existing modified/untracked files from earlier work, including root docs, package metadata, `apps/www/`, `packages/cli/`, `packages/examples/`, and Yarn cache artifacts.

## Commands run

- `corepack yarn workspace @urk/examples build`
- `corepack yarn workspace @urk/examples build` under Node 22
- `corepack yarn workspace @urk/www check`
- `corepack yarn workspace @urk/www check` under Node 22
- `corepack yarn workspace @urk/www build`
- `corepack yarn workspace @urk/www build` under Node 22
- `corepack yarn build`
- `corepack yarn build` under Node 22
- `npm pack --dry-run --json` in `packages/core`
- `npm pack --dry-run --json` in `packages/adapters`
- `npm pack --dry-run --json` in `packages/react-urk`
- `npm pack --dry-run --json` in `packages/next-urk`
- `npm pack --dry-run --json` in `packages/cli`
- generated-site internal link audit over `apps/www/dist`
- `corepack yarn install --immutable` under Node 22
- `corepack yarn workspace @urk/examples build` under Node 22 after release-candidate cleanup
- `corepack yarn workspace @urk/www check` under Node 22 after release-candidate cleanup
- `corepack yarn workspace @urk/www build` under Node 22 after release-candidate cleanup
- `corepack yarn build` under Node 22 after release-candidate cleanup
- `npm pack --dry-run --json` in `packages/core` after release-candidate cleanup
- `npm pack --dry-run --json` in `packages/adapters` after release-candidate cleanup
- `npm pack --dry-run --json` in `packages/react-urk` after release-candidate cleanup
- `npm pack --dry-run --json` in `packages/next-urk` after release-candidate cleanup
- `npm pack --dry-run --json` in `packages/cli` after release-candidate cleanup
- `git diff --cached --check` after release-candidate cleanup
- Staged `.yarn/install-state.gz` and generated/local-only artifact checks after release-candidate cleanup
- Final staged release-candidate review commands: `git diff --cached --stat`, `git diff --cached --name-status`, `git diff --cached --check`, `.yarn/install-state.gz` staged check, generated/local artifact staged check, staged `"default"` export-map check, targeted package/private-boundary scans, and `git status --short`
- Static untracked-generated-output check with `git ls-files -o --exclude-standard`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4327`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4328`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4329`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4330`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4331`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4332`
- `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port 4333`
- Static route/content checks with `rg`
- Targeted stale planned-example phrase checks with `rg`
- Static accessibility/mobile CSS checks with `rg`
- Static playground route/docs checks with `rg`
- Static Project docs canon-sync checks with `rg`
- Browser smoke checks through the Codex in-app browser

Node used for validation: `/Users/nappy.cat/.nvm/versions/node/v22.22.2/bin`.

## Tests / verification

- `@urk/examples` build passed.
- `@urk/www` Astro check passed.
- `@urk/www` production build passed.
- Full workspace build passed under Node 22.
- Static checks confirmed `/examples/adapter-registration/` and `/examples/controller-orchestration/` are live routes with `data-example-id` and no planned placeholder text.
- Static checks confirmed `/examples/runtime-state/` is a live route with `data-example-id="runtime-state"` and no planned placeholder text.
- Static checks confirmed `/examples/event-routing/` is a live route with `data-example-id="event-routing"` and no planned placeholder text.
- Static checks confirmed `/examples/scene-ui-bridge/` is a live route with `data-example-id="scene-ui-bridge"` and no planned placeholder text.
- Static checks confirmed `/examples/pointer-input-overlay/` is a live route with `data-example-id="pointer-input-overlay"` and no planned placeholder text.
- Static checks confirmed `/examples/embedded-docs-demo/` is a live route with `data-example-id="embedded-docs-demo"` and no `Runtime island planned` or `example:planned` placeholder text.
- Docs checks confirmed adapter registration and controller orchestration pages say `Status: current`.
- Docs checks confirmed `/docs/examples/runtime-state-panel/` says `Status: current` and links to `/examples/runtime-state/`.
- Docs checks confirmed `/docs/examples/event-routing-demo/` says `Status: current` and links to `/examples/event-routing/`.
- Docs checks confirmed `/docs/examples/scene-ui-coordination/` says `Status: current` and links to `/examples/scene-ui-bridge/`.
- Docs checks confirmed `/docs/examples/pointer-input-overlay/` says `Status: current` and links to `/examples/pointer-input-overlay/`.
- Docs checks confirmed `/docs/guides/astro-docs-embed/` and `/docs/guides/static-website-embed/` link to `/examples/embedded-docs-demo/`.
- Browser smoke passed for `/examples/controller-orchestration/`: adapters, `ui:host` service, both controllers, lifecycle events, telemetry coordination, pause/resume, reset/restart, and clean console.
- Browser smoke passed for `/examples/event-routing/`: route mounted, runtime reached `ready`, `loading:loading-adapter` appeared, both event controllers started, event log showed `event-demo:started`, `event-demo:checkpoint-observed`, `event-demo:any-observed`, and `event-demo:completed`, pause/resume worked, and console had no warnings/errors.
- Browser smoke passed for `/examples/scene-ui-bridge/`: route mounted, runtime reached `ready`, `loading`, `ui-widgets`, and `pointer` adapters appeared, both scene/UI controllers started, service list showed `ui:host` and `scene:bridge`, event log showed scene mount/state/overlay/ready events, pointer selection emitted `scene-ui:node-selected`, pause/resume worked, and console had no warnings/errors.
- Browser smoke passed for `/examples/pointer-input-overlay/`: route mounted, runtime reached `ready`, `loading`, `pointer`, `input`, and `ui-widgets` adapters appeared, the pointer overlay controller started, service list showed `ui:host`, `input:target`, and `pointer-overlay:surface`, pointer target selection, surface selection, Space activation, R reset, pause/resume, and console checks passed.
- Browser smoke passed for `/examples/embedded-docs-demo/`: route mounted, runtime reached `ready`, `loading:loading-adapter` appeared, `docs:host:HTMLElement(<article>)` appeared, `docs-embed-controller:started` appeared, event log showed host resolution, island loading, runtime mount, fallback confirmation, ready, pause, and resume events, reset/restart remounted cleanly, and console checks passed.
- Browser regression smoke passed for `/examples/minimal-runtime/` and `/examples/adapter-registration/` after the shared-helper extraction.
- Targeted docs audit check passed: no stale promoted-example phrases remained for `Adapter Registration later`, `Controller Orchestration later`, `When implemented`, `Experimental later`, `planned routes`, `planned example pages`, `other seven`, `minimal live runtime example`, `current runnable public example`, `planned packages/examples`, `Show planned examples`, `later package detail pages`, or `planned status`.
- Generated docs output confirmed updated status language for adapter registration, controller orchestration, and the roadmap.
- `@urk/examples` build passed after the accessibility/responsive QA pass.
- `@urk/www` Astro check passed with 0 errors, 0 warnings, and 0 hints after the accessibility/responsive QA pass.
- `@urk/www` production build passed after the accessibility/responsive QA pass.
- Full workspace build passed under Node 22 after the accessibility/responsive QA pass.
- Static output checks confirmed generated skip link, active Examples nav `aria-current`, external GitHub label, runtime progressbar ARIA attributes, runtime controls group, event log label, reset button label, and `data-example-id="minimal-runtime"`.
- Static output checks confirmed `/examples/` no longer renders `Planned next` or `Future examples` when there are no non-current examples.
- Static CSS checks confirmed the mobile/responsive rules and overflow wrapping remain present in `apps/www/src/styles/global.css`.
- Browser smoke passed for `/examples/minimal-runtime/`: runtime reached `ready`, progressbar reached `aria-valuenow="100"`, active nav and runtime labels were present, reset label was present, and browser console logs had no warnings/errors.
- Browser smoke passed for `/examples/`: active nav was present, heading rendered, and planned/future example copy was absent.
- `@urk/www` Astro check passed with 0 errors, 0 warnings, and 0 hints after playground hardening.
- `@urk/www` production build passed after playground hardening and generated `/playground/index.html`.
- Full workspace build passed under Node 22 after playground hardening.
- Static output checks confirmed `/playground/` includes config editor hooks, validate/reset controls, known-example sandbox status, custom-code rejection copy, and no stale `Run preview later`, `playground:planned`, or `phase: planned` placeholder copy.
- Static docs checks confirmed `/docs/examples/playground-starter/` documents current playground boundaries.
- Browser smoke passed for `/playground/`: initial Minimal Runtime config was valid, selecting Adapter Registration updated title/adapters/controllers/link, custom JavaScript was rejected with `aria-invalid="true"`, reset restored valid config, and browser console logs had no warnings/errors.
- `@urk/www` Astro check passed with 0 errors, 0 warnings, and 0 hints after the public Project docs canon sync.
- `@urk/www` production build passed after the public Project docs canon sync.
- Full workspace build passed under Node 22 after the public Project docs canon sync.
- Static output checks confirmed Project docs contain synced architecture layers, Kivatar boundary exclusions, decision IDs D-001 through D-006, deferred marketplace/no-code/devtools scope, roadmap sync status, and `docs/07_URK/` archive language.
- `corepack yarn workspace urk-examples build` passed under Node 22 with `vendor-three`, `vendor-react`, and `vendor-urk` chunks and no Vite chunk-size warning.
- `corepack yarn workspace @urk/www check` passed under Node 22 with `0 errors`, `0 warnings`, and `0 hints`.
- `corepack yarn workspace @urk/www build` passed under Node 22 after `@urk/examples` artifacts were present.
- `corepack yarn build` passed under Node 22 and did not emit the previous proof-workspace chunk-size warning.
- Generated-site internal link audit passed with `htmlFiles: 77` and `missing: []`.
- `npm pack --dry-run --json` passed for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Pack checks confirmed no raw `src/` in `@urk/core`, `@urk/adapters`, `@urk/react-urk`, or `@urk/next-urk`.
- Pack checks confirmed `@urk/cli` includes `src/templates/**` intentionally as scaffold assets.
- Release-hygiene inventory exists at `codex/RELEASE_HYGIENE.md` and separates intended source changes from generated/local-only output.
- `corepack yarn install --immutable` passed under Node 22 on 2026-05-22. It exited `0` with warnings only: one `@astrojs/language-server` peer warning for `typescript` and expected native rebuild notices for `esbuild` and `sharp`.
- Static untracked-file check found no generated `dist`, `.astro`, `.next`, or `node_modules` paths in `git ls-files -o --exclude-standard`.
- Release-candidate cleanup checks passed under Node 22 on 2026-05-23: `@urk/examples` build, `@urk/www` check, `@urk/www` build, and full workspace build.
- Publish dry-runs after cleanup passed for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Runtime and wrapper dry-runs after cleanup still exclude raw `src/`; `@urk/cli` still intentionally includes `src/templates/**`.
- Staged checks after cleanup confirmed `.yarn/install-state.gz` is not staged, generated/local-only artifact paths are not staged, no staged package export map contains `"default"`, and `git diff --cached --check` passed.
- Final staged release-candidate review found no blockers. The only noted risk was the intentionally large staged diff from public-site work and tracked zero-install cache archives.
- Commit-only readiness checks passed before commit: whitespace check, `.yarn/install-state.gz` staged check, generated/local artifact staged check, and staged `"default"` export-map check.

## Known issues

- Production readiness verification is complete, but this is not a deployment or npm publish claim.
- The release candidate is commit-only. It has not been versioned for npm release, tagged, pushed, published, or deployed.
- `.yarn/install-state.gz` remains intentionally unstaged; include it only if a later release-policy decision accepts Yarn install-state churn.
- Running `corepack yarn workspace @urk/www build` before `@urk/examples` artifacts exist can fail package entry resolution. Run `corepack yarn workspace @urk/examples build` first or use `corepack yarn build` for dependency-safe order.
- Running `corepack yarn workspace @urk/www check` without first selecting Node 22 fails because the default shell Node is `v18.17.1`; use `nvm use 22` first.
- `corepack yarn install --immutable` exits successfully but currently reports a peer warning: `@astrojs/language-server` does not provide `typescript` to `@volar/kit`.
- During dev-server smoke tests, rebuilding packages while Astro watches `dist/` can briefly produce Vite reload errors for missing transient files. The server recovers after the package build finishes.
- The in-app browser did not expose a viewport resize capability during the accessibility QA pass; mobile coverage was validated through generated/static CSS checks rather than a resized live browser viewport.
- Manual browser smoke routes were not rerun during the production readiness hardening pass because the source change was limited to proof-workspace Vite chunking and verification focused on build, package, and generated-link health.
- The worktree has substantial unrelated dirty state; do not revert unrelated files.

## Next recommended task

Recommended next scope is final release hygiene:

- Decide release versioning, changelog, npm publish, and site deploy steps.
- Keep the next task narrow and update `codex/SESSION_HANDOFF.md` before stopping.
- Do not add new runtime APIs, package exports, or new example scope without a new roadmap decision.

## Important decisions

- `@urk/examples` remains private, unstable, and website-consumed only.
- Runtime examples should use the existing `LiveURKExample` panels and data-role hooks unless a task explicitly requires a website UI change.
- Shared example utilities are acceptable when they remove real duplication across two or more examples.
- Public runtime APIs for `@urk/core`, `@urk/adapters`, React, and Next remain unchanged during example work.
- `apps/www` owns public routes and presentation; `packages/examples` owns private runtime island implementations.
- The embedded docs demo proves documentation-embedded runtime islands without making URK own Astro/Starlight rendering.
- Documentation status language should reflect the current eight runnable examples and reserve `planned` wording for future entries only.
- Accessibility polish should prefer durable semantics first: skip links, `aria-current`, grouped controls, progress/status ARIA, and readable responsive behavior before cosmetic changes.
- The playground MVP remains config-only and known-example-only; runtime execution should stay on dedicated example routes until a stable playground mount contract exists.
- Public Project docs are onboarding summaries of root canonical docs; root docs remain the source of truth and `docs/07_URK/` remains archive/reference material.
- The proof workspace may use manual vendor chunks because it is repo-only proof infrastructure, not a public runtime package surface.
- `examples/vite.config.ts` owns the `650 kB` warning limit for intentional private proof chunks; do not apply that threshold to publishable packages or the public website without a separate decision.
- `@urk/cli` may include `src/templates/**` in npm dry-runs because those template files are required scaffold inputs.
- `@urk/www` direct builds depend on `@urk/examples` build artifacts; prefer dependency-safe `corepack yarn build` or build `@urk/examples` first.
- `codex/RELEASE_HYGIENE.md` is the release staging inventory for the current dirty worktree.
- `corepack yarn install --immutable` passed under Node 22 with warnings only on 2026-05-22.
- Staged package export maps should not include `"default"` conditions for this release.
- `.yarn/install-state.gz` should remain unstaged for this release unless a later explicit policy decision changes that.
- Package versions stay unchanged for the commit-only release-candidate step: `@urk/core` `0.1.1`, `@urk/adapters` `0.1.3`, `@urk/react-urk` `0.1.0`, `@urk/next-urk` `0.1.0`, and `@urk/cli` `0.1.0`.
- The release-candidate commit message is `chore: prepare URK public release candidate`.

## Do not redo

- Do not re-promote `adapter-registration`; it is already current and runnable.
- Do not re-promote `controller-orchestration`; it is already current and runnable.
- Do not re-promote `runtime-state`; it is already current and runnable.
- Do not re-promote `event-routing`; it is already current and runnable.
- Do not re-promote `scene-ui-bridge`; it is already current and runnable.
- Do not re-promote `pointer-input-overlay`; it is already current and runnable.
- Do not re-promote `embedded-docs-demo`; it is already current and runnable.
- Do not redo the focused public-docs status audit; the targeted stale phrases are already cleaned up.
- Do not redo the focused public-site accessibility/responsive QA pass; shell, examples index, runtime panels, and progress semantics have already been covered.
- Do not redo the playground hardening pass; `/playground/` already validates known-example config and rejects custom code.
- Do not redo the public Project docs canon sync; architecture, boundary, decisions, deferred features, and roadmap pages are already updated.
- Do not redo the production readiness hardening pass unless the chunk warning, package contents, or generated-link audit regresses.
- Do not redo the release-hygiene inventory unless the dirty worktree changes materially.
- Do not redo the release-candidate cleanup unless staged export-map or install-state checks regress.
- Do not recreate the shared runtime-panel helper; it already exists and is used by current live examples.
- Do not move `packages/examples` out of `packages/`.
- Do not publish or document `@urk/examples` as a stable public npm API.
- Do not run publish dry-runs for private `@urk/examples` as if it were publishable.
- Do not re-add `"default"` export conditions without a separate package-export decision.
- Do not stage `.yarn/install-state.gz` without a separate release-policy decision.
- Do not change package versions, create tags, push, npm publish, or deploy the site as part of the commit-only release-candidate step.
- Do not remove the private Three.js proof or hide its imports to solve bundle noise; the current fix is scoped vendor chunking.
- Do not revert unrelated dirty workspace changes.
