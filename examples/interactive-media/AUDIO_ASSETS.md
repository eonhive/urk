# Orbit sound assets

`orbit-explore.wav` and `orbit-create.wav` are original four-second synthesized chord loops. `orbit-guide.wav` contains the original text “Follow the signal. Choose what comes next.” synthesized with the eSpeak-NG English formant voice (no recorded speaker, voice cloning, or external recording).

`generate-audio.mjs` writes identical PCM WAV files into `examples/public/audio/` and `apps/www/public/audio/`. It uses `@echogarden/espeak-ng-emscripten` **0.3.5** as an optional generation-only tool. The tool is GPL-3.0 licensed; its source is at [espeak-ng-emscripten](https://github.com/echogarden-project/espeak-ng-emscripten). It is not a URK dependency and its code/data are not shipped in the runtime.

To regenerate, install the tool into a temporary directory, then pass its absolute `espeak-ng.js` path to `node examples/interactive-media/generate-audio.mjs`. Normal builds use the checked-in WAVs and need no speech tooling. Each host uses the same assets; the existing Orbit film stays silent to avoid duplicate soundtracks.
