# EIGENGOTT larger arena benchmark

This milestone tests **smooth gameplay while a replacement arena is generated, validated, and uploaded**. It lives in a separate directory. [`engine-test/`](../engine-test/) is the unchanged, accepted small baseline; the title apps are also unchanged.

Serve the repository over localhost and open [the benchmark](http://127.0.0.1:8080/engine-benchmark/). The checked-in WASM needs no local compiler to run.

For shared device testing, use the [public HTTPS benchmark](https://pipebrain.github.io/eigengott/engine-benchmark/) or [open its tools directly](https://pipebrain.github.io/eigengott/engine-benchmark/?tools=1). The deployed commit appears in H and exported diagnostics/reports. See [deployment notes](../docs/DEPLOYMENT.md).

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Click **Enter arena**, use **WASD / mouse / Space**, and open **H** for tools. **N** prepares another seed using the selected workload while you keep playing. A candidate never automatically replaces the world during ordinary preparation; use **Activate validated candidate** in H. **Esc** releases the mouse and **F** toggles fullscreen. The normal player view has no HUD.

## Workloads

| Profile | Construction grid | Width | Reference units | Default emitters / luxels per metre |
| --- | --- | --- | --- | --- |
| Small | 13 × 13 | 19.5–22.75 m by seed | 624–728 | 12 / 2 |
| Medium | 25 × 25 | 75 m | 2400 | 24 / 2 |
| Large | 49 × 49 | 196 m | 6272 | 48 / 2 |

The conversion **32 Quake units = 1 metre** is our chosen benchmark convention. These are synthetic arenas inspired by Quake III/OpenArena scale, not measurements or copies of particular shipped maps. Larger fixtures have wider rooms/openings, pillars, continuous ramps/terraces rising to 4 m, inverted ceilings within a 12 m structural height, and one nearby lamp ahead of the spawn. The generator retains its current single floor/ceiling interval per XY cell; this restriction belongs to this generator, not the 3D engine. Stacked rooms and overhang generators remain future work.

Seed 94 gives 2,136 open sectors, 10,176 structural triangles, 67,008 surface vertices, 48 emitters, and 649,792 baked samples in the standard large profile. Geometry detail, light count, and lighting density are independent controls. The small profile's six uploaded buffers are byte-identical to the accepted test across six tested seeds. The original test remains the preferred historical baseline for its memory/runtime measurements.

## H tools

- **Next arena:** profile, uint32 seed, 1–64 emitters, 1–4 luxels/metre, flat/standard/double wall subdivisions, nine deliberately broken candidates, cancel, manual activation, and return-to-play after starting preparation. Main-thread copy/upload work has a selectable 0.25–3 ms budget per frame, default 1 ms.
- **Movement and inspection:** baseline or optional Quake-referenced movement, physical player/free/top-down cameras, seam/collision view, lightmap atlas view, unlit inspection, relief, internal resolution, fullscreen, and player reset. Free-camera controls add Space/Ctrl vertically and Shift for speed; the physical player stays in place.
- **Repeatable routes:** record inputs from a reset spawn, stop, and replay against the same structural geometry. The movement profile is restored for replay. A recording is bounded to 7,200 input frames and lives in memory; fixture files store workload settings, not route recordings. Routes are benchmark aids, not game saves or network demos.
- **Fixtures:** browser-saved names/seeds/workloads, load/delete, and schema-checked JSON import/export. Imports are limited to 16 KiB and never execute code or import a raw engine memory image.
- **Benchmark suite:** explicitly prepares and activates small → medium → large, collecting preparation metrics and a two-second steady rendering sample for each. This button intentionally changes arenas. Stop cancels outstanding preparation; ordinary gameplay preparation still requires manual activation. Export writes the workload settings, seeds, timings, counters, browser, and current diagnostics to JSON.
- **Diagnostics:** frame interval and host CPU median/p95/p99, optional GPU pass timings, preparation phases, activation, atlas occupancy, visibility rays/grid steps, structural candidate-pair counts, geometry capacities, and memory estimates. Frame intervals include time outside our RAF callback; CPU samples cover the callback's simulation/render submission and bounded preparation work.

Density or detail combinations that exceed checked capacities are rejected. For example, the large profile at four luxels/metre exceeds the 1024² atlas. A failed workload leaves the active arena intact; it does not silently reduce requested quality.

## Background transaction

```text
active WASM instance + active GPU resources keep running
  -> disposable worker instantiates the same compiled WASM module
  -> generate canonical sectors and assembled 3D boundary
  -> validate binding, headroom, connectivity, seams, geometry, and spawn
  -> build physical BVH, decorative geometry, lightmap charts, and lighting
  -> transfer a validated internal static-memory image
  -> reconstruct an isolated candidate instance in bounded main-thread steps
  -> upload candidate GPU resources in bounded steps
  -> await explicit activation
  -> inherit clear player state or use a verified spawn
  -> switch the WASM instance and GPU mesh together before simulation
```

Construction, validation, lighting, and image creation run on a worker. Copying uses at most 64 KiB per scheduling step; GPU buffer writes use at most 256 KiB and atlas writes at most 64 rows per step. The frame loop services these steps after submitting the active view, checking its time budget between steps. A budget bounds scheduled work approximately, not browser/driver/GC latency or a single primitive's execution time. Reports measure the actual intervals.

Each job has a serial and cancellation signal. Cancel/supersede terminates the worker or aborts pending copy/upload steps and destroys candidate resources. Stale results cannot activate. Worker errors and a 30-second worker deadline reject only the candidate. Device recovery cancels preparation and rebuilds GPU resources from the active instance; two automatic attempts precede manual retry. Visibility/freeze pauses frame work and input, then resumes without simulating suspended wall time.

The worker image is an **internal same-build transport**, not an external map format. It transfers static linear memory from the fixed stack boundary to the exported `__heap_base`; stack bytes are excluded. The host instantiates the exact same `WebAssembly.Module`, verifies image bounds/ABI and imported clearance, and never changes the active instance during copying. No `SharedArrayBuffer`, cross-origin isolation headers, framework, binding generator, or runtime asset parser is required. Candidate render/physical validation runs in the worker; the host does not repeat the expensive validator on the gameplay thread.

## Spatial and memory changes

Canonical integer vertex welding now uses a bounded hash table. A balanced 3D AABB hierarchy accelerates capsule/gun sweeps, containment rays, and nonadjacent triangle intersection candidates. All physical narrow-phase tests remain 3D. This is still a validator for our canonical generator, not an arbitrary-mesh CSG proof.

Each benchmark WASM instance has fixed **32 MiB** memory, a 256 KiB stack, and one arena. The active world, factory worker, and reconstructed candidate have separate lifetimes. Each arena structure reserves 20,967,520 bytes for bounded tables, including geometry, collision/BVH, surface vertices, and a maximum 1024² atlas. Actual small charts use 512². Capacity overflow rejects construction.

An image currently carries 23,217,088 bytes, including unused reserved table space. Compact component transfer is a future optimization if bandwidth or memory becomes a measured problem. At most one candidate/job is logically owned. The measured logical ownership peak was approximately **86.1 MiB** of WASM/image data. This estimate excludes delayed garbage collection, browser/worker overhead and native/driver allocations; it is not a process resident-memory measurement. GPU diagnostics separately count nominal active/staged mesh and texture sizes. Retired WASM instances become collectible after activation; JS, worker, image, and GPU references are released on cancellation/disposal.

## Quake III / OpenArena reference

The optional profile applies independently implemented movement using referenced numeric targets:

| Property | Quake reference | This benchmark |
| --- | --- | --- |
| Run speed | 320 units/s | 10 m/s |
| Gravity | 800 units/s² | 25 m/s² |
| Jump speed | 270 units/s | 8.4375 m/s |
| Ground / air acceleration | 10 / 1 | 10 / 1 |
| Ground friction / stop speed | 6 / 100 units/s | 6 / 3.125 m/s |
| Body width / standing height | 30 / 56 units | Capsule diameter 0.9375 m / height 1.75 m |
| Eye above feet | 50 units | 1.5625 m |

References inspected on 2026-11-26: id Software commit `dbe4ddb10315479fc00086f08e25d968b4b43c49`: [`g_main.c`](https://github.com/id-Software/Quake-III-Arena/blob/dbe4ddb10315479fc00086f08e25d968b4b43c49/code/game/g_main.c), [`bg_pmove.c`](https://github.com/id-Software/Quake-III-Arena/blob/dbe4ddb10315479fc00086f08e25d968b4b43c49/code/game/bg_pmove.c), [`bg_public.h`](https://github.com/id-Software/Quake-III-Arena/blob/dbe4ddb10315479fc00086f08e25d968b4b43c49/code/game/bg_public.h), and [`bg_local.h`](https://github.com/id-Software/Quake-III-Arena/blob/dbe4ddb10315479fc00086f08e25d968b4b43c49/code/game/bg_local.h). OpenArena's acceleration/friction values were cross-checked in [`bg_pmove.c`](https://github.com/OpenArena/gamecode/blob/5478aad23b12857d265103f6aa2f5258c78799c8/code/game/bg_pmove.c).

This is a reference profile, not exact Quake movement parity: it keeps our 120 Hz simulation, 3D capsule collision, and true first-person body/gun clearance. Quake's discrete stair handling, original collision hull, network timing, crouch, water, jump pads, and exact movement edge cases are not reproduced. The baseline movement remains the default. Selecting a wider profile near a wall uses the verified spawn if the current position cannot accommodate it.

No Quake/OpenArena source code, maps, media, or archive content is incorporated into this benchmark. Rendering is our procedural library. The provided references remain useful for future media, audio, animation, AI, and engine milestones; those systems are not introduced here.

## Build and verification

The project-local or system Rust **1.100.0** toolchain needs `wasm32-unknown-unknown`. Node 24 runs the dependency-free checks.

```sh
sh engine-benchmark/tools/build-wasm.sh
node engine-benchmark/tools/check-core.mjs
node engine-benchmark/tools/check-browser.mjs
node engine-benchmark/tools/check-soak.mjs
```

Core checks run in CI, including a reproducible WASM rebuild. Browser helpers are development-only imports from `dos-maze/tools/`; the shipped app requests its own files only. Desktop browser checks currently use isolated Chrome/Metal profiles on macOS, with `CHROME_PATH` available for the executable. Browser and soak evidence is local; CI does not claim hardware GPU coverage.

Evidence is under [`evidence/`](evidence/):

- **Core:** six baseline-buffer comparisons; 36 size/seed fixtures and 166,296 structural triangles; 27 intentionally broken candidates; atlas overflow rejection; trusted image reconstruction; 17,280 movement steps; both profiles at 30/60/120/240 render FPS; free-camera isolation; fixture schema/storage checks.
- **Browser:** native Pointer Lock and background preparation; real fixture persistence/import; manual activation; rejected/failed workers; cancellation during construction and upload; latest-request behavior; view tools; route endpoint reproduction; suite/report download; resizing/freeze/recovery/disposal.
- **45-second soak:** 18 accepted replacements, 18 rejected candidates, 2,722 frames, changing view size/quality/movement profiles, and GPU loss during construction. Every sampled preparation stayed below 16.9 ms for both frame p95 and maximum; maximum preparation CPU p95 was about 1.4 ms. Retained JS heap increased about 200 KiB after GC. Reported backing-store counters exclude some native/WASM/driver memory and do not establish a complete native-memory leak proof.

The reference machine is an Apple M2 / 16 GB, Chrome 158 / Metal. One large build prepared and staged in **355 ms**, including an **82 ms worker bake**. During preparation its frame p95/max was **16.7 ms**, host-frame CPU p95 **1.2 ms**; activation was below 1 ms in the measured runs. The large steady sample stayed near 60 display-limited FPS, with host CPU p95 around 0.4 ms and sampled GPU scene/display work around 0.42/0.23 ms at 645 × 360 internal / 1376 × 768 output. Individual results vary; JSON contains counts, seeds, workload settings, and samples.

The 2 ms bake remains a small-workload profiling aspiration, not a whole-large-map requirement or a claim of achievement. This milestone prioritizes bounded gameplay interruption and safe activation. Physical mobile/browser/device acceptance, long-duration native-memory profiling, stacked-room generation, live structural folding, authored assets, combat, and exact Quake movement parity remain pending.
