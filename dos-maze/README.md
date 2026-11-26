# EIGENGOTT DOS-maze · v1.1.1

A standalone title-screen runtime specialized for the accepted `dos-maze` profile. The original `vector-labyrinth/` editor and `v1.0.0` checkpoint remain available.

## Run

From the repository root:

```sh
python3 vector-labyrinth/tools/serve.py --port 8080
```

Open **http://127.0.0.1:8080/dos-maze/** or the [public Pages build](https://pipebrain.github.io/eigengott/dos-maze/). The directory also works on its own localhost/HTTPS static server. WebGPU, WebAssembly, hardware acceleration, and native gzip decompression are required. There are no runtime libraries, fonts to install, build services, or external network requests.

## Controls

- **H / backtick:** hidden menu with Playback, Render quality, and Diagnostics.
- **Space:** pause/resume. **R:** restart the cycle. **F:** fullscreen. **Escape:** close controls.
- **Three-finger tap:** open/close controls on touch devices.
- Playback includes single-step and time scale. Quality includes pixel-ratio cap and 4× antialiasing. Quality and speed save under a separate browser key; full-lab saves are untouched.
- Copy diagnostics to record the version/build, render size, FPS, CPU timings, wall count, memory, and device recoveries.

The default remains 1 px walls, 16 px paths, 12 px glyph clearance, 30-second corruption cycle, drifting gothic letters, reference hatching, letter hierarchy, and hard maze flicker/redraw. The profile uses **free gaps**, exactly as saved. Grid snapping and the earlier glyph-clearance grid issue are not changed by this optimization. Walls stay screen-space width 1 rather than scaling with the title.

v1.1.1 defaults: **time scale ×0.50**, **pixel ratio cap 1.00**, and **4× antialiasing off**. A 30-second simulation cycle therefore takes 60 seconds at the default speed. Existing saved browser choices still restore normally.

## What is specialized

- One guided orthogonal maze generator; no generator mixer, perspective/fill profiles, plate simulation, diagonals, exact-grid variants, arbitrary title/font editing, or preset library.
- Eight MiB fixed WASM memory instead of the lab's 64 MiB. Parallel-wall cleanup uses a coordinate index while retaining the original clipping order.
- Exact binary letter masks and guide data take approximately 3.6 KB compressed. Startup recreates the original 4.7 MB distance-field atlas in WASM, borrowing maze workspace. No Canvas/font rasterization runs in production.
- Three GPU passes instead of four: combined letter clearance/priority, vector coverage, and final composition. No depth attachment. Six pipelines instead of fourteen; cached relative title strokes and much smaller buffers.
- Layout reads and title-stroke rebuilding occur on resize/quality changes. Glyph motion updates a fixed typed array. Sorting occurs only when letter order changes. Diagnostics are computed on demand, and the hidden menu updates no readouts.
- Generation retains the accepted 30 Hz cadence; rendering follows the display's animation-frame cadence. Quality never changes automatically. GPU completion checks bound backlog while batching checks at high frame rates.
- Pausing and backgrounding suspend rendering. Resize, visibility, freeze/resume, errors, disposal, and bounded graphics-device recovery are handled explicitly. Startup failures have a retry action.

## Embed

```js
import {createDOSMaze} from './dos-maze/runtime.js';

// Give the canvas explicit CSS width and height in its parent container.
const title = await createDOSMaze(canvas, {
  onError: message => console.error(message),
});

title.pause();
title.resume();
title.setTimeScale(0.5);
title.setQuality({dprCap: 1, antialias: false});
title.destroy(); // Cancels frames/listeners/fetches and releases GPU resources.
```

The component owns its WebGPU device, canvas context, and frame loop. It has no dependency on the HTML menu, local storage, or the earlier lab. An optional abort signal cancels startup. `snapshot()` provides diagnostics without per-frame object copying. `seek(time, {state, redraw})` supports deterministic review poses; `restart()` restores an automatic cycle. Testing-only device-loss injection is opt-in.

## Build and verify

The compiled WASM and title assets are included. To rebuild WASM, use LLVM Clang with `wasm32` and `wasm-ld` support:

```sh
sh dos-maze/tools/build-wasm.sh
node dos-maze/tools/check-generator.mjs
node dos-maze/tools/check-animation.mjs
node dos-maze/tools/check-visual.mjs
node dos-maze/tools/check-runtime.mjs
node dos-maze/tools/check-soak.mjs
```

The first two checks use Node only. Browser checks use the installed Chrome binary and a temporary, isolated profile/server; no npm packages are needed. Set `CHROME_PATH` if Chrome is installed elsewhere. These tools currently target macOS Metal WebGPU; the app itself uses standard browser APIs.

The **DOS-maze checks** Actions workflow rebuilds the WASM on Linux and runs the deterministic generator/atlas/animation checks on pushes and pull requests. The separate [Pages workflow](../.github/workflows/pages.yml) also runs these checks before publishing the shared test site. Browser/GPU checks remain separate local checks.

`tools/build-assets.mjs` rebakes the exact reference masks from the preserved lab using Chrome. It is an offline development utility. `tools/benchmark.mjs` compares both versions at identical quality with frame-rate limits disabled and GPU work drained at measurement boundaries.

Evidence is in `evidence/`: byte-for-byte geometry and atlas checks, 120 seconds of animation-state comparisons, desktop/portrait/high-DPI screenshot comparisons, runtime fault/lifecycle checks, a two-cycle browser soak, and local benchmarks. GPU floating-point/rasterization can introduce tiny pixel differences, so screenshot comparison uses a documented narrow tolerance.

Local automated Chrome checks do not establish physical Android/iOS/Safari compatibility, performance on every GPU, or freedom from all long-duration driver faults. Cross-device acceptance remains in the [development plan](../docs/PLAN.md). The release identifier resolves through the matching release tag; the hosted H menu and diagnostics additionally identify the exact deployed commit.
