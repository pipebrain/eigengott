# Playable equipment milestone

[Play](https://pipebrain.github.io/eigengott/playable-test/) · [H tools](https://pipebrain.github.io/eigengott/playable-test/?tools=1) · [Deferred sound design](../docs/SOUND_DESIGN.md)

A separate vanilla JS / raw WebGPU / Rust WebAssembly gameplay slice. The accepted encounter, sweep, benchmark, engine and title applications remain unchanged. OpenArena media are reused from `../encounter-test/`, with its existing [credits and source archives](../encounter-test/licenses/index.html); they are not duplicated here.

## What to play

Enter a finite run with thirteen Selves, including the player, and three opposing Selves per encounter by default. Defeat opponents, select equipment during Recomposition, then re-enter combat after shared Release. H includes **Clear encounter → loot [dev]** for immediate equipment inspection, a firing lane, invulnerability, AI freeze, damage/reaction controls and model selection.

A Self has a persistent identity and can die only once in the run ledger. Staging draws from living identities instead of creating an unlimited new population. Remaining population drives structural persistence through coherence: the existing compatible-interior wave affects progressively less architecture. The last opposing death completes the prototype run without another ordinary wave. Player death ends this prototype run. Narrative death transfer, the original final endings, multiplayer and production progression are later work; this test does not replace those design contracts.

## Equipment and loot

Default inventory is one equipped gun and three worn armor slots: helmet, torso and legs. Each item permits one installed fragment. The starting gun is a machinegun. Opponents initially distribute machinegun, shotgun and plasma archetypes; only those three weapon models load at startup. All thirteen imported weapons remain available through an explicit development inventory toggle, which prepares the additional media before enabling selection.

Six original armor presets trade protection against movement and, for the heavy helmet, viewport restriction. Protection depletes under damage; injury persists through the current run. Five fragment prototypes provide tighter patterns, stronger/slower shots, thermal silhouettes, extra protection or lighter movement. Thermal rendering identifies visible living opposing models; it does not reveal actors through opaque geometry. It is a prototype heat tint, not a thermal simulation or completed AI darkness/perception system.

After the encounter clears, the equipment interface releases mouse capture and displays actual rotating weapon meshes and simple original 3D armor prototypes. Point to an item to compare it. Drag equipment onto the actual selected MD3 Self; compatible helmet, torso, legs or weapon targets highlight. Drag a fragment handle separately to transfer it. Drag empty model space to rotate the Self; projected body targets follow the model. Invalid drops return to the pool, and disappearing options or Release cancel unfinished drags. Displaced equipment/mods remain in the temporary pool with the source cluster's expiry. There is no backpack or loose-mod inventory. Exchanges validate the expanded character envelope and held weapon atomically; blocked swaps preserve both current gear and source items.

Armor previews use the stock red/yellow OpenArena MD3 pickup models; fragments use the stock armor shard. They are role placeholders, not new modular worn meshes. Production interchangeable worn armor meshes, hand inspection animations and helmet construction remain later work. Mod installation reports a development status message as requested.

The pool belongs to defeated Selves in the current encounter. Items expire when their originating cluster is deleted; protected/surviving-cluster options remain until shared Release. Opponents play their selected MD3 death clips, dissolve with stock-sprite particles and a short shadowless light, then disappear. Own-player death remains visible before the end panel and lowers the first-person camera above floor level. Watching the wave with **L** hides the interface; reopening does not reset its deadline. Selection ends at the same fixed boundary that closes the intermission and releases all fields/enemies. The page attempts to restore mouse capture automatically after a normally played encounter; browsers that require another gesture display the Enter button. Opening H cancels automatic recapture.

Simulation and the wave run at 0.35 speed during selection by default. Mouse/UI and preview rotation remain responsive. The debug loop HUD shows remaining real-time selection seconds. This loot-screen direction replaces the proposed physical pickup and run-to-item warning phase.

## Shared labyrinth and feedback

`maze.js` runs the accepted `dos-maze/maze.wasm` generator with its reference guide to rasterize an orthogonal line field through WebGPU. It caches that field until output dimensions change. `shaders/labyrinth.wgsl` is shared by the full-screen history/loot effect and world-space forcefields. Quantized regional offsets preserve the underlying 17-pixel line/gap pitch; the history warp supplies deliberate stretching and architectural smearing. No per-fragment search through maze line segments occurs.

Two explicitly owned history textures alternate each frame. Clean characters, guns, effects, equipment previews and overlays are excluded from history. Loot previews use the same WebGPU device, bounded meshes/uniforms, viewport/scissor draws and a separate depth attachment. They do not create a device/canvas per item. The final loot presentation dims the background while leaving previews sharp.

This is a shared effect module and composition, not a claim that the entire 3D world, vector generation, history and equipment rendering fit in one shader invocation. The accepted title app remains unchanged.

Injury uses a persistent red procedural edge layer; armor uses its preset tint and remaining condition; incoming hits create a brief brighter directional flash. Their opacity controls are independent in H. Cast shadows remain disabled. Bounded event lights add to the static lightmap and illuminate rendered world faces, props and characters. Default light budget is 16, capped at 32. Particle simulation caps at 256 and instanced sprite draws at 512. Muzzle flashes preserve stock additive/animated texture stages; smoke uses alpha blending with depth tests and no depth writes. Effects no longer use opaque placeholder cubes. The material converter supports the selected blend, animation, constant-color and UV rotation/scroll stages; it is not a full Quake shader-language implementation.

## Audio: deliberately unprocessed

The user's `ambient-loop.wav`, `warn-loop.wav` and `death.wav` are copied byte-for-byte into `assets/`. Combat uses ambient; loot adds the warning loop; player death uses the one-shot recording. Playback rate is always **1.0**, detune **0**. Master gain/mute are the only signal-level controls. Existing OpenArena weapon/footstep/pain cues also play as raw samples through a bounded eight-voice transient pool. No pitch shifting, time stretching, speed ramps, filters, reverb, distortion, compressor, spatial processing or synthesized effects are applied. Gameplay slow motion does not slow audio.

Standalone procedural A/B candidates are available at [Audio auditions](https://pipebrain.github.io/eigengott/audio-previews/); they are not imported or integrated by this runtime. The supplied recordings are placeholders, not newly designed sounds or guaranteed finished loop seams. The original audio remains the user's design. The deferred stretching/ramping proposal is recorded in [SOUND_DESIGN.md](../docs/SOUND_DESIGN.md), linked from both engine planning documents. Audio never determines the simulation's Release boundary. Pause/hiding/reset stop sources; only an unlocked audio context can start playback.

## Persistence and controls

Automatic checkpoints are saved in browser storage at safe encounter/load/reset boundaries. Export returns the last boundary checkpoint; Import/Resume validate identities and equipment and reconstruct a safe arena before activation. Mid-wave geometry, exact actor positions and in-flight projectiles are not serialized. A checkpoint resumes an encounter from a validated placement. Browser storage failures remain playable with explicit export available.

- WASD / mouse: move and look. Space: jump. C: crouch. Shift: walk.
- Mouse 1 / Ctrl: attack. Mouse 2 / Alt: strafe. Mouse 3: zoom.
- H: tools. L: show/hide equipment during Recomposition. N: manual development wave.
- Number keys / wheel select additional guns only when the development inventory is enabled.
- F: fullscreen. Esc: release capture. Backtick: development console.

Default-on loop/metrics/kill/log overlays remain development UI, with independent H toggles. Equipment comparisons use qualitative descriptions by default; numeric state is available in diagnostics. Touch inspection and item selection are supported through normal UI; touch movement is not implemented.

## Physics, AI and remaining engine work

Body envelopes remain character-specific and conservative. Armor adds bounded radius/height; movement penalties use a real WASM speed multiplier. Worker navigation uses the largest prototype armor allowance for each model. Held weapon/body selection must fit live structural and overlay collision. Bot recovery tries clear local directions and briefly retains a successful direction, with configurable reaction time and damage. It is not a complete botlib or balanced production AI.

The accepted structural topology/BVH remains fixed. Current Recomposition replaces compatible interiors/materials, with the protected player support intact. Height-rich actual structural replacement, full composed-world validation/navigation, the surface editor and placement-role flags, detailed visual surfaces over simple collision planes, and multiple regional 3D sky scenes remain the following engine stage.

## Verification

```sh
sh playable-test/tools/build-wasm.sh
node playable-test/tools/check-core.mjs
node playable-test/tools/check-browser.mjs
node playable-test/tools/check-soak.mjs
node playable-test/tools/check-lifecycle.mjs
node playable-test/tools/check-effects-browser.mjs
node audio-previews/tools/check-audio.mjs
node audio-previews/tools/check-browser.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
node tools/check-pages-browser.mjs
PLAYABLE_URL=https://pipebrain.github.io/eigengott/playable-test/ node playable-test/tools/check-browser.mjs
```

Core checks cover exactly-once identities, validated checkpoints, equipment compatibility, actual drops, atomic swap rejection, cluster expiry, shared Release, final-opponent precedence, armor speed in physical simulation, fixed 32 MiB memory, AI recovery and unchanged WAV bytes/no audio processing. Browser checks cover native entry/audio unlock, hover and button exchanges with rendered 3D previews, shared history isolation, non-resetting selection, GPU recovery, checkpoints, completion, damage feedback and resize.

The recorded 30-second local Chrome/Metal soak used a 196 m arena with six opponents, completing six transitions / seven encounters with 51 shots and 48 hits. Its final frame window measured CPU median/p95 0.50/1.10 ms and frame p95 16.8 ms. These are development soak samples recorded alongside other validation, not an isolated benchmark, a device-wide performance guarantee or physical-device acceptance. See `evidence/verification.json` and screenshots.

Additional armor/effect conversion inputs, GPL notices, hashes and available Blender/MM3D authoring sources accompany the [stock effects pack](licenses/index.html). Pixel checks verify real dynamic illumination, partial alpha, additive coverage, wall occlusion and animated death frames. Native-pointer checks verify fragment/equipment drags, invalid-slot rollback and model rotation.
