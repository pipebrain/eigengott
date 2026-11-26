# EIGENGOTT — vector labyrinth study

A separate animated title-screen experiment. It does not modify or import the earlier 3D app. The artwork uses white vector walls on black paths, with gothic glyphs formed by a change in the line field. Horizontal/vertical walls are the default; optional diagonals use exactly 45° / 135°. No red guide outlines, filled letter caps, lighting, or shadows are rendered.

## v1.0.0 opening profile

**dos-maze** is now the default, using the exact **dos-maze** profile exported from the browser library: 1 px white walls, 16 px path gap, free-gap mode, traced glyphs, 12 px glyph clearance, and maze flicker. It starts a fresh animation cycle. The supplied file's settings are preserved, including **grid off**; this checkpoint does not change rendering or repair grid clearance.

Press **H** and choose **dos-maze default** to restore it. **Previous default · perspective + fill planes**, the earlier continuous-field/tectonic/concept/original presets, and existing browser saves remain available. A one-time revision-4 migration saves revision-3 browser options as **Before dos-maze · previous browser options**, including their font link, before switching defaults. Later edits survive reloads. Portable `presets/dos-maze.json`, `presets/dos.json`, and `presets/dos-2x.json` also retain their exported poses for explicit import.

The sections below document the earlier study configurations and verification history; their references to an opening continuous-field/profile default describe that earlier configuration. See [v1.0.0 checkpoint](../docs/V1_0_0.md) for the current known issue.

## Open

Using the study's localhost server (also serves the original app):

```sh
cd /Users/poo/dev/EIGENGOTT
python3 vector-labyrinth/tools/serve.py --port 8080
```

Open **http://127.0.0.1:8080/vector-labyrinth/**.

This folder is also standalone and works on a localhost/HTTPS static server. The supplied server accepts parallel module requests without the small connection backlog of Python's default server. Direct `file://` loading is unsupported. WebGPU and browser hardware acceleration are required.

## Controls

- **H** or **backtick**: show/hide the grouped control menu.
- **Space**: pause/resume. **R**: restore and pause at the stable pose.
- **F**: fullscreen, including the control menu. **Escape**: close the menu.
- Touch: three-finger tap toggles the menu. Physical touch hardware has not been validated.

The menu includes Playback & cycle, Maze & linework, Generator mixer, Overlap & hierarchy, Vector plates & depth, Corruption & drifting copies, Title hatching, Title & font, Per-character transforms, Layers & background, Flicker & redraw, Performance, and Browser saves, files & resets.

Controls include independent wall width/path gap, constant/free gaps, turn and branch-splitting probability, seed/seed lock/regenerate, displacement, copy divergence, broken connections, character drift, manual/automatic corruption, endpoints, cycle/holds/time scale, editable background, independent layer visibility/opacity, independent hard and smooth flicker, redraw-on-flicker, title editing, font selection/import, global/per-character position/scale/rotation, tracking, per-character hatch direction and opacity, glyph clearance, pause/step/stable pose, JSON presets, reset, segment budget, geometry update rate, antialiasing, and render resolution.

Current options autosave in this browser. Imported TTF/OTF/WOFF/WOFF2 fonts are stored locally in IndexedDB and restore after reloads. No files are uploaded.

In **Browser saves, files & resets**:

