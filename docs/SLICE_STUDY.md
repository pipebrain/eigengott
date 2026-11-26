# EIGENGOTT — slice study

A local title-screen prototype made from stacks of flat quads. Each character has its own stack and character mask. Alternating black and white slices extend toward a central vanishing point, creating the stretched lines through actual perspective and occlusion. The default palette is black and white; a muted olive, earth, and violet palette is optional.

## Run

```sh
python3 tools/serve.py
```

Open **http://127.0.0.1:8080** in a browser with WebGPU and hardware acceleration enabled. `motion.wasm` is included and already compiled. Serve the files over localhost or HTTPS; opening `index.html` directly will not work.

## Hidden menu

Press **H** or **backtick** to open or hide the menu. On a touchscreen, tap the scene with three fingers. **Escape** closes it; **F** toggles fullscreen.

The menu provides:

- Live title editing, with up to 24 characters and one stack per character.
- A built-in square-cornered alphabet, system font choices, and local TTF/OTF/WOFF/WOFF2 loading. Font files remain on the device and are loaded for the current session.
- Filled or outlined character masks, black-and-white or muted colors, slice counts, environment density, depth stretch, and white/black layer balance.
- Displacement, drift, speed, shear, twist, elastic repulsion, and a title-anchor hold.
- Camera translation, yaw, pitch, vertical field of view, and **Reset camera**.
- Pause/resume, **Reassemble**, and **Reset all**.

With the menu open, drag the scene to pan; Shift-drag to look; scroll to move forward/backward. **R** resets the camera. Input fields retain their normal text-editing behavior. The camera stays fixed unless deliberately moved and begins each visit at the centered default view. Art settings and title text persist in browser storage. A loaded custom font falls back to the built-in mask on a fresh visit; choose the font file again to restore it.

## Rendering

The application has no runtime packages or frameworks. JavaScript uses native WebGPU for every visible frame. WebAssembly drives stack motion and elastic interaction.

Every layer is a real flat quad: six vertices, generated in the vertex shader using instancing. Character quads use an alpha-cutout mask; environmental quads are rectangles. Black layers occlude white layers behind them, revealing the successive edges as long bands. The scene uses one instanced draw call in one unlit render pass. There are **no lights, shadow maps, shadow passes, side-wall meshes, cubes, or postprocessing passes**. A normal depth buffer provides occlusion; four-sample antialiasing and alpha-to-coverage smooth the mask edges.

The default scene has 30 environmental stacks and nine character stacks. At the default density it draws 36,288 flat layers, with more closely spaced slices for the environment. Slice spacing is logarithmic through depth; the finite stacks extend toward a visually distant vanishing point. Environmental stacks begin behind the camera so their near end faces are clipped out. No explicit front/back cap meshes are added.

Slice normals stay aligned with the camera's optical axis, including during camera exploration. In geometric terminology, their planes are parallel to the image plane. Rotation is around that depth axis; shear and twist vary the cross-sections along depth while every individual slice remains camera-facing. The camera uses rectilinear perspective, with a default vertical field of view of 68 degrees.

`masks.js` uses a detached Canvas 2D only when text or font changes to rasterize filled/contour masks, then uploads those masks to a WebGPU texture array. It does not draw the visible scene or rasterize text each frame. The built-in alphabet keeps G and O boxy. Loaded fonts use their own glyph designs. Slice spacing, animation, and perspective generate the long lines; there is no painted line texture.

`src/motion.c` projects rotating 4D tesseract face centers into motion fields, drives anchor springs, and computes soft repulsion between rotated rectangular footprints. Repulsion is an art control that permits some overlap, not a rigid-body simulation. Set it to zero for free overlap. Each character moves as one coherent stack. The default breakup/recovery cycle is 26 simulation seconds, about 37 real seconds at the default 0.7 time scale. There is no start transition or sound.

## Rebuild WebAssembly

Requires LLVM Clang with a wasm32 target and `wasm-ld`:

```sh
sh tools/build-wasm.sh
```

The helper uses Homebrew LLVM on Apple Silicon when available. Set `WASM_CC` to another suitable Clang executable elsewhere. The module imports only `Math.sin` and `Math.cos`; there is no WASI or Emscripten runtime. HTML, JavaScript, CSS, and WGSL require no build step.

## Verification

```sh
node tools/check-motion.mjs
# With the localhost server running and Google Chrome installed:
node tools/verify.mjs
```

The motion check covers one stack per character, a complete displacement/recovery cycle, finite transforms, paused reassembly, anchor hold, and extreme repulsion/movement settings.

The browser check uses a temporary Chrome profile and native Chrome DevTools Protocol. It covers actual WebGPU/WASM initialization, rest/displacement/return captures, grayscale output pixels, the muted palette, live text edits, local font loading, empty/24-character titles, hidden controls, camera movement/reset, pause/resume, settings persistence, portrait resizing, and absence of runtime/WebGPU errors. It checks that masks are not rebuilt every frame. Screenshots and reports are saved in `evidence/`.

Set `CHROME_PATH` and `TEST_FONT` for different Chrome and local font paths. These are local desktop checks; they do not establish performance or compatibility on every browser or physical mobile device.

For inspection, `?time=0&paused` opens the resting pose and `?time=16&paused` opens a displaced pose. `window.__EIGENGOTT` exposes a diagnostic snapshot including layer counts, camera basis, mask rebuild count, and renderer errors.
