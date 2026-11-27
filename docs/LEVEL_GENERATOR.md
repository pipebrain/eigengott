# Level generator — shared design and roadmap

Status: **M1 flat blockout prototype published for review**, promoted from the private generator work on 2026-11-27. Runtime/source: [`level-generator/`](../level-generator/README.md). [Open test](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/).

## Confirmed design

- A 2D architectural plan with rooms as nodes and complete hallways as connections. Initial topology favors a main route, branches and a few loops. Every room and hallway must attach; room degree is finite and constrained by available space/ports.
- **Random clear corridor widths from 4 to 12 m**, including intermediate values. This supersedes a suggested fixed 12 m minimum. The three-largest-Selves comparison is a capacity reference; individual safe navigation remains mandatory.
- Structural GREYBOX / WHITEBOX / BLOCKOUT only. Surface-library detail is a separate system. No generated fixtures, props, trim, wall/floor/ceiling detail or other cosmetic meshes.
- Validate closure, physical clearance and all-room/all-hallway navigation before activation. Store deterministic seeds with versioned geometry, profiles, engine identity, routes and certificates; a number alone is not a certificate.
- The broader design permits curves, floor/ceiling changes, ramps/steps, enclosed or sky ceilings, ring rooms/posts and natural structural shapes. Sightlines must be checked against real opaque geometry, not inferred from a bend or height label.
- Lighting comes from invisible point emitters, sky openings or red lava / green radioactive floor/fall boundaries. Animated feature appearance belongs on structural surfaces; it must not compromise safe connectivity.
- Resolve design questions with prompts, then record the agreed decisions. Keep private research/reference files local unless separately selected for promotion.

## Implemented M1

The current test offers 6/9/12 rooms, dogleg hallways, a flat floor and a 5.5 m closed ceiling. Canonical rectilinear union cells produce a welded shell of floor/wall/ceiling triangles. Top-down structure/clearance inspection, a first-person walk view, actual-controller route demonstrations and full package export are available.

The test uses a **frozen v0.1.3 controller/BVH snapshot** and its render/lighting interfaces. The current game build remains independent. A new flat-mesh adapter avoids forcing arbitrary corridor widths into the old fixed grid. It is not yet the final production sector-list/Recomposition integration.

The composite route envelope contains the current 18 model navigation allowances and level-pitch machinegun yaw extents. Its entire eroded flat configuration-space domain is partitioned into free rectangles and portals. One connected component, exact all-pairs LUT endpoints and live-engine directed sweeps are required. Twelve qualified packages store geometry and routes, with hash/version guards. Failed preparation retains the active level.

M1 verification covers 96 generated layouts, 813 distinct widths, 1,125,896 reconstructed routes and 20,176 directed continuous sweeps. Exact 4 m and 12 m fixtures at all sizes replay controller journeys to every region. Browser tests exercise startup, real input, package loading, rejection, cancellation, overview, map selection, portrait layout and region tours. These are finite local/CI checks, not physical-device acceptance or exhaustive dynamic-crowd verification.

## Next milestones

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| M1 review | Inspect current flat blockout scale and movement | User play review; preserve 4–12 m width range and all-region connectivity |
| M2 sector compiler | Independent sector planes, curved boundaries, ring/post rooms, natural structural variants | Shared render/collision representation, closed non-overlapping geometry, full route coverage |
| M3 broader traversal | Final supported body/armor/weapon profiles, turns, full-region routing and versioned certificates | Every declared region connected for each supported profile; exact endpoint and controller checks |
| M4 structural features | Ramps, real stairs, operable doors, enclosed/sky ceilings, red/green hazards and light occlusion | Bidirectional traversal, safe hazard bypasses, measured sight breaks, no details/fixtures |
| M5 catalogue qualification | Broader seed sweeps, adversarial fixtures and combat pacing review | Retain only passing packages; report rejection rates, duplicates and measured budgets |
| M6 production integration | Staged render/collision/nav/lighting, preserved landing patch, spawn cohort and checkpoint handling | Validate the final composed world; atomic activation, cancellation and recovery |
| M7 handoff | Integrable v1.2 prototype and reviewed shared documentation | Reproducible build, catalogue, evidence and explicit remaining limitations |

M1 point lights currently use the shadowless case: light may cross walls even when the physical shell is sealed. All M2/M4 features above, other weapons, arbitrary pitch/crowds, recovery and physical-device behavior remain unverified. See [`level-generator/README.md`](../level-generator/README.md) for commands and exact scope.

## Publication contract

The root index is the shared build menu: current game at `play.html`, engine baseline/test hub and generator at `level-generator/`. GitHub Pages stages only explicit runtime paths. Generator Rust/rebuild sources and this roadmap are shared in GitHub; private `.local/` research, downloaded inspiration, local logs and evidence are excluded from the site artifact. Deployment must pass existing engine checks plus generator rebuild, catalogue identity and core validation.
