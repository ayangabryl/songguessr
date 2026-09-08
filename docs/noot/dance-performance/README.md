# Readable dances and crowd performance

The initial template adaptation muted the source motions too much. The four dance loops now have Noot-specific choreography: a step-touch groove, body roll, Charleston kicks/toe turns, and alternating hip-sway reaches. Body weight shifts span 0.18–0.38 model units, with independently planted feet. A regression check requires noticeable hand movement and foot lifts in every dance. Loop seams and actual deformed sole clearance are checked on the exported GLB. Pair dances play a full four-second phrase; group dances run for sixteen seconds and can be interrupted.

Animation remains baked in Blender. The browser does not solve retargeting or scan vertices to animate dance foot contact.

Runtime changes:

- Bind AnimationMixer actions on first use, instead of binding every clip when a Noot mounts.
- Use a material uniform for blush colour; preserve feathered alpha without rewriting/uploading cheek vertices each frame.
- Apply static wardrobe styles only when appearance changes.
- Update label transforms only when projected coordinates change.
- Recompute the single-character camera projection on resize.
- At four or more characters, omit sixteen tiny paw-pad meshes per Noot and cap pixel ratio at 1.25. Full arm and foot anatomy stays visible, and all detail returns for smaller groups.
- Existing pause, reduced-motion, offscreen/tab-hidden suspension, shared asset loading, and resource cleanup remain in place.

The six-character browser sample dropped from 298 to 202 draw calls (32%). Exact observed intervals and CPU timings are in `browser.json`. CPU-only 1/2/6-character samples are in `before.json` and `after.json`, reproducible with `node scripts/benchmark-noot.mjs`. Timing samples are sensitive to machine load; they are not a device-wide FPS guarantee. No real mobile hardware or networked multiplayer session was benchmarked.

Validation: 45 Noot tests pass. Browser review confirmed the amplified group poses, pause control, intact silhouettes/accessories, and no browser errors. The deployment asset remains under 5 MB with 43 clips; raw reference animations and Blender files are not browser downloads.

Before publishing, the exact staged source tree was checked in a separate temporary directory: 109 tests passed across Noot, shared match/profile rules, playback and scoring, plus a successful production client/worker/admin build. Targeted runtime lint passed. Existing build chunk-size advisories remain. Unrelated in-progress song-matching worker edits were excluded from the commit.
