# Next Steps

The audio/motion integration candidate is on `thehive/urk-audio-integration`,
based on motion release commit `04ee90a837aa841dc5a733c34dac3663a0d4ba03`.
Adapters remain `0.2.1` and Core `0.2.0`; package peers and entrypoints are unchanged.
The original `thehive/urk-motion-v0.2.1` branch remains separate. See
[audio integration notes](docs/AUDIO_RELEASE.md) for the refreshed scope and diff.

The integrated source includes native position/seek, source replacement, the
shared Canvas widget, local files, reaction tuning and opt-in host memory, Audio
Lab/docs composition, and the independent audio starter/exporter. Validation
history from both candidates is retained. The refreshed patch applies directly
to the committed motion candidate, without the old motion snapshot prerequisite.

Focused builds/typechecks and the four browser flows are recorded in
[validation](docs/VALIDATION.md). Playback, local-source replacement/seek races,
widget removal/remount, URL/context cleanup, and preference save/restore/reset/
forget passed. The hidden/visible policy passed simulated controls; actual native
tab background/restore remains to be checked in a normal browser. Storage failure
modes, additional codecs/browsers, and the broader release gates are still open.
No runtime fix or new automated suite was needed for this browser pass.

The audio branch is prepared as a scoped commit and stacked draft against the
unmerged `thehive/urk-motion-v0.2.1` prerequisite. Review/land motion first, then
review the audio follow-ups before distribution. Adapters remain `0.2.1` and Core
`0.2.0`; no further version change is proposed here.

The development checkout's onset/state extensions, Media FX Lab, theme redesign,
video, overlay, and media-stage work remain outside this integration. Publication,
deployment, and additional runtime subsystems are deferred.
