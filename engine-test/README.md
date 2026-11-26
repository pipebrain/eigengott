# EIGENGOTT engine proof 1

A separate, playable structural test for the [approved engine direction](../docs/ENGINE_PLAN.md). The existing title apps are unchanged. This is an engine prototype, not a gameplay release.

## Run

Serve the repository over localhost, then open `/engine-test/`. The checked-in `engine.wasm` runs without a local Rust installation.

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open [the engine test](http://127.0.0.1:8080/engine-test/) in a WebGPU-capable desktop browser. HTTPS is required when serving remotely. The repository remains private; Pages is not enabled.

Click **Enter arena** to capture the mouse. **WASD** moves, **mouse** looks, **Space** jumps, **Esc** releases the mouse, **H** opens development controls, and **F** toggles fullscreen. There is no gameplay HUD. Opening controls pauses movement.

In H, choose a seed and **Generate & validate**. A valid candidate is uploaded without replacing the current arena. **Activate validated arena** switches rendering and collision together on the next frame. Choose an intentionally invalid candidate to demonstrate rejection while preserving the active world. Collision/seam inspection, internal resolution, lightmaps, relief, player reset, and copyable diagnostics are also available.

## Implemented

- Freestanding, dependency-free Rust/WASM with an explicit pointer/count ABI and fixed memory. Vanilla JS ES modules handle I/O and raw WebGPU; WGSL handles rendering. No framework, generated bindings, Canvas drawing, or runtime asset parser.
- A deterministic 13 × 13 sector construction template with seeded dimensions, pillars, shared openings, and sloped floors/ceilings. Integer coordinates at **1/1024 metre** produce welded structural seams. Rendered and physical boundaries come from the same assembled 3D triangles.
- Validation of sector headroom/binding, connected interiors, indices, degeneracy, winding, closed manifold edges, proper nonadjacent face crossings, and spawn/body/weapon clearance. Capacity failures reject the candidate. Active and candidate arenas occupy separate fixed buffers.
- **120 Hz fixed-step 3D capsule movement**, conservative swept collision and sliding, ramp contacts, jumping, and a conservative world-space gun proxy. The same structural floor/ceiling/wall triangles constrain movement. Long frames have bounded catch-up.
- A world-space placeholder torso, arms, legs, boots, and gun rendered in the world depth pass. Looking down shows the body. The weapon has physical clearance and can block movement or a look direction near geometry.
- One procedural `SurfacePreset`: real 3D trims, bevels, recessed wall bays, and lamp fixtures. Decorative relief stays within the conservative structural wall padding. Relief can flatten for inspection; decorative fixture triangles are discarded when fully collapsed.
- A 512 × 512 parent-plane lightmap atlas with guarded charts, nearest sampling, 12 preset emitters, coarse lighting bands, a 256-color palette, and mild ordered dithering. Default scene height is 360 pixels, with no MSAA. There are two render passes; the body shares the world pass.
- Visibility/freeze pausing, resize/high-DPI handling, bounded GPU submission, stale-request rejection, explicit disposal, two automatic device recovery attempts, manual retry, and readable unsupported-device/asset errors.

## Scope and limits

The **engine collision and rendering are true 3D**. The first generator is deliberately restricted to a grid template with one floor/ceiling interval per cell. It does not impose that restriction on future generators. It is not an unrestricted random arena generator or a general arbitrary-mesh CSG validator. Its intersection guarantees combine canonical, disjoint cell construction with the implemented boundary checks.

Ordinary gravity is implemented. Local-up vectors and oriented collision math are retained for later work; arbitrary-surface walking is not implemented. Body and weapon meshes are placeholders, with no head/helmet or equipment system yet. There is no combat, enemy, loot/fold timing, moving structural geometry, progression, mirror, multiplayer, authored surface packer, or touch movement in this test. The `SurfacePreset` contract reserves authored-pack integration; OBJ/glTF conversion and the broader hybrid library remain planned.

Manual activation retains the player's transform when it is clear in the new arena, otherwise uses the verified spawn. It does not prove a safe continuous physical fold between two arenas. Decorative light visibility uses this generator's grid/height data; a future stacked-volume generator needs an adapted light-bake accelerator. GPU body lighting is a simple unshadowed emitter approximation.

The current CPU construction/bake is synchronous and can briefly interrupt a frame. Worker scheduling, broader generation, and optimization follow measured evidence. Desktop browser automation covers portrait/high-DPI rendering, not physical mobile controls or device acceptance.

## Build and check

Rust **1.100.0**, the `wasm32-unknown-unknown` target, and Node 24 are used. There are no Cargo/npm dependencies. A toolchain file pins the compiler. Install the pinned compiler/target with rustup if needed; the build script also detects a project-local toolchain under ignored `.local/rust/`.

```sh
rustup toolchain install 1.100.0 --profile minimal --target wasm32-unknown-unknown
sh engine-test/tools/build-wasm.sh
node engine-test/tools/check-core.mjs
node engine-test/tools/check-browser.mjs
node engine-test/tools/check-soak.mjs
```

`ENGINE_RUSTC` can select a compiler explicitly. Compiler flags use optimization/LTO, aborting panics, a 256 KiB stack, and a fixed **16 MiB** initial/maximum memory. The binary imports only host `sin`, `cos`, `sqrt`, and a monotonic profiling clock. The two arena structures consume 6,310,272 bytes; validation scratch, palette/LUT, body, stack, and other state fit within the fixed memory. No memory growth is permitted.

Core checks run in CI. Browser checks use the existing **development-only** CDP/PNG helpers under `dos-maze/tools/`, launch isolated Chrome profiles and a temporary localhost server, and do not change the DOS-maze app. They currently default to Chrome/Metal on macOS; `CHROME_PATH` can override the executable. The shipped engine requests files only from its own directory.

The tests write bounded, reproducible evidence under [`evidence/`](evidence/):

- `core-verification.json`: 256 deterministic seeds, 215,040 structural triangles, eight rejected fault types, byte-for-byte preservation of active buffers, stale activation, memory bounds, render-rate parity, contact/jump/movement and swept collision.
- `browser-verification.json`: native Pointer Lock and controls, staging/rejection/races, rendered relief/body, resizing/quality, timing, lifecycle/device recovery, disposal, and missing/unsupported-resource errors.
- `soak-verification.json`: repeated movement, arena staging/activation, rejection, resizing, and resource/memory checks over a bounded desktop run.
- PNG captures of the arena, surface relief/retraction, structural seams, body, and high-DPI output.

## Measurements

Diagnostics distinguish render FPS, host-frame CPU median/p95, CPU generation/validation/surface/bake phases, optional GPU scene/display timestamps, fixed WASM memory, active GPU mesh bytes, and internal/output dimensions. GPU timestamps are sampled periodically if the adapter supports them. They omit browser presentation latency. Target texture memory is a nominal estimate, not driver allocation telemetry.

The initial local reference is an **Apple M2, 16 GB, Chrome/Metal WebGPU**, 1376 × 768 output and a roughly 645 × 360 scene. See the evidence JSON for measured results, seeds, counts, and timings. These measurements are bounded desktop tests, not a guarantee for other hardware or physical mobile devices.

The proposed **0.03 ms extrusion** and **2 ms bake** remain profiling targets. The measured generation phase includes sector creation and welding; it does not isolate extrusion. Initial bake samples are roughly 3–5 ms, exceeding the 2 ms target. This implementation does not claim those targets have been met.

## Module and ABI map

| Module | Responsibility |
| --- | --- |
| `src/world.rs` | Canonical sector construction, structural topology, bounded arena storage, preset/data types |
| `src/validate.rs` | Binding/connectivity, boundary validation, physical triangle cache, spawn checks |
| `src/physics.rs`, `src/math.rs` | 3D contact/sweep math, fixed-step body/gun movement |
| `src/surface.rs` | Procedural surface geometry, emitters, chart atlas, bake, palette |
| `src/lib.rs` | Exported ABI, active/candidate transaction, camera/body render state |
| `engine.js` | Engine component API, WASM lifetime, frame scheduling, staging and recovery |
| `renderer.js`, `shaders/` | Raw WebGPU resources, world/body/seam rendering, palette presentation |
| `main.js` | Test-harness controls and diagnostics |

All exported counts are bytes when named `*_bytes`, otherwise element counts. WebAssembly numbers are little endian. The renderer range-checks pointers before creating views. Fixed WASM memory keeps typed-array views stable; GPU uploads still copy bytes into GPU resources.

`arena_buffer_ptr(kind, candidate)` / `arena_buffer_bytes(kind, candidate)` select active (`candidate = 0`) or pending (`1`) data:

| Kind | Data / stride |
| --- | --- |
| 0 | Surface vertices, 32 bytes, 16-byte-aligned base |
| 1 | Render indices, uint32 |
| 2 | Structural positions, float32 × 3 |
| 3 | Structural wire indices, uint32 |
| 4 | 512 × 512 RGBA8 lightmap |
| 5 | Light descriptors, 32 bytes, 16-byte alignment |

A render vertex stores float3 parent position (offset 0), packed signed-normal/AO bytes (12), packed signed relief/palette bytes (16), uint32 flags (20), and float2 continuous parent lightmap UV (24). Relief bytes represent signed displacement in units of `0.5 / 127` metre. Normals use signed bytes divided by 127. Compile-time assertions guard vertex size/alignment. Light descriptors are float3 position/radius followed by float3 color/intensity. The camera/options uniform is 96 bytes; diagnostics are 32 uint32 followed by 32 float32 (256 bytes). Current construction cells have a 52-byte stride, exported by `cell_stride()`; they are not the illustrative MD's earlier sector layout.

The component API is `createEngine(canvas, options)`, returning `play`, `input`, `generate`, `activate`, `view`, `resetPlayer`, `snapshot`, and `destroy`. `generate` stages but never implicitly activates a replacement. Diagnostics are read on demand, not copied every frame. `?test` enables harness-only placement and simulated device-loss controls; no gameplay mechanic depends on them.
