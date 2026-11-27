# Level generator — shared design and roadmap

Status: **M3 elevated blockout and bounded acoustic graph implemented**, promoted from the private generator work on 2026-11-27. Runtime/source: [`level-generator/`](../level-generator/README.md). [Open test](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/).

## Confirmed design

- A 2D architectural plan with rooms as nodes and complete hallways as connections. Initial topology favors a main route, branches and a few loops. Every room and hallway must attach; room degree is finite and constrained by available space/ports.
- **Random clear corridor widths from 4 to 12 m**, including intermediate values. The user also approved local widening on curved sections where the largest envelope needs diagonal clearance, staying within 4–12 m. Store sampled nominal widths and actual section widths separately. This supersedes a suggested fixed 12 m minimum. The three-largest-Selves comparison is a capacity reference; individual safe navigation remains mandatory.
- Structural GREYBOX / WHITEBOX / BLOCKOUT only. Surface-library detail is a separate system. No generated fixtures, props, trim, wall/floor/ceiling detail or other cosmetic meshes.
- Validate closure, physical clearance and all-room/all-hallway navigation before activation. Store deterministic seeds with versioned geometry, profiles, engine identity, routes and certificates; a number alone is not a certificate.
- The broader design permits curves, floor/ceiling changes, ramps/steps, enclosed or sky ceilings, ring rooms/posts and natural structural shapes. Sightlines must be checked against real opaque geometry, not inferred from a bend or height label.
- Lighting comes from invisible point emitters, sky openings or red lava / green radioactive floor/fall boundaries. Animated feature appearance belongs on structural surfaces; it must not compromise safe connectivity.
- Resolve design questions with prompts, then record the agreed decisions. Keep private research/reference files local unless separately selected for promotion.

## Implemented M3

The current test offers 6/9/12 rooms, mixed curved/dogleg hallways, rounded donut rooms, full-height structural posts, flat room landings at different elevations, shallow sloped connections, real stairs and a terrain-following closed ceiling with 5.5 m vertical clearance. Boolean union/subtraction of polygon outlines produces one walkable domain with solid cores/posts excluded. Area-checked conforming triangulation produces a welded shell of floor/wall/ceiling triangles. Curves retain their cubic design controls and twelve structural chord segments; render, collision and navigation use the same final 1/1024 m polygon outline. Top-down structure/clearance inspection, a first-person walk view, actual-controller route demonstrations and full package export are available.

The test uses a **v0.1.3 controller/BVH snapshot** and its render/lighting interfaces. M3 uses imported-terrain f64 floor/ceiling membership, complete-footprint support heights and a bounded grounded step adapter before the captured movement fallback. Continuous body SAT and BVH remain the captured versions. This extends the old controller and is not current game-controller parity. The current game build remains independent. A generator mesh adapter avoids forcing arbitrary corridor widths into the old fixed grid. It is not yet the final production sector-list/Recomposition integration.

The composite route envelope contains the current 18 model navigation allowances and level-pitch machinegun yaw extents. Its entire projected polygonal configuration-space domain is eroded by the AABB and partitioned into convex cells with shared portals; every ring/post bypass remains represented. One connected component, exact all-pairs XYZ LUT endpoints, full-footprint headroom and live-engine directed 3D traversal sweeps are required. Current stair risers are 0.15625 m with broad 1.2–2 m treads. Limits are 0.25 m risers and 0.2 grade; no hidden stair ramps are used. Twelve qualified packages store geometry and routes, with hash/version guards. Failed preparation retains the active level.

M3 verification covers 96 generated layouts, 1,115 distinct section widths, 20,992,608 validated lookup routes and 1,029,150 continuous sweeps. Nominal 4 m and 12 m fixtures at all sizes replay controller journeys to every region and back over real slopes/steps, without jumping, with permitted local curve widening. Ninety-six controller journeys traverse donut quadrants in both directions. Cores/posts reject body occupancy and occlude real eye-height rays. Independent height-aware polygon samples verify column containment. Invalid risers, steep slopes and insufficient largest-hull headroom are rejected. Browser tests exercise startup, real input, package loading, rejection, cancellation, overview, map selection, portrait layout and region tours. These are finite local/CI checks, not physical-device acceptance or exhaustive dynamic-crowd verification.

## Bounded acoustics for v0.1.6

Each room and hallway has a stable map-local acoustic node, reciprocal connections and validated 3D navigation distances. The user confirmed **three room→corridor→room stages** by default: six graph transitions. Propagation is precomputed with a hard iteration/state budget, inverse-square energy falloff and a simple 6 dB reduction per complete corridor. Each room has four or fewer finite structural wall spans for first-order reflections; corridors add no echo voices. No recursive echo or path multiplication is used. The generator exports data and a pure query module; v0.1.6 owns audio playback and voice budgeting. See [LEVEL_GENERATOR_AUDIO.md](LEVEL_GENERATOR_AUDIO.md) for the integration contract and exact limits.

## Next milestones

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| Prototype review | Inspect elevated blockout scale, curves, rings, posts and noise graph | User play review; preserve 4–12 m width range and all-region connectivity |
| Polygon/terrain compiler | Curves, cores, posts, slopes and real stairs implemented; stacked sectors and natural variants remain | Shared polygon render/collision boundary, closed non-overlapping geometry, full clearance-domain coverage |
| M3 broader traversal | Final supported body/armor/weapon profiles, turns, full-region routing and versioned certificates | Every declared region connected for each supported profile; exact endpoint and controller checks |
| Remaining structural features | Operable doors, sky ceilings, red/green hazards and light occlusion | Bidirectional traversal, safe hazard bypasses, measured sight breaks, no details/fixtures |
| M5 catalogue qualification | Broader seed sweeps, adversarial fixtures and combat pacing review | Retain only passing packages; report rejection rates, duplicates and measured budgets |
| M6 production integration | Staged render/collision/nav/lighting, preserved landing patch, spawn cohort and checkpoint handling | Validate the final composed world; atomic activation, cancellation and recovery |
| M7 handoff | Integrable v1.2 prototype and reviewed shared documentation | Reproducible build, catalogue, evidence and explicit remaining limitations |

M3 point lights currently use the shadowless case: light may cross walls even when the physical shell is sealed. Stacked sectors, natural variants and the remaining M4 features, other weapons, arbitrary pitch/crowds, recovery and physical-device behavior remain unverified. See [`level-generator/README.md`](../level-generator/README.md) for commands and exact scope.

## Publication contract

The root index is the shared build menu: current game at `play.html`, engine baseline/test hub and generator at `level-generator/`. GitHub Pages stages only explicit runtime paths. Generator Rust/rebuild sources and this roadmap are shared in GitHub; private `.local/` research, downloaded inspiration, local logs and evidence are excluded from the site artifact. Deployment must pass existing engine checks plus generator rebuild, catalogue identity and core validation.


## Room acoustics audition

The Room acoustics panel enables positional sound and plays an original OpenArena release cue at the selected room/hallway destination. It accepts the generator’s room/corridor acoustic contract, or derives a compatible scene from room outlines, hallway portals and the validated navigation cost LUT, without altering world polygons, collision or qualified package schema. Room-hop limits, early echo and reverb can be compared in place; diagnostics expose voices, echo taps and graph visits. The generator audition uses a 160 m distance ceiling and three room hops by default. The main game uses connected sector clusters and 120 m, while sharing the renderer/router. Four outer-wall reflections are an approximation for curved rooms, holes and corridors. See [SOUND_DESIGN.md](SOUND_DESIGN.md).
