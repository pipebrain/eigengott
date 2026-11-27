# Level generator M2

[Open generator](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/) · [Design and roadmap](../docs/LEVEL_GENERATOR.md)

A separate, strictly blockout test: 6, 9 or 12 rooms, a main route with branches and a few loops, curved corridors, donut rooms and structural posts, with seeded **4–12 m corridor targets**, sealed welded geometry and precomputed clearance-aware navigation. Curved sections widen locally where the largest supported envelope needs extra diagonal clearance, staying within 4–12 m. Floors are flat and ceilings are 5.5 m. Donut rooms wrap around a solid central core; posts extend from floor to ceiling. Both are actual holes in the walkable polygon, with matching inner walls and alternate routes. Output contains only floors, walls and ceilings, with invisible white point emitters. No textures, fixtures, props, decorative polygons, relief, grain or seams are generated.

## Controls

- Generate a numeric seed, select a room count, or choose one of twelve qualified packages.
- **Walk / mouse look** captures the mouse. WASD moves, Shift walks, Space jumps, C crouches, Esc releases capture.
- **3D overview** hides the ceiling visually while collision stays sealed.
- Click the map or choose a room/hallway destination, then use **AI walk to destination** or **Tour every region** (including ring quadrants and post bypasses). The marker follows the actual controller; manual movement stops the tour.
- **Clearance regions & waypoints** inspects the navigation decomposition. **Export package** saves full geometry, semantic plan, routes and reports.
- **Build menu** returns to the current game / engine / generator selection. Touch movement is not implemented.

## Engine and navigation

The test starts from the local **v0.1.3** body collision, movement controller and BVH snapshot. Its minimal WebGPU renderer uses that snapshot's packed vertices, frame layout and dynamic-lighting shader. This is a dedicated adapter, not the full current game renderer. The current game is versioned independently.

[BASELINE.json](engine/BASELINE.json) records captured source hashes and the starting commit. The snapshot included local work at capture time; it is not claimed to equal a release tag. The adapter adds flat-shell import/query exports and disables unused body-proxy mesh generation. M2 dispatches imported-flat inside/outside checks to BVH-accelerated floor-triangle membership evaluated in f64: the original general ray test could merge distinct near-coincident curved-wall hits and falsely reject an interior point. The movement equations, continuous SAT body sweep and BVH sources remain unchanged. This scoped containment adaptation is recorded in BASELINE.json; it does not change the current game.

The conservative routing profile has half-width **1.84336 m** and height **2.50789 m**, plus a 12 mm configuration-space safety margin. It contains the current navigation allowances for all 18 existing character models and their level-pitch machinegun yaw extents. Routes cover the entire eroded polygonal flat free-space domain, including all space around cores and posts; they do not accept a 75% connected subset. Convex navigation cells share explicit portals. Weighted all-pairs next hops/costs are computed and the entire next-hop forest is checked for valid edges, exact endpoints, costs and cycles; and every directed edge passes a v0.1.3 continuous body-box sweep.

Twelve compressed packages, four seeds for each room count, contain geometry, topology, clearance regions, LUTs and validation reports. Engine/profile/package hashes and generator/schema identity guard loads. A failed or superseded candidate retains the active world. At 4 m, passage capacity may be fewer than three largest Selves abreast.

## Build and test

From the repository root:

```sh
node level-generator/tools/build-profiles.mjs
sh level-generator/tools/build-wasm.sh
node level-generator/tools/check-core.mjs
node level-generator/tools/build-catalogue.mjs
node level-generator/tools/check-catalogue.mjs
node level-generator/tools/check-browser.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
GENERATOR_URL=https://pipebrain.github.io/eigengott/level-generator/ node level-generator/tools/check-browser.mjs
```

Rust is pinned by `rust-toolchain.toml`; an existing local toolchain is supported by the build script. Core checks can run in CI; browser checks use the repository's development Chrome/Metal harness. Reports/screenshots go to ignored `.local/level-generator-checks/`. Runtime needs WebGPU and gzip streams, with no npm runtime dependencies.

The M2 core suite checks 96 layouts, 1,115 distinct section widths, 16,241,732 LUT paths and 78,364 directed collision sweeps. Sampled 4 m/12 m fixtures at every size replay the controller from the initial room to every room/hallway, with permitted local curve widening. Ninety-six additional controller journeys traverse donut quadrants in both directions. Structural core/post centres reject occupancy and block real eye-height rays. Planar triangulation is checked for exact area/coverage and floor-edge conformity so room joins cannot turn into invisible walls. Browser checks cover native input, qualified packages, rejection/cancellation, UI/resize and full-region tours for six- and twelve-room cases. These are bounded development checks; do not claim every actor pair was separately replayed.

## Remaining scope

Ramps, real stairs, doors, sky openings, hazards and natural variants remain later work. The new polygon compiler is flat and closed-ceiling; independent sector planes and production sector-list integration are still pending. Point lights currently use the snapshot's shadowless case and can spill across walls; sealed geometry does not establish light occlusion. Other weapons, arbitrary pitch while traversing, dynamic crowd behavior, device-loss recovery, physical-device acceptance and production Recomposition integration remain unverified. See the shared [roadmap](../docs/LEVEL_GENERATOR.md).

## Geometry dependencies

Pinned local [polygon-clipping 0.15.7](https://github.com/mfogel/polygon-clipping/tree/v0.15.7) performs union, subtraction and AABB boundary expansion. [Earcut 3.0.2](https://github.com/mapbox/earcut/tree/v3.0.2) triangulates polygons with holes; its output is independently checked for coverage and overlap before use. There are no CDN requests or npm runtime dependencies. Preserve [licenses](licenses/geometry.txt) and [vendoring provenance](vendor/README.md).
