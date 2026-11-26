# EIGENGOTT development plan

## Current baseline

- Preserve the `v1.0.0` checkpoint and the exact `dos-maze` default profile.
- Keep earlier profiles available in the H menu.
- Next rendering work: investigate and correct the reported off-grid lines and glyph-clearance behavior, using the saved reproducer. The checkpoint itself does not fix that issue.

## Cross-device testing and deployment

Status: planned. The repository remains private and Pages deployment is not enabled.

1. Prepare automated unit checks in GitHub Actions and a Pages workflow that deploys only after those checks pass. Review existing checks for assumptions about earlier defaults before using them as deployment gates.
2. Add the deployed build's commit identifier to the hidden H menu so devices can confirm they are running the same version.
3. When the user says we are ready for cross-device testing, make `pipebrain/eigengott` public and enable GitHub Pages. This plan records the intended visibility change; it does not authorize changing visibility now.
4. Automatically deploy passing pushes to `main`. The intended prototype URL is `https://pipebrain.github.io/eigengott/vector-labyrinth/`.
5. Test rendering, animation, controls, browser saves, and preset import/export across target WebGPU-capable browsers and devices. Record the build, device, browser, and results. Pages provides the shared test app; automated unit checks run separately in Actions.

## Game development

- Engine
- Gameplay
- Enemies
- Multiplayer
