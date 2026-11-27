# EIGENGOTT development plan

## Current baseline

- Preserve the `v1.0.0` checkpoint and the exact `dos-maze` default profile.
- Keep earlier profiles available in the H menu.
- The `v1.1.1` DOS-maze defaults are time scale ×0.50, pixel ratio cap 1.00, and antialiasing off.
- The full lab's reported off-grid lines and glyph-clearance issue retain their saved reproducer. Preserve the accepted DOS-maze appearance while pursuing the engine test.

## Small 3D engine test

Follow the [approved engine direction](ENGINE_PLAN.md), incorporating the user's 2026-11-26 clarification. Preserve original true-first-person, looting/transition, equipped-inventory, and progression rules.

The engine is true 3D. Generate arenas from bound 2D sector construction data, assemble their 3D gameplay geometry, and validate walls, floors, ceilings, seams, collision, and connectivity before replacing the current arena. Keep failed candidates isolated from the active world. Rust/WASM, symmetry, surface dressing, coarse lighting/palette, arena modifiers, and mirrors are directions to pursue in staged tests; performance numbers are measured targets.

The first [engine proof](../engine-test/README.md) is implemented separately in `engine-test/`: sealed sector-generated 3D arenas, fixed-step body/weapon collision, one procedural surface preset, coarse lightmaps/palette, validated GPU staging and manual activation, hidden controls, and bounded diagnostics/recovery. Deterministic structural/physics checks run in CI; desktop browser and soak checks have local evidence. Both title apps and their defaults remain unchanged.

The user accepted the small test. The subsequent [larger arena benchmark](../engine-benchmark/README.md) is implemented separately in `engine-benchmark/`, preserving `engine-test/` as the historical small baseline. It adds 75 m and 196 m fixtures, background generation/validation/baking, bounded candidate copy/upload, spatial acceleration, explicit atomic activation, and H tools for workloads, inspection, fixtures, routes, and exported benchmarks. An optional Quake-referenced movement profile follows the user's choice; baseline movement remains the default. The benchmark README records source references, measured timings, memory budgets, and parity limits.

The separately authorized [continuous fold experiment](../arena-fold/README.md) adds a sealed chamber, safe moving partitions and independent controlled void feedback. Its body / weapon guard and H controls do not alter either accepted engine test or title renderer. It remains a bounded transition proof; the original loot warning window and arbitrary candidate-arena transitions are not implemented here.

The user retained that experiment as candidate 1 and authorized [candidate 2](../arena-fold-2/README.md): fixed layouts audition / disappear / reappear, random instigators spread sector corruption, old geometry can persist across waves, and coherence reduces affected sectors toward a static world. All old bodies clear globally at wave end, including bodies in surviving sectors, as explicitly selected by the user. Inert fixtures demonstrate that timing; actual looting and game progression remain future work. Candidate 1 remains unchanged.

The user reported **Test PASS** and selected candidate 2 as the direction on 2026-11-26. Candidate 1 remains a historical comparison. The selected encounter transition uses discrete architecture changes, a living corruption-wave warning and global old-body cleanup; no moving architecture is required.

The proposed next milestone is a separate procedural-wave integration test: versioned sector/replacement-group ownership, compatible boundaries and composed-world validation, worker-prepared choices, safe atomic commits without fallback relocation, bounded resource retention, and the benchmark's coarse lighting combined with coverage/history rendering. Start at 75 m, then test 196 m. The [engine plan](ENGINE_PLAN.md) records the gaps, proposed restrictions and acceptance criteria. The compatible-interior subset is implemented separately in `arena-sweep/`; arbitrary topology and neighbour-dependent rebaking remain future work.

Audiovisual presets can be defined now against shared transition events: shadowless dynamic light/emissive changes, sector-local static/interference and glitches, spatial sound and procedural material changes. Prototype these in parallel with integration; final lighting, masks and spatial tuning need the real generated arena. Keep independent H controls and measured budgets. Authored surface tiles, arbitrary-surface locomotion, mirrors, combat, and broader/stacked generation remain later milestones. Physical device checks are pending; current movement uses desktop mouse/keyboard controls.

## Cross-device testing and deployment

