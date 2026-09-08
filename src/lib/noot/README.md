# Noot runtime

The game, `/?noot-studio`, and multiplayer load the same Blender character from
`public/mascot/noot.glb`. Editable source: `assets/noot/noot.blend`. Reproduction:
`scripts/blender/noot_asset.py` and `scripts/blender/noot_wardrobe.py`.

- `asset.ts`: cloned skeletons, materials and iris textures; 220 ms clip blends;
  authored morphs with independent attention/blinking layered after the mixer.
  Authored values are restored before evaluation so unchanged mixer tracks cannot
  accumulate gaze rotations or leave the eyelids closed. Gaze changes the iris
  texture's bounded UV offset rather than sliding geometry through the whites.
- `character-mind.ts`: identity-seeded timing, saccades, asymmetric blinks,
  occasional double blinks, rest intervals, outfit gestures and varied fidgets.
- `social-world.ts`: shared positions, intent, turn-before-travel, capsule contact,
  gravity, damped landing response, approach/contact/recovery phases. High fives
  angle both characters inward and use opposite hands. Greetings and score events
  come from the game; autonomous play and pointer-drag physics are local cosmetic
  simulation, not network-synchronized physical state.
- `party-scene.ts` / `NootParty.tsx`: one renderer for the table's characters,
  pointer/touch dragging, keyboard selection/jumping, context recovery,
  visibility suspension, disposal and reduced motion.
- `soft-accessories.ts`: skinned clothing follows the body/arms. Bounded spring
  dynamics drive cloth/brim morphs from movement; hand-to-pad distance compresses
  headphone foam. A chest clearance proxy makes small forearm corrections.
  These are realtime approximations, not a general cloth/soft-body solver; extreme
  poses still require visual collision review. Scarf, bow and glasses retain the
  existing procedural geometry in `wearables.ts`.
- `scene.ts` / `Noot3D.tsx`: single-character framing, lifecycle and SVG fallback.
  `model.ts`, `geometry.ts` and `face.ts` retain the earlier procedural model for
  regression/reference work; production loads the GLB.

`npm run test:noot` checks the actual exported geometry and runtime. Game rules
and matching: `node --test shared/match.test.ts worker/match-guess.test.ts
shared/noot-profile.test.ts`. `npm run build` builds client/worker/admin.

Development previews: `/?noot-studio` for motion and wardrobes, `/?match-preview`
for lobby, playing, 5,000-point result, tie and final layouts. The latter uses a
clearly labeled local fixture; it does not validate a live multiplayer backend.

The studio now previews 2, 3, 4 or 6 Noots with a selected actor, neighboring
pair gestures, a staggered wave chain and group dances. Autonomous turns favor
friends who have waited longest. Contact gestures require a clear approach lane
and wait for both actors to arrive; other friends acknowledge the pair.

Space / Little jump starts a finite jump (anticipation, gravity, soft landing).
Dragging holds only until release, lost capture, window blur or tab hiding.
Sideways contact resolution prevents characters from balancing on one another.
Roster changes reflow seats before physics to prevent new arrivals overlapping
existing seats. Motion pauses explicitly and reduced motion clears world motion.

Free CC0 dances are baked in Blender and played from the same GLB. Crowd rendering omits only tiny paw pads at four or more characters; two-person/solo views retain them. Animation actions bind on demand, blush uses a material tint, and stable name-label transforms are not rewritten each frame. `scripts/benchmark-noot.mjs` measures CPU playback; development party canvases expose a `data-noot-performance` sample for browser review.
