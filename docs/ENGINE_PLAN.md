# EIGENGOTT · approved engine direction

Status: the first separate [engine proof](../engine-test/README.md) is implemented on 2026-11-26. Its scope and validation results are recorded below. This plan incorporates the user's eight responses to the review of `eigengott_3d_engine_geometry_specification.md`. The supplied document is architectural input; the original game decisions remain authoritative where they differ.

## Gameplay contracts

1. **True first person.** The camera sees through the actual equipped body. Helmet construction affects visibility; the held weapon has its real world dimensions, obstruction, and clearance requirements. Preserve the body in the main view, with selective camera/head clipping where necessary. Reflections show that same body and equipment. Do not make the entire body reflection-only.
2. **Encounter transition: selected candidate 2 direction.** After an encounter resolves, a living corruption wave communicates the approaching arena transition without a numeric timer. The player may loot defeated selves during that window. The selected procedural direction uses an outward deletion sweep from the player's fixed starting XY, then inward reconstruction. Architecture changes discretely without moving or interpolation. Protected sector clumps contain the equipped body and weapon; transparent static fields respond when the player attempts to leave. Old bodies disappear with their deleted clumps; bodies in protected or other surviving clumps clear at final return. Looting ends only after reconstruction, when staged enemies and the player share one forcefield release. Old geometry may survive multiple waves. The final opponent's death takes precedence and follows the appropriate ending rather than an ordinary next-arena transition. Wave duration remains tunable; the completion boundary is fixed.
3. **Equipped inventory only.** One held gun with installed modifications and the armor currently worn. Equipment exchanges replace, install, or equip directly; there is no spare-item inventory. Fragment acquisition, lifetime, compatibility, and application to armor remain design questions from the original discussion, rather than new rules invented by the geometry implementation.
4. **Global progression.** Remaining selves and the original difficulty/progression model influence generation and arena-law selection. Reality becomes more coherent as selves disappear while combat difficulty escalates. Arena rolls must respect that convergence, rather than remaining equally chaotic throughout a run. Preserve death transfer, the looping bad ending, the deathless good ending, and the removal of scorekeeping.
5. **No gameplay HUD.** No crosshair, health/ammo counters, numerical countdown, or minimap. A hidden development menu and diagnostic overlays belong to the engine test harness. Equipment and damage cues remain physical, visual, or auditory in gameplay.

The first engine test need not implement combat or equipment, but its architecture must preserve these contracts.

## True 3D engine, sector-generated arenas

The engine renders and simulates a three-dimensional world. Two-dimensional sectors are procedural construction inputs: generate footprints, assign floor/ceiling and wall geometry, bind the sectors together, and produce the assembled 3D gameplay boundary and collision representation.

Generator restrictions are local to a generator. Do not impose an engine-wide rule that every XY coordinate can have only one traversable height interval. Future generators may construct multiple volumes at different heights, overhangs, or stacked spaces. The first room can remain geometrically simple.

Use simplified 3D structural collision hulls/planes, with oriented swept collision for moving bodies and raycasts in 3D. Decorative relief can remain noncolliding. Features that define a traversable space, support a player, provide structural cover, or materially constrain equipment require an appropriate physical representation. Wall padding alone does not guarantee floor, ceiling, camera, or weapon clearance.

Sector adjacency represents continuous openings within the assembled arena. An intentionally open connection between neighboring sectors is valid interior space; it is not an exterior leak or a traversal-portal mechanic.

## Candidate construction and activation

```text
seed + progression + arena rules
  -> generate 2D sector construction data
  -> construct and bind 3D structural geometry
  -> build collision and connectivity data
  -> validate the complete candidate
  -> stage rendering resources
  -> activate at a controlled simulation boundary
```

The current arena stays active while a candidate is generated and checked. Never replace it with a partially generated, invalid, or failed-upload candidate. On failure, preserve the current arena and report the failing seed and reason to development diagnostics; retry or use a known-valid fallback. Rendering, collision, and arena-law state must switch together.

Validation must cover:

- **Input and capacities:** finite coordinates, valid indices, nondegenerate convex construction polygons, valid plane parameters, and checked vertex/index/sector/edge/light/atlas capacities.
- **Sector binding:** reciprocal adjacency, matching shared-edge endpoints, compatible opening profiles, and correct risers/caps where adjacent floors or ceilings differ. Split or reject crossing profiles that the current generator cannot resolve safely.
- **Exterior seal:** after merging/removing internal interfaces, the assembled gameplay boundary has welded seams, consistent winding, no unmatched exterior edges, no T-junction cracks, and no nonmanifold boundary connections. Treat deliberate interior openings through their neighboring volume connectivity.
- **Geometric validity:** reject invalid face intersections, inverted or collapsed playable volumes, and floor/ceiling configurations that leave unintended openings. A topologically closed mesh alone is not sufficient proof of valid interior space.
- **Gameplay space:** verify connectivity, player headroom, passage width, reachable placement, and clearance for the movement profile and equipped dimensions relevant at activation. Leak freedom and traversability are separate checks.
- **Render/collision agreement:** gameplay walls, floors, ceilings, and openings agree with the collision representation. Decorative geometry cannot be used to hide structural leaks.

Define a consistent coordinate/welding tolerance and test it. Derive shared seams from canonical construction data instead of independently rounded endpoints. Deliberately punctured or mismatched candidates must be rejected while the active arena remains usable.

Valid start/end arenas do not prove a safe transition between them. The later fold/churn implementation needs its own swept-clearance and displacement checks, or a verified safe physical envelope during the visual effect. Nonlethal transitions must not accidentally force an unavoidable crush. Lethal arena rules require an explicit gameplay policy. The first test uses manual activation before attempting live churn.

## Architecture and visual directions to pursue

