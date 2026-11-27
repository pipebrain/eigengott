# Level generator — shared design and roadmap

Status: **M4 doors, structural sectors, safe hazard bypasses and dual-resolution acoustics implemented** in the independent prototype. Runtime/source: [`level-generator/`](../level-generator/README.md). [Open test](https://pipebrain.github.io/eigengott/level-generator/) · [Build menu](https://pipebrain.github.io/eigengott/).

## Confirmed design

- A 2D architectural plan with rooms as nodes and complete hallways as connections. Initial topology favors a main route, branches and a few loops. Every room and hallway must attach; room degree is finite and constrained by available space/ports.
- **Random clear corridor widths from 4 to 12 m**, including intermediate values. The user also approved local widening on curved sections where the largest envelope needs diagonal clearance, staying within 4–12 m. Store sampled nominal widths and actual section widths separately. This supersedes a suggested fixed 12 m minimum. The three-largest-Selves comparison is a capacity reference; individual safe navigation remains mandatory.
- Structural GREYBOX / WHITEBOX / BLOCKOUT only. Surface-library detail is a separate system. No generated fixtures, props, trim, wall/floor/ceiling detail or other cosmetic meshes.
- Validate closure, physical clearance and all-room/all-hallway navigation before activation. Store deterministic seeds with versioned geometry, profiles, engine identity, routes and certificates; a number alone is not a certificate.
- The broader design permits curves, floor/ceiling changes, ramps/steps, enclosed or sky ceilings, ring rooms/posts and natural structural shapes. Sightlines must be checked against real opaque geometry, not inferred from a bend or height label.
- Lighting comes from invisible point emitters, sky openings or red lava / green radioactive floor/fall boundaries. Animated feature appearance belongs on structural surfaces; it must not compromise safe connectivity.
- Resolve design questions with prompts, then record the agreed decisions. Keep private research/reference files local unless separately selected for promotion.

## Implemented M4

Seeded 6/9/12-room layouts contain curves, straight and dogleg hallways, donut cores, posts, real ramps/steps and flat room sectors. Room/corridor dimensions and branch counts vary by seed. Four door types use automatic proximity opening for player and AI, with no-crush occupancy and exact shared render/collision transforms. Stair turns have 16 m flat landings; room entries match floors and flight ceilings slope independently of real stair treads.

Independent room floor/ceiling sectors create reachable one-step platforms, escapable shallow pits, 2 m inaccessible platforms and 4 m fatal liquid pits. Some donut cores are red lava or green radioactive liquid-fall walls with liquid pits around them. Hazard materials affect existing structural surfaces only. The same damage function handles every Self; burning persists after heat contact, and radiation increases toward contact with a finite 2 m range. Exact prototype tuning is in the runtime README. No decorative world polygons are generated.

The complete declared **safe** domain excludes unreachable/lethal feature sectors and radiation standoff, then erodes by the composite AABB plus 12 mm. It must remain one component covering every required room, hallway, ring quadrant and post bypass. Optional hazardous/unreachable sectors are explicitly outside this navigation promise. LUT endpoints, next hops, costs and every directed terrain edge are certified. The composite envelope contains current 18 model allowances plus level-pitch machinegun yaw; it does not establish other weapons/pitches or crowd behavior.

The dedicated controller remains the v0.1.3-based captured adapter, with complete-footprint support and bounded continuous SAT step movement. M4 reuses its existing dynamic overlay for doors; this is not current game-controller parity. The compiler creates an oriented welded shell with independent floor/ceiling planes, risers and soffits, comparing closure volume against integrated sector heights. Schema-4 packages and generator `m4.0` invalidate M3 packages. Twelve qualified seeds store geometry, navigation and acoustic metadata with version/hash guards.

The core suite sweeps 96 layouts and replays every required destination to/from the start at 4 m and 12 m fixtures, plus ring journeys. M4 tests additionally replay every generated door at both widths and all room counts in both directions, exercise occupied closing, zero-dose safe waypoints, equal player/AI fatal damage and burning/radiation behavior. Desktop browser checks exercise full live tours, actual input, native audio, cancellation and package loading. Exact evidence is generated under ignored `.local/level-generator-checks/`; these remain bounded development checks.

## Bounded acoustics for v0.1.6

Room/corridor nodes retain reciprocal validated navigation distances, six default transitions and at most four finite room echo spans. Structural sector cells carry actual floor/ceiling planes. Runtime door aperture adds 24 dB when closed and invalidates graph caches; bounded Pareto distance/loss candidates permit alternate open routes.

High resolution applies to origins in the listener's current room: **128 shared propagation/reflection work samples per 10 Hz update**. Low resolution has an independent **128 external graph-state/sector evaluations per update**, prioritizing active remote origins. The limits are separate from PCM and mixer voice limits. Local rays and echo-leg checks use real 3D collision; remote output uses the coarse bounded graph. The diagnostic projectile emits fire, every-sector-entry and impact sound without adding visible meshes. Playback reuses the native v0.1.6 mixer through an optional route binding. See [LEVEL_GENERATOR_AUDIO.md](LEVEL_GENERATOR_AUDIO.md).

## Next milestones

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| Prototype review | Inspect elevated blockout scale, curves, rings, posts and noise graph | User play review; preserve 4–12 m width range and all-region connectivity |
| Polygon/terrain compiler | Curves, cores, posts, slopes and real stairs implemented; stacked sectors and natural variants remain | Shared polygon render/collision boundary, closed non-overlapping geometry, full clearance-domain coverage |
| M3 broader traversal | Final supported body/armor/weapon profiles, turns, full-region routing and versioned certificates | Every declared region connected for each supported profile; exact endpoint and controller checks |
| M4 review / remaining structure | Review doors, sectors and hazards; add sky openings and light occlusion later | Safe routes, no-crush doors, measured sight breaks, no details/fixtures |
| M5 catalogue qualification | Broader seed sweeps, adversarial fixtures and combat pacing review | Retain only passing packages; report rejection rates, duplicates and measured budgets |
| M6 production integration | Staged render/collision/nav/lighting, preserved landing patch, spawn cohort and checkpoint handling | Validate the final composed world; atomic activation, cancellation and recovery |
| M7 handoff | Integrable v1.2 prototype and reviewed shared documentation | Reproducible build, catalogue, evidence and explicit remaining limitations |

M4 point lights currently use the shadowless case: light may cross walls even when the physical shell is sealed. Stacked sectors, natural variants, sky ceilings, other weapons, arbitrary pitch/crowds, recovery and physical-device behavior remain unverified. See [`level-generator/README.md`](../level-generator/README.md) for commands and exact scope.

## Publication contract

The root index is the shared build menu: current game at `play.html`, engine baseline/test hub and generator at `level-generator/`. GitHub Pages stages only explicit runtime paths. Generator Rust/rebuild sources and this roadmap are shared in GitHub; private `.local/` research, downloaded inspiration, local logs and evidence are excluded from the site artifact. Deployment must pass existing engine checks plus generator rebuild, catalogue identity and core validation.


## Room acoustics audition

The viewer enables positional sound and auditions a selected destination, or fires an invisible diagnostic projectile with stock OpenArena audio. Work counters expose local samples and external evaluations independently. Its optional binding supplies generator routing to native HRTF playback; the current game keeps its own router. Late reverb and coarse anchor distances remain approximations; listening balance and physical-device review are pending. See [SOUND_DESIGN.md](SOUND_DESIGN.md) for the shared playback implementation.
