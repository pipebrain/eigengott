# Playable equipment milestone

[Play](https://pipebrain.github.io/eigengott/playable-test/) · [H tools](https://pipebrain.github.io/eigengott/playable-test/?tools=1) · [Deferred sound design](../docs/SOUND_DESIGN.md)

A separate vanilla JS / raw WebGPU / Rust WebAssembly gameplay slice. The accepted encounter, sweep, benchmark, engine and title applications remain unchanged. OpenArena media are reused from `../encounter-test/`, with its existing [credits and source archives](../encounter-test/licenses/index.html); they are not duplicated here.

## What to play

Enter a finite run with thirteen Selves, including the player, and three opposing Selves per encounter by default. Defeat opponents, select equipment during Recomposition, then re-enter combat after shared Release. H includes **Clear encounter → loot [dev]** for immediate equipment inspection, a firing lane, invulnerability, AI freeze, damage/reaction controls and model selection.

A Self has a persistent identity and can die only once in the run ledger. Staging draws from living identities instead of creating an unlimited new population. The compatible-interior comparison mode retains its coherence control. The structural mode currently replaces the complete arena outside the reserved landing clump; population-driven partial structural persistence remains later work. The last opposing death completes the prototype run without another ordinary wave. Player death ends this prototype run. Narrative death transfer, the original final endings, multiplayer and production progression are later work; this test does not replace those design contracts.

## Equipment and loot

Default inventory is one equipped gun and three worn armor slots: helmet, torso and legs. Each item permits one installed fragment. The starting gun is a machinegun. Opponents initially distribute machinegun, shotgun and plasma archetypes; only those three weapon models load at startup. All thirteen imported weapons remain available through an explicit development inventory toggle, which prepares the additional media before enabling selection.

Six original armor presets trade protection against movement and, for the heavy helmet, viewport restriction. Protection depletes under damage; injury persists until loot entry, which restores health to 100 while retaining armor wear. Five fragment prototypes provide tighter patterns, stronger/slower shots, thermal silhouettes, extra protection or lighter movement. Thermal rendering identifies visible living opposing models; it does not reveal actors through opaque geometry. It is a prototype heat tint, not a thermal simulation or completed AI darkness/perception system.

After the encounter clears, a worker generates and validates replacement structure and traversal tables. Its geometry, props and physically fitting spawn cohort are staged before a prepared outside-in Collapse deletes every occupied sector group from the outer arena toward the player's captured XY. Ordering varies within radial bands; the landing clump disappears last. Deletion applies to both rendering and triangle collision, including group-owned props and environmental emitters. Collapse lasts at most five real seconds.

Once all groups are gone, the actual player falls under controlled gravity through the void. Only a few randomly sampled equipment drops drift near the POV: three by default, including a random weapon when one is available. Rendered MD3 models carry one-pixel orthogonal corner boxes, a single title-style label and a leader of at most two orthogonal segments. The accepted DOS-maze WASM supplies the monochrome field. The title study uses custom Gothic glyphs rather than a font file; the labels reuse its six custom glyphs and condensed serif fallback.

Click one item to replace the corresponding equipped item, including its installed fragment. A missed click is harmless. Only one successful selection is permitted; unchosen items are discarded. No selection after five real seconds preserves the current loadout. Equipment changes are atomic and check the canonical landing geometry and solid props before committing, even while the player is below the arena.

Selection or timeout restores the landing clump beneath the same captured XY. A short collision-driven fall lands without damage, then Return rebuilds outward within five real seconds. Shared Release clears fields and enables the next encounter. A seam-spanning body/weapon envelope restores the adjacent cells as one safe landing clump. The prior drag-to-Self interface, cluster-expiring loot choices and slow-motion selection have been superseded in this separate test. Legacy speed inputs do not extend the phase deadlines.

Stock red/yellow OpenArena armor pickup MD3s remain placeholders for armor roles; the stock shard remains available in the asset pack. Production modular worn armor meshes and inspection animations remain later work. Death animations, particles/lights, exactly-once accounting and final-opponent precedence are preserved.

## Shared labyrinth and feedback

`maze.js` runs the accepted `dos-maze/maze.wasm` generator with its reference guide to rasterize an orthogonal line field through WebGPU. It caches that field until output dimensions change. `shaders/labyrinth.wgsl` is shared by the full-screen history/loot effect and world-space forcefields. Quantized regional offsets preserve the underlying 17-pixel line/gap pitch; the history warp supplies deliberate stretching and architectural smearing. No per-fragment search through maze line segments occurs.

Two explicitly owned history textures alternate each frame. Clean characters, guns, effects, equipment previews and overlays are excluded from history. Loot previews use the same WebGPU device, bounded meshes/uniforms, viewport/scissor draws and a separate depth attachment. They do not create a device/canvas per item. The final loot presentation dims the background while leaving previews sharp.

This is a shared effect module and composition, not a claim that the entire 3D world, vector generation, history and equipment rendering fit in one shader invocation. The accepted title app remains unchanged.

Injury uses a persistent red procedural edge layer; armor uses its preset tint and remaining condition; incoming damage produces a short directional flash. The falling selection suppresses these overlays and development HUDs so only the feedback and drops remain.

## Dynamic-only lighting

No lightmap is baked, uploaded or sampled by this playable renderer. World surfaces, props and animated bodies use runtime point emitters with no ambient/key/fill or fog illumination. With environmental emitters OFF, sky emission zero and no event light, world RGB is exactly black. Environmental lights disappear and return with their owning groups. Regional sky emission is explicit and defaults to 0.35. Sky openings use bounded runtime point emitters with their scene palette. Low-basin fixtures are omitted and nearby emitter radii are clipped before they reach basin interiors; event lights can still illuminate those areas.

The default light budget and hard capacity are **128**. Short event and projectile lights take priority, followed by nearby environmental emitters. **Box shadows default ON:** up to 128 player/object AABBs, with eight nearby candidates per point light and an optional debug cutaway-sky test. These are deliberately coarse occluders; world triangles do not cast shadows and mesh silhouettes are not traced. No shadow maps are allocated. Loot previews use a separate inspection point emitter so their models stay visible in the void. H exposes emitter, sky, box-shadow and light-budget controls.

Particles cap at 256 and sprite draws at 512. Rocket flare/thrust shader textures now resolve from the stock archive and use additive blending rather than opaque fallbacks. Declared projectile billboard stages use camera-facing sprites with their stock color/rotation, texture frames and derived surface bounds; solid rocket, grenade and mine geometry remains opaque. Material lookup normalizes legacy backslash paths. Clean characters, sprites, item previews and labels stay outside architectural history.

## Placeholder audio

The user's `ambient-loop.wav`, `warn-loop.wav` and `death.wav` remain byte-for-byte unchanged, at playback rate 1 and detune 0. Ambient and warning use an aggressive **180 ms gain crossfade** at Collapse and Release; the loops are not stopped/restarted at those boundaries. The original death recording remains a one-shot. Pause, hidden-page suspension and explicit mute stop playback normally. No stretching, pitch shift, filters, reverb or procedural auditions are integrated. Existing OpenArena gameplay samples remain original recordings. The newly authorized deletion, insertion and release cues are unmodified OpenArena teleport/respawn samples, positioned at actual sector events through HRTF panners. Wave playback caps at eight voices with a 55 ms event throttle; the total audio pool caps at nineteen voices. H controls wave sound and volume independently. Included source samples, hashes and provenance are in [wave audio notices](licenses/wave-audio.json).

[Separate audio auditions](../audio-previews/) are still unintegrated. Deferred stretching/ramping is documented in [SOUND_DESIGN.md](../docs/SOUND_DESIGN.md).

## Controls

- H: tools; **Clear encounter → loot [dev]** starts the new full sequence.
- During the void: click one drifting item; selection closes after five seconds.
- WASD / arrows: movement; mouse: look; mouse 1 / Ctrl: attack; Space: jump; C: crouch; Shift: walk.
- F: fullscreen; Esc: release capture; backtick: development console.
- All thirteen weapons remain available through the development inventory option.

## Physics, AI and remaining engine work

Body envelopes remain character-specific and conservative. Armor adds bounded radius/height; movement penalties use a real WASM speed multiplier. Worker navigation uses the largest prototype armor allowance for each model. Held weapon/body selection must fit live structural and overlay collision. Bot recovery tries clear local directions and briefly retains a successful direction, with configurable reaction time and damage. It is not a complete botlib or balanced production AI.

### Structural Recomposition

The default now generates genuinely different room occupancy, partitions, openings, floor/ceiling heights and sky roles on the same sector grid and footprint. Small (~20 m), Medium (75 m) and Large (196 m) are selectable in H. Canonical shared height knots produce planar collision surfaces, ramp gradients and welded floor/ceiling seams. The landing clump preserves occupancy, height knots, props and sky roles. Generation rejects leaks, bad bindings/winding, intersections, capacity failures and insufficient physically traversable connectivity before Collapse. Bounded retries can fall back to open space outside the protected patch; failures retain the active arena and report the failing seed.

Render geometry, triangle collision, navigation and emitter ownership switch together in the fully empty void. Return inserts the new groups outward from the original XY and activates the prevalidated NPC positions as their groups restore. Checkpoints store the full composed blueprint, actor state and props: a seed alone cannot reproduce a composition containing an older protected patch. H provides structural enablement, height deviation, dark-basin fraction, a deliberate leak-rejection fixture and diagnostics. A compatibility toggle retains the prior interior-only comparison mode.

Every encounter places opposing Selves by greedy max-min sampling over all reachable navigation nodes, checking each actual body/weapon envelope and previous placements. It maximizes the next placement's distance from the existing cohort; it is not a global optimal-packing proof or a line-of-sight fairness guarantee. AI selects among all opposing Selves by distance and decaying recent damage, enabling infighting; H controls retaliation bias. AI still uses line of sight without light-aware stealth perception.

### Regional 3D skies and wave presentation

Three miniature box/pyramid scenes render to fixed 256 × 128 views. A scaled world camera supplies parallax; two small tiled cloud layers scroll independently. Sky-design reference: [id Software's Quake sky renderer](https://github.com/id-Software/Quake/blob/master/WinQuake/gl_warp.c). Geometry and textures here are original procedural approximations. Visible sky ceilings remain sealed collision surfaces, blocking actors and projectiles. Sky emission, coverage, scrolling, parallax and scene rendering have H controls. These are simple regional scenes, not portal-recursive or production sky authoring tools.

Deletion and insertion events restore travelling 3D maze curtains and glow, with independent H effect/glow controls. There is no moving world architecture. Dynamic-only lighting, 128-light capacity, coarse box shadows and owned feedback remain intact. The surface editor, placement-role authoring, complex visual relief, stacked/spiral layouts, light-aware AI and population-driven partial structural persistence remain later work.

## Verification

```sh
sh playable-test/tools/build-wasm.sh
node playable-test/tools/check-core.mjs
node playable-test/tools/check-structure.mjs
node playable-test/tools/check-structure-browser.mjs
node playable-test/tools/check-browser.mjs
node playable-test/tools/check-soak.mjs
node playable-test/tools/check-lifecycle.mjs
node playable-test/tools/check-effects-browser.mjs
node playable-test/tools/check-lighting-browser.mjs
node playable-test/tools/check-deadline-browser.mjs
node audio-previews/tools/check-audio.mjs
node audio-previews/tools/check-browser.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
node tools/check-pages-browser.mjs
PLAYABLE_URL=https://pipebrain.github.io/eigengott/playable-test/ node playable-test/tools/check-browser.mjs
```

Core checks cover finite identities, atomic one-choice replacement, real collision deletion, falling, deadlines, safe landing, shared Release, final-opponent precedence, fixed 32 MiB memory, AI recovery, source assets and unchanged WAV bytes. Browser checks exercise native click selection, misses, timeout, portrait layout, feedback isolation, recovery, checkpoints, death and resize. Structural checks cover all three sizes, exact protected geometry, full-blueprint reproduction, sealed sky traces, dark-basin light exclusion, spread spawns and NPC retaliation. Browser checks also cover atomic replacement, rejected candidates, distinct miniature skies, parallax, cloud scrolling and Small play. Pixel checks verify zero-light darkness, explicit sky illumination, AABB shadows, 128-light capacity, rocket transparency, smoke alpha and animated death frames.

Performance evidence is recorded in `evidence/verification.json`; it is a local development sample, not physical-device acceptance. Existing engine, benchmark, encounter and title applications remain unchanged. Stock media inputs, GPL notices, authoring sources and hashes accompany [licenses](licenses/index.html).


## Shared v0.1.1 engine changes

The combined [game build](../game/README.md) enables the 6,022-Self economy, random workload cohorts, shotgun start, chunky effects and unrestricted Recomposition. This standalone route retains its original fixed-population, fixed-workload/protected-clump defaults; H exposes comparisons. The shared engine now supports exact larger population counters and compact progression checkpoints, larger combat lights, nearest stock texture sampling, optional stepped effects and collision-safe gun-driven body displacement. Loot heals health on both routes. See the game notes for current balance rules and acceptance checks.
