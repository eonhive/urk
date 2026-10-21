# Audio release preparation

Updated: 2026-10-20. This records the local audio/motion integration candidate,
not a published release. Branch: `thehive/urk-audio-integration`, based directly on
motion commit `04ee90a837aa841dc5a733c34dac3663a0d4ba03` from
`thehive/urk-motion-v0.2.1`. Adapters remain `0.2.1`; Core and other runtime/tooling
packages remain `0.2.0`. No additional version change is made here. The base already
contains optional audio analysis; this changeset adds transport and example follow-ups.

## Public API and ownership

Import `AudioCapability` and `createAudioAdapter` from `@urk/adapters/audio`.
Playback keeps the existing track registration, native media elements, scoped
cleanup, and lazy optional `audio.analysis`. One transport owns one context and
active analyser when opted in; source nodes stay bound to their existing elements.

- Snapshots add `currentTime` and nullable `duration` in seconds. An unbounded
  duration can be `Infinity`. Native events publish progress without frame work.
- `seek(seconds)` validates an active source, metadata, and range. It preserves
  playing/paused state except a pending play, which is cancelled and left paused.
- `setSource(trackId, src)` reuses a registered element, selects it paused, stops
  prior playback, aborts replaced preloads, and clears its loaded cache. A stale
  play cannot restart it or rewind a newer seek. Callers own supplied object URLs.
- Mixer channels inherit these transport additions. Playback-only consumers
  continue to avoid Web Audio setup; analysis provides data rather than rendering.

The review also closes a preload cleanup gap: if native `load()` throws during
setup, temporary media/abort listeners are released before the rejection escapes.
See the [audio API](../packages/adapters/src/audio/README.md) and
[migration notes](MIGRATION_V02.md#audio-position-and-seeking).

## Private examples and distribution

| Surface | Role |
| --- | --- |
| `/audio-proof/analysis.html` and website Audio Lab | Shared plots/meters, optional Three scene, settings, local files, and runtime controls |
| `/audio-starter/` | Smaller Canvas widget, host-owned lifecycle, and independent-project exporter |
| Embedded Docs Demo and Astro docs guide | Optional widget beside motion in the existing kernel |

The private `@urk/examples/audio-widget` borrows the host runtime and registered
track. Its child scope releases controls and temporary frame work on removal;
the host owns final adapter/context disposal. One widget controls one transport.
Hosts should not hand that transport to another owner before widget teardown.
Local-file controls hold one object URL and revoke it on replacement/reset/removal.
Files are not uploaded or remembered. Hidden tabs/runtime pause stop sound and
returning never autoplays.

Visual response uses bounded gains for intensity and bass/mids/treble, leaving
measurements unchanged. Initial `reactions`, immutable `onReactionsChange` commits,
and copied `getReactionSettings()` values let hosts configure it. Opt-in host
memory validates a complete versioned record and saves only those four values on
committed changes. Forgetting preserves live values; Reset saves the baseline
when memory is enabled. Storage failures stay local. Docs audio remains local by
default. Reduced motion remains effective.

`scripts/create-audio-starter.mjs <new-directory>` copies widget sources, the
original synthetic study, and content-named Core/adapters archives. The resulting
project needs neither this repository nor the private examples package. See the
[starter guide](../examples/audio-starter/README.md) for embedding and hosting.

## Integration scope and review artifact

The audio selection has been refreshed onto the committed motion candidate. The
only patch conflict was appended validation history: motion release records are
preserved, followed by the earlier audio evidence and this integration's results.
Both widget exports, the Audio Lab/docs composition, starter routes, source
exporter, and content-named runtime archives use the same committed motion base.

The ignored `.codex/validation/audio-integration/` directory contains one
`audio-integration.patch`, a checksum manifest, a diffstat, and focused build logs.
The patch is relative to `04ee90a837aa841dc5a733c34dac3663a0d4ba03`; the manifest
pins its base, selected source tree, file hashes, and validation. No separate
historical motion patch needs to be applied to this base.

In a clean checkout of that commit:

```bash
git apply --check /absolute/path/to/audio-integration.patch
git apply /absolute/path/to/audio-integration.patch
```

The earlier `audio-changeset` patch remains historical evidence for the older
base-plus-motion-snapshot selection. It is not the integration patch. Global
theme changes, video/overlay extensions, newer onset/analysis-state work, and
the separate Media FX Lab remain excluded. The shared media settings helper is
included because Audio Lab uses the existing overlay API. Analysis is unchanged
from the committed motion base, and no Core or dependency changes are introduced.

## Validation and remaining release work

Use Node 22 and Yarn 3.8.7. The focused commands are:

```bash
corepack yarn install --immutable
node scripts/build.mjs @urk/examples @urk/react
corepack yarn typecheck
corepack yarn workspace urk-examples lint
corepack yarn workspace urk-examples build
corepack yarn workspace @urk/www check
corepack yarn workspace urk-examples dev
```

The integration's immutable install, focused shared builds, root/proof typechecks,
proof production build, and website diagnostics passed on 2026-10-20. Diagnostics
reported 44 files with zero errors/warnings/hints. A starter exported from these
builds also passed a fresh install and normal TypeScript/Vite build. The install
retains the existing language-server TypeScript peer warning. Generated tracked
install metadata was restored to the base and is excluded from the review diff.

The artifact manifest and [validation record](VALIDATION.md) distinguish these
results from earlier candidate checks. On 2026-10-20, the focused browser pass
confirmed:

- Demo and local WAV playback, seeking, source replacement, and one owned local
  URL across replacement, with zero remaining after reset or removal.
- Pending seek/source replacement cancellation using a controlled delayed native
  completion: stale requests reject with `AbortError`, remain paused, and do not
  rewind a later seek. The ignored diagnostic deliberately forces a late native
  start before releasing the result; this is a controlled race, not a codec matrix.
- Runtime pause/resume without autoplay; widget removal/remount with one reused
  AudioContext; final shutdown closing it; fresh startup remaining idle.
- Preference opt-in, committed save, reload restore, reset persistence, and forget
  preserving live settings while the next reload returns defaults. Memory was
  left off. No starter console warnings/errors were observed.

The in-app browser does not background a document when its surface is hidden or
another automated tab is opened. The hidden/visible policy passed simulated
`document.hidden`/`visibilitychange` controls, but **actual native tab background
and restore remains unverified**. Hardware audition, other codecs/browsers,
invalid/unavailable/quota-limited storage, retained-control callbacks after removal,
automated suites, website production build, and the full release matrix remain
outside this focused pass. See ignored `browser-results.json`, diagnostic controls,
final state, and the screenshot beside the integration manifest for evidence.

No runtime fix was required by these checks. The scoped audio commit and stacked
draft target `thehive/urk-motion-v0.2.1`, keeping the audio diff separate from its
unmerged motion prerequisite. Review that prerequisite and the integrated
scope/version before distribution. The development checkout and original motion
release checkout remain unchanged. No tag, package publication, or deployment is
part of this phase.