Status: the user accepted both engine milestones and authorized public cross-device testing on 2026-11-26. The repository is public and Pages uses Actions with HTTPS enforced. The [test hub](https://pipebrain.github.io/eigengott/) links the [small engine](https://pipebrain.github.io/eigengott/engine-test/), [larger benchmark](https://pipebrain.github.io/eigengott/engine-benchmark/), and title studies. See [deployment details](DEPLOYMENT.md).

The v1.1.0 [DOS-maze runtime](../dos-maze/README.md) adds the minimal H menu, a release build identifier, and deterministic unit checks in GitHub Actions. Desktop GPU comparison/lifecycle/soak checks are provided separately. Physical multi-device acceptance remains pending; publishing is now authorized and configured.

1. The Pages workflow rebuilds the WASM runtimes and runs all deterministic engine/title checks before uploading and publishing the static artifact. Pull requests validate without deploying.
2. The hub, hidden H menus, and engine diagnostics/report exports identify the deployed commit. Direct `?tools=1` URLs open existing inspection controls without a physical H key.
3. The user's explicit authorization to make `pipebrain/eigengott` public and enable Pages supersedes the earlier visibility restriction.
4. Passing pushes to `main` deploy automatically. Keep `/engine-test/`, `/engine-benchmark/`, `/arena-fold/`, `/arena-fold-2/`, `/dos-maze/`, and `/vector-labyrinth/` available under the shared hub.
5. Test rendering, worker preparation/activation, controls, browser saves, and fixture/preset import/export across target WebGPU-capable browsers and devices. Record the build, device, browser, and results. Touch movement is still a future feature; current engine controls use keyboard and mouse.

## Game development

- Engine
- Gameplay
- Enemies
- Multiplayer


## Procedural sweep integration

[`arena-sweep/`](../arena-sweep/README.md) implements the latest collapse/return direction on both generated arena sizes. The fixed starting XY anchors an outward deletion and inward reconstruction. Protected clumps safely contain body/weapon across seams; contact produces transparent static fields. Bodies disappear with deleted clumps; those in surviving clumps clear at final return. Staged enemy fixtures and the player share one final field-release / loot-close boundary.

The current integration preserves structural boundaries and changes compatible interiors/material generations. It includes bounded worker staging, per-clump resource selection, shadowless light, eight-voice spatial sound and controlled screen-space void feedback. It has no actual looting, combat or enemy AI. The benchmark, small engine, both earlier fold tests and title apps remain unchanged. Use the new test's H menu for medium/large workload, clump/coherence, protection, effects and performance checks.


## Interactive Encounter before Structural Recomposition

The user accepted the procedural Recomposition mechanic and authorized a separate [`encounter-test/`](../encounter-test/README.md). It adds all released OpenArena 0.8.8 character models/named roster entries and thirteen weapons, vertex animation and attachments, original bounded combat/AI, precomputed physical-profile routes, automatic encounters/Recomposition, test inventory and the requested debug overlays. **Per-character physical envelopes are the default**, following the user's explicit choice. All requested corner overlays and browser console logging default ON; H controls them independently. Quake/OpenArena bindings provide gameplay input.

All-weapons inventory is a test exception; actual corpse equipment exchange is skipped. The production equipped-inventory, true-first-person, no-gameplay-HUD, death-transfer and ending contracts remain authoritative. The accepted previous apps are preserved. OpenArena media notices, original conversion inputs, available preferred authoring sources and provenance accompany the test.

Next: Structural Recomposition with actual walls/floors/ceilings/ramps/openings and their collision, connectivity and lighting versions. Prepare navigation for the accepted rebuilt composition before releasing live opponents. Retain protected geometry and preserve safe body/weapon clearance; validate old/new seams and composed-world reachability. Audio/visual authoring can be tuned independently after the mechanic is sound.

## Playable equipment milestone

Build a separate `playable-test/`: finite Self ledger and checkpoints, one equipped gun, armor/mod exchanges through a timed 3D loot interface, shared maze/history feedback, damage feedback and bounded AI recovery. Preserve the accepted encounter and engine apps. See [ENGINE_PLAN.md](ENGINE_PLAN.md#separate-playable-milestone-equipment-and-a-finite-run).

The user supplied three audio placeholders and explicitly prohibited audio effects in this milestone. Deferred speed/pitch/stretch-ramping design: [SOUND_DESIGN.md](SOUND_DESIGN.md). Height-rich structural replacement, surface authoring/joining and multiple sky scenes follow the equipment slice.

## Playable presentation revision

2026-11-27: stock armor / sprite assets, transparent and additive materials, shadowless event lights, MD3 death animations, and native pointer drag-to-Self loot in `playable-test/`. Add standalone procedural audio auditions in `audio-previews/`; keep runtime recordings unchanged until the user selects replacements. See [engine direction](ENGINE_PLAN.md#playable-presentation-revision--2026-11-27) and [sound design](SOUND_DESIGN.md).

## Playable falling-void revision — 2026-11-27

The latest approved direction supersedes drag-to-Self loot, lightmap shading and shadowless-only lighting in `playable-test/`. Collapse deletes all occupied groups outside-in within five real seconds; the captured body/weapon clump disappears last. Rendering and triangle collision share one visibility mask. The player then falls through pure monochrome DOS-maze feedback while three random drops drift near the POV. One successful click replaces a complete item, including its installed fragment; misses are harmless and unchosen loot is lost. A five-second timeout preserves gear. Restore the clearance-checked landing clump beneath the original XY, land without damage, then rebuild outward within five seconds and share Release. The full structural blueprint remains validated and fixed; this does not implement new structural topology generation.

Use 128 runtime lights by default, no baked or sampled lightmaps and no ambient fill. Environmental emitters follow group visibility. Explicit cutaway sky emission defaults to zero. Coarse player/object AABB shadows are allowed; no triangle shadow maps. Rocket flare/thrust shader references must resolve and blend additively. H retains independent lighting, shadow, phase and performance controls. Labels reuse the title study's glyph style, with one-pixel orthogonal corners and at most two leader segments.

Only the supplied audio placeholders remain integrated. The newly authorized processing is a short gain-only ambient/warning crossfade; rate, pitch and timbre are unchanged. Procedural auditions remain separate. See [sound design](SOUND_DESIGN.md) and [current playable test](../playable-test/README.md).


## Structural playable revision — 2026-11-27

The user approved retaining each arena's grid/footprint while regenerating occupancy, walls, floor/ceiling heights and sky openings around a reserved landing clump. This is implemented only in `playable-test/`; accepted historical engine, benchmark, sweep, encounter and title applications remain unchanged.

Before Collapse, a worker validates sealed welded planar geometry, equipped-player clearance and precomputed body-profile traversal. The host validates a complete physically fitting farthest-spawn cohort and stages GPU resources. In the fully empty void, rendering/collision/navigation switch atomically; Return inserts the new structure outward from the captured XY. Failed candidates preserve the active arena. Checkpoints retain the complete composed blueprint and props rather than relying on a seed alone. Small, Medium and Large remain selectable. This first structural pass changes the full arena outside protected space; population-driven partial structural persistence is still pending.

New shared height knots provide ramps, vantage differences and low basins with excluded environmental illumination. Three bounded miniature sky scenes use simple boxes/pyramids, scrolling tiled clouds and scaled-camera parallax. Sky ceilings are explicitly sealed physical boundaries. Runtime sky/environment/event point emitters share the 128-light budget; no lightmaps or ambient fill are restored. AI currently remains LOS-based, so dark-space hiding needs later perception work.

Each cohort uses physically checked greedy max-min spawn placement over reachable nodes. Selves may target one another according to proximity and decaying received damage. Restored maze curtains/glow follow deletion/insertion events. The user authorized original OpenArena positional wave cues; their ambient/warning/death placeholders remain unchanged, rate 1 / detune 0 with the approved gain-only crossfade. Independent H controls and structural rejection/recovery diagnostics accompany this revision. See [playable details and verification](../playable-test/README.md) and [sound design](SOUND_DESIGN.md).


## Game build v0.1.0 — 2026-11-27

The main URL now opens the accepted DOS-maze composition, then clears it on the first real key, click/tap, pointer movement or wheel input and enters gameplay directly. Prepare the arena behind the title and suspend hidden gameplay rendering once ready. If input arrives first, clear immediately and carry capture/audio activation through preparation. Preserve the test hub at `tests.html` and leave the historical DOS-maze v1.1.1 route/version unchanged.

The release preset is authoritative in `game/preset.js`: 32 total Selves, S_Marine/default, inclusive random 1–7 opponents per encounter, the requested presentation/lighting values, a ten-second void-loot window and 0.5 sky parallax. Clamp only to living available Selves; validate the drawn cohort before Collapse and retain the count through Return/checkpoint restoration. The older playable-test route retains its own defaults, with expanded H limits. Release checkpoints use a separate browser key. This game version starts a new v0.x numbering sequence; existing v1.x tags identify the DOS-maze studies.


## Game v0.1.1 — population, movement and chunky combat

The v0.1.1 build used 6,022; the corrected starting population is **6,174**, including the player (v0.1.2). The release starts all first-arena actors with shotguns. Every new composition randomly selects Small (1–3), Medium (3–7), or Large (3–15) opponents, capped by remaining Selves. Recomposition keeps movement/look enabled, removes player forcefields, allows falls and footprint changes, and proves a clear supported player position before combat Release. Enemies are spread relative to that final position. Canonical collision/navigation still validate before Collapse; failed candidates retain the active world.

Loot entry restores full health without repairing worn armor. Surviving NPCs improve equipped guns/armor/fragments after clears; the player still needs loot. Exact population counters and a bounded live equipment pool replace the 65-copy test cap. The initial tunable offscreen elimination rate is 10% of the unmaterialized population per clear, exposed in H. Item quality uses logarithmic combat scaling; this is prototype balance, with narrative death transfer/endings still pending.

Combat lights are wider/brighter. The game defaults to nearest textures, stepped light/alpha/colour levels and blocky HUD/weapon effects. Gun collision separates the body safely from surfaces instead of pinning movement or simply removing physical gun clearance. Audio placeholders and processing remain unchanged. Historical accepted applications stay intact. [Current game details and verification](../game/README.md).


## Population correction — v0.1.2

The user corrected the intended Kaprekar motif to **6,174 total Selves**, including the player. New games use that exact count. The economy retains its bounded 48-record live pool and exact population counters; no actor/equipment allocation scales with all 6,174 copies. Full-run tests now verify accounting, upgrades, unique identities, checkpoint round trips and bounded storage through convergence. Existing imported checkpoints retain their own populations and progress.

Additional local reference/media sources are available under `src-inspiration/assets` and `src-inspiration/games` (armor, props, sound/music, skies, textures, weapons and reference games). They remain local inputs; this population-only correction adds no runtime media or rendering cost.


## Recomposition and loot corrections — v0.1.3

Keep the live scene drawing through Collapse, void loot and Return, including the no-choice timeout. Free-void falling is a feedback presentation: never accelerate the physical player below the upcoming floor. Place the newly equipped body and weapon on a validated visible landing clump before reconstruction spreads outward. Collision checks against the nonphysical void player cannot prevent remaining prop records from updating; normal placement and combat collision remain checked.

All displayed loot can be selected. Every stock gun and armor piece has an actual-WASM safe-return regression. Square item bounds drift and bounce; title-font labels drift nearby, avoid other labels, may overlap items, and attach with at most two axis-aligned one-pixel segments. Bounded layout tests cover one to five items in desktop and portrait shapes. New defaults use 10% dark basins, dynamic-light intensity 1.5 and sky emission 0.65, retaining genuinely unlit spaces and no lightmaps.


## Continuous supported Return and reference rendering — v0.1.4

The user clarified: keep the loot interval, then keep player movement live while the new arena builds outward from the player's return XY. There is no physical landing drop in this mode. During every deletion / insertion frame, set the player's feet to the logical sector flat (accounting for body footprint); if no flat exists, retain the last supported height. Mouse recapture may be denied without disabling keyboard movement or uncaptured mouse look. Do not clear held movement merely because capture changes during intermission. Verify this using native browser events with recapture explicitly denied, plus per-frame floor-height / vertical-velocity checks.

Default game rendering is fixed 640×480 at 4:3, nearest-scaled with letterboxing. World, actors, feedback, sky views, loot models / labels and effect composition target the same internal raster; asset texture and font-mask dimensions are independent. Keep the title's accepted DOS-maze renderer and debug tools available. H can compare adaptive resolution.

Restore warm grey / charcoal / ochre / brown / olive material ramps from the provided art.png, pallet.png and lighting.png references. Use stable sampled surface detail and dynamic lighting; deduplicate local fixtures per clump, reduce overlapping sky emission and retain dim light through finer quantization / tone mapping instead of flooring it to black. Source-free scenes remain black. No lightmaps or audio processing are added. Dark basins can receive local light spill rather than forcing every distant source's radius to collapse to zero.

## Level generator M1

Published as a separate blockout test with a shared build menu. See [the generator design and roadmap](LEVEL_GENERATOR.md) and [runtime/build commands](../level-generator/README.md). The current milestone is flat 6/9/12-room layouts, random 4–12 m corridors, sealed structure, precomputed navigation and actual-controller route tours. Advanced geometry/features and integration remain later work.
