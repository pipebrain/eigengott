# EIGENGOTT v0.1.0

[Play](https://pipebrain.github.io/eigengott/) · [H tools](https://pipebrain.github.io/eigengott/?tools=1) · [Historical tests](https://pipebrain.github.io/eigengott/tests.html)

The accepted DOS-maze title is the entry screen. The first real keyboard, click/tap, pointer-movement or wheel input clears it immediately and enters the current game. There is no start animation or second Enter-run prompt. The input that starts the game is consumed, so it cannot fire or activate a tool. Pointer capture and Web Audio still follow browser gesture permissions; moving the mouse alone cannot grant those permissions, and a later click captures normally.

Gameplay assets, the validated arena and the S_Marine profile prepare behind the title. Hidden gameplay stops rendering once ready. If the player starts before preparation finishes, the title clears immediately to the black loading screen and the same input unlocks capture/audio where permitted. The title renderer is destroyed at launch. Normal loading starts a fresh run; H offers explicit checkpoint restore under a separate `eigengott.game.v0.1.0.checkpoint` browser key.

`preset.js` contains the complete user-specified preset. `character=smarine` maps to the engine's `model` key. There are 32 total Selves including the player. Each encounter draws a fresh inclusive uniform integer from 1–7 opponents, capped by the living population. The chosen count is retained through candidate validation, Return and checkpoint restore. The release uses ten seconds for void selection, 2.5 seconds each for Collapse/Return, and sky parallax 0.5. Other unspecified gameplay defaults remain those of `playable-test`.

The shared controller/renderer live in `playable-test/`. Its standalone test defaults remain unchanged. The main entry markup is `site/index.html`; the test hub is `site/tests.html`. The original `dos-maze/` keeps its historical v1.1.1 version. The new v0.1.0 tag identifies the combined game build.

Verification:

```sh
node tools/check-release.mjs
node tools/build-pages.mjs
node tools/check-pages.mjs
node tools/check-release-browser.mjs
node tools/check-pages-browser.mjs
GAME_URL=https://pipebrain.github.io/eigengott/ node tools/check-release-browser.mjs
```

The browser check covers title ownership/hidden-game standby, first-input launch, exact presets, ten real seconds of selection, random next cohorts and early input during preparation. Existing playable core, structural and browser regressions cover the reused engine. Physical-device acceptance and touch locomotion remain pending.
