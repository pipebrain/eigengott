# Level generator M2 scope

This directory is the published, reproducible generator prototype. The user authorized promoting it to GitHub Pages on 2026-11-27. Private research/reference files remain in the ignored `.local/level-generator/` area and are not part of this source or site package.

- Keep output strictly structural blockout. Only floors, walls and ceilings are emitted in M2; point lights and diagnostic overlays add no world polygons.
- Corridor target widths are seeded random values in [4,12] metres. The user approved locally widening curved sections as needed for the largest envelope, remaining within 4–12 m; retain nominal and section widths separately. The earlier three-largest-Selves comparison is capacity evidence, not a universal minimum width.
- Preserve full connectivity of the declared composite clearance domain, exact LUT endpoints, welded closure and live-engine sweep checks. Do not silently accept a disconnected subset or activate a failed candidate.
- `engine/BASELINE.json` records the frozen local v0.1.3 source snapshot. The current game may advance independently. Do not silently replace the snapshot with the current game sources.
- Engine/controller changes require rebuilding WASM and catalogue. Generator/navigation changes require a version bump and catalogue rebuild. Hash mismatches must reject stale packages.
- Record limitations accurately: M2 is flat and roofed, with a composite envelope covering the current 18 model allowances and level-pitch machinegun yaw extent. Elevation, natural variants, all weapons and production Recomposition integration are not complete.
- Read README.md and `../docs/LEVEL_GENERATOR.md` before extending the prototype. Keep generated verification reports under `.local/level-generator-checks/`.

- Curves are tessellated cubic structural boundaries. Donut cores and posts are full-height exclusions from the same polygon domain used for rendering, collision and navigation; never dressings or disconnected prop colliders.
- M2 adds an imported-flat containment predicate before the snapshot's general parity ray. Preserve the original source hashes and adaptation record in BASELINE.json. Do not call this release-tag-identical physics.
- Navigation erodes the complete polygon domain by the AABB envelope and safety margin. Never connect triangle centres without a shared, validated portal; retain both sides of rings/posts.
- Vendor geometry code is pinned and local; preserve licenses and provenance in vendor/README.md and licenses/geometry.txt.
