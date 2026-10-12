# URK v0.2 performance evidence

Auto mode removes the kernel controller loop when there are no successfully started update controllers. Continuous mode retains the existing scheduling behavior. The shared event-driven experience runs with an idle frame loop in standalone, React, and Next; it remains interactive through adapter events.

## Reproduce the local dispatch measurement

Build core, then run:

```bash
node benchmarks/runtime.mjs
```

The script records Node/OS/CPU, repository HEAD, working-tree status, and protocol. It compares continuous and auto modes with 0/10/100/1000 no-op update controllers, 5,000 manual frame opportunities, two warmups, and seven measured runs. Output includes dispatched frames, median time, and maximum observed time. Diagnostics is off. This isolates manual scheduler/kernel dispatch rather than browser rendering or application work.

The recorded working-tree run is in [runtime-v02.json](../benchmarks/results/runtime-v02.json). With no update controllers, continuous mode dispatched 5,000 frames and auto dispatched **zero**. With active updaters, both modes dispatched the same 5,000 frames. Browser experience checks likewise observed zero kernel frames with actual event-driven interaction.

These are frame-mode comparisons within v0.2. There is no comparable historical v0.1 CPU baseline, allocation/GC evidence, GPU improvement, or general percentage speedup claim. Small timing differences are sensitive to JIT and background activity; they do not establish a release-wide speedup. Maximum samples are not tail-percentile estimates.

For a future release comparison, hold hardware, toolchain, workload, warmups, diagnostics mode, and background activity constant. Use a pinned clean revision for each candidate, repeated runs, medians and enough samples for tails. Record startup, dispatch, rendering, heap/resource trends, bundles, and cold/warm builds separately before setting budgets.

## Architecture refactor comparison — 2026-10-07

The saved before/after comparison is [architecture-v02.json](../benchmarks/results/architecture-v02.json). Both are local v0.2 builds on Node 22.22.2, Darwin 24.6.0, Apple M1. This compares this architecture refactor against the immediately preceding working tree, not a published historical release. SHA-256 digests identify each build's JavaScript. Raw samples are retained.

The same process alternates which build runs first, with three warmups and eleven measured runs per workload. Diagnostics are off. Fixture construction and cleanup are outside the timed region; startup includes the complete boot operation. Dispatch uses a manual scheduler and a counter in each active update callback. Lookup uses the common `ctx.require` facade and verifies its results.

| Workload | Before median | After median |
| --- | ---: | ---: |
| Boot 1,000 update controllers | 7.599 ms | 1.539 ms |
| Boot 5,000 update controllers | 144.463 ms | 7.667 ms |
| 10,000 frames × 1,000 active controllers | 41.189 ms | 41.862 ms |
| 10,000 frames × 10 active among 1,000 controllers | 0.414 ms | 0.397 ms |
| 1,000,000 typed lookups across 100 adapters | 42.758 ms | 36.464 ms |
| 1,000,000 alias lookups across 100 adapters | 45.322 ms | 29.555 ms |

Sequential startup now inserts one update entry per successful updater instead of scanning all registered controllers after every start. The startup improvement grows with controller count. Direct adapter indexing removes alias/token-to-ID indirection. Busy dispatch is **1.6% slower** in this run; no dispatch speedup is claimed. These microbenchmarks do not establish browser rendering, GPU, network, memory, small-application startup, or overall application speed gains. Maximums in the JSON are observations, not percentile estimates.

The active update plan uses one small entry per updater, containing its registration order, registration reference, and initialized context. This keeps lifecycle promises and flags out of frame traversal. Reverse-order concurrent startup can still shift entries; it is not claimed to have linear worst-case insertion cost.

Reproduce with the saved local baseline and current core build:

```bash
corepack yarn workspace @urk/core build
node benchmarks/architecture.mjs .codex/validation/architecture-before/dist packages/core/dist
```

The baseline directory is an ignored local artifact captured before this refactor. On another checkout, build and save both versions first, then pass their `dist` directories to the script. Do not substitute the older recorded frame-mode measurement for this baseline. The benchmark verifies update counts and lookup results, so skipped work cannot appear as a timing win.

## Package and browser bundle baseline — 2026-10-07

Run `corepack yarn build:runtime`, then `corepack yarn report:size`. The report uses the existing Vite 5.4.21 / esbuild toolchain, ES2020 output, minification, no source maps, gzip level 9, and Brotli quality 11. It imports built public package exports with no application config or source aliases. All five publishable packages are packed locally with scripts disabled; temporary archives are removed afterward.

The recorded baseline is [bundles-v02.json](../benchmarks/results/bundles-v02.json). Two consecutive measurements, separated by a complete workspace build, produced identical package sizes/integrities and bundle sizes/hashes.

| Browser fixture | Minified bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Core `createKernel` | 29,932 | 6,607 | 5,980 |
| Core + DOM adapter exports | 39,240 | 9,493 | 8,533 |
| Core + Three adapter exports, including Three.js | 525,831 | 132,011 | 109,477 |
| Core + React wrapper exports | 32,656 | 7,597 | 6,891 |
| Core + Next wrapper exports | 33,100 | 7,691 | 6,976 |

React/Next framework peers are external; the actual remaining imports are `react` and `react/jsx-runtime` in both wrapper fixtures. This does not estimate framework/application download size. The Next measurement is a browser-only fixture: bundling may strip its `use client` directives while the published package files retain them. Tree shaking differs with each application's imports, and the core inspector facade remains included where the kernel uses it.

| npm package | Archive bytes | Unpacked bytes |
| --- | ---: | ---: |
| `@urk/core` | 35,374 | 171,619 |
| `@urk/adapters` | 21,702 | 109,110 |
| `@urk/react-urk` | 6,586 | 22,395 |
| `@urk/next-urk` | 3,208 | 9,032 |
| `@urk/cli` | 49,144 | 213,421 |

Archive sizes include declarations, maps, package metadata, and the CLI's template files. They are not browser transfer sizes. The JSON includes package integrity values, bundle hashes, Node/npm/Yarn/Vite versions, lockfile hash, HEAD, and dirty-tree status so later comparisons can distinguish code and toolchain changes.

CI now produces and retains this report alongside browser diagnostics. No arbitrary size threshold is enforced from a single baseline. Representative diagnostics/event/adapter-start workloads, heap/GC evidence, build timing, and justified regression budgets remain outstanding.

## Release preparation baseline — 2026-10-11

The unchanged core was measured again with Node 22.22.2 on Apple M1 / Darwin 24.6.0. [Raw results](../benchmarks/results/runtime-brand-v02.json) now include complete boot timing, seven sorted raw boot/dispatch samples after two warmups, and a SHA-256 digest of the built core JavaScript. Construction and cleanup remain outside the boot interval. These no-op-controller measurements are not page-load, adapter-I/O, GPU, or historical-release comparisons.

Auto mode with no updaters again dispatched **zero** of 5,000 manual frame opportunities. With 1,000 no-op update controllers, the recorded auto-mode boot median was **1.831 ms**. Do not interpret cross-mode JIT/timing differences as a speedup.

The fresh [package/bundle report](../benchmarks/results/bundles-brand-v02.json) packs all five public packages at 0.2.0. Core is **33,163 minified / 7,267 gzip / 6,596 Brotli bytes** under the existing fixture protocol; Three and framework peer boundaries are unchanged. This updates the baseline to the merged lifecycle code, rather than attributing size changes since October 7 to the visual redesign. No regression budget or npm publication is implied.
