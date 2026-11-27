# Level generator M1 scope

This directory is the published, reproducible generator prototype. The user authorized promoting it to GitHub Pages on 2026-11-27. Private research/reference files remain in the ignored `.local/level-generator/` area and are not part of this source or site package.

- Keep output strictly structural blockout. Only floors, walls and ceilings are emitted in M1; point lights and diagnostic overlays add no world polygons.
- Corridor clear widths are seeded random values in [4,12] metres. The earlier three-largest-Selves comparison is capacity evidence, not a universal minimum width.
- Preserve full connectivity of the declared composite clearance domain, exact LUT endpoints, welded closure and live-engine sweep checks. Do not silently accept a disconnected subset or activate a failed candidate.
- `engine/BASELINE.json` records the frozen local v0.1.3 source snapshot. The current game may advance independently. Do not silently replace the snapshot with the current game sources.
- Engine/controller changes require rebuilding WASM and catalogue. Generator/navigation changes require a version bump and catalogue rebuild. Hash mismatches must reject stale packages.
- Record limitations accurately: M1 is flat and roofed, with a composite envelope covering the current 18 model allowances and level-pitch machinegun yaw extent. Later geometry, all weapons and production Recomposition integration are not complete.
- Read README.md and `../docs/LEVEL_GENERATOR.md` before extending the prototype. Keep generated verification reports under `.local/level-generator-checks/`.
