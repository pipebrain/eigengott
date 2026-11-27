# Level generator M4

[Open generator](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/) · [Roadmap](../docs/LEVEL_GENERATOR.md)

A structural blockout prototype with 6, 9 or 12 rooms, a main route, random branches and loops, curved and straight corridors, donut cores and posts. Corridor targets remain seeded random **4–12 m**, with permitted local curve widening inside that range. Room sizes, corridor lengths and branch counts vary by seed.

M4 adds independent flat room floor/ceiling sectors, small reachable platforms and escapable step-down pits, 2 m inaccessible platforms and 4 m lethal pits. Red means lava/heat; green means radiation. Some donut cores are damaging full-height liquid-fall boundaries surrounded by liquid pits. These are existing structural surfaces, without decorative meshes, liquid tessellation, fixtures, trim or textures. Hazard point lights have corresponding colors. All other surfaces remain grey.

Stairs use actual risers, straight flights, broad **16 m flat turning landings**, matching room entry heights and independently **sloped ceilings over the flights**. Ramps may curve. Turning stair corridors remain orthogonal. Current half-flight risers are at most 0.15625 m; supported limits remain 0.25 m step and 0.2 grade. There is no invisible ramp.

Doors use grey structural leaves. All four types—up, down, horizontal split and vertical split—share exact rendering/SAT boxes. They open automatically for the manual player or AI walker, hold near a Self and reopen rather than close through an occupied swept volume. The v0.1.3 snapshot already provided the dynamic collision overlay; M4 reuses it without changing the WASM controller. Doors retract into enclosing solid boundaries; no separate frames or pockets are dressed onto the mesh.

## Controls

- Generate a seed, choose 6/9/12 rooms, or load a qualified package.
- **Walk / mouse look** captures the mouse. WASD moves, Shift walks, Space jumps, C crouches, Esc releases capture.
- **AI walk to destination / Tour every region** uses the actual controller and opens route doors. The map includes all ring quadrants and post bypasses. Manual movement cancels a tour.
- **3D overview / Inspection cutaway** hides ceilings visually while collision remains sealed.
- **Enable sound** then **Sound at selected destination** auditions room/corridor propagation. **Test shot**, or left click while captured, sends an invisible diagnostic projectile: firing, each entered sector and wall impact emit sound. No projectile/world dressing geometry is added.
- Health and burning status are shown below the destination controls. **Return to start** restores health. Hazards apply identically to the player and AI walker.
- Sound diagnostics show independent local and external work counters. The native mixer's 16 voices and four echo-enabled voices remain separate limits.
- **Export package** saves geometry, semantic sectors/doors/hazards, safe navigation LUTs and certificates. Touch movement is not implemented.

## Safe navigation and geometry

One welded, oriented floor/wall/ceiling shell is compiled from exact snapped polygons and independent piecewise floor/ceiling planes. Sector risers and ceiling soffits are structural. Closure checks require every edge to have exactly two opposing incidences and compare signed shell volume to the integrated sector volume. Cores and posts remain actual exclusions shared by rendering, collision and navigation.

The required navigation domain is now explicitly **safe traversable space**, excluding unreachable platforms and lethal sectors, with a 2 m standoff around radioactive features. The complete domain is then eroded by the composite AABB plus 12 mm. No connected subset is silently substituted. Every room, hallway, donut quadrant and post bypass must be represented in one component, with exact endpoints, full all-pairs next-hop/cost validation and continuous live-engine terrain traversal witnesses. Optional unreachable/lethal feature sectors are deliberately outside this promise. Reachable platforms and shallow escapable pits remain in it.

The composite half-width **1.84336 m** and height **2.50789 m** contain the current 18 model navigation allowances and level-pitch machinegun yaw extents. Bounded step traversal uses full-footprint floor support and continuous lift/forward/down SAT. M4 retains the captured **v0.1.3-based** controller/BVH adapter; it does not establish current game-controller parity. [BASELINE.json](engine/BASELINE.json) records original hashes and adaptations. WASM remains fixed at 32 MiB.

Qualified schema-4 packages use generator identity `m4.0` and engine/profile/package hashes. Failed and superseded candidates retain the active world. Closed door states are runtime state; static LUT qualification assumes passable doors, while separate live-controller tests verify automatic traversal and both directions for every generated door at 4 m and 12 m fixtures.

## Environmental rules

Fatal liquid pits kill on liquid contact. Nonfatal heat contact deals 45 health/s; sustained exposure increases ignition probability. Burning persists for four seconds after ignition and drains 18 health/s after leaving heat. Radiation has a 2 m finite range from a full hull to the source surface, quadratic falloff and stronger 100 health/s contact damage. These are prototype tuning values, shared by all Selves. Radiation has a finite zero-dose boundary so safe AI bypasses can be proven. No armor, resistance or player-specific exemption is applied here.

## Sound handoff

[LEVEL_GENERATOR_AUDIO.md](../docs/LEVEL_GENERATOR_AUDIO.md) defines the data contract, room/corridor graph, structural sector cells, dynamic door loss and the two work budgets. Default travel remains **three room→corridor→room stages / six transitions**. A closed door adds 24 dB loss; aperture reduces that loss. Strongest-route selection keeps bounded Pareto labels for distance and transmission, so an open alternate route can win.

High resolution applies only to origins in the listener's current room. It shares **128 propagation/reflection work samples per 10 Hz update** across sounds. Low resolution has its own **128 external graph-state/sector evaluations per update**. These counts are not PCM samples or voice counts. High rays use actual 3D engine collision, including steps, ceilings, posts and doors; finite image-source echoes validate both 3D legs. Remote output uses bounded room/corridor propagation. Recording playback, HRTF and optional late reverb reuse v0.1.6 modules through an optional routing binding. The main game keeps its existing router unless supplied this binding.

## Build and verify

```sh
node level-generator/tools/build-profiles.mjs
sh level-generator/tools/build-wasm.sh
node level-generator/tools/check-core.mjs
node level-generator/tools/check-acoustics.mjs
node level-generator/tools/check-m4.mjs
node level-generator/tools/build-catalogue.mjs
node level-generator/tools/check-catalogue.mjs
node level-generator/tools/check-browser.mjs
node level-generator/tools/check-acoustics-browser.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
```

Rust is pinned at 1.100.0. Reports and screenshots are ignored under `.local/level-generator-checks/`; research remains private under `.local/level-generator/`. Geometry vendor code and [licenses](licenses/geometry.txt) remain pinned and local. GitHub Pages stages runtime files only.

## Limits

This is still a roofed, single-valued heightfield. Sky openings, natural variants, stacked rooms, production sector-list/Recomposition integration, all weapons/pitches, dynamic crowds and physical-device acceptance remain pending. The AI demonstration uses one actual walker, not a crowd. Point lights currently lack wall occlusion and may spill through walls. The sound model is a bounded approximation, with event/voice culling under load, not a full wave-equation solver or calibrated environmental audio simulation. Combat pacing and damage balance require user play review.