- Vanilla JS ES modules for browser I/O and raw WebGPU/WGSL rendering.
- Pursue freestanding Rust WASM with a small explicit C ABI, bounded buffers, and no runtime framework or generated binding layer. Preserve the existing C/WASM title runtime. Verify the Rust toolchain, panic strategy, math support, exports, and layout before engine work depends on them.
- Keep the host thin through clear modules, rather than a hard line-count ceiling that would compromise recovery or diagnostics.
- Explore strong horizontal/vertical symmetry, floor/ceiling inversion, and controlled faults. Apply reflected winding/normals correctly. Reserve the name D4h for the complete intended symmetry group, rather than assuming two axis reflections establish it.
- Pursue coarse nearest-sampled lightmaps, the constrained horror palette, optional dithering, procedural surface recipes, and curated authored surface tiles. Their parameters require visual tests. The title screen's black-and-white profile stays intact.
- Pursue in-place folding/churn around the persistent player state. Candidate arena graphs may be regenerated; an immutable XY partition for the entire game is not an engine requirement.
- Pursue arena physics modifiers and mirrors in later tests, with selection influenced by global progression and explicit performance limits.

## Hybrid 3D surface library

Preserve the supplied MD's hybrid library as an explicit engine direction: procedural architectural recipes and curated, authored low-poly tiles share a `SurfacePreset` system. These are actual 3D surface meshes applied to generated walls, floors, and ceilings.

### Assets and shared presets

- **Procedural recipes:** swept trim profiles, baseboards, cornices, stepped recesses, ribs, low-sided conduits, and wires. Recipes adapt continuous architecture to the generated surface dimensions.
- **Authored tiles:** industrial panels, pipe/valve clusters, lamp bays, grates, and gothic relief authored in a 3D editor. An offline `tools/pack_surfaces` step converts supported OBJ/glTF input into a compact, versioned `surfaces.bin` pack. Validate indices, semantic tags, bounds, and alignment when packing. No OBJ/glTF parsing is needed during gameplay. Verify aligned embedding or loading of the pack into WASM rather than assuming its byte-array alignment.
- **Common surface coordinates:** describe a tile in tangent-space `(u, v, n)`, with positive `n` toward the playable room and negative `n` recessed behind the structural plane. Store physical dimensions and placement constraints alongside its geometry.
- **`SurfacePreset`:** identify the procedural bottom/top trims, authored or generated middle bay, intended bay dimensions, material/palette roles, AO weights, permitted relief bounds, and local light emitters. A preset may freely combine procedural and authored pieces.
- **Semantic export data:** preserve roles such as palette slot, AO shade, and emissive cyan/red/amber. Transform local emitter positions into world-space light inputs when a preset is placed. Light count, atlas space, and bake work remain bounded and measured.

### Fitting the generated arena

Fit wall presets with fixed-size trim regions and repeating middle bays, using the MD's 9-slice/bay-subdivision approach. Preserve important feature proportions instead of stretching a complete tile indiscriminately. Sloped floors/ceilings require evaluating available wall height along the edge, rather than assuming one constant height.

For floors and ceilings, combine a perimeter treatment with a world-aligned interior tile grid clipped to the generated polygon. Reuse the corresponding presets for mirrored/inverted architecture while correcting transforms, normals, and winding.

Use mitered corner joins where appropriate, with explicit limits or bevel/corner-piece fallbacks for acute angles. Validate the transformed relief bounds and seams. Keep the structural gameplay boundary independently sealed beneath the dressing.

### Physical and lighting contracts

Most visual depth should recess behind the structural plane. The MD's outward-relief target of at most 0.15 m is an initial authoring constraint to verify, including the actual bounds after fitting and mitering. Derive any conservative collision padding from those bounds and check player/camera/weapon clearance against the complete 3D physical representation. Decorative surface complexity does not require per-triangle micro-collision; genuinely traversable or gameplay-blocking features require structural collision.

Relief inherits the parent surface's lightmap transform with bounded per-face/per-vertex AO. Preset emitters feed the coarse lighting bake. Preserve `relief_scale` retraction/extrusion as a later transition feature, with the structural coverage and degenerate-triangle checks described below.

Start the small engine test with one procedural preset. The authored packer and broader curated library follow the structural proof, using the same preset contract from the outset. This stages the implementation while retaining the hybrid-library design.

## Rendering corrections

### Lightmaps and surface relief

Keep parent-plane lightmap coordinates continuous through vertex interpolation. Produce coarse steps through nearest sampling or fragment-stage world/luxel quantization. Define atlas rectangle bounds and edge handling explicitly; nearest filtering does not justify unchecked border addressing.

Decorative relief may inherit parent-plane lighting and bounded AO weights. Keep a sealed structural surface underneath. Relief retraction must handle collapsed/overlapping dressing triangles and preserve structural coverage throughout the animation; a watertight endpoint alone is not a proof for every intermediate state.

### Mirrors

Use the full affine reflection for a plane, including its distance from the origin. Reflected clipping/projection must follow WebGPU depth conventions. Mask visible mirrors with explicit per-mirror stencil-reference draws and use the correct winding for each reflected view.

An attachment depth clear clears the attachment; it cannot selectively clear only stencil-matching pixels. Use a stencil-tested depth-reset draw or an explicitly designed separate-target/compositing path. Budget visible mirror count, recursion depth, geometry processing, and draw work. Low internal resolution reduces fill work but does not make reflections free. Begin the mirror milestone with one mirror and one reflection depth.

Keep experimental FOV/kaleidoscope distortion distinguishable from physical scene reflections. Preserve the actual player body's visibility requirements.

