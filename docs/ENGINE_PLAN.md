# EIGENGOTT · approved engine direction

Status: the first separate [engine proof](../engine-test/README.md) is implemented on 2026-11-26. Its scope and validation results are recorded below. This plan incorporates the user's eight responses to the review of `eigengott_3d_engine_geometry_specification.md`. The supplied document is architectural input; the original game decisions remain authoritative where they differ.

## Gameplay contracts

1. **True first person.** The camera sees through the actual equipped body. Helmet construction affects visibility; the held weapon has its real world dimensions, obstruction, and clearance requirements. Preserve the body in the main view, with selective camera/head clipping where necessary. Reflections show that same body and equipment. Do not make the entire body reflection-only.
2. **Original encounter transition.** After an encounter resolves, a short countdown is communicated by increasing wall/tesseract distortion, without a numeric timer. The player may loot defeated selves during that window. Folding and separation advance the arena automatically. The final opponent's death takes precedence and follows the appropriate ending rather than an ordinary next-arena transition.
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

The 2 ms bake stays an aspiration for a defined small workload. Large-map preparation latency, gameplay interruption, and activation cost are separate budgets. Compact transport, further light filtering/caching, broader generators, authored assets, physical folds, and physical-device acceptance follow the measured evidence. Repository visibility and Pages remain unchanged.