- Enter a name and choose **Save in browser** to keep a named setup. **Load selected** restores it; **Delete saved** removes the named save while keeping the current controls. Saving the same name updates that save.
- **Export JSON / Import JSON** transfer all parameters, character overrides, and the active imported font. The file embeds the font, so it can restore on a browser without the original font cache. Legacy version-1 parameter files still load; their missing composition setting uses the original recursive layout.
- **Include current animation pose** is on by default for named/file saves. It preserves simulation time, pause state, the current maze variant, whole-title/per-letter hatch directions, hierarchy randomization and the flicker-driven corruption disturbance. Flicker scheduling restarts on load. Autosaved current options restart at a fresh cycle instead.
- **Continuous-field default** restores the opening preset: traced reference geometry and glyphs with negative-space pockets filled. **Previous concept** and **Original study** preserve the earlier defaults. The original study's stable output is checked pixel-for-pixel. The Built-in selector also retains the unfilled traced reference and mixed-generator/plate presets. The prior concept JSON remains in `presets/concept-v2.json`.
- Existing version-2 browser options are backed up once as **Before continuous-field default · previous browser options**, including their imported-font link, before switching to the new opening default. Their exact autosave is also retained under `eigengott-vector-labyrinth-v2-before-continuous-default`. Subsequent choices and edits continue to autosave and restore normally. Older version-1 browser options retain their **Before concept default** migration backup.
- The tectonic-animation update separately preserves revision-1 browser settings as **Before tectonic animation · previous browser options**, with an exact autosave under `eigengott-vector-labyrinth-v2-before-tectonic-default`. The **Previous continuous-field default · v4** preset and `presets/continuous-v4.json` retain the earlier continuous composition and animation settings.
- The perspective-profile update preserves revision-2 options as **Before perspective profiles · previous browser options**, with an exact autosave under `eigengott-vector-labyrinth-v2-before-perspective-profiles`. **Previous tectonic default · v5** and `presets/tectonic-v5.json` retain the previous animation. Saved poses now include contact lifetimes, individual edge visibility values and edge redraw revisions.

## Defaults and meaning

- **Traced reference · continuous field** is the opening default. It uses the supplied gothic concept's extracted vector geometry and glyphs, with procedural lines filling negative-space pockets. The previous direction-guide concept and original recursive study remain available in H.
- Black background, white source strokes, 2.8 CSS-pixel walls, 3.2 CSS-pixel nominal path gaps. Antialiasing and layer opacity can produce gray edge/fade pixels. Previous concept retains 2.1 / 3.9; original study retains 2.2 / 3.8.
- **Grid · fixed wall / path spacing** is **on** in the new default. Pitch is wall width + path gap, with editable X/Y origins. Strict animated mode constructs complete integer-indexed grid cells: every visible cell retains a horizontal or vertical pair of walls exactly one pitch apart. It resolves layer visibility per cell and emits each grid edge once, so skipped reference rows, shortened collision edges and subpixel visibility seams cannot change the gap. Perspective contours become orthogonal steps. Switching the grid off retains continuous/source spacing; the previous v4/v5 presets keep that behavior. 45°/135° title hatches use a rotated lattice with the same perpendicular pitch. Corners, junctions and glyph masks shape connectivity; they do not rescale parallel wall spacing.
- A **30-second** automatic stable→chaos→stable cycle at **×1.00**, with **4 seconds stable**, **12 rising**, **2 at chaos**, and **12 recovering**. All variables are editable. Endpoint holds are constrained to leave time for travel.
- Stable `0` and chaos `1` are visual states. Actual maze solvability is intentionally not computed or guaranteed.
- Hard flicker enabled independently on both layers: maze 0.35 Hz / 45 ms, title 0.18 Hz / 30 ms, with irregular timing. Both smooth-pulse amounts start at zero.
- Redraw-on-hard-flicker **on**. A hard flicker from either layer advances the variation counter. In the new tectonic mode with exact return enabled, the home geometry stays fixed; flicker can shuffle priorities and perturb intermediate corruption instead. Smooth opacity pulses do not regenerate it. Legacy procedural mode retains its seed-based redraw behavior.
- **Drift the fixed composition as tectonic plates** and **Restore exact home composition each cycle** are on in the new default. Geometry at state 0 is cached and split into coherent source regions, which move and quarter-turn during corruption. The surrounding maze breaks apart while the title stays anchored by default. Every cycle restores the exact home geometry and original hierarchy. Wall width stays in CSS pixels and is never transformed with a plate. Stable Pose rewinds the cycle, selects manual state 0 and pauses. Turning exact return off permits redraws to change the home variation.
- **Anchor title · ignore tectonic movement** is on by default in **Title & font**. It removes automatic translation and quarter turns from every title character while retaining manual position, rotation, spacing, font and hatch controls. Turn it off to restore character drift.
- Title clearance starts at **0**: no empty halo. The maze mask is replaced by the title's hatch field inside the glyphs. Raising clearance suppresses the background around glyph contours. Hiding the text restores the background field rather than leaving letter-shaped holes.
- The built-in glyphs are custom outlines inspired by the supplied gothic reference, not an identified font. E/I/G/N/O/T have authored outlines; other characters use a condensed system-serif fallback. Font imports use their own shapes. The concept preset adjusts tracking, horizontal placement, and individual character widths/offsets toward the reference. The title retains roughly 53%-width, 32%-height proportions at 1376×768.
- Global and per-character rotation affect the glyph mask, not the hatch direction. Per-character hatching and the whole-title override select vertical/horizontal or, when enabled, 45°/135°. Diagonal spacing is measured perpendicular to the stroke, so the line thickness and nominal gap remain the same. At corners, crossings and region boundaries, local open-space dimensions naturally differ from that nominal gap.

