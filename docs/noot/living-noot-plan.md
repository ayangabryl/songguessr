# Living Noot — working brief

Original timed session: 2026-09-08 05:08–07:08 Asia/Manila. The user explicitly
resumed the polish afterward. Historical notes below describe the earlier cap;
the resumed work and verification are recorded at the end.

The character should feel curious, musical, affectionate and occasionally
grumpy. Use authored Blender poses with an attention/behavior director and
physical response. Pure procedural oscillation would repeat the robotic quality
we are correcting. Give a reaction anticipation, an action, follow-through and
rest; vary timing and intent per character rather than shaking every part.

Requirements to verify:

- Rounded antenna silhouette from every angle; balanced soft hands.
- Foot soles and open palms have paw pads; a small expressive rear tail.
- Editable Blender rig and matching exported web asset.
- Browser gaze retains brown irises near the pointer; blinking closes fully.
- Individual idle/gesture variations with attention, pauses and interruption.
- Shared multiplayer space: notice friends, approach, play, respond to greetings,
  wins/frustration, contact and falls; recover naturally instead of teleporting.
- The same shared behavior is reviewable locally without a live multiplayer room.
- Pointer, touch and keyboard equivalents; stable input, reduced motion,
  visibility suspension and clean disposal.
- Review moving frames in Blender and Three.js, including side/back, hand/foot
  undersides, rapid changes, contacts and recovery; validate the actual export.

Game/network state owns identity, scores and greetings. The animation director
owns optional local acting; physics owns shared-space translation and contact.
Authored clips own skeletal poses. Facial attention owns gaze and blink after
clip evaluation. Presentation must never delay a game action.

Expanded scope during this goal:

- New multiplayer games use 5,000/4,000/3,000/2,000/1,000 points. Existing
  in-progress classic matches retain their original scoring. Shared ranks and
  explicit tie copy; score count-up and list reordering respect reduced motion.
- Multiplayer layout, compact mobile standings, clear transport/answer hierarchy,
  upright game typography, perfect-score feedback, and a local state preview.
- Answer validation honors selected IDs, retains international title identity,
  requires complete typed titles, and never substitutes a different explicit
  round track. Existing catalogue metadata has not received a full manual audit.
- Fitted shirt, bandana, beanie and bucket hat, fabric patterns/colors, starter
  outfits, multiple viewing angles, signature outfit gestures and Samba.

Verification notes (2026-09-08):

- Type checking passed. Client/worker and admin production builds passed with
  existing large-chunk / mixed static-dynamic import warnings.
- 24 matching/scoring/social-world cases passed. 30 Noot checks passed before
  removing the temporary palm-position diagnostic; targeted blink/gaze and
  opposite-palm contact checks passed against the GLB.
- Reviewed desktop/mobile arena and wardrobe layouts in Chrome. Disabled WebGL
  for the initial layout captures; these show the SVG fallback. Mobile overflow
  check: 390px viewport, 390px document width. Corrected crowded two-column ranks.
- Chrome/Metal subsequently rendered the GLB and recorded the shared playdate,
  pickup/drop and dance. Review footage: `noot-web-motion.webm`.
- First Blender hat renders were too conical. Revised to a rounded beanie dome
  and a flatter bucket crown. Current export/render timestamps determine which
  version a review artifact contains; do not use the earlier hat images as proof
  of the revised shape until the final renders have been inspected.

Practical limits: cloth and foam use bounded realtime dynamics and collision
proxies. Local dragging/autonomous play are not replicated physical state across
clients. Network greetings and game reactions are shared. Do not claim exhaustive
collision-free animation, a general cloth solver, or feature-film production
quality from passing numeric tests or a single front render. Live multi-client
backend verification is separate from the local arena fixture.

Final asset review, 07:04: the revised beanie dome and bucket crown were
rendered and inspected. The GLB contains 36 clips, 19 bones, 65 meshes and
two embedded textures (painted eyes and a knitted normal texture), about
4.1 MB. The Blender file opens on Idle with the default headphones and
wardrobes hidden individually in the Outliner. Final display renders:
`wardrobe-hat-gesture.png`, `wardrobe-bandana.png`; condensed browser motion:
`playdate-preview.mp4`. The earlier `wardrobe-samba.png` is superseded by the
revised hat geometry. Full production build passed again after the code/UI
changes; the final GLB was copied into the build output.

At the time limit, remaining work is an art/physics polish pass across every
garment and extreme pose (including cloth self-contact), network replication
for pickup/drag/drop with ownership/rate limits, and a live multi-client match
check. The current local playdate should not be described as synchronized
physical simulation or all animations as feature-film quality.

Final verification: 30 full Noot checks passed on the final exported asset, plus
a targeted foam test confirming compression during earcup contact and recovery
afterward. The latter brings the Noot suite to 31 cases. Scoring/matching/social
regressions and 20 legacy matching checks passed. No deployment or commit made.

FINAL CHECK CORRECTION AT 07:08: expanding loop verification to WalkSoft, DanceB
and Samba caught a WalkSoft foot_L.position seam mismatch. Final result is
30/31 passing, not 31/31. The optional WalkSoft clip needs loop endpoint
correction in Blender and a fresh export. The two-hour limit prevents another
export/review cycle in this goal. Builds passed; do not call the full goal complete.

## Resumed polish — September 8

The user's follow-up requested finishing the polish, correcting the flat
triangle, preventing jumps getting stuck above the floor, adding interaction
variations and involving groups larger than two.

- Rebuilt the triangle as a smaller, rounded kerchief with folds, a continuous
  wrap, back knot and matching cloth/hem Flutter morphs, through Blender MCP.
- Corrected WalkSoft's fractional-frame endpoint and exported a new Jump clip
  with arm lift, tucked feet, face, antenna and landing follow-through. Flight
  remains owned by world gravity; the clip adds no root translation.
- Replaced the indefinite pickup demo button with a finite jump. Pointer release,
  lost capture, blur and visibility changes drop held actors. Sideways collision
  response removes the balancing-on-a-friend failure. Labels stay on the floor.
- Added 2/3/4/6-member studio rosters, actor selection, wave chains, varied group
  dances, fair autonomous turns, audience reactions and distance-gated contact.
  Roster changes reflow seats before simulating, avoiding overlapping new seats.
- Fixed duplicate animation-frame scheduling during roster resize, accounted for
  slower frames with bounded substeps, and included full wardrobe preferences in
  the single-character studio preview.

Current export: 4,609,608 bytes, 68 meshes, 19 bones, 37 clips, two embedded
textures. All 38 Noot regression tests pass, including the former WalkSoft seam,
actual exported jump behavior, repeated/interrupted flights, head-on drops,
three-to-six participation and adding/removing friends. The earlier 30/31
result above is superseded. The practical networking/cloth limits still apply.

Final rendered verification: Chrome/Metal loaded the GLB without console or page
errors. Reviewed pair contact, mouse/keyboard jumps and their landed frames,
window-blur release, pause/resume, reduced motion, three- and six-member wave
chains and group dances. The 390px mobile page remains 390px wide. Production
client/worker/admin build passed; existing bundle-size warnings remain.
`polished-playdate.mp4` is the new browser motion recording; `polish-*.png` are
the resumed pass's screenshots. `kerchief-polished.png` is the Blender garment
render. No deployment or commit was made.
