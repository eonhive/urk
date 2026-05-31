# RELEASE_HYGIENE.md

## Status

Last reviewed: 2026-05-28.

This file records the dirty-worktree release inventory. It does not approve a publish or deployment by itself.

The release candidate was committed locally as `29ceb89 chore: prepare URK public release candidate`. The release-prep metadata commit gate is limited to the root changelog, public scoped-package publish metadata for the three unpublished packages, and codex release docs. It does not tag, push, publish, or deploy.

Npm publish execution was attempted on 2026-05-28 but blocked before publish because `npm whoami` returned `E401 Unauthorized` for `https://registry.npmjs.org/`. No package was published in that attempt.

Npm publish execution resumed on 2026-05-29 after auth succeeded as `stannesi`, but `npm publish --workspace @urk/react-urk --access public` was rejected with `E403` because npm requires two-factor authentication or a granular access token with 2FA bypass enabled. No package was published in that attempt.

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
- Npm registry status checked on 2026-05-25: `@urk/core` is published at `0.1.1`, `@urk/adapters` is published at `0.1.3`, and `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli` returned `E404` because they are not published yet.
- Release prep added root `CHANGELOG.md` and `publishConfig.access: "public"` to `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli` only. Package versions remain unchanged.
- Release-prep validation on 2026-05-25 passed: `git diff --check`, targeted builds for `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`, and `npm pack --dry-run --json --workspace` for those three packages.
- Release-prep pack results: React and Next wrapper tarballs contain README, package metadata, and built `dist/**` only; CLI tarball contains README, package metadata, built `dist/**`, and intentional `src/templates/**` scaffold assets.
- `.yarn/install-state.gz` remains modified but unstaged; the staged install-state check printed no paths during release-prep validation.
- Release-prep commit gate on 2026-05-27 stages only `CHANGELOG.md`, `packages/react-urk/package.json`, `packages/next-urk/package.json`, `packages/cli/package.json`, `codex/RELEASE_HYGIENE.md`, `codex/PLANS.md`, and `codex/SESSION_HANDOFF.md`, then commits with `chore: prepare URK public package release metadata`.
- Npm publish preflight on 2026-05-28 confirmed registry `https://registry.npmjs.org/`, `@urk/core@0.1.1` and `@urk/adapters@0.1.3` already published, and `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli` still returning `E404`.
- Publish-target validation on 2026-05-28 passed again for `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`: targeted builds passed and `npm pack --dry-run --json --workspace` passed for all three.
- Npm publish preflight on 2026-05-29 confirmed auth as `stannesi`, registry `https://registry.npmjs.org/`, and `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli` still returning `E404`.
- Publish-target validation on 2026-05-29 passed again for `@urk/react-urk`, `@urk/next-urk`, and `@urk/cli`: targeted builds passed and `npm pack --dry-run --json --workspace` passed for all three.
- Publish attempt on 2026-05-29 was blocked at `@urk/react-urk` with npm `E403` requiring two-factor authentication. No package upload completed.

## Remaining release blockers

- Provide a current npm one-time password or use a granular publish token with 2FA bypass enabled before publish execution.
- Publish `@urk/react-urk@0.1.0`, `@urk/next-urk@0.1.0`, and `@urk/cli@0.1.0` only after an explicit npm publish decision.
- Decide public site deploy target and environment before deploying `apps/www`.
- Do not publish private `@urk/examples`.

## Do not redo

- Do not redo public example promotion, public-docs status audit, public-site accessibility QA, playground hardening, Project docs canon sync, or production readiness hardening unless a validation check regresses.
- Do not remove the private Three.js proof or hide imports to solve bundle noise; the current fix is scoped vendor chunking.
- Do not move `packages/examples` out of `packages/`.
- Do not document `@urk/examples` as a stable public npm API.
- Do not re-add `"default"` export conditions without a separate package-export decision.
- Do not stage `.yarn/install-state.gz` without a separate release-policy decision.
- Do not republish `@urk/core@0.1.1` or `@urk/adapters@0.1.3` in the unpublished-package release step.