## Generator, plates and hatch experiments

**Perspective line profile** and **Fill-plane line profile** are independently controllable. Perspective layers retain their traced front faces and construct projected side planes toward one fixed vanishing point (the frame center by default). Every update recomputes projected hatch endpoints from the current layer position and depth; it does not slide a prepainted perspective texture. Depth rows are sampled at the chosen wall/path pitch, keeping line thickness constant. In grid mode the contours and ownership boundaries use steps on that lattice. Depth and the vanishing-point position are adjustable.

Fill planes sit beneath the perspective layers and cover their exposed gaps. Each has an independently seeded horizontal/vertical hatch direction, timed direction changes and moving orthogonal bends. Their column/row count, direction-change rate, movement speed and bend amount are editable. Turning off the perspective profile isolates fill planes; turning off fill planes exposes the gaps between perspective layers. State 0 preserves the cached reference composition; the profiles unfold as corruption grows and return to that exact starting frame.

**Edges decide visibility on collision** replaces persistent painter index with per-edge visibility values. Convex-quad contact tests identify the contacted edges. A seeded decision keeps or reverses the current winner according to **Chance current edge keeps visibility**. Contacts are reconsidered after the configurable hold time and when their contacted edges change. Thus one object can win at one edge and lose at another. Gap-fill planes remain below perspective planes, and text remains highest. Free-gap mode resolves visibility with a GPU depth attachment; strict-grid mode resolves the same edge scores at cell centers before emitting wall geometry. Neither uses lighting or shadows. Turning collision decisions off restores ordered layer selection.

**Redraw contacted edge lines** updates linework inside the adjustable edge band whenever decisions change. Free-gap mode re-trims terminating sections. Strict-grid mode reroutes complete cells instead of leaving shortened walls or missing rows. Contacts and revisions persist through JSON/browser pose saves. Cycle/flicker hierarchy settings still control letter ordering; collision decisions govern the perspective layers instead of a permanent object index.

**Overlap & hierarchy** defaults to preventing overlaps in the new preset. A WebGPU integer ownership map selects one visible plate or letter at each pixel, using collision-edge decisions when enabled. All letters sit above the maze; a letter's complete glyph shape, including its black hatch paths, occludes lower letter hatching. Per-character **Base priority** chooses the base letter ordering, with larger values on top. Optional cycle and hard-flicker shuffles vary ordering during corruption; restoring the home hierarchy is on by default. Disabling overlap prevention permits the layers to crosshatch. This is visual occlusion, not rigid-body collision. Existing perpendicular wall junctions within the artwork remain connected; overlapping near-parallel trace fragments are trimmed so they do not form thicker white bands.

**Preserve traced walls · fill every dead zone** is on in the new default. It measures clearance from the actual vector walls and adds guide-aligned strokes in uncovered areas, including margins and the title's background. It preserves the original traced endpoints; overlap prevention may separately trim conflicting lower-priority parallel fragments. Normal black path gaps remain. The older pocket-fill toggle remains available for comparison. A drifting, wrapped lower stratum keeps linework beneath gaps exposed by moving plates; flicker can still deliberately drop a whole layer.

