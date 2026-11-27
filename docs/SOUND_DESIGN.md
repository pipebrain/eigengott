# Sound design and deferred audio processing

Status: design only. The user explicitly requested **no audio effects** for the separate playable milestone on 2026-11-26. Supplied recordings remain authoritative placeholders; sound design belongs to the user.

## Current playable milestone

Files: `playable-test/assets/ambient-loop.wav` (28.794490 s), `warn-loop.wav` (7.168594 s), `death.wav` (4.181497 s). They are original stereo 44,100 Hz / 16-bit PCM files copied byte-for-byte from the user's Downloads folder.

Ambient plays during combat. During equipment selection, ambient and warning tracks loop at their original playback rate. Player death plays the one-shot death recording. Existing OpenArena combat/footstep cues remain raw sample playback in a bounded transient pool. Master volume/mute are the only signal-level controls. Playback rate stays 1.0, detune stays 0. No filters, reverb, distortion, compressor, synthesized transition cues, stretching, rate automation or pitch processing is applied. The gameplay slow-motion control never changes audio speed. User interaction unlocks Web Audio; pause, page hiding, cancellation and reset stop sources safely.

The simulation is authoritative. Audio playback does not decide when Collapse, Return or shared Release occur. Debug status counts down to Release. The placeholder warning loop does not yet implement an authored escalating musical countdown, nor are its loop seams assumed to be finished.

## Deferred proposal: stretched playback returning to normal

Two distinct implementations are possible:

1. **Varispeed:** native Web Audio `AudioBufferSourceNode.playbackRate`, for example 0.50 to 1.00. Slow playback lowers pitch; the ramp returns both duration rate and pitch to their recorded values. Schedule AudioParam changes against AudioContext time. Expose starting rate, target rate, ramp duration/curve and loop boundaries in development controls.
2. **Pitch-preserving time stretch:** a dedicated bounded DSP implementation, potentially Rust/WASM in AudioWorklet. This is additional processing, not a property of the present buffer source. It requires listening tests for artifacts, CPU/latency budgets and cancellation/recovery tests. No particular algorithm or dependency is selected.

A future normalized intermission progression can drive the chosen audio envelope, maze corruption and feedback stretch together. Do not restart the deadline when the equipment interface is reopened. Define behavior for pause, hiding, interrupted audio, checkpoints and changes to intermission duration. Loop crossfades and authored musical transition points are also future sound-design decisions.

This proposal is **not enabled or implemented** in the playable milestone. Await a later explicit request before adding audio effects.

References: [Web Audio buffer sources and playback rate](https://www.w3.org/TR/webaudio/#AudioBufferSourceNode), [AudioWorklet](https://www.w3.org/TR/webaudio/#AudioWorklet).

## Standalone procedural auditions — 2026-11-27

The user authorized generating previews separately before integrating them. `audio-previews/` contains original/A/B listening controls and six procedural candidates derived from the recordings' envelope and spectral statistics. The offline generator, output levels, source hashes and reproduction notes are included there. See [audio preview notes](../audio-previews/README.md) and [listen on Pages](https://pipebrain.github.io/eigengott/audio-previews/).

These previews do not replace any runtime file. The game continues playing the original placeholders at rate 1.0 and detune 0 with no DSP effects. Selecting an audition and any later in-engine processing remain separate user decisions.

## Approved gain crossfade — 2026-11-27

For the falling-void playable revision, the user authorized aggressive crossfading of the original ambient and warning placeholders. Use a 180 ms gain envelope in each direction; keep loop source continuity across Collapse/Release, playback rate 1 and detune 0. This narrowly supersedes the former prohibition on all envelopes. No time stretching, ramped playback speed, filters, pitch changes or generated auditions are integrated. The deferred stretching/ramping design above remains a proposal.


## Approved positional wave cues — 2026-11-27

The user explicitly approved OpenArena transition/energy samples for the restored sector waves. The playable test copies original `world/teleout.wav`, `world/telein.wav` and `items/respawn1.wav` without modifying the recordings. Deletion/insertion/release events place them at actual world coordinates with listener-relative HRTF panning and distance attenuation. Cap at eight wave voices, throttle dense sector events to 55 ms and cancel stale playback across pause/reset/recovery. H controls wave enablement and gain. This adds spatial playback only; it does not authorize processing the user's placeholders or integrating procedural auditions. Source inputs, hashes and GPL notices accompany [wave audio](../playable-test/licenses/wave-audio.json).
