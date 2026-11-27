# EIGENGOTT v0.1.4

[Play](https://pipebrain.github.io/eigengott/play.html) · [H tools](https://pipebrain.github.io/eigengott/play.html?tools=1) · [Historical tests](https://pipebrain.github.io/eigengott/tests.html)

The accepted DOS-maze title clears on the first real input and starts the S_Marine/default game. The arena prepares behind the title and stands by until input; early input carries capture/audio activation through loading. There is no second Enter-run gate. Browser gesture rules still govern pointer capture and audio. H retains the development tools. Release checkpoints use `eigengott.game.v0.1.4.checkpoint`; older saves remain untouched and can be imported explicitly.

The root index now provides the shared build menu; the game opens directly at `play.html`.

## Current game rules

- The clarified starting population is **6,174 Selves including the player**. First-arena actors all hold shotguns. Player upgrades still come from the single loot choice: one held gun and three worn armor pieces, at most one fragment per item.
- Each new arena independently rolls Small (~20 m, 1–3 opponents), Medium (75 m, 3–7) or Large (196 m, 3–15). The remaining population caps the cohort. Geometry, traversal and a fitting spawn cohort validate before Collapse; final placement spreads enemies relative to the player's safe return position.
- Collapse and Return leave player movement and look enabled. Cursor selection during void loot coexists with keyboard movement/look. There are no player/return forcefields in this mode. The feedback conveys falling while the free-void player remains at or above the future landing floor. Return places the equipped player onto a visible, validated clump before the outward wave; the live scene continues through selection and timeout without an Enter-run gate. A changed footprint can leave old XY outside the new arena: before Release, prefer a valid existing position, otherwise place the player at the nearest fitting sector support, clear of enemies. Input is not disabled while generation runs. The protected-clump comparison remains available in the standalone test.
- Loot entry restores health to 100 and clears old projectiles/damage flashes. Armor wear remains. Every displayed weapon or armor piece can be chosen; landing clearance is resolved after selection, rather than vetoing loot. Items drift and collide using square screen bounds. Labels follow nearby, avoid other labels, may cross models, and connect to their items with at most two orthogonal one-pixel segments. The default loot window is ten seconds; Collapse and Return each default to 2.5 seconds.
- Every cleared arena improves surviving NPC equipment. Weapon families unlock progressively, armor improves, and one-fragment choices remain. Internal item quality increases each clear with logarithmic combat scaling. Player gear is not upgraded for free. The first balance rule removes 10% of the still-unmaterialized offscreen population per clear; H exposes this rate, including zero. Final actual opponents remain available for combat. This is a tunable prototype economy, not final progression balance or the narrative death-transfer/endings.

Population accounting uses exact integer counters and a bounded equipment pool (48 live records for large populations), rather than allocating thousands of complete actors. IDs are never reused. Compact version-2 checkpoints preserve the counter, equipment, progression, full structural blueprint and workload; version-1 test checkpoints remain readable.

## Presentation and collision

Muzzle lights now reach 9 m, impacts 7.5 m and projectile lights 9 m, with brighter intensities and short trailing emitters. The 128-light, 256-particle and 512-sprite limits remain. World surfaces now use warm grey, charcoal, ochre, brown and subdued olive ramps based on the supplied art, palette and lighting references. World-space texel / panel detail and sampled dynamic illumination retain the coarse aesthetic. Local sources are deduplicated per clump; sky spill is reduced. Display tone mapping preserves dim emitted light, with 32 colour steps rather than crushing it to eight levels. A restrained warm, lower-saturation grade also covers actors and loot models. Lights still require emitters: no ambient light, lightmaps or new audio processing are introduced.

Chunky mode defaults ON: nearest texture sampling, stepped spatial illumination and event-light decay, low-step sprite alpha, stepped weapon effects and blocky injury/armor/directional overlays. Final presentation colour is quantized to 32 steps per channel. The default raster is exactly **640×480**, including world, actors, feedback, skies, equipment previews and effect composition. The 4:3 picture scales with nearest sampling and letterboxes outside its bounds; browser size and DPR do not change its internal resolution. H retains an adaptive-resolution comparison toggle. Source texture / font-mask sizes remain asset-specific; all visible game rendering uses the shared raster. H can compare stepped and smooth effects. Transparent/additive stock materials remain transparent/additive.

Gun contacts push the body clear of walls/props using bounded capsule separation and collision-safe sliding. Look is rejected only when the body cannot fit the displacement. Body and weapon clearance remain real; the engine does not solve sticking by disabling the gun collider.

## Verification

```sh
sh playable-test/tools/build-wasm.sh
node playable-test/tools/check-core.mjs
node playable-test/tools/check-structure.mjs
node playable-test/tools/check-weapon-push.mjs
node tools/check-progression.mjs
node tools/check-release.mjs
node playable-test/tools/check-loot-motion.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
node tools/check-release-browser.mjs
node tools/check-recomposition-browser.mjs
node tools/check-game-soak.mjs
node tools/check-pages-browser.mjs
GAME_URL=https://pipebrain.github.io/eigengott/play.html node tools/check-release-browser.mjs
```

Browser checks exercise all workload ranges, moving through collapse/void/return, healing, safe resized-world Release, upgraded media, population checkpoints, native cold start, and an actual rendered colour-level comparison. Wall and prop fixtures prove weapon displacement and escape. A 45-second maximum Large/15-opponent soak records bounded resources and frame timing. Physical-device acceptance and touch locomotion remain pending. Accepted historical engine/fold/encounter/title applications remain unchanged.
