# Interactive Encounter

Separate vanilla JavaScript / Rust WebAssembly / WebGPU test, built on the accepted Recomposition framework. The small engine, larger benchmark, both fold candidates, accepted procedural sweep and title screens remain unchanged.

[Play](https://pipebrain.github.io/eigengott/encounter-test/) · [H tools](https://pipebrain.github.io/eigengott/encounter-test/?tools=1) · [Media credits and source archives](https://pipebrain.github.io/eigengott/encounter-test/licenses/)

Serve the repository with `python3 -m http.server 8080`, then open `/encounter-test/`. WebGPU is required. Desktop keyboard/mouse gameplay is implemented; touch devices can open inspection tools.

## Accepted scope and vocabulary

The user accepted the procedural sweep and selected it as the Recomposition framework. **Arena** means the complete assembled playable level. A **sector** is a generator construction unit; a **cluster** groups adjacent sectors for replacement. A **composition** is the current arrangement of sector versions. The transition is **Recomposition**, with **Collapse**, **Return** and shared **Release** phases. Its fixed starting XY is the **anchor**; unchanged clusters containing the body and weapon form the **protected region**. **Coherence** controls persistence. Combat is an **encounter**; its transition overlaps the **loot intermission**.

For this milestone the user requested the complete released OpenArena roster and weapons, automatic encounters, Quake/OpenArena bindings, debug overlays enabled by default and **per-character physical envelopes**. All weapons remain in inventory with unlimited ammunition strictly for testing. Actual corpse equipment exchange is deliberately skipped. The original equipped-inventory-only game rule remains the production design.

## Media coverage

OpenArena **0.8.8** supplies **18 base character models, 33 named roster entries, their included skins and all 13 weapons**. H selects the character, skin and weapon. Opposing Selves normally use the player's model; the mixed-roster inspection option prepares three additional character profiles. Assets load on demand, with shared GPU pose buffers and textures. Source archives are not fetched by gameplay.

Weapons are gauntlet, machinegun, shotgun, grenade launcher, rocket launcher, lightning gun, railgun, plasma gun, BFG, grappling hook, nailgun, proximity mine launcher and chaingun. Their models, applicable projectile models, source textures and sound cues are included. The runtime implements melee, automatic hitscan, shotgun pellets, rail penetration, continuous lightning pulses, direct/splash projectiles, gravity/bouncing grenade fuses, armed sticky proximity mines and a held grappling hook with pull force. Pools cap projectiles at 128, beams at 128 and impacts at 64.

An offline MD3 converter produces compressed vertex-frame packs, compact normals, tag attachments and PNG textures limited to 512 pixels per side. The browser uses native decompression, image decoding, WebGPU and Web Audio. It does not load or execute native OpenArena binaries, QVM game modules, OpenGL or a browser rendering framework. Materials use a simple lit / alpha-tested interpretation; full legacy multipass shader fidelity is not claimed. Death clips create inert corpse meshes; ragdoll simulation is not implemented.

The body and held world weapon share their geometry in first-person and inspection views. The own head is omitted in first person to avoid camera intersection; final helmet visibility and exact animated-eye attachment remain later work. Third-person inspection has camera obstruction handling.

## Physics and navigation

Per-character envelopes are **ON by default**, as explicitly chosen by the user. Bounds come from the imported model's neutral locomotion and firing poses at 32 source units per metre. Conservative character-specific body boxes use continuous SAT collision against structural triangles and bounded overlays; the common capsule hull remains an H comparison. Crouch heights are character-specific. These are simplified physical envelopes, not per-triangle limb, cloth, gesture or ragdoll collision. Wide characters can genuinely fail to fit narrow spaces. Models are not silently scaled to fit.

Each held weapon has its own conservative capsule derived from the imported geometry and attachments. Selection is atomic: if a new body or gun cannot fit at the current position, the old equipment remains. Ordinary Recomposition never teleports the player. Explicit reset, arena loading and firing-lane fixtures can reposition them.

After structural validation, a worker builds reciprocal sector routes with sampled clearance checks using the actual selected envelope. Each active model has a versioned all-pairs next-hop table and connected-component labels. Spawn candidates are checked against live geometry. Route following uses table lookups, local obstacle avoidance and real WASM collision; wide characters may have fewer reachable areas. Tables rebuild when the arena, cluster construction or physical profile changes. Current interior variants retain compatible structural topology; Structural Recomposition will also need new tables before Release.

The controller implements original, bounded chase / strafe / aiming / range-based weapon selection inspired by Quake. It is **not the complete Quake botlib**, does not require BSP/AAS files and makes no exact bot or weapon parity claim. Skill, opponent count, forced weapon, AI freeze and player invulnerability are H controls. Opponents default to three and are bounded at sixteen. Body contacts prevent actors occupying one another; weapons and hits use the same world collision queries.

## Encounter cycle

1. Enter the arena; opposing Selves perceive, pursue and attack the player.
2. Defeating the encounter requests Recomposition automatically. The selected starting XY and equipped proxies establish the protected region.
3. Collapse deletes clusters outward. Bodies disappear with their owning cluster; surviving bodies remain until final Return.
4. Return reconstructs compatible interiors/materials inward and stages enemies behind forcefields.
5. Release clears remaining old bodies, closes the intermission and releases the player/enemy fields at one fixed simulation boundary.

The current structural floors, ceilings, ramps, openings and BVH remain fixed, matching the accepted sweep's scope. Actual structural replacement is the next milestone. This test adds combat and media around that framework; it does not claim Structural Recomposition is already implemented.

Death is a test failure state with Attack/Enter restart. Global death transfer, remaining-selves progression, final-opponent endings, equipment modifiers, armor exchange, multiplayer and the production encounter balance remain future gameplay work. The game's final no-HUD design is preserved separately from this explicitly requested debug UI.

## Controls and H tools

| Input | Action |
|---|---|
| WASD / Up / Down | Move |
| Mouse | Look |
| Left / Right arrows | Turn; Alt changes them to strafe |
| Mouse 1 / Ctrl | Attack |
| Mouse 2 / Alt | Mouse strafe |
| Mouse 3 | Hold zoom |
| Space / C / Shift | Jump / crouch / walk |
| 1–9 / 0 | Weapons 1–9 / grappling hook |
| Wheel / brackets / slash | Cycle all thirteen weapons |
| Enter | Use-item diagnostic / restart after death |
| Tab | Hold roster inspection |
| Backtick / tilde / T | Console / local debug message |
| Pause / End | Pause simulation / centre view |
| H / N / F | Tools / force Recomposition / fullscreen |

Extra weapons can also be selected through H or `weapon 11`, `weapon 12`, `weapon 13` in the console. Commands include `help`, `give all`, `god`, `kill`, `restart`, `recompose`, `model NAME [SKIN]`, `freeze` and `say TEXT`. There is no network chat. No reload is needed with unlimited test ammunition.

The top-left loop/player panel, top-right FPS/metrics, bottom-right `self-##### killed self-#####` feed, bottom-right debug messages and browser console logging are **all ON by default**, with independent H toggles. Additional optional tools expose physical bounds, current bot routes, third-person/free/overhead cameras, a firing-lane fixture, AI controls, encounter reset, wave timing/coherence, independent feedback/sound/light and render quality.

## Sources and licensing

Release: [OpenArena 0.8.8](https://openarena.ws/download.php?view.4=), MD5 `9f353d96d7889c377349d692c3905e5b`. The exact archive was verified before conversion. OpenArena media retain their original GNU GPL notices and contributor credits. `licenses/` includes original model/skin/texture/sound conversion inputs, relevant available authoring files from SVN revision 951, file hashes and provenance. The [media index](licenses/index.html) exposes these downloads. No retail Quake III artwork, sounds or footage is included.

Reference sources: [OpenArena default bindings](https://openarena.ws/svn/default.cfg), [weapon/item definitions](https://github.com/OpenArena/gamecode/blob/master/code/game/bg_misc.c), [weapon logic](https://github.com/OpenArena/gamecode/blob/master/code/game/g_weapon.c), [missile logic](https://github.com/OpenArena/gamecode/blob/master/code/game/g_missile.c), [character animation](https://github.com/id-Software/Quake-III-Arena/blob/master/code/cgame/cg_players.c), and [bot-controller architecture](https://github.com/OpenArena/gamecode/blob/master/code/game/ai_dmq3.c). These informed this original runtime; no legacy game-code source is embedded. The Quake source release and retail data have separate licensing, as described in the [ioquake3 README](https://github.com/ioquake/ioq3/blob/main/README.md#compilation-and-installation).

To reproduce media conversion, use Python with Pillow **13.0.0** and run `tools/pack-openarena.py` against the verified release ZIP. Original inputs, converter source, included notices and the authoring-source manifest document the transformations. Runtime users do not need Python or Pillow.

## Verification

```sh
sh encounter-test/tools/build-wasm.sh
node encounter-test/tools/check-media.mjs
node encounter-test/tools/check-core.mjs
node encounter-test/tools/check-browser.mjs
node encounter-test/tools/check-soak.mjs
node encounter-test/tools/check-lifecycle.mjs
ENCOUNTER_URL=https://pipebrain.github.io/eigengott/encounter-test/ node encounter-test/tools/check-browser.mjs
```

Rust is pinned to 1.100.0 / `wasm32-unknown-unknown`; WASM memory is fixed at 32 MiB. Native Web Audio uses a bounded eight-voice HRTF pool. World coverage and owned feedback remain separate from characters, corpses, weapons, effects and diagnostic geometry. At most two GPU submissions may be pending. Hidden pages suspend without accumulated catch-up; device recovery preserves the active simulation and restages imported media.

Core checks cover media hashes and every model's animation buffers, all weapon classes, actual world ray/shape collision, safe placement, navigation next hops/components, automatic encounter progression, corpse timing, staging/Release, crouch and fixed memory. Browser checks exercise native controls/audio, every imported base model and weapon, actor/history exclusion, default/toggleable overlays, large-arena preparation, resize, freeze, missing APIs and in-wave GPU recovery. The soak runs live AI, attacks, projectiles and repeated automatic encounters in the large arena. Reports distinguish bounded desktop checks from subjective audio quality and physical-device acceptance.

A local Chrome 158 / Metal large-arena soak (196 m, six opponents, 30 seconds) completed six automatic encounter cycles with 145 shots and 45 hits. In its final 600-frame window, CPU median / p95 were 1.70 / 2.80 ms, sampled GPU median / p95 were 0.81 / 2.26 ms and frame p95 was 16.8 ms. These are measured desktop samples at the test defaults, not universal device budgets or a guaranteed 2 ms ceiling. See `evidence/verification.json` for the recorded bounded checks.
