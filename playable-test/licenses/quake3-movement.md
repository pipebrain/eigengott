# Quake III movement adaptation

Copyright (C) 1999-2005 id Software, Inc. Original code and the Rust adaptation in `src/q3move.rs` are GPL-2.0-or-later. The redistribution license is included in COPYING.txt and quake3-source.zip.

Pinned upstream: https://github.com/id-Software/Quake-III-Arena/tree/dbe4ddb10315479fc00086f08e25d968b4b43c49

Adapted routines: PM_ClipVelocity, PM_SlideMove, PM_StepSlideMove and PM_CorrectAllSolid. Quake units are converted at 32 units per metre. Body tracing uses EIGENGOTT's triangle / box collision queries. The ground probe is two Quake units (0.0625 m) to cover the engine's combined 0.035 m support-query margin and 0.015 m transition-floor clearance. Bounded overlap shells move to an actually verified point; a verified prior player pose is retained for recovery. The more-progressing valid step path is preferred to avoid stepping backward. This is a scoped movement adaptation, not the full Quake III engine or a claim of exact movement parity. Weapon models do not participate in body collision.

The unmodified upstream C files and license are in [quake3-source.zip](quake3-source.zip). The adaptation's corresponding source is [q3move.rs](https://github.com/pipebrain/eigengott/blob/main/playable-test/src/q3move.rs), [physics.rs](https://github.com/pipebrain/eigengott/blob/main/playable-test/src/physics.rs), [body.rs](https://github.com/pipebrain/eigengott/blob/main/playable-test/src/body.rs) and [overlay.rs](https://github.com/pipebrain/eigengott/blob/main/playable-test/src/overlay.rs); build instructions are in the playable README.
