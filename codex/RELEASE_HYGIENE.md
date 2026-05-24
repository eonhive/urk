# RELEASE_HYGIENE.md

## Status

Last reviewed: 2026-05-23.

This file records the dirty-worktree release inventory. It does not approve a publish or deployment by itself.

The final staged review found no blockers. The selected release action is commit-only: create a local release-candidate commit, keep package versions unchanged, and do not tag, push, publish, or deploy in this step.

## Release-intended source changes

- Root package/workspace policy: `package.json`, `tsconfig.json`, `.gitignore`, `.nvmrc`, `.yarnrc.yml`, and `yarn.lock`.
- Public website workspace: `apps/www/package.json`, `apps/www/astro.config.mjs`, `apps/www/tsconfig.json`, `apps/www/public/**`, and `apps/www/src/**`.
- Private website example package: `packages/examples/package.json`, `packages/examples/tsconfig.json`, and `packages/examples/src/**`.
- Publishable CLI workspace: `packages/cli/package.json`, `packages/cli/README.md`, `packages/cli/tsconfig.json`, and `packages/cli/src/**`.
- Publish hygiene metadata: `packages/core/package.json`, `packages/adapters/package.json`, `packages/react-urk/package.json`, and `packages/next-urk/package.json`.
- Canonical docs and readiness docs: `README.md`, `DEVELOPMENT.md`, `BUILD_STATUS.md`, `docs/EXAMPLES.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/DOCUMENTATION_IA.md`, `docs/PUBLIC_SITE_PLAN.md`, `docs/UI_UX_SYSTEM.md`, `codex/PLANS.md`, `codex/SESSION_HANDOFF.md`, and this file.
- Private proof workspace updates: `examples/index.html`, `examples/main.ts`, `examples/styles.css`, and `examples/vite.config.ts`.

## Explicit staging decisions

- Stage `.pnp.cjs` and `.pnp.loader.mjs` deletions with `.yarnrc.yml` because the repo now uses Yarn `nodeLinker: node-modules`.
- Stage `.nvmrc` because the repo policy is Node `22`.
- Stage `.yarn/cache/*.zip` archives that correspond to the current `yarn.lock`, because this repo intentionally tracks zero-install cache artifacts.
- Keep `.yarn/install-state.gz` unstaged unless a later release-policy decision explicitly accepts Yarn install-state churn.
- Keep package export maps stable; the staged-review cleanup removed unintended `"default"` export conditions.
- Do not stage generated website or proof output unless a release decision explicitly changes the repo policy.

## Generated or local-only artifacts

- `apps/www/.astro/**` is generated Astro metadata and ignored.
- `apps/www/dist/**` is generated website output and ignored.
- `apps/next-proof/.next/**` is generated Next output and ignored.
- `examples/dist/**` is generated proof-workspace output and ignored.
- `packages/*/dist/**` is generated package output and ignored unless a package-specific publish policy changes.
- `node_modules/**` under any workspace is install output and ignored.
- `.DS_Store` and `.codex/**` are local-only and ignored.

## Current validation baseline

- `corepack yarn install --immutable` passed under Node 22 on 2026-05-22. It exited `0` with warnings only: one `@astrojs/language-server` peer warning for `typescript` and expected native rebuild notices for `esbuild` and `sharp`.
- `corepack yarn workspace urk-examples build` passed under Node 22 with no Vite chunk-size warning.
- `corepack yarn workspace @urk/www check` passed under Node 22 with `0 errors`, `0 warnings`, and `0 hints`.
- `corepack yarn workspace @urk/www build` passed under Node 22 after `@urk/examples` artifacts were present.
- `corepack yarn build` passed under Node 22 with no proof-workspace chunk warning.
- `npm pack --dry-run --json` passed for `@urk/core`, `@urk/adapters`, `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`.
- Generated-site internal link audit over `apps/www/dist` passed with `missing: []`.
- Static untracked-file check found no generated `dist`, `.astro`, `.next`, or `node_modules` paths in `git ls-files -o --exclude-standard`.
- Release-candidate cleanup reran `corepack yarn workspace @urk/examples build`, `corepack yarn workspace @urk/www check`, `corepack yarn workspace @urk/www build`, `corepack yarn build`, and publish dry-runs for the five publishable packages under Node 22 on 2026-05-23; all passed.
- Staged hygiene checks after cleanup passed: `.yarn/install-state.gz` was not staged, generated/local-only paths were not staged, no staged package export map contains `"default"`, and `git diff --cached --check` exited cleanly.
- Final staged release-candidate review passed on 2026-05-23. No blockers were found; the only noted risk is the large intentional staged diff from public-site work and tracked zero-install cache archives.
- Commit-only decision: preserve current package versions (`@urk/core` `0.1.1`, `@urk/adapters` `0.1.3`, `@urk/react-urk` `0.1.0`, `@urk/next-urk` `0.1.0`, and `@urk/cli` `0.1.0`) and commit with `chore: prepare URK public release candidate`.

## Remaining release blockers

- Decide versioning, changelog, npm publish, and site deploy steps after the local release-candidate commit.
- Do not publish private `@urk/examples`.

## Do not redo

- Do not redo public example promotion, public-docs status audit, public-site accessibility QA, playground hardening, Project docs canon sync, or production readiness hardening unless a validation check regresses.
- Do not remove the private Three.js proof or hide imports to solve bundle noise; the current fix is scoped vendor chunking.
- Do not move `packages/examples` out of `packages/`.
- Do not document `@urk/examples` as a stable public npm API.
- Do not re-add `"default"` export conditions without a separate package-export decision.
- Do not stage `.yarn/install-state.gz` without a separate release-policy decision.
