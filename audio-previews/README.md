# Procedural audio auditions

[Listen and download](https://pipebrain.github.io/eigengott/audio-previews/)

Six standalone WAV auditions: A/B alternatives for ambient, warning and death. **None is integrated into gameplay.** The playable test continues using the user's original recordings unchanged.

The offline generator analyzes each reference's amplitude envelope, logarithmic spectral bands and prominent frequencies, then synthesizes new oscillators and shaped noise. A emphasizes resonant modes; B emphasizes broken noise/pulses. Ambient and warning are loop auditions; death uses a shorter one-shot attack/decay. These are candidates for listening and selection, not a claim of finished sound design or a perceptual match established by automated tests.

Files are stereo 48 kHz / 16-bit PCM, conservatively normalized with no clipped samples, low DC and zero endpoint jumps. The page provides original/A/B comparisons, one-at-a-time native playback, Stop and WAV downloads. Audio is not preloaded or autoplayed. Source hashes and analysis parameters are recorded in `assets/manifest.json`.

Reproduce offline with Python and NumPy (the exact installed version is recorded in the manifest):

```sh
python audio-previews/tools/generate.py
node audio-previews/tools/check-audio.mjs
node audio-previews/tools/check-browser.mjs
```

The generator reads the unchanged reference recordings from `playable-test/assets/`. Runtime playback needs no NumPy or synthesis engine. The generator and auditions are separate from the deferred in-engine stretching/ramping design in [SOUND_DESIGN.md](../docs/SOUND_DESIGN.md). Integration waits for the user's choice.