**Generator mixer** chooses an algorithm independently for each seeded region, with normalized weights for nested contours, recursive division, Growing Tree and Sidewinder. Set one weight to 1 and the others to 0 to isolate it. Zero total weight falls back to contours. Growing Tree has a newest/random active-cell bias; straight-run preference and horizontal direction bias tune passage generation. Region subdivision depth changes the size of architectural masses; contour depth adds periodic branching. The graph generators are cached until dimensions, seed or generator biases change. Mixing masks pieces from those graphs; the resulting composition has no solvability guarantee.

**Vector plates & depth** adds ordered masks with independent depth-weighted translation, expansion/contraction, quarter turns, stepped shear, overlap and displaced copies. The camera remains fixed. These are 2D vector layers with simulated depth, not a 3D renderer or rigid-body physics. State 0 restores the anchored arrangement; displacement grows with corruption. Constant-gap mode samples the masks onto the shared lattice, while free-gap mode also shifts the actual vectors. Diagonal regions are opt-in and retain a separate rotated lattice with the same perpendicular pitch.

**Title hatching** provides independent hard-flicker switches for changing the whole title and individual letters. Choose title events, maze events or either layer, separate whole-title/per-letter probabilities, and random or cyclic direction selection. Each letter can opt out of individual changes. Whole-title changes and letter offsets combine, so both switches can operate together. Smooth opacity pulses never change directions. All hatch-change switches start off; diagonal directions start disabled. Disabling diagonals resolves a saved diagonal direction to an orthogonal direction without deleting that choice. Stable Pose resets the hatch state; named/JSON pose saves preserve it. No font mask is rebuilt for a hatch event.

The **Traced vector reference** preset uses `reference-master.json`: 1,826 background centerlines plus 266 title strokes, along with vector rectangles defining editable glyph masks. It follows the supplied gothic JPEG, including its original negative-space pockets. Its calibrated stroke width is 2.8 CSS pixels. **Fill negative-space pockets in reference**, also available as the **Traced reference · continuous field** preset, adds procedural lines inside those pockets. Source spacing requires constant gaps off; switching constant gaps on uses the direction guide on a uniform lattice instead. The traced glyph source still supports live title editing, transforms, replacement fonts and alternative hatching. Traced title strokes can be disabled separately. New/unrecognized characters use a system-serif fallback.

The reference is extracted geometry, not pixel-perfect reproduction: the renderer keeps a single editable wall width, whereas the JPEG contains varying widths and antialiased edges. `tools/calibrate-reference.mjs` compares widths against the supplied source image. `tools/trace-reference.mjs` rebuilds the editable reference data offline using native browser Canvas for image analysis. The live app never loads the JPEG.

## Renderer and engine integration

There are no runtime libraries, external services, SVG DOM renderer, image backdrops, or scene textures containing the reference artwork.

`src/labyrinth.c` is a freestanding WebAssembly generator using 64 MiB of fixed memory. Seeded rectangular subdivision supplies regions; nested contour fields produce stepped architectural bundles. Concept composition optionally guides local orientation from `concept-guide.json`; traced mode uses vector centerlines from `reference-master.json`. Mixing and corruption replace regions with procedural graphs and drifting fields. Adjacent collinear pieces are merged into long vector segments. The module imports only `Math.sin` and `Math.cos`, with no WASI or Emscripten runtime.

WebGPU expands each vector into a constant-width rectangle made of two triangles, in CSS-pixel screen space. There are no perspective volumes. The rendering stages are:

1. When overlap prevention is enabled, draw ordered plate footprints and glyph masks into an integer ownership map.
2. Render transformed glyph regions into an offscreen mask.
3. Rasterize actual maze/text stroke geometry into antialiased coverage channels, clipping lower-priority layers against ownership.
4. Composite white coverage, independent layer opacity/flicker, glyph clearance, and the chosen solid background. With overlap prevention off, the ownership pass is skipped and there are three passes.

Keeping coverage separate prevents overlapping strokes from accumulating brightness when layer opacity is reduced. The font cache uses a detached Canvas 2D to rasterize imported/system glyphs and create signed-distance fields only when text or font changes. Per-frame animation and glyph transforms happen in WASM/WebGPU; font rasterization does not run every frame. The clearance field uses a finite-resolution distance approximation.

