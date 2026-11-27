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
