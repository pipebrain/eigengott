# Level generator → v0.1.6 acoustic contract

This is a data/query handoff for the separate basic 3D audio engine. It creates no audio context, media, fixtures or world meshes. The user confirmed **three room→corridor→room stages** by default and **four or fewer wall echoes** per room.

## Package and identity

Schema-3 level packages expose `package.acoustics`. The acoustic schema is independently versioned (`schema: 1`), with map-local IDs `room:N` and `corridor:N`. Recreate the acoustic runtime whenever a validated world activates. Do not carry caches or delayed events into another seed, geometry hash or generator version just because an ID such as `room:0` still exists.

- `nodes`: kind, owner ID, label, XYZ anchor, footprint, navigation target and at most four reflection walls.
- `edges`: reciprocal room/corridor connections, portal index, positive navigation-path distance in metres and half-corridor attenuation in dB. These do not connect rooms through closed walls.
- `portals`: inset approach anchors for panning incoming sound. These are not door polygons or an operable-door implementation.
- `precomputed`: bounded propagation candidates for each source, destination and transition count under the default cap.
- `elevation`, `polygons`: point ownership excludes post/core solids, space below floors and space above ceilings.

Coordinates are engine **[x, y, z] in metres, z up**. Existing Web Audio coordinates map to **[x, z, -y]**.

## Query

```js
import {createAcousticRuntime, locateAcousticNode}
  from '../level-generator/acoustics.js';

// Build once on validated-world activation, not for each sound or audio frame.
const graph = levelPackage.acoustics;
const acoustics = createAcousticRuntime(graph);

const sourceNode = locateAcousticNode(graph, sourceXYZ);
const listenerNode = locateAcousticNode(graph, listenerXYZ);
const travel = acoustics.evaluate({
  sourceNode, listenerNode,
  sourcePosition: sourceXYZ, listenerPosition: listenerXYZ,
  maxStages: 3,
  referenceDistance: 1, // Saturates inside this distance; mixer may tune it.
});

if (travel.audible) {
  // Absolute transmission amplitude; multiply by the event's own source gain.
  gainNode.gain.value = sourceGain * travel.gain;
  // Use travel.entryPosition for incoming direction around room connections.
  // Optional propagation delay: travel.delaySeconds from emission time.
  // Allocate at most travel.reflections.length <= 4 parallel early-echo taps.
}
```

A stage is two graph edges, so the default cap is **six transitions**. Source and listener may be rooms or corridors. Zero stages confines a sound to its source node. Runtime queries permit integer stage limits 0–8; the inspection UI exposes 0–4. Unknown nodes and destinations beyond the cap return `audible: false`. Invalid limits/positions/reference distance throw an error.

## Falloff, loss and early echoes

For path distance `d`, reference distance `r`, and total corridor loss `L` dB:

```text
energyGain = (r / max(r, d))² × 10^(-L/10)
gain       = sqrt(energyGain)
delay      = d / 343 seconds
```

This is inverse-square **energy/intensity** falloff. Playback amplitude follows its square root; it is not another square-law multiplier. Each half traversal to/from a corridor anchor costs 3 dB, giving 6 dB for room→corridor→room. These are explicit prototype defaults, not measured material absorption. Tune `referenceDistance` and per-event source gain in the mixer. Avoid applying PannerNode attenuation again: for example retain spatial panning while setting `rolloffFactor = 0`. The Web Audio specification defines separate panner distance gain, so applying both would duplicate attenuation. [Web Audio distance models](https://www.w3.org/TR/webaudio/#enumdef-distancemodeltype).

A room retains at most one real finite wall span per cardinal side. The image-source calculation verifies that the reflection hits that span, between its floor and ceiling, and that both planar legs remain in free space around posts/cores. Returned reflection gains are absolute path amplitudes, including corridor loss and the prototype wall energy reflectance of 0.35. Their delays are absolute from emission time. Do not multiply them by `travel.gain` a second time. Corridors return no reflection taps. There is no feedback, recursive reflection, floor/ceiling reflection or diffuse reverb tail.

## Performance and approximation

Propagation uses dynamic programming over **(node, hop count)**. For `N` acoustic nodes and `H = 2 × stages` transitions, state storage is bounded by `N × (H + 1)`; expansion is bounded by that count and bounded graph degree. Cycles cannot create an exponential path flood or repeated energy summation. The default tables are baked into qualified packages; configurable-cap results are cached within a finite node/configuration budget. Each query examines at most `H + 1` candidates and up to four reflection spans.

The mixer still needs its own source/voice cap and a bounded update cadence. This module is not an audio-thread ray tracer. Point ownership and reflection occlusion inspect polygon boundaries; call them at controlled event/update times. Reflection and path work should not be inserted unbounded into audio callbacks. [Steam Audio simulation scheduling guidance](https://valvesoftware.github.io/steam-audio/doc/capi/simulation.html).

This is a lumped room/corridor model: inter-node distances follow valid navigation routes and intranode position offsets are approximate. It chooses one strongest bounded path rather than mixing all loop paths. It does not model physical diffraction, frequency-dependent absorption, moving doors, full 3D ray acoustics or detailed reverberation around a donut core. Room geometry, posts, slopes, risers and ceilings remain structural blockout. Actual v0.1.6 playback, listening calibration and physical-device audio acceptance belong to that engine's integration checks.

## Verification

`node level-generator/tools/check-acoustics.mjs` verifies a chain with an exactly known three-stage cutoff, cycle/state/cache bounds, inverse-square energy ratios, dB conversion, travel delays, four analytically known image-source reflections, generated graph incidence and ownership, and reflection energy below the arriving direct signal. The regular generator checks also validate the acoustic graph in every qualified candidate and reproduce it from each catalogue seed.

## Viewer audition and native mixer

The generator viewer now reuses the v0.1.6 `Audio`/`SpatialAudio` modules for **Enable sound** and **Sound at selected destination**. Its `AcousticRouter` accepts this schema through `acousticSceneFromContract`. The mixer keeps its own softened distance curve, maximum distance, voice/echo budget and optional late reverb. These native playback gains/reflections are an approximation and are not bit-for-bit results of the pure generator query above. The graph overlay shows topological reach; audible output also depends on the mixer's distance, gain and voice culling. No new world geometry or audio fixtures are added.