References: [WebGPU uploads](https://www.w3.org/TR/webgpu/#dom-gpuqueue-writebuffer), [depth/stencil attachments](https://www.w3.org/TR/webgpu/#depth-stencil-attachments), and [Rust C-compatible layout](https://doc.rust-lang.org/reference/type-layout.html#the-c-representation).

## Memory, ABI, and measured performance targets

The reviewed C-compatible field layout gives `SectorEdge = 24 bytes` and `SectorCell = 76 bytes`. At 512 cells with eight edges each, their tables require **137,216 bytes**. The supplied interval `0x001000..0x020000` provides **126,976 bytes**, leaving a **10,240-byte shortfall**. This field-layout calculation has been checked; Rust/WASM compile-time layout assertions remain required.

Replace illustrative absolute addresses with exported pointers, explicit counts/strides, checked capacities, and compile-time/runtime size and alignment assertions. Declare 16-byte alignment wherever the chosen ABI requires it; `repr(C)` alone does not establish it. Specify seed representation, uniform layouts, packed relief scales, and index/byte-count semantics explicitly.

Budget the active arena, staged candidate, validation scratch, stack, surface pack, lightmaps, and renderer resources together. Staging can require more memory than the supplied single-arena sketch. Select the initial memory limit from the measured/compiled layout, with defined overflow behavior. Do not assume the sketch's approximately 10 MB is sufficient.

WASM-backed typed-array views avoid an additional JS-side mesh copy. GPU uploads still copy bytes. Measure upload size, frequency, and time alongside generation/rendering costs. Distinguish CPU memory from GPU allocations and account for both.

Use the proposed 0.03 ms simple extrusion and 2 ms lightmap bake as profiling targets, with documented geometry/light counts and hardware. They are not verified results. Measure frame time and p95/p99 behavior, CPU generation/validation/baking, GPU work, mirror costs, startup, memory high-water marks, and failure recovery. Retain reproducible seeds and report target misses honestly.

## Small engine test

Build a separate `engine-test/` prototype, preserving both title apps.

1. Establish the freestanding Rust/WASM ABI and basic WebGPU host, with explicit memory/capacity checks and usable unsupported-device/error handling.
2. Generate one small arena from bound sectors: walls, floor, ceiling, a pillar, a ramp, and one shared interior opening. Validate the assembled 3D boundary and collision/connectivity data.
3. Add first-person movement using fixed simulation steps and swept 3D collision. Keep orientation/contact math capable of arbitrary local up, while initially testing ordinary gravity. Render the gameplay world at an explicitly chosen quality setting.
4. Try one procedural trim preset and a simple coarse-lightmap/palette treatment. Introduce the broader authored-asset pipeline after the structural test is sound.
5. Generate a replacement off to the side, validate it, then manually activate it. Demonstrate rejection of intentionally broken candidates without changing the active arena.
6. Expose seed/regenerate, validation results, manual activation, collision/seam visualization, and performance/memory readouts in a hidden development menu.

Acceptance checks: deterministic generation; deliberate leak rejection; closed seams and correct reflected winding where used; valid floor/ceiling/wall collision; comparable simulation outcomes across render rates; safe candidate rejection/activation; bounded buffers/resources; and explicit CPU/GPU measurements. Physical-device acceptance remains pending until it is actually performed.

Follow with original-timing loot/fold integration, verified moving geometry, arbitrary-surface locomotion/arena modifiers, authored surface tiles, and bounded mirrors/rival-self rendering. These directions are accepted for exploration; they are not requirements to complete all at once in the first engine test.

## Engine proof 1 implementation

The separate `engine-test/` now implements the six steps above with a bounded initial generator. The root title prototype, `vector-labyrinth/`, and `dos-maze/` remain intact. No game release version or deployment is implied by this prototype.

- **Core:** dependency-free Rust 1.100.0 / `wasm32-unknown-unknown`, explicit pointer/count ABI, compile-time layouts, 16 MiB fixed memory, two isolated arena slots, and checked geometry/light/atlas capacities. Browser I/O and raw WebGPU remain vanilla JS.
- **Construction:** a deterministic 13 × 13 sector template varies dimensions, floor/ceiling slopes, pillars, and emitters by seed. Canonical coordinates use 1/1024 m integer ticks. It contains shared interior openings and assembles welded 3D floor/ceiling/wall boundaries. This generator has one height interval per grid cell; future engine generators are not restricted to it.
- **Validation/activation:** reciprocal binding, headroom, connectivity, finite/nondegenerate indexed geometry, winding, oriented manifold-edge closure, proper nonadjacent triangle crossings, and spawn/body/weapon clearance. An invalid candidate never changes active geometry or player state. A valid GPU upload is staged for explicit activation on a frame boundary; rendering and physical state switch together. Unclear player placement falls back to a verified spawn.
- **Movement/view:** 120 Hz fixed-step, oriented 3D capsule sweeps, ramp contact, jump, sliding, and conservative physical gun clearance. Placeholder body/equipment geometry shares the world's view and depth pass. Ordinary gravity is active; arbitrary-surface walking is deferred.
- **Surface/rendering:** one procedural preset with real 3D wall relief and light fixtures, continuous parent-plane UVs/guarded coarse atlas, 12 bounded emitters, nearest sampling, indexed horror palette, and dithering. Relief is adjustable. The common preset reserves an authored pack ID; the OBJ/glTF packer and full tile library remain future work.
- **Harness/lifetime:** hidden H controls for seeds, fault injection, staging/activation, collision/seams, lighting/relief/resolution, and CPU/GPU/memory diagnostics. Resize, visibility/freeze, stale requests, bounded device recovery, manual retry, missing assets, and explicit disposal have browser checks.

The validator is scoped to this canonical generator and is not a general arbitrary-mesh CSG proof. Decorative light visibility is accelerated using the current sector grid and height planes; future stacked-volume construction needs an adapted accelerator. Arena construction and baking currently run synchronously. Continuous folding, moving structural geometry, mirrors, authored surface packs, and gameplay are not implemented.

### Bounded verification and measurements

See [`engine-test/evidence/`](../engine-test/evidence/) and the engine README for commands and scope. The initial local verification covers 256 deterministic seeds / 215,040 structural triangles, eight rejected fault types with byte-for-byte active-buffer preservation, stale activation, fixed memory, 7,680 directional movement steps, jumping/contact, long sweeps, and matching 120 Hz simulation results at 30/60/120/240 render FPS. Browser checks cover native Pointer Lock, view/surface controls, activation/rejection/races, portrait/high-DPI rendering, freeze/resume, two simulated device recoveries, manual retry, disposal, and asset/unsupported-WebGPU errors.

On an Apple M2 / 16 GB with Chrome/Metal, the default roughly 645 × 360 scene at 1376 × 768 output measured approximately 60 display-limited FPS, 0.10 ms median / 0.20 ms p95 host-frame CPU, and sampled GPU work of 0.17 ms scene / 0.26 ms palette/display. These are individual bounded local measurements, not cross-device guarantees. Fixed WASM storage is 16 MiB, with about 1.37 MiB of active arena GPU mesh/atlas data for the measured seed.

Initial core phase samples were generation 0.25–0.34 ms, validation 0.96–1.57 ms, procedural surfaces 0.14–0.36 ms, and bake 2.60–4.91 ms. Generation includes sector creation and welding, so it does not establish a 0.03 ms isolated extrusion result. The bake exceeds the 2 ms target; neither proposed performance target is claimed as achieved. Optional GPU timestamps measure GPU passes, not presentation latency. Physical-device acceptance remains pending.

A 30-second desktop soak also passed: eight validated replacements, eight rejected candidates, continued movement and repeated portrait/high-DPI changes, 1,810 rendered frames, roughly 60 FPS throughout, and at most 0.50 ms host-frame CPU p95 across the sampled windows. WASM stayed at 16 MiB; retained JS heap rose about 104 KiB after explicit garbage collection. This bounds that run only and is not a long-duration or driver-memory leak proof.

## Larger arena benchmark milestone

The user accepted engine proof 1 and authorized larger arena benchmarks and associated H tools, prioritizing continued gameplay during construction/validation. The user chose an **optional Quake-referenced movement profile**, preserving the accepted baseline movement. Implementation is separate in [`engine-benchmark/`](../engine-benchmark/README.md); the accepted `engine-test/` and both title apps remain unchanged.

### Workload and reference contracts

- Keep the accepted 13 × 13 small fixture. Its six render buffers are byte-identical across six compared seeds, although the new benchmark runtime has a different memory budget and spatial acceleration.
- Add a 25 × 25 / 75 m medium fixture and a 49 × 49 / 196 m large fixture, with wider rooms/openings, ramps/terraces up to 4 m, pillars, and inverted ceilings. These are synthetic scale workloads, not reproduced Quake maps. The current generator still has a single floor/ceiling interval per XY cell; this is not an engine-wide restriction.
- Use the documented convention **32 Quake units per metre**. Optional reference movement targets speed 320 u/s, gravity 800 u/s², jump 270 u/s, ground/air acceleration 10/1, friction 6, and stop speed 100 u/s. Reference body diameter/height is 30/56 units; eye height is 50 units above the feet. Retain our 120 Hz capsule simulation, real body/gun clearance, and original gameplay contracts. Exact Quake collision, stairs, water, networking, and movement parity are not claimed.
- id Software and OpenArena source references, pinned commits, unit conversion, implemented values, and remaining differences are recorded in the benchmark README. No third-party source, maps, or media are incorporated in this milestone. The user's assets/audio/AI/menu references remain available for later work.
- Keep light count, lighting density, decorative subdivisions, resolution, and movement profile independent so benchmarks distinguish physical/world scale, lighting work, and GPU geometry cost. Reject unsupported capacity combinations rather than silently lowering quality.

### Smooth candidate preparation

Each job builds and validates an isolated arena in a disposable worker using the same compiled WASM module. A validated internal static-memory image transfers to the main thread, where a separate candidate instance is reconstructed incrementally. GPU uploads also run in bounded steps after active rendering submission. The default scheduled copy/upload budget is approximately **1 ms per frame**; reports measure actual frame intervals rather than assuming that this budget controls browser/driver/GC latency.

Active, worker, and candidate instances have isolated storage. Each benchmark instance has fixed 32 MiB memory and one arena; this replaces the proof's two slots only within the new benchmark runtime. The original 16 MiB two-slot proof remains available unchanged. The measured logical WASM/image ownership peak is approximately 86.1 MiB, excluding delayed GC and browser/driver overhead. This is an explicit scaling budget, not a measured process resident-memory bound. Image transfer is internal to the same build, not a user-importable map format, and requires no shared-memory/cross-origin-isolation deployment headers.

Generation requests have serials, cancellation, a worker deadline, and candidate-only failure handling. Cancel/supersede destroys candidate work/resources. Only an explicitly activated, validated, fully uploaded candidate can switch the active WASM instance and GPU resources together before simulation. Clear player state is inherited; otherwise activation uses a verified spawn. This remains manual arena replacement and does not implement physical folding.

Canonical vertex welding now uses hashing. A balanced 3D BVH accelerates swept collision/containment and triangle-pair validation. Large atlas charts are packed by height; the small fixture retains its original packing. Validation additionally rejects sector ceiling planes that disagree with the canonical 3D ceiling even when the plane remains finite and has sufficient headroom.

### H tools and bounded evidence

H groups next-arena settings and fault injection; cancellation/manual activation and return-to-play; baseline/reference movement; physical/free/top-down cameras; structural seams and lightmap atlas inspection; lighting/relief/resolution; route recording/replay; browser-saved fixtures with validated JSON import/export; an explicit small → medium → large benchmark suite/report export; and CPU/GPU/geometry/atlas/memory diagnostics. **N** prepares the next seed during captured-mouse gameplay. Ordinary gameplay retains no HUD.

Core verification covers 36 size/seed fixtures, 166,296 structural triangles, six byte-identical small-baseline comparisons, 27 deliberately broken candidates across three sizes, density overflow, same-build image reconstruction, 17,280 directional/jump movement steps, both movement profiles at 30/60/120/240 render FPS, camera isolation, and fixture schema/storage. Browser checks cover live worker preparation, native controls, persistence/import, activation/rejection, worker errors, cancellation during construction/upload, latest-request races, inspection, repeatable route endpoints, suite/report download, resize/freeze/recovery/retry/disposal.

Initial Chrome/Metal measurements on M2 / 16 GB: a 196 m arena with 2,136 open sectors, 10,176 structural triangles, 67,008 surface vertices, 48 emitters, and 649,792 luxels prepared/staged in about 355 ms, including about 82 ms of worker baking. Active frame p95/max during that preparation was about 16.7 ms, host CPU p95 about 1.2 ms, and activation below 1 ms. A large steady sample remained near 60 display-limited FPS. A 45-second stress run completed 18 replacements and 18 rejections; sampled preparation frame p95/max stayed below 16.9 ms, including GPU loss during construction. These are bounded local results, not cross-device guarantees or a complete native-memory leak proof.

The 2 ms bake stays an aspiration for a defined small workload. Large-map preparation latency, gameplay interruption, and activation cost are separate budgets. Compact transport, further light filtering/caching, broader generators, authored assets, physical folds, and physical-device acceptance follow the measured evidence. At this milestone the repository remained private; subsequent public-testing authorization and publication are recorded in [deployment notes](DEPLOYMENT.md).

## Separate continuous fold experiment

The user authorized a separate [`arena-fold/`](../arena-fold/README.md) test with safe moving geometry and controlled void feedback, keeping both accepted engine tests and title apps unchanged. It uses a permanently sealed chamber, four moving partitions, fixed-step player / weapon collision, and conservative whole-trajectory fold checks. A threatened body or weapon holds the fold; movement away releases it. Observer cameras and explicit reset / safety fixtures support inspection. This is a bounded physical-envelope experiment, not arbitrary conversion between generated arena graphs or a change to the encounter / looting contracts above.

Visual faces can disappear independently of collision. Fresh scene depth, a separate clean body attachment, and owned ping-pong floating-point histories produce a controlled interpretation of out-of-bounds afterimages. Feedback applies only to uncovered pixels. Architectural hatches use constant final-pixel width, with optional world-plane perspective or screen-space colour afterimages. No undefined swapchain retention or deliberately faulty clear behavior is used. Geometry playback / safety and visual openings / feedback have independent H groups and controls.

The experiment has fixed 4 MiB WASM memory and bounded box / render buffers. Its README records safety certification, exact resource accounting, verification, performance observations and limits. Sampled frames from the subsequently supplied local reference clip were inspected across 0:03–0:07. Colour afterimages support comparison while architectural lines remain a deliberate interpretation. This experiment does not replace the larger-arena worker pipeline, surface library, benchmark or DOS-maze renderer. Next acceptance should cover the fold's feel, player escape from blocked fixtures, void styling and physical-device performance before integrating broader arena transitions.

## Fold candidate 2: discrete corruption waves

Candidate 1 is retained. The user authorized a separate [`arena-fold-2/`](../arena-fold-2/README.md) alternative with **no moving architecture**: complete fixed layouts disappear / reappear, audition unchosen variants, and change instantly. Random instigators propagate corruption probabilistically through adjacent sectors. Untouched sectors can carry old geometry across multiple iterations. Coherence reduces instigators and spread, providing a test control for the intended end-game convergence; progression is not wired to remaining selves yet.

The user explicitly chose **global old-body cleanup at wave end**, including untouched and protected sectors. Body lifetime is independent of architecture persistence. Inert 3D bodies demonstrate the living intermission boundary; inventory and looting are not implemented. The timing emerges from wave traversal, auditions and settling, without a numerical gameplay HUD or a guaranteed minimum looting window.

Previews leave committed collision intact; only a safe final recipe changes physical geometry. Unsafe replacements retain the old sector without stalling the whole wave. Stable structural support / enclosure, actual body / weapon checks, clean actor rendering and owned feedback histories remain in force. The fixed catalogue and common chamber envelope bound this proof; arbitrary generated-arena replacement still needs the full construction and validation contracts above.

The user reported **Test PASS** and selected **candidate 2 as the direction** on 2026-11-26. Candidate 1 remains an unchanged historical comparison. Selection accepts the transition direction; it does not claim that the bounded chamber proof already supports arbitrary procedural topology, actual looting, audio, authored materials or game progression.

## Procedural corruption-wave integration roadmap

The following roadmap records the integration requirements. The compatible-interior subset is now implemented separately in `arena-sweep/`, described below; arbitrary topology and dependency-aware rebaking remain future work. Preserve the small baseline, larger benchmark, both fold candidates and title screens. Build the next integration test separately, starting with the 75 m workload and then exercising the 196 m workload.

### Replaceable generated sectors

The benchmark currently owns one complete arena image, GPU mesh / atlas and physical BVH per active instance; activation replaces that complete set. Candidate 2 instead chooses fixed recipes inside a permanently sealed chamber. Retaining old generated sectors requires an explicit composed-world representation between these designs.

Give logical sectors stable IDs and separately tracked generations. Own render geometry, collision, surface/material choices, lighting data and resources by sector or compatible replacement group. Retain the latest live version of unchanged sectors through reference ownership; do not retain entire historical arenas for each surviving piece. Use compact component packets for worker transport rather than allocating the benchmark's full 32 MiB arena image per sector.

Initially constrain replacements to compatible shared boundary profiles: matching openings, floor/ceiling edge heights and canonical seams. This is an initial generator restriction, not an engine-wide immutable XY partition. If an interface must change, stage and commit the coupled neighbouring sectors together. Later generators may split, merge or create volumes with appropriate identity and validation rules.

Validate the composed world, including intermediate old/new combinations: reciprocal bindings, sealing, headroom, intersections, connectivity and reachable gameplay space. A valid final arena does not prove that independently committing its pieces yields valid intermediate worlds. Recheck the live player's body, head, held weapon and support at the actual commit boundary. Retain an unsafe complete replacement group; do not reuse the benchmark's fallback-spawn relocation for ordinary nonlethal corruption waves.

### Preparation, activation and budgets

Reuse background workers, stale-result protection and bounded uploads. Generate and validate final choices and the audition resources before their warning/flicker begins. Previews choose from prepared alternatives; a visual slot change must not synchronously generate, rebake or upload an entire arena. Bound simultaneous auditions, queued work, cached variants and retained GPU/WASM resources. Key results to wave and sector/neighbour generations so stale work cannot overwrite newer geometry.

Publish each accepted group at a simulation boundary with matching render, collision, adjacency and lighting references. Build the necessary collision hierarchy updates off the gameplay thread. Revalidate retained-group boundaries when another planned change is rejected. Worker failure, cancellation or failed staging preserves the current playable world. Keep the initial scheduled main-thread preparation budget near the benchmark's existing 1 ms/frame and measure actual frame p95/p99/max, GPU work, activation cost and memory rather than assuming that budget guarantees smoothness.

### Lighting and the feedback renderer

Combine the benchmark's surface/material/lightmap representation with candidate 2's world coverage, owned history and clean actor pass. The current room-envelope reprojection is specific to a box chamber; general arenas need coverage tied to real surfaces, depth and sector/version identity. Reuse the unanchored comparison mode where appropriate. Preserve constant final-pixel line width and actor exclusion from retained feedback.

A changed wall or emitter can invalidate lighting in surviving neighbouring sectors. Track lighting dependencies/influence regions and prepare the affected coarse lighting before committing; do not silently keep old occlusion or rebake the whole large arena per flicker. Retain the existing coarse baked base, with a bounded shadowless dynamic-light layer for transition cues. Dynamic shadow rendering remains outside the proposed initial effects scope.

### Audiovisual authoring can start now

Define one shared per-sector transition preset against authoritative states: queued warning, audition/blank slot, commit or protected retention, settled, and global wave end. Lighting, noise, glitches, sound and material changes consume these events; they do not choose physics or determine when bodies disappear. The existing bounded diagnostic event ring is not a production delivery mechanism: add reliable, ordered events with IDs, timestamps, cancellation and recovery handling for audiovisual consumers.

Prototype shadowless light dips/pulses and emissive changes, sector-masked static/interference and line/UV glitches, spatial crackles/ticks/commit cues and a clear wave-end cue, and procedural material variants. Share prepared materials/textures through the planned surface library, with independent H controls by effect and phase. The authored asset packer is not required to begin procedural material tests. Keep body/weapon rendering clean and avoid mandatory fullscreen interference. Cap active lights, audio voices, effect pixels/passes and cached resources; measure them independently.

Web Audio can schedule sound against its audio clock and spatialize sources relative to the listener; proposed sound events should use that scheduling rather than trigger once per rendered frame. See the primary [scheduled-source specification](https://www.w3.org/TR/webaudio/#AudioScheduledSourceNode) and [spatialization specification](https://www.w3.org/TR/webaudio/#Spatialization). Handle audio enablement, pause/resume and stale-event cancellation when implementing it. The separate procedural sweep now prototypes native positional audio; final asset authoring and perceptual tuning remain open.

### Acceptance target

Walk continuously through a medium, then large, generated arena while corruption changes prepared groups around the player. Verify seam/ramp/headroom and connectivity validity after each commit, protected bodies/weapons/support with no relocation, surviving old generations without unbounded retention, global old-body cleanup exactly once at wave end, and smooth preparation under cancellation, failures, resize and recovery. Keep coherence as an explicit test input until its relationship to remaining selves and encounter timing is designed. Define the first configurable audiovisual preset in parallel; its final spatial tuning follows this real-geometry test.


## Procedural sweep implementation and latest gameplay decisions

The user replaced the slot auditions with a fixed-origin expanding deletion sweep and an inward insertion sweep. Their latest body-lifetime rule supersedes the earlier candidate 2 global-only cleanup: delete bodies with their sector/clump; clear those in untouched protected space at final return. Remaining surviving-clump bodies also clear then, preserving no old loot carryover.

The separate [`arena-sweep/`](../arena-sweep/README.md) now integrates the real 75 m and 196 m generated workloads. Capture includes the actual equipped proxies and all intersected clumps. Static contact fields bound the protected union without internal seams. Enemies are staged as inert fixtures with their own fields during return. One fixed simulation boundary closes looting, clears remaining bodies and releases all fields together. Normal sweeps never relocate the player.

Structural floor/ceiling/ramp/opening topology and its BVH remain stable. Only bounded, flat-cell interior column/cap recipes and material generations change; hidden structural geometry retains collision. Overlay insertion is atomic and checks the live body and gun; rejected recipes retain their previous safe geometry. This restriction preserves canonical seam, enclosure and connectivity validation without claiming arbitrary composed-world regeneration or new neighbour-dependent light bakes.

The base GPU arena remains resident; compact worker-produced interior packets, two bounded recipe meshes, versioned clump visibility, fixed 32 MiB WASM, bounded staging and owned feedback keep resource lifetime explicit. Player, bodies, enemies and fields are excluded from history. This large-arena interpretation uses controlled screen-space feedback, shadowless wave light and eight-voice native spatial audio. Audio receives ordered synchronous events; its diagnostic ring is not the delivery path. H exposes these effects independently.

Core and browser checks cover both workloads, clump boundaries, both movement profiles, per-deletion body timing, enemy staging/shared release, cancellation, bounded resources and recovery. Physical device and subjective audio acceptance remain open. Full topology replacement, real loot/combat, enemy AI and progression are still later milestones. The accepted earlier apps remain unchanged.


## Accepted Recomposition terminology and Interactive Encounter

The user reported **Test PASS** for `arena-sweep/` and accepted its Candidate 2-derived mechanic as the framework. Sound and visual effects can be tuned later. Adopt **arena**, **sector**, **cluster**, **composition**, **Recomposition**, **Collapse**, **Return**, **Release**, **anchor**, **protected region**, **coherence**, **encounter**, **loot intermission** and **Self/Selves** as defined in [`encounter-test/README.md`](../encounter-test/README.md). Actual structural replacement remains the next engine milestone.

Before that milestone, the user authorized the separate Interactive Encounter test with **all OpenArena 0.8.8 characters and weapons**. It includes 18 base model packs, 33 named roster entries and 13 weapons; character/skin/weapon selection; animated bodies and corpses; weapon behaviours and spatial cues; damage, pursuit and encounters; precomputed, model-clearance-aware sector navigation; automatic Recomposition; and Quake/OpenArena gameplay bindings. This is an original sector-based controller informed by Quake, not a complete botlib port.

The user explicitly chose **per-character physical envelopes**. The default is conservative model-specific body boxes and geometry-derived held-weapon capsules. Large silhouettes can make narrow passages inaccessible. Swaps require clearance, and model-specific navigation is prepared off the gameplay thread. The H menu retains the common-hull comparison and physical-bound/route inspection.

The inventory exception is **strictly for testing**: all thirteen weapons are available with unlimited ammunition, while corpse equipment exchange is skipped. The original production one-gun / equipped-armor inventory contract is unchanged. Top-left loop state, bottom-right kill/debug messages, top-right FPS/metrics and browser console debug logging default ON and have independent H toggles. These are development UI, not a production HUD decision.

The earlier accepted engine, benchmark, fold candidates, procedural sweep and titles remain unchanged. Global death transfer/endings, real inventory/RPG systems, multiplayer and production AI/balance are not introduced by this test. Next, carry these live entities and profile-specific navigation through actual Structural Recomposition: versioned structural render/collision/connectivity/lighting, compatible seams, validated composed worlds and safe shared Release.

## Separate playable milestone: equipment and a finite run

Proceed in `playable-test/`, preserving all accepted applications. Implement the first gameplay slice: persistent Self identities and boundary checkpoints; one equipped gun and worn armor; one fragment per item; a time-limited 3D equipment-selection interface; injury/armor/directional feedback; basic progress-based bot recovery; and a shared DOS-maze / controlled-history visual effect used by loot, forcefields and exposed void. The equipment pool belongs to the current encounter, disappears with originating clusters and closes at shared Release. Swaps must be atomic and validate body/weapon clearance. The loot interface replaces the proposed physical pickup/run-to-item phase. The current structural topology remains fixed.

Use the user's `ambient-loop.wav`, `warn-loop.wav` and `death.wav` unprocessed at original speed and pitch. **Do not implement audio effects.** The deferred stretching/ramping proposal and audio ownership are recorded in [SOUND_DESIGN.md](SOUND_DESIGN.md).

Subsequent engine work remains: height-rich Structural Recomposition with synchronized collision/navigation/rendering and protected support; the surface workbench and wall/floor/ceiling placement permissions; detailed visual surfaces over simple structural collision planes; and multiple simple, region-selected 3D sky scenes. These are not claimed as completed by the equipment milestone. Full narrative death transfer/endings and production armor attachment/animation remain follow-up gameplay work.

## Playable presentation revision — 2026-11-27

The user approved updating only `playable-test/`: stock OpenArena sprites and alpha/additive material stages, shadowless event lighting, restored MD3 death presentation, then drag-to-player equipment using the stock armor pickup models. Dead entities remain rendered through their selected death clip, dissolve with particles and emit a short point light before removal. Own-player death lowers the first-person camera safely and delays the end panel until presentation finishes. Identity/death accounting remains immediate and exactly once.

The loot interface uses the actual selected MD3 Self, projected body targets, separately draggable fragments, compatible-target highlighting and atomic clearance-checked drops. The stock red/yellow armor pickups are placeholders for armor roles; modular worn armor authoring is not implied. GPU geometry/textures, particles, sprites and lights remain bounded, recoverable and excluded from world history where appropriate. Full legacy Quake shader-language fidelity and dynamic shadows are not introduced.

Procedural sound candidates are generated separately in `audio-previews/` for audition. Do not integrate them without the user's selection. The current runtime audio and deferred processing design remain documented in [SOUND_DESIGN.md](SOUND_DESIGN.md).

## Playable falling-void revision — 2026-11-27

The latest approved direction supersedes drag-to-Self loot, lightmap shading and shadowless-only lighting in `playable-test/`. Collapse deletes all occupied groups outside-in within five real seconds; the captured body/weapon clump disappears last. Rendering and triangle collision share one visibility mask. The player then falls through pure monochrome DOS-maze feedback while three random drops drift near the POV. One successful click replaces a complete item, including its installed fragment; misses are harmless and unchosen loot is lost. A five-second timeout preserves gear. Restore the clearance-checked landing clump beneath the original XY, land without damage, then rebuild outward within five seconds and share Release. The full structural blueprint remains validated and fixed; this does not implement new structural topology generation.

Use 128 runtime lights by default, no baked or sampled lightmaps and no ambient fill. Environmental emitters follow group visibility. Explicit cutaway sky emission defaults to zero. Coarse player/object AABB shadows are allowed; no triangle shadow maps. Rocket flare/thrust shader references must resolve and blend additively. H retains independent lighting, shadow, phase and performance controls. Labels reuse the title study's glyph style, with one-pixel orthogonal corners and at most two leader segments.

Only the supplied audio placeholders remain integrated. The newly authorized processing is a short gain-only ambient/warning crossfade; rate, pitch and timbre are unchanged. Procedural auditions remain separate. See [sound design](SOUND_DESIGN.md) and [current playable test](../playable-test/README.md).


## Structural playable revision — 2026-11-27

The user approved retaining each arena's grid/footprint while regenerating occupancy, walls, floor/ceiling heights and sky openings around a reserved landing clump. This is implemented only in `playable-test/`; accepted historical engine, benchmark, sweep, encounter and title applications remain unchanged.

Before Collapse, a worker validates sealed welded planar geometry, equipped-player clearance and precomputed body-profile traversal. The host validates a complete physically fitting farthest-spawn cohort and stages GPU resources. In the fully empty void, rendering/collision/navigation switch atomically; Return inserts the new structure outward from the captured XY. Failed candidates preserve the active arena. Checkpoints retain the complete composed blueprint and props rather than relying on a seed alone. Small, Medium and Large remain selectable. This first structural pass changes the full arena outside protected space; population-driven partial structural persistence is still pending.

New shared height knots provide ramps, vantage differences and low basins with excluded environmental illumination. Three bounded miniature sky scenes use simple boxes/pyramids, scrolling tiled clouds and scaled-camera parallax. Sky ceilings are explicitly sealed physical boundaries. Runtime sky/environment/event point emitters share the 128-light budget; no lightmaps or ambient fill are restored. AI currently remains LOS-based, so dark-space hiding needs later perception work.

Each cohort uses physically checked greedy max-min spawn placement over reachable nodes. Selves may target one another according to proximity and decaying received damage. Restored maze curtains/glow follow deletion/insertion events. The user authorized original OpenArena positional wave cues; their ambient/warning/death placeholders remain unchanged, rate 1 / detune 0 with the approved gain-only crossfade. Independent H controls and structural rejection/recovery diagnostics accompany this revision. See [playable details and verification](../playable-test/README.md) and [sound design](SOUND_DESIGN.md).


## Game v0.1.1 — population, movement and chunky combat

The v0.1.1 build used 6,022; the corrected starting population is **6,174**, including the player (v0.1.2). The release starts all first-arena actors with shotguns. Every new composition randomly selects Small (1–3), Medium (3–7), or Large (3–15) opponents, capped by remaining Selves. Recomposition keeps movement/look enabled, removes player forcefields, allows falls and footprint changes, and proves a clear supported player position before combat Release. Enemies are spread relative to that final position. Canonical collision/navigation still validate before Collapse; failed candidates retain the active world.

Loot entry restores full health without repairing worn armor. Surviving NPCs improve equipped guns/armor/fragments after clears; the player still needs loot. Exact population counters and a bounded live equipment pool replace the 65-copy test cap. The initial tunable offscreen elimination rate is 10% of the unmaterialized population per clear, exposed in H. Item quality uses logarithmic combat scaling; this is prototype balance, with narrative death transfer/endings still pending.

Combat lights are wider/brighter. The game defaults to nearest textures, stepped light/alpha/colour levels and blocky HUD/weapon effects. Gun collision separates the body safely from surfaces instead of pinning movement or simply removing physical gun clearance. Audio placeholders and processing remain unchanged. Historical accepted applications stay intact. [Current game details and verification](../game/README.md).


## Population correction — v0.1.2

The user corrected the intended Kaprekar motif to **6,174 total Selves**, including the player. New games use that exact count. The economy retains its bounded 48-record live pool and exact population counters; no actor/equipment allocation scales with all 6,174 copies. Full-run tests now verify accounting, upgrades, unique identities, checkpoint round trips and bounded storage through convergence. Existing imported checkpoints retain their own populations and progress.

Additional local reference/media sources are available under `src-inspiration/assets` and `src-inspiration/games` (armor, props, sound/music, skies, textures, weapons and reference games). They remain local inputs; this population-only correction adds no runtime media or rendering cost.


## Recomposition and loot corrections — v0.1.3

Keep the live scene drawing through Collapse, void loot and Return, including the no-choice timeout. Free-void falling is a feedback presentation: never accelerate the physical player below the upcoming floor. Place the newly equipped body and weapon on a validated visible landing clump before reconstruction spreads outward. Collision checks against the nonphysical void player cannot prevent remaining prop records from updating; normal placement and combat collision remain checked.

All displayed loot can be selected. Every stock gun and armor piece has an actual-WASM safe-return regression. Square item bounds drift and bounce; title-font labels drift nearby, avoid other labels, may overlap items, and attach with at most two axis-aligned one-pixel segments. Bounded layout tests cover one to five items in desktop and portrait shapes. New defaults use 10% dark basins, dynamic-light intensity 1.5 and sky emission 0.65, retaining genuinely unlit spaces and no lightmaps.


## Continuous supported Return and reference rendering — v0.1.4

The user clarified: keep the loot interval, then keep player movement live while the new arena builds outward from the player's return XY. There is no physical landing drop in this mode. During every deletion / insertion frame, set the player's feet to the logical sector flat (accounting for body footprint); if no flat exists, retain the last supported height. Mouse recapture may be denied without disabling keyboard movement or uncaptured mouse look. Do not clear held movement merely because capture changes during intermission. Verify this using native browser events with recapture explicitly denied, plus per-frame floor-height / vertical-velocity checks.

Default game rendering is fixed 640×480 at 4:3, nearest-scaled with letterboxing. World, actors, feedback, sky views, loot models / labels and effect composition target the same internal raster; asset texture and font-mask dimensions are independent. Keep the title's accepted DOS-maze renderer and debug tools available. H can compare adaptive resolution.

Restore warm grey / charcoal / ochre / brown / olive material ramps from the provided art.png, pallet.png and lighting.png references. Use stable sampled surface detail and dynamic lighting; deduplicate local fixtures per clump, reduce overlapping sky emission and retain dim light through finer quantization / tone mapping instead of flooring it to black. Source-free scenes remain black. No lightmaps or audio processing are added. Dark basins can receive local light spill rather than forcing every distant source's radius to collapse to zero.
