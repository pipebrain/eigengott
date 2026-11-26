# EIGENGOTT · approved engine direction

Status: design decisions recorded on 2026-11-26; engine implementation has not started. This plan incorporates the user's eight responses to the review of `eigengott_3d_engine_geometry_specification.md`. The supplied document is architectural input; the original game decisions remain authoritative where they differ.

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
