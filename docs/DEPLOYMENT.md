# Public test builds

The user authorized making `pipebrain/eigengott` public and enabling GitHub Pages on 2026-11-26 after accepting the small engine and larger benchmark tests. The repository is public. Pages uses GitHub Actions with HTTPS enforced.

## Links

- [Test hub](https://pipebrain.github.io/eigengott/)
- [Small engine baseline](https://pipebrain.github.io/eigengott/engine-test/) · [open tools](https://pipebrain.github.io/eigengott/engine-test/?tools=1)
- [Larger arena benchmark](https://pipebrain.github.io/eigengott/engine-benchmark/) · [open tools](https://pipebrain.github.io/eigengott/engine-benchmark/?tools=1)
- [DOS-maze title](https://pipebrain.github.io/eigengott/dos-maze/)
- [Full vector lab](https://pipebrain.github.io/eigengott/vector-labyrinth/)

## Publication

`.github/workflows/pages.yml` validates every push to `main` and also checks pull requests. Its verification job installs the pinned Rust toolchain and freestanding C compiler, rebuilds both engine WASM binaries reproducibly, rebuilds DOS-maze, and runs all four deterministic engine/title checks. The separate deployment job depends on successful verification and only runs for `main`, never pull requests. It publishes the verified artifact to the `github-pages` environment. Failed verification leaves the previous live build in place.

`tools/build-pages.mjs` stages `_site/` from an explicit runtime allowlist. The website contains the hub, the four applications, their runtime assets/presets/shaders/WASM, and build/file metadata. Source, development tools, evidence, local files, and repository metadata are excluded from the site artifact. The public GitHub repository separately exposes its tracked source/history.

The build stamp includes the full commit, short commit, repository URL, and build date. It appears on the hub and inside each H menu. Engine and DOS diagnostics include the same deployment metadata; benchmark report exports carry it as well. `build.json` identifies the deployment, and `manifest.json` records staged file sizes and SHA-256 hashes. The H-menu metadata and `?tools=1` behavior are hosting additions; simulation, geometry, rendering defaults, and the accepted small baseline's buffers are unchanged.

`?tools=1` opens the existing H menu at startup, allowing inspection from touch devices without a physical H key. Engine UI paths tolerate a missing Pointer Lock exit API; inspection does not require mouse capture. Engine movement still requires keyboard/mouse; touch movement is not implemented. The landing page identifies whether the browser exposes WebGPU. This is not a claim that every WebGPU browser/device has passed physical testing.

## Local and live verification

```sh
node tools/build-pages.mjs
node tools/check-pages.mjs
node tools/check-pages-browser.mjs
PAGES_URL=https://pipebrain.github.io/eigengott/ node tools/check-pages-browser.mjs
```

The browser check uses isolated desktop Chrome/Metal through the existing development-only helper. It checks a mobile-width hub, all four app startups under the project prefix, tools links, deployed commit identity, engine WASM MIME types, and worker generation/manual activation of a large arena. It does not establish physical mobile-device acceptance. Its latest local report is written to ignored `.local/pages-browser-verification.json`.

For cross-device results, record the H-menu commit, device, OS/browser, internal/output resolution, workload/seed/movement profile, and diagnostics or benchmark report. Browser storage is scoped to the GitHub Pages origin; localhost fixtures/settings do not automatically migrate. Use the existing JSON exports/imports when transferring fixtures.

Future passing pushes to `main` deploy automatically. Use the **Verify and deploy Pages** workflow's manual dispatch to rebuild the current branch, or rerun an earlier successful run to republish that run's commit. Physical-device findings remain open until recorded and reviewed.
