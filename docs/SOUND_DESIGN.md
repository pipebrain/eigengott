# Sound design and deferred audio processing

Status: original placeholder processing remains gain-only. On 2026-11-27 the user authorized positional world audio, room/corridor damping, basic four-wall echo and reverb. The stretched playback proposal below remains deferred; supplied recordings remain authoritative placeholders.

## Current playable milestone

Files: `playable-test/assets/ambient-loop.wav` (28.794490 s), `warn-loop.wav` (7.168594 s), `death.wav` (4.181497 s). They are original stereo 44,100 Hz / 16-bit PCM files copied byte-for-byte from the user's Downloads folder.

Ambient plays during combat. During equipment selection, ambient and warning tracks loop at their original playback rate. Player death plays the one-shot death recording. The ambient/warning/player-death placeholder path uses gain controls only. OpenArena weapon, character, footstep and sector-wave samples now use the bounded spatial world-audio path described below. Playback rate stays 1.0 and detune stays 0 for all sources. No stretching, rate automation, distortion, compressor or procedural auditions are integrated. The gameplay slow-motion control never changes audio speed. User interaction unlocks Web Audio; pause, page hiding, cancellation and reset stop sources safely.

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

## Positional world acoustics

`playable-test/acoustics.js` supplies shared, serializable room/portal metadata and pure routing math. `spatial-audio.js` renders it with native Web Audio HRTF panners. World Z maps to audio Y; listener position, forward and up come from the actual 3D camera. Sample positions are world positions, rather than screen coordinates. Dry amplitude is `1 / sqrt(1 + (distance / 8)^2)`: finite at the listener, with intensity approaching inverse-square at distance. Panner distance rolloff is disabled to avoid attenuating twice.

The current gameplay generator derives connected sector-cluster nodes and real open-neighbor portals in its worker. Disconnected pieces inside a cluster become separate nodes. The standalone generator derives semantic room/hallway nodes and edge costs from its validated navigation LUT. Its data-only acoustic contract is accepted through an adapter that preserves portal positions, decibel transmission and declared reflection walls. The committed M2 generator can instead derive a compact scene at load time, including width-dependent corridor loss. The audio layer changes neither geometry nor qualified package formats. Both generators use the same router and renderer. No full audio ray tracing, per-triangle reflections, AAS integration or physically exact reverberation is claimed.

Paths are cached per listener node, settings and geometry-visibility revision. The nearest corridor portal determines where sound arrives; each room hop adds damping and low-pass absorption. Default limits are **three room hops and 120 world metres** (160 m for the generator audition). The search visits at most 64 node/hop states with at most 512 frontier entries; H permits 0–6 hops and 10–300 m. Beyond those limits, or without a connected path, sources are silent. During intentional Collapse/Return void exposure, disconnected/missing geometry permits direct spatial playback so the wave remains audible; distance/voice caps still apply.

Four image-source reflections use the listener room's outer X/Y wall planes, including their 3D source/listener heights. Early reflections have bounded 6–650 ms relative delays. The compact format uses four bounding wall planes; the generator contract uses its declared eligible wall segments (up to four). Both approximate complex geometry; cores, internal walls and exact height contours are represented by connectivity/costs rather than individual reflecting surfaces. Late reverb is a shared four-delay, damped-feedback network scaled by room size. No baked impulse responses or new sound assets are required.

Hard budgets: **16 spatial source voices, four echo-bearing voices / 16 reflection taps, four shared reverb delay lines**, and routing updates at 10 Hz while listener/panner pose follows rendering. The existing eight combat transient and eight wave-source limits also remain. Echo tails retain their reservation until cleanup; muted, hidden, stopped or destroyed engines disconnect sources and delay feedback. These are work budgets, not a universal browser audio-thread timing guarantee.

H groups spatial enable, echo/reverb toggles, room hops, maximum distance, corridor transmission, reflection mix and reverb mix. Acoustic settings are included in subsequent boundary checkpoints. The level-generator panel auditions a stock positional release cue at the selected room/hallway destination. Ambient/warning crossfades and the supplied player-death recording bypass this world-acoustic processing.

Verification: `check-acoustics.mjs` checks attenuation, corridor isolation/damping, range/hop/visibility limits, reflected paths, bounded searches, three game arena sizes and all stored generator packages. `check-spatial-browser.mjs` measures actual offline-rendered stereo channel energy, distance loss and late echo/reverb energy. `check-spawn-audio-browser.mjs` checks live accepted geometry replacement, audio limits, cleanup and immutable staged NPC positions. Headphone listening and physical-device acceptance remain user tests.

### Independent M4 generator binding

The generator viewer now supplies optional `SpatialAudio.scene` binding callbacks (`route`, `reflections`, `snapshot`) for its sector-aware routing. Existing game scenes continue through `AcousticRouter`. `Audio.media` accepts an optional fourth volume argument, defaulting to 1. M4's 128 local propagation/reflection samples and independent 128 external node/sector evaluations run at 10 Hz and remain separate from the native voice/tap limits. Its diagnostic shot emits stock fire, per-sector flight and impact sounds without meshes. See [LEVEL_GENERATOR_AUDIO.md](LEVEL_GENERATOR_AUDIO.md) for the contract and production handoff limits.
