# Generator acoustics contract — M4 / v0.1.6 handoff

The independent blockout generator exports a data-only acoustic graph and structural sector cells. `level-generator/acoustics.js` owns bounded graph queries; `sector-sound.js` owns the listener work budgets and local samples. Native `playable-test/Audio` and `SpatialAudio` provide recording playback, HRTF and optional reverb. Their routing binding is optional; the current game retains its existing router.

## Confirmed decisions

- Three room→corridor→room stages by default, meaning six graph transitions; configurable to 0–8 stages.
- High resolution: **128 shared propagation/reflection work samples per update**, for sounds originating in the listener's current room.
- Low resolution: its own **128 external listener-sector/graph-state evaluations per update**. Same-corridor sounds use the coarse model. Changing listener room reclassifies active origins.
- Four or fewer finite structural wall spans per room for early echoes. Corridors damp propagation and create no wall echo taps.
- Door operation is automatic for every Self, with occupied closure blocked/reversed. Closed doors attenuate sound.
- These budgets are separate from PCM buffer size, active voice count and audio sample rate.

## Data

Packages use schema 4 and generator `m4.0`; the extended room/corridor acoustic contract retains `schema:1` for the existing adapter. Validate the enclosing package version before interpreting M4 fields.

- `nodes`: stable map-local `room:N` / `corridor:N` IDs, anchor XYZ, footprint, nav target and up to four finite wall spans.
- `edges`: reciprocal room/corridor edges with portal, validated navigation distance, 3 dB base loss and door IDs.
- `doors`: structural axis, threshold position, floor/top, width and closed loss. Runtime aperture/revision is supplied separately, never baked into a static LUT.
- `sectors`: semantic room height patches, safe/unsafe classification and hazard type.
- `cells`: actual disjoint structural partitions, polygon footprint, floor/ceiling plane and parent acoustic node. They include room sectors and corridor ramp/tread/landing cells.
- `polygons`, `boundary`, `elevation`: the same structural domain used for collision and navigation.
- `precomputed`: default-stage candidates without runtime door loss.

All distances are metres, x/y horizontal and z up. Web Audio uses `[x,z,-y]`. IDs are local to a map: discard events, cache and bindings when activating a replacement world.

## Runtime and doors

```js
const doors = createDoors(plan);
const runtime = createAcousticRuntime(graph, {doors});
const sound = createSectorSound(graph, runtime, {trace: structuralEngineRay});
// All actors' full collision bounds participate in door occupancy.
installDoors(sim, doors.update(dt, actors));
sound.emit('weapon-fire', muzzleXYZ);
// At a controlled 10 Hz cadence:
sound.update(listenerXYZ, monotonicSeconds, {maxStages: 3});
const travel = sound.route(sourceXYZ, {soundRooms: 3, soundDistance: 160});
```

A closed door adds 24 dB; opening reduces it linearly to zero in dB. Every aperture change invalidates graph caches. Endpoint corrections account for origins/listeners on either side of a door within a corridor. Bounded dynamic programming keeps nondominated distance/loss candidates per (node, transition count), capped at 32 labels; exceeding this cap rejects the query rather than growing without bound. Selection uses strongest arriving energy, permitting a longer open alternative to beat a short closed route.

For path distance `d`, reference distance `r = 1 m`, and combined loss `L`:

```text
energyGain = (r / max(r, d))² × 10^(-L/10)
playback amplitude = sqrt(energyGain)
propagation delay = d / 343 seconds
```

The panner uses zero rolloff to avoid applying distance falloff twice. Room/corridor anchor offsets remain a coarse path-distance approximation. The inspection graph can evaluate full bounded candidates; the live low-resolution listener pass may omit remote states when its independent 128-work budget is exhausted.

## Shared budgets and lifecycle

Each 10 Hz update advances at most 76 local ray samples, reserving work for finite wall reflections and direct occlusion checks. Every local early-wall test reserves three samples (image source and two 3D trace legs); a direct occlusion test reserves one. The sum cannot exceed 128 even across many sources. The local cache prevents repeated voices from charging the same origin twice during that update. Rays reflect from actual 3D surfaces, track current sector, decay with distance/reflection and retire after four bounces, low energy or leaving the listener room. A blocked local direct path receives an additional approximate 12 dB reduction; validated reflected paths remain available.

Low resolution first spends at most 96 evaluations on graph states from the listener. It spends the remaining budget on external sector/node evaluations, prioritizing active origins, with a hard total of 128. Remote playback consumes these prepared routes, without initiating an unbudgeted graph traversal. Omitted routes are silent until a later pass can admit them. The two budgets do not borrow from one another.

The event pool holds at most 64 events for at most two seconds. Eight initial ray directions per admitted event fit in a 512-wave pool. Overflow is counted and culled. The mixer independently keeps its existing 16 voices, four echo-enabled voices × four taps, and four shared reverb delay lines. Echoes and reverb do not emit new game noise events or recursively multiply graph paths.

## Diagnostic projectile

The blockout viewer's Test shot emits stock OpenArena rocket fire, travel and impact recordings without adding projectile meshes. A swept ray clips movement to the earliest structural/door hit. Segment intersections with every crossed sector boundary and floor/ceiling plane produce ordered entry events, so a fast projectile cannot skip sectors. Remaining within one sector does not create a new entry every physics tick. A wall hit emits an impact source just inside the free side. These hooks are isolated prototype behavior; full production weapon/AI-hearing integration is a later handoff.

## Verification and limits

`check-acoustics.mjs` checks exact stage cutoff, finite falloff, dB conversion, reflection geometry and ownership. `check-m4.mjs` checks closed/open door loss, automatic/no-crush traversal, both independent 128 caps under load, listener reclassification, expiry and high-speed sector crossings. Browser checks use a native audio gesture and confirm routed HRTF playback; they do not establish listening quality or physical-device acceptance.

This approximation omits material/frequency-dependent absorption, diffraction and a full acoustic wave equation. Room image-source spans are at most four cardinal walls; actual 3D leg traces reject steps, posts, cores, ceilings and doors that block those paths. Local sample rays inspect other surfaces, but are not a separate audible source per ray. Late reverb remains the native shared approximation. Tune mix, range and hazard/weapon audibility during play review.

## M5 door and sky extension

Schema-5 / `m5.0` packages add `openings`, describing collision-sealed windows, skylights and open-looking ceilings. `skyOpeningAt` identifies them at actual engine ray hits. Local rays terminate there and finite-wall echo paths hitting a window are rejected. No outside source/listener nodes are created. Room anchor height follows the actual centre-floor sector.

Door state changes emit start/finish per moving leaf for both open and close strokes. Full stroke time is 0.25 s. Original synthesized motor-onset and stop-thud buffers play through the existing HRTF mixer and voice cap. A bounded 64-cue queue expires after 0.25 s and is processed after normal propagation updates; it never resets or enlarges the 128/128 budgets to force a new sound through. Active external origins are prioritized, followed by nearby sector cells. Interrupted motion has no false finish event. Parked doors are silent.
