# Pinned geometry dependencies

All runtime code is committed locally; no CDN or package-manager access is needed to generate or view a level. License texts, including bundled code, ship in [`../licenses/geometry.txt`](../licenses/geometry.txt).

| Runtime | Upstream source | Change |
| --- | --- | --- |
| `earcut.js` | [earcut 3.0.2](https://github.com/mapbox/earcut/tree/v3.0.2), npm `earcut-3.0.2.tgz`, `package/src/earcut.js` | Unmodified source ESM |
| `polygon-clipping.js` | [polygon-clipping 0.15.7](https://github.com/mfogel/polygon-clipping/tree/v0.15.7), npm `polygon-clipping-0.15.7.tgz`, `package/dist/polygon-clipping.umd.js` | The UMD dispatch wrapper becomes a local IIFE constant and `export default polygonClipping`; factory contents unchanged |

The polygon-clipping UMD bundle includes splaytree 3.1.2, robust-predicates code and TypeScript helpers. Their notices/licenses are included.

SHA-256 of npm source tarballs:

```text
546b92493d021b05b5c3832edbae292ad3686848a3f434697b6338d4d74c8253  earcut-3.0.2.tgz
23bdea671a65011107d91536881f527c8e2e6820f59e4bc1408a94d7cc11d5b7  polygon-clipping-0.15.7.tgz
```

SHA-256 of committed runtime files:

```text
83d5b59bc520601bb2dd7401a2f8382a008d8d95e0e6e0fe45759ae4fda1aa56  earcut.js
4a706a01f6a9545b632eef943be79cff6dcc22aebf5ed378143d82042b875471  polygon-clipping.js
```

Earcut explicitly does not guarantee correctness for arbitrary input. The generator verifies triangle union/area against the source polygons, removes no free-space components, conforms structural floor edges to the complete ring vertices, checks exact wall-boundary coverage and rejects an invalid shell. Navigation and actual-engine collision certification provide additional independent gates.
