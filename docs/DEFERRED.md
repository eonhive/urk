# Deferred after URK v0.2

The working v0.2 implementation includes lifecycle/ownership, typed adapter and borrowed-service lookup, dependency planning, auto frame scheduling, diagnostics, framework hosts, and the shared experience. The following need independent evidence or contracts:

- Per-dependency immediate startup beyond the implemented parallel batches: measure real application startup before adding a more complex scheduler.
- Forced cancellation or shutdown timeouts: arbitrary hooks remain cooperative. Unresolved owned work must not be reported as completed cleanup.
- Automatic controller hot swapping: membership grows after successful startup; disposal remains terminal. Removal/replacement needs its own concurrency and frame-boundary contract.
- Compiler, bundler, or package-manager migration: retain Node 22, Yarn, and the existing tools until comparable cold/warm measurements justify a change.
- Historical performance comparisons and broad allocation/heap/GPU budgets: the current measurement compares frame modes within v0.2, not an old release. Browser resource checks are not a complete profiler report.
- Diagnostics packaging split: observation is lazy, but its compatible facade remains part of core.
- New rendering engines, ECS, physics, marketplaces, product identity, monetization, editors, workers, or a wider framework matrix: outside this runtime release.

Package publication, deployment, and creating a release tag are external release actions; changing local manifests does not perform them.
