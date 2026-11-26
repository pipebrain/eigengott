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

Next, review larger-arena movement, scale, visibility, inspection tools, and smooth preparation on target devices. Then develop authored surface tiles and a verified moving-geometry/fold prototype, keeping the original loot warning window. Arbitrary-surface locomotion, mirrors, combat, and broader/stacked generation remain later milestones. Physical device checks are pending; both tests use desktop mouse/keyboard controls.

## Cross-device testing and deployment

Status: the user accepted both engine milestones and authorized public cross-device testing on 2026-11-26. The repository is public and Pages uses Actions with HTTPS enforced. The [test hub](https://pipebrain.github.io/eigengott/) links the [small engine](https://pipebrain.github.io/eigengott/engine-test/), [larger benchmark](https://pipebrain.github.io/eigengott/engine-benchmark/), and title studies. See [deployment details](DEPLOYMENT.md).

The v1.1.0 [DOS-maze runtime](../dos-maze/README.md) adds the minimal H menu, a release build identifier, and deterministic unit checks in GitHub Actions. Desktop GPU comparison/lifecycle/soak checks are provided separately. Physical multi-device acceptance remains pending; publishing is now authorized and configured.

1. The Pages workflow rebuilds the WASM runtimes and runs all deterministic engine/title checks before uploading and publishing the static artifact. Pull requests validate without deploying.
2. The hub, hidden H menus, and engine diagnostics/report exports identify the deployed commit. Direct `?tools=1` URLs open existing inspection controls without a physical H key.
3. The user's explicit authorization to make `pipebrain/eigengott` public and enable Pages supersedes the earlier visibility restriction.
4. Passing pushes to `main` deploy automatically. Keep `/engine-test/`, `/engine-benchmark/`, `/dos-maze/`, and `/vector-labyrinth/` available under the shared hub.
5. Test rendering, worker preparation/activation, controls, browser saves, and fixture/preset import/export across target WebGPU-capable browsers and devices. Record the build, device, browser, and results. Touch movement is still a future feature; current engine controls use keyboard and mouse.

## Game development

- Engine
- Gameplay
- Enemies
- Multiplayer
