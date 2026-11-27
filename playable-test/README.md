# Playable equipment milestone

[Play](https://pipebrain.github.io/eigengott/playable-test/) · [H tools](https://pipebrain.github.io/eigengott/playable-test/?tools=1) · [Deferred sound design](../docs/SOUND_DESIGN.md)

A separate vanilla JS / raw WebGPU / Rust WebAssembly gameplay slice. The accepted encounter, sweep, benchmark, engine and title applications remain unchanged. OpenArena media are reused from `../encounter-test/`, with its existing [credits and source archives](../encounter-test/licenses/index.html); they are not duplicated here.

## What to play

Enter a finite run with thirteen Selves, including the player, and three opposing Selves per encounter by default. Defeat opponents, select equipment during Recomposition, then re-enter combat after shared Release. H includes **Clear encounter → loot [dev]** for immediate equipment inspection, a firing lane, invulnerability, AI freeze, damage/reaction controls and model selection.

A Self has a persistent identity and can die only once in the run ledger. Staging draws from living identities instead of creating an unlimited new population. Remaining population drives structural persistence through coherence: the existing compatible-interior wave affects progressively less architecture. The last opposing death completes the prototype run without another ordinary wave. Player death ends this prototype run. Narrative death transfer, the original final endings, multiplayer and production progression are later work; this test does not replace those design contracts.

## Equipment and loot

Default inventory is one equipped gun and three worn armor slots: helmet, torso and legs. Each item permits one installed fragment. The starting gun is a machinegun. Opponents initially distribute machinegun, shotgun and plasma archetypes; only those three weapon models load at startup. All thirteen imported weapons remain available through an explicit development inventory toggle, which prepares the additional media before enabling selection.

Six original armor presets trade protection against movement and, for the heavy helmet, viewport restriction. Protection depletes under damage; injury persists through the current run. Five fragment prototypes provide tighter patterns, stronger/slower shots, thermal silhouettes, extra protection or lighter movement. Thermal rendering identifies visible living opposing models; it does not reveal actors through opaque geometry. It is a prototype heat tint, not a thermal simulation or completed AI darkness/perception system.

After the encounter clears, a prepared outside-in Collapse deletes every occupied sector group from the outer arena toward the player's captured XY. Ordering varies within radial bands; the landing clump disappears last. Deletion applies to both rendering and triangle collision, including group-owned props and environmental emitters. Collapse lasts at most five real seconds.

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

No lightmap is baked, uploaded or sampled by this playable renderer. World surfaces, props and animated bodies use runtime point emitters with no ambient/key/fill or fog illumination. With environmental emitters OFF, sky emission zero and no event light, world RGB is exactly black. Environmental lights disappear and return with their owning groups. Cutaway sky emission is explicit and defaults to zero; it is a simple directional sky emitter, not the later regional 3D skybox system.

The default light budget and hard capacity are **128**. Short event and projectile lights take priority, followed by nearby environmental emitters. **Box shadows default ON:** up to 128 player/object AABBs, with eight nearby candidates per point light and bounded directional-sky tests. These are deliberately coarse occluders; world triangles do not cast shadows and mesh silhouettes are not traced. No shadow maps are allocated. Loot previews use a separate inspection point emitter so their models stay visible in the void. H exposes emitter, sky, box-shadow and light-budget controls.

Particles cap at 256 and sprite draws at 512. Rocket flare/thrust shader textures now resolve from the stock archive and use additive blending rather than opaque fallbacks. The flare is a camera-facing sprite; solid rocket geometry remains opaque. Clean characters, sprites, item previews and labels stay outside architectural history.

## Placeholder audio

The user's `ambient-loop.wav`, `warn-loop.wav` and `death.wav` remain byte-for-byte unchanged, at playback rate 1 and detune 0. Ambient and warning use an aggressive **180 ms gain crossfade** at Collapse and Release; the loops are not stopped/restarted at those boundaries. The original death recording remains a one-shot. Pause, hidden-page suspension and explicit mute stop playback normally. No stretching, pitch shift, filters, reverb or procedural auditions are integrated. Existing OpenArena gameplay samples remain original recordings.

[Separate audio auditions](../audio-previews/) are still unintegrated. Deferred stretching/ramping is documented in [SOUND_DESIGN.md](../docs/SOUND_DESIGN.md).

## Controls

- H: tools; **Clear encounter → loot [dev]** starts the new full sequence.
- During the void: click one drifting item; selection closes after five seconds.
- WASD / arrows: movement; mouse: look; mouse 1 / Ctrl: attack; Space: jump; C: crouch; Shift: walk.
- F: fullscreen; Esc: release capture; backtick: development console.
- All thirteen weapons remain available through the development inventory option.

## Physics, AI and remaining engine work

Body envelopes remain character-specific and conservative. Armor adds bounded radius/height; movement penalties use a real WASM speed multiplier. Worker navigation uses the largest prototype armor allowance for each model. Held weapon/body selection must fit live structural and overlay collision. Bot recovery tries clear local directions and briefly retains a successful direction, with configurable reaction time and damage. It is not a complete botlib or balanced production AI.

The accepted structural topology/BVH remains fixed. Recomposition now temporarily removes all sector-group rendering and collision, then restores the same validated structural blueprint with compatible interior changes. Height-rich actual structural replacement, full composed-world validation/navigation, the surface editor and placement-role flags, detailed visual surfaces over simple collision planes, and multiple regional 3D sky scenes remain the following engine stage.

## Verification

```sh
sh playable-test/tools/build-wasm.sh
node playable-test/tools/check-core.mjs
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

Core checks cover finite identities, atomic one-choice replacement, real collision deletion, falling, deadlines, safe landing, shared Release, final-opponent precedence, fixed 32 MiB memory, AI recovery, source assets and unchanged WAV bytes. Browser checks exercise native click selection, misses, timeout, portrait layout, feedback isolation, recovery, checkpoints, death and resize. Pixel checks verify zero-light darkness, explicit sky illumination, AABB shadows, 128-light capacity, rocket transparency, smoke alpha and animated death frames.

Performance evidence is recorded in `evidence/verification.json`; it is a local development sample, not physical-device acceptance. Existing engine, benchmark, encounter and title applications remain unchanged. Stock media inputs, GPL notices, authoring sources and hashes accompany [licenses](licenses/index.html).
