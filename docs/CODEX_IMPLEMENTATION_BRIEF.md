# Codex implementation brief: URK v0.2

Read URK_V02_ARCHITECTURE_AND_PLAN.md as the proposed design. Work against the actual current checkout, not an assumed historical revision. The review baseline was 94b654c107ff6fbe2e554fc81c093d4372cdb001.

## Task

Improve URK incrementally while retaining standalone-first behavior, adapters, controllers, explicit state, existing public package names, and thin downstream wrappers. Implement reviewable changes in the sequence below. Do not interpret the entire roadmap as permission for a single massive rewrite.

## Before changing code

Read README.md, docs/BOUNDARY.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/IMPLEMENTATION_PLAN.md, public package manifests/exports, core types, kernel lifecycle, registries, scheduler, inspector, React provider/hooks, Next wrapper, and representative adapters/examples.

Record actual commands and results. Echo-only tests/lint are placeholders, not successful validation. Do not overwrite uncommitted user changes. Keep working changes scoped; do not push or publish without the surrounding task's authorization.

## First implementation slice

1. Add a deterministic scheduler/test harness and characterize the public lifecycle.
2. Reproduce concurrent boot completion, shutdown during async setup/start, concurrent shutdown completion, updates before controller startup, and stop/start within one frame callback.
3. Fix shared lifecycle completion, immediate shutdown cancellation/guards, started-only activation, and scheduler generation safety.
4. Add partial-initialization ownership/rollback tests and the smallest ResourceScope implementation required to make them pass.
5. Reserve adapter IDs/capabilities before asynchronous setup. Prevent late publication after cancellation.
6. Keep the kernel usable through the existing public factory/method/import shapes. Document intentional behavior fixes.

Do not begin with token migration, removing Next, moving every example, changing package managers, upgrading all toolchains, or parallelizing adapter startup.

## Follow-on slices

- Lazy diagnostics with explicit detach/disposal, revisioned immutable snapshots, and no Date.now() identity logic.
- Active update membership at defined frame boundaries; preserve receivers/arguments/order.
- Explicit wrapper ownership and lifecycle replay/unmount tests.
- Add typed lookup and lifecycle observation APIs with guarded legacy compatibility paths.
- Add independently importable adapter subpaths and clean packed-package fixtures, including DOM-only installation without Three.js.
- Prove one shared experience in standalone/React/Next hosts; collect repeatable performance baselines.
- Improve dependency-aware builds separately; evaluate compiler/bundler/package-manager changes independently.

## Non-negotiable contracts

Disposed is terminal. Concurrent callers await complete operations. Shutdown interrupts boot rather than waiting behind it before signaling cancellation. Setup cancellation is cooperative: prevent late activation and report unresolved cleanup honestly.

Each registered owned acquisition has one cleanup owner. Borrowed resources survive shutdown. Cleanup continues after individual failures and preserves the initiating failure. Legacy disposers and scopes must not double-dispose the same resource.

Only successfully started controllers update. At most one kernel-owned frame request is outstanding. No new activation or scheduling begins after disposal intent. A controller/observer exception must not prevent best-effort cleanup or create recursive error dispatch.

Keep operational lifecycle separate from application flow without pretending the old phases map one-to-one. Preserve legacy notification timing and APIs where feasible; test any intentional migration differences.

Snapshots are cached immutable values with revisions. Diagnostics retain bounded metadata, not arbitrary live resource graphs. Do not claim zero bundle overhead merely because observation is lazy.

## Required output for each slice

Provide a change summary, exact files changed, tests added, commands run and their real outcomes, compatibility effects, remaining risks, and the next small change. Clearly distinguish implemented behavior from the remaining proposal. Include before/after measurements only when actually measured in comparable environments.

Stop after a coherent reviewable slice when that is the execution task's scope. Do not mark the entire roadmap complete because unit tests for one subsystem pass.
