# Video Proof

Build `@urk/examples`, then run `corepack yarn workspace urk-examples dev` and
open `/video-proof/`. The website shares the same controller at
`/examples/video-proof/`.

Two players demonstrate playback, pause/stop, seek, volume/mute, speed, looping,
native captions, local files, explicit experience pause, diagnostics, disposal,
and fresh-kernel recovery. Nothing autoplays and local files are never uploaded.
The Orbit sample is silent; volume/mute also work on videos with sound.

The original Orbit animation, poster, and caption text were created for this
repository by EonHive Inc. No external media is bundled. `generate-sample.swift` reproduces the eight-second H.264 MP4
with macOS AVFoundation; it is an optional asset-generation tool, not a build or
runtime dependency. Copy its output into both hosts' `public/video/orbit.mp4`.
The two host assets must remain byte-identical.

The adapter preserves borrowed nodes/sources. This controller owns the nodes,
source URLs, captions, and UI, and releases them explicitly through its scope.
There is no polling or empty controller update hook.
