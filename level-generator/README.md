# Level generator M6

[Open level test](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/) · [Design](../docs/LEVEL_GENERATOR.md)

A strictly structural blockout generator. M6 replaces the previous curved/donut layouts with **orthogonal geometry throughout**, including room sectors, corridor turns, traps, columns and the blockout sky scenes. Floors and ceilings are flat; steps use real vertical risers. No invisible ramps, special donut-room generator, fixtures, textures, trim or decorative world polygons.

## Layout rules

The maximum placement grid is **12×12 cells**. Internal room sectors are separate from that grid. Select automatic sizing or a fixed size up to 12, and 6/9/12/16 initial room cells. Adjacent room pairs may combine, so the final room count can be lower than the requested cell count. Combined rooms retain their contributing cell identities.

Every room joins the corridor network. A complete hallway network must connect at least two distinct rooms. Adjacent corridor cells may join, branch and form loops. Shared room walls are actual structural separators; they are removed only for admitted room combinations. Small structural corner junctions prevent diagonal point contacts from becoming invalid mesh edges. Connectivity is verified independently of visual adjacency.

Clear corridor and doorway widths remain **4–12 m**. Straight runs and turns are all rectangular. Hallway ceilings have one uniform flat height. Room/feature/alcove ceilings may have different flat heights, joined by vertical soffits. No generated face is sloped. The shared sky renderer uses boxes only in this viewer, preserving the current game's normal rendering option.

## Features and decaying adjacent decisions

**Feature** is the common object. Each feature has a room-relative rectangular mask and combinable `trap`, `waterfall`, `column`, `relief` flags, referenced from `sector.flatDetail`. There is no donut-specific geometry or fixed room assignment.

The count budget is `floor(roomFloorArea / density)`, capped at eight features per room; density defaults to **512 m² per feature** and is adjustable in the viewer. A separate **20% floor coverage cap** applies. Structural wall area is excluded. Desired feature count is sampled within the budget, and a feature is admitted only if it fits the area limit, entrance reservations, separation and safe route requirements. Coverage counts each outer mask once, including any nested relief steps.

Masks scale with room dimensions and may be placed anywhere legal. They do not have to be centred. Columns use raised sector floors; traps may use lethal liquid pits. Waterfall flags use existing vertical sector boundaries, with solid red lava or green radioactive surfaces. Relief features use flat tiers and real 0.15625 m steps. Surface-library dressing remains a separate system.

All spatial style proposals use a shared directed inheritance rule:

```text
next probability = parent sector's CURRENT probability / 2
1/8 → 1/16 → 1/32 → 1/64 …
```

Success and failure do not reset the probability to one. A decision records its value, probability, parent, source, depth and whether the parent's value was inherited. A flag rolls directly against the current reduced probability. A rejected size/category inheritance samples a different legal proposal; its propagation probability still continues to decay. If only one legal value exists, that constrained fallback is recorded explicitly. One parent per decision prevents cyclic redecay. The mechanism covers corridor/door dimensions, opening sizes/presence, ceiling heights, alcove dimensions/steps, feature flags/scale/material/count proposals, and merge probabilities. Legal size/step ranges, count/coverage limits and connected collision-free routes remain hard constraints; they are never halved or bypassed by a roll.

Alcoves vary their mouth width, depth, clear height and floor offset. Each connection differs from its parent floor by at most one 0.15625 m step; clear height is at least 3 m. The existing bounds remain two alcoves / 180 m² per room, depth two and 0.1% repeat-branch chance. Door/corridor entrances and other room geometry are reserved.

## Collision, navigation, sky and sound

One welded oriented shell is shared by rendering and collision, with exact fixed-point floor/wall/ceiling boundaries, real risers and soffits. Every edge needs two opposite incidences, and signed shell volume must match the integrated sector volume. All faces must be axis-aligned. Failed or superseded candidates retain the active world.

The entire declared safe domain is eroded by the largest composite AABB plus 12 mm. Optional lethal traps and inaccessible columns are excluded, with radioactive standoff. Every room, hallway, alcove and reachable feature must belong to one component. Complete all-pairs LUTs and continuous 3D terrain traversal witnesses are validated. The composite half-width **1.84336 m**, height **2.50789 m** covers current allowances for 18 models and level-pitch machinegun yaw extents. This uses the frozen v0.1.3-based adapter, not current game-controller parity; see [BASELINE.json](engine/BASELINE.json). WASM stays fixed at 32 MiB.

Windows, skylights and open-looking ceilings show miniature 3D sky scenes while remaining sealed to Selves/projectiles. Sky boundaries absorb local sound samples. The scenes add only off-world box geometry; they do not enter the dungeon mesh or AI graph. Sky/point lighting is still approximate and lacks wall occlusion.

Automatic doors open in 0.25 s, hold/reopen around any occupied collision bounds and use identical render/SAT leaf transforms. Each leaf emits start/finish for each stroke, with no parked repetition or false completion after reversal. Closed doors reduce graph transmission. Local sound retains **128 shared propagation/reflection samples** and a separate **128 external graph/sector evaluations** per update, independent of mixer voices. See [audio contract](../docs/LEVEL_GENERATOR_AUDIO.md).

## Controls and reproducible checks

Generate a seed, choose layout size and feature density, or load a qualified schema-6 package (`m6.0`). Walk uses WASD/mouse, Shift, Space, C and Esc. Map selection, AI walk/tour, overview, safe-domain overlay, sound audition, diagnostic shot and package export remain available. Enable audio to hear door/fire/flight/impact cues. Room merging is reflected in the actual room count and preserved cell metadata.

```sh
node level-generator/tools/check-core.mjs
node level-generator/tools/check-m6.mjs
node level-generator/tools/check-acoustics.mjs
node level-generator/tools/build-catalogue.mjs
node level-generator/tools/check-catalogue.mjs
node level-generator/tools/check-browser.mjs
node level-generator/tools/check-m6-browser.mjs
node level-generator/tools/check-acoustics-browser.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
```

Rebuild profiles/WASM with the existing pinned build tools when their owning sources change. Reports and screenshots remain ignored under `.local/level-generator-checks/`; research stays in `.local/level-generator/`. The site package includes runtime files only. Preserve the pinned geometry [licenses](licenses/geometry.txt).

Remaining work: production sector/Recomposition integration, physical devices, crowds, other weapons/pitches, lighting occlusion, feature/alcove combat pacing and acoustic/damage calibration. These tests establish bounded prototype behavior, not exhaustive gameplay acceptance.
