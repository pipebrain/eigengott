# Level generator — design and roadmap

Current prototype: **M6 orthogonal sector layout and general Features**. [Open test](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/) · [Runtime/rebuild documentation](../level-generator/README.md).

## Current user decisions

- At most **12×12 top-level layout cells**. Room-internal sectors do not count as extra placement-grid cells.
- No orphan rooms. A complete hallway network connects two or more distinct rooms; adjacent hallway cells may join. Visual adjacency alone is not connectivity.
- Adjacent rooms may share structural walls and have a random chance to combine. The prototype combines eligible pairs and preserves their original cell IDs. Shared walls remain solid unless the combination is admitted.
- **90° architecture everywhere**: room/sector/corridor boundaries, columns, trap masks and sky scenery. No curves or sloped faces. Flat uniform staircase ceilings supersede the earlier sloped-ceiling requirement. Internal triangulation diagonals are rendering topology, not diagonal architectural faces.
- Seeded corridor/door openings stay within **4–12 m**, with full largest-envelope clearance. Three largest Selves abreast is a comparison, not the required minimum for each passage.
- General **Features**, with room-relative masks and combinable trap/waterfall/column/relief flags. No dedicated donut generator or fixed donut-room positions.
- Feature count scales with room floor area. Defaults: one per 512 m², hard cap eight; maximum 20% floor coverage. Admission also reserves entrances, hazard standoff and required combat/navigation space.
- Decaying adjacent-sector inheritance applies to spatial style choices. **Next probability is half the current parent's probability**: 1/8→1/16→1/32. A successful or failed roll never resets probability to 100%. Parent/source/depth and flag realizations and legal fallback choices are recorded. Flags roll directly at the reduced probability; rejected size inheritance draws a different legal proposal. One directed parent avoids cyclic redecay.
- Alcove mouth, depth, floor offset and clear height vary. Every alcove connection is at most a single legal step; collision/AI tests use the entire largest supported hull, not a centre point.
- Strict structural blockout. Surface-library dressing is separate. No fixtures, bevels, trim or decorative world polygons. Red means lava/heat; green means radiation.

## Implemented architecture

M6 places room cells while preserving exposed corridor access and a connected empty-cell routing domain. It constructs a joined, branching orthogonal corridor network, explicit room ports, structural shared-wall separators and corner junctions. Random pair combinations remove the corresponding separators and create one room/acoustic identity with the original member-cell IDs retained. Default presets use automatic grids; a fixed 12×12 grid and 16 initial room cells are supported and tested within the engine budgets.

Room features are authored as flat sector masks. Columns raise floors, traps can lower them into lethal liquid pits, and relief masks add real orthogonal steps. Waterfall and damage flags use existing sector surfaces. Masks scale with room dimensions and are placed throughout legal room areas, not just at the centre. Count and coverage are distinct limits. The shared decision mechanism supplies coherent but increasingly unlikely inheritance for corridor/door dimensions, window/skylight sizes and presence, ceiling/alcove heights and dimensions, feature proposals and room merging. Mandatory geometric/legal limits override unsuitable proposals, with actual accepted parameters retained.

The compiler normalizes structural boundaries to shared 1/1024 m cuts. It creates a closed floor/wall/ceiling shell with real risers and soffits, validates oriented incidence and volume, and rejects non-orthogonal faces. Diagonal room point contacts are separated by real structural corner junctions. Shared walls, traps and columns are actual collision data.

The complete safe configuration-space domain excludes optional lethal/inaccessible feature sectors and radiation standoff, then erodes by the current largest composite body envelope plus 12 mm. Every required room, hallway, alcove and reachable feature must be represented in one connected component. All-pairs LUT endpoints/links/costs and live-engine continuous terrain sweeps are checked. The adapter retains the captured v0.1.3-based controller/BVH with bounded step movement, fixed 32 MiB WASM and current 18-model / level-pitch machinegun envelope. It is not current game-controller or arbitrary-weapon parity.

## Preserved sky and audio behavior

Windows/skylights/open ceilings are visual sky masks backed by the sealed collision shell; Selves and projectiles cannot leave through them. Miniature sky scenes use boxes only in this viewer. Sky rays are absorbed rather than reflected as a closed acoustic roof. Point/sky lighting remains approximate and can spill across walls.

Doors open automatically without crushing, using exact shared render/collision leaf boxes. Stroke time is 0.25 s; start/finish cues are per leaf, with bounded queues and no parked repeats or false completion after reversal. Closed doors attenuate the room/corridor graph. The default cap stays three room→corridor→room stages, with independent 128 local propagation/reflection samples and 128 external node/sector evaluations per update. Weapon, per-sector projectile and impact noise remain available. See [LEVEL_GENERATOR_AUDIO.md](LEVEL_GENERATOR_AUDIO.md).

## Qualification and roadmap

Schema-6 packages / `m6.0` supersede the previous catalogue. Twelve qualified packages retain engine/profile/geometry hashes, semantic room-cell/sector/feature data and LUT certificates. Failed preparation keeps the active world. Desktop tests exercise native input, source/package generation, invalid-candidate retention, cancellation, safe AI tours, sky views and actual audio playback. Private evidence and downloads remain under ignored `.local/` / inspiration paths and are excluded from Pages.

Next acceptance work is human review of shared-room density, feature/alcove frequency and combat space, followed by light occlusion and acoustic/damage tuning. Production sector-list/Recomposition integration, stacked/natural/playable exterior sectors, crowds, other weapons/pitches and physical-device acceptance remain pending. GitHub Pages continues to provide separate current-game, engine-test and level-test entries.