Strict-grid strokes use analytic pixel-area coverage rather than phase-dependent MSAA. Axis-aligned maze walls and horizontal/vertical/45°/135° title hatches use the same configured thickness. Strict mode renders at native device-pixel density and pads/crops the canvas to a common integer CSS/device-pixel extent, avoiding compositor rescaling on fractional viewports. It needs no MSAA attachment; the pixel-ratio cap controls free-gap mode. Antialiasing can still be disabled. With fractional pixel dimensions, 8-bit edge colors have ordinary quantization error; the logical grid remains exact.

If the segment budget is too small, strict mode reduces directional detail rather than dropping arbitrary walls. Wall width, path gap and complete cell coverage remain unchanged. `gridCoarsening` in the diagnostic snapshot reports that fallback. Legacy presets retain their historical renderer.

`settings.js` describes the editor parameters; `presets.js` preserves the old defaults and concept overrides; `animation.js` contains cycle and flicker scheduling; `hierarchy.js` manages cycle/flicker priorities and corruption disturbances; `collisions.js` manages quad contacts and per-edge visibility/redraw state; `hatching.js` manages event-driven directions and vector hatch generation; `renderer.js` owns WebGPU resources. Perspective, fill and edge-redraw geometry are generated in `src/labyrinth.c`. `storage.js` manages the local preset/font library. Built-in preset JSON files are in `presets/`. The isolated renderer/generator modules are intended to be reusable in a homebrew JS/WASM/WebGPU engine. The HTML menu is a development harness.

## Build and verify

`labyrinth.wasm` is included. Rebuilding requires LLVM Clang with wasm32 support and `wasm-ld`:

```sh
sh tools/build-wasm.sh
node tools/check-core.mjs
node tools/check-features.mjs
node tools/check-tectonic-core.mjs
node tools/check-profiles-core.mjs
node tools/check-exact-grid.mjs
```

The helper uses Homebrew LLVM on Apple Silicon when available; otherwise set `WASM_CC` to an appropriate Clang executable.

With the repository server running on port 8080 and local Google Chrome installed:

```sh
node tools/check-browser.mjs
node tools/check-browser-features.mjs
node tools/check-tectonic-browser.mjs
node tools/check-profiles-browser.mjs
node tools/check-grid-pixels.mjs
node tools/check-composition.mjs
```

Set `CHROME_PATH` or `TEST_FONT` for different browser/font locations. Verification uses Node built-ins and Chrome DevTools Protocol, with a disposable profile. It covers real WebGPU/WASM startup, named browser saves/load/delete, migration backup, fonts across reloads, portable font/pose import without the previous cache, v1 compatibility, exact original reset pixels, stable/chaos/free-gap output, grayscale pixels, grouped controls, glyph transforms, clearance, layer toggles, background colour, both flicker modes, redraw toggling, pause/step, render quality, and portrait resizing. Core tests check timing, exact original geometry restoration, seeded recovery, wall orthogonality, the constant-gap lattice, and segment budgets. The composition check compares local wall orientation with the gothic reference; this is not an overall visual-equivalence score. Its optional reference input currently uses the supplied image in Downloads.

Before implementation, 40 existing workspace files were hashed. Both test suites verify that those files remain byte-identical. The baseline is `evidence/protected-files.json`; verification reports and captures are in `evidence/`. Performance measurements are local desktop samples, not guarantees for other GPUs or physical mobile hardware.

The spacing audit checks actual emitted wall pairs, not just endpoint proximity: `evidence/exact-grid-verification.json` records zero missing pairs, duplicate edges or off-grid coordinates across 824,516 cells in 28 configurations/animation states. `evidence/grid-pixel-verification.json` measures antialiased parallel gaps and title strokes at multiple device-pixel ratios. `evidence/grid-before-audit.json` records the unequal-cell coverage found in the previous endpoint-only implementation.

For inspection, `?paused&state=0&flicker=off` freezes the stable pose; `?paused&state=1&flicker=off` freezes chaos. These query overrides do not save themselves to browser storage. `window.__VECTOR_STUDY` exposes a diagnostic snapshot for testing.
