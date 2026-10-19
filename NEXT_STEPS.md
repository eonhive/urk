# Next Steps

The motion release candidate is `@urk/adapters@0.2.1` on
`thehive/urk-motion-v0.2.1`. Core remains `0.2.0`; existing peers and entrypoints
stay compatible. See [release notes](docs/MOTION_RELEASE.md) for scope and the
required migration away from routine custom `motion.advance(...)` calls.

Before a tag or publication, run the existing CI/release gates on this branch,
including browser integration and website checks. The focused candidate checks
and their limits are recorded in [validation](docs/VALIDATION.md).

The development checkout's newer audio/video, managed overlay, and media-stage
integration work needs separate review and commits. Keep it outside the motion
release until its own dependency and browser checks pass. No publication,
deployment, or additional runtime subsystem is part of this candidate.
