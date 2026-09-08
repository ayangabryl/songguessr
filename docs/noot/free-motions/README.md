# Free motion templates for Noot

Source: [Mesh2Motion](https://mesh2motion.org/), Scott Petrovic and contributors.
The selected human add-on animations are provided under [CC0](https://github.com/Mesh2Motion/mesh2motion-app/blob/main/LICENSE-CC0.MD).
Pinned revision, original clip names and SHA-256 are recorded in `assets/noot/motions/source.json`. The upstream animation GLB and license are retained there for reproducible editing. The source library is not served to browsers.

| Noot clip | Original source | Playback |
| --- | --- | --- |
| Groove | Idle Listening | 4-second loop |
| BodyRoll | Dance Body Roll | 8-second loop |
| Charleston | Dance Charleston | 4-second loop |
| HipSway | Dance Reach Hip | 4-second loop |
| VictoryPump | Victory Fist Pump | 2.4-second gesture |
| FriendlyWave | Greeting | 3.2-second gesture |

These are adapted animation templates, not newly recorded motion capture. Noot-specific step-touch, body-roll, toe-turn and arm-reach accents make the four looping dances legible at small stage sizes. Blender samples the source joint trajectories, compresses the movement range for Noot's body and arms, maps anatomical sides, and gives the independent feet bounded steps with one sole grounded. No imported human skeleton replaces Noot's 19-bone rig. Expressions and antenna follow-through remain Noot-specific. Loops blend over the last 12% to close their seam; gestures ease in and return to neutral. Hand trajectories are simplified for Noot's mitten anatomy, not exact human hand-contact retargeting.

Rebuild using Blender MCP in the existing NootStudio scene:

```python
import sys
sys.path.insert(0, '/Users/ayangabryl/Documents/Dev/songguessr/scripts/blender')
import noot_retarget, noot_asset
noot_retarget.prepare()
noot_asset.animate(list(noot_retarget.CLIPS))
noot_asset.export()
```

`prepare()` also imports the upstream GLB if Motion_Source does not exist. The reference rig lives in a hidden Motion Reference collection and is excluded from the selected-object export. `retarget-samples.json` preserves sampled trajectories, so a full `noot_asset.animate()` also reproduces the clips without importing the reference again.

The Three.js runtime chooses a stable per-character style for the existing dance mood, with event variations. Explicit studio buttons expose all six clips. Pair and group dances use the new styles; the group director supplies one elapsed clock, keeping four- and eight-second phrases aligned at the authored 120 BPM. This is a fixed choreography tempo, not song BPM detection. Pausing freezes that clock, and grabbing or jumping cancels the group dance. Source animation root translation never moves the stage actors.

Mixamo was checked but required an Adobe login in the available browser. No Mixamo assets, paid packs, registrations or marketing subscriptions were used. The Rokoko free collection examined is primarily magic-themed and was not added to this music companion.

## Verification

- 45 Noot tests passed, including actual exported GLB playback, all new loop seams, planted-foot bounds, no root elevation, gesture recovery, shared-clock playback, pause, group cancellation, and restoration of the game listening mood.
- Production build passed; existing large-chunk and mixed static/dynamic import advisories remain.
- Export: 43 clips, 19 bones, about 4.85 MB.
- Browser review in Noot Studio: Charleston front, body-roll/hip-sway three-quarter poses with the current wardrobe, six-person choreography controls, pause/resume, and grounded recovery after jump. Browser console had no errors or warnings. This did not test a live multi-client server or detect tempo from song audio.
