# Headphone contact and final-result polish

The arm's shoulder cap originally started inside the lower cushion. Seat the
shoulder 0.10 character units lower when headphones are worn, then steer sampled
upper-arm and palm volumes around the moving earcups after clip blending and
clothing correction. Solve in the head bone's local space, with at most eight
passes per arm. Restore authored transforms before each mixer update to avoid
drift, including pause, reduced motion and wardrobe changes.

This is a kinematic character constraint in the shared Three.js asset player,
not a general rigid-body or ragdoll simulation. Blender's rig was inspected; the
GLB and editable Blender file are unchanged. Every game mode using the asset
player receives the constraint. Contact still drives subtle cushion compression.

Validation uses actual skinned vertices against convex planes from all four
parts of both earcups, independent of the runtime's approximate volumes. Tested
idle, high-five, wave, small wave, stretch, cheer, celebration, listening and their
transitions with both headphone styles. No sampled arm points were more than
0.003 units inside a cup. Opposite high-five palm centers reach a 0.064-unit gap;
existing contact, grounded dance, pause and independent-instance tests pass.

Browser review covered the raised wave from front and three-quarter views and
an actual paired high-five. No new geometry, textures or draw calls are added.
Local CPU sample for six dancing Noots: median 0.931 ms, p95 6.711 ms; GPU time is
excluded and the development machine was shared with other active work.

Final results now use one outcome heading, a compact rank/total summary, the
last track and Play again. Removed repeated completion labels, last-round points
and the inaccurate next-song instruction on the final screen. Waiting status,
ready counts and score-reset/carry-over information remain. Reviewed at desktop
and 390px width; no horizontal overflow. Also clamped the score count-up's first
frame to prevent a negative display when its RAF timestamp precedes effect setup.

115 relevant tests and the production build passed before release.
