# @urk/next-proof

Standalone Next 14 App Router proof for validating `@urk/next-urk`.

This proof keeps scope narrow:

- one App Router route at `/`
- one client-only proof shell
- one loading-focused controller path
- no `three`, `audio`, `storage`, or overlay-host timing

## Running locally

```bash
corepack yarn workspace @urk/next-proof dev
```

Then open `http://127.0.0.1:3002`.

## Acceptance checklist

1. Confirm the proof mounts and enters `loading`.
2. Confirm staged loading progress is monotonic.
3. Confirm the runtime reaches `ready`.
4. Confirm phase, reason, loading stage, progress, latest event, and frame count all render through the Next client proof.
5. Confirm the inspector panel shows runtime id, booted/disposed, scheduler state, total event count, and registry counts.
6. Confirm the recent-events panel updates from the inspector snapshot without manual refresh.
7. Click `Pause` and confirm the runtime enters `paused`, the visible frame count stops, and scheduler state flips to stopped.
8. Click `Resume` and confirm the runtime returns to `ready`, the frame count resumes, and scheduler state flips back to running.
9. Click `Shutdown` and confirm the controls disable and visible updates stop.
10. Reload the page and confirm a fresh kernel instance boots cleanly again.
11. Confirm the browser console shows no hydration warnings, client/server serialization warnings, or React maximum-depth/snapshot warnings.
