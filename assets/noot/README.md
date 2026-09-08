# Noot — Blender source and Three.js asset

Created in Blender 5.2.1 through Blender MCP, using the supplied photo for shape,
proportions and headphone construction. The two supplied 4.04-second clips guide
the earcup/shrug gestures and side/back silhouette. The walk and other game
reactions are authored animation, not motion capture from those clips.

## Files

- `noot.blend`: editable meshes, shared armature, facial shape keys, named NLA
  tracks and a lit preview scene. The pre-existing Blender scene is preserved
  separately; choose **Noot Studio**.
- `../../public/mascot/noot.glb`: self-contained web asset, under a 5 MB budget, with
  19 bones, 68 meshes and 43 animation clips (about 4.85 MB). The iris and knitted normal PNGs are embedded; no external textures or services.
- `../../scripts/blender/noot_asset.py`: reproducible geometry, weight assignment,
  animation and export source.
- `../../docs/noot/`: review renders and a walking preview.

## Editing

Select **Noot_Rig** and enter Pose Mode. Controls are `root`, `pelvis`, `chest`,
`head`, `note_stem`, `note_tip`, `upper_arm_L/R`, `forearm_L/R`, `foot_L/R` and
`gaze_L/R`, `hand_L/R`, and `tail_base/mid/tip`. Bone rotation modes are XYZ. Feet attach to the root so the body can
shift weight independently of a planted foot. Body and note form a continuous
surface. Soft arm weights blend across the elbow.

Eye surfaces keep their volume. Brown irises, pupils and catchlights use an embedded painted texture with bounded gaze offsets. `Noot_Lid_L/R` and `Noot_LowerLid_L/R`
have **Blink** shape keys; upper and lower skin lids cover the eye, with a
**Close** crease on `Noot_Lash_L/R`. Brows have **Concern**, **Lift**, and **Angry**;
the mouth has **Open** and **Frown**. Headphones are separate meshes with the
`headgear=headphones` custom property, attached to the head through the shared
skin. The padded bridge sits behind the note, with rails connected to the cups.

Each clip groups matching NLA tracks on the armature and facial shape-key owners.
Use the helper to preview skeletal and facial motion together:

```python
import sys
sys.path.insert(0, '/path/to/songguessr/scripts/blender')
import noot_asset
noot_asset.select_clip('Walk')
```

Looping clips include **Idle, Walk, WalkSoft, Run, Dance, DanceB, Samba, Happy, Sad, Listen, Sleepy, Groove, BodyRoll, Charleston, HipSway**.
Reactions: **Wave, Pet, Celebrate, Streak, Shrug, Cheer, Lose, Switch, Skip**.
Additional acting includes **LookAround, Stretch, Yawn, WaveSmall, HighFive,
Boop, Laugh, Angry, Startled, Tumble, Sit, GetUp, Catch, HatTip, FabricCheck, TeeTug**.
Palm and sole pads and a three-bone curled tail complete the anatomy.
The wardrobe script supplies a fitted bandana, tee, knit beanie and bucket hat;
`wardrobe` extras select them in the web runtime. Foam has a **Squish** morph;
cloth and brim edges have **Flutter** morphs driven by bounded runtime dynamics.

The game uses looping Run during measured ruler movement and blends back to Idle
when movement ends. A standalone Skip clip is also exported.

The lower antenna blend is centered and symmetric. Its hook remains asymmetric,
with rounded front/back depth. The body has a fuller side profile, continuous
slender mitten arms, curved facial surfaces, soft vertex-alpha blush and rounded
headphone shells with flat extension rails. The studio uses an orthographic
camera so turning and gestures retain a consistent framing scale.

## Regenerate or export

Call stages separately in Blender's Python console or through Blender MCP:

```python
noot_asset.build()    # Replaces generated objects in Noot Studio.
noot_asset.animate()  # Replaces generated animation tracks.
noot_asset.export()   # Saves .blend and writes public/mascot/noot.glb.
```

After hand edits, call **export() only**. Building or animating again replaces
those authored parts with the script's version. Export uses selected asset
objects, NLA track grouping, sampled animation, morphs, skins, custom properties
and zero-based clip times. Blender Z-up/-Y-forward becomes Three.js Y-up/+Z-forward.

`npm run test:noot` validates the exported result. The source photo is already
available in `public/mascot/noot-reference.jpg`; it is not baked onto the model.

Wardrobes are hidden individually in the Blender Outliner by default. Enable the
chosen objects with the eye and render controls; the glTF export includes all
options and the web runtime selects one per category.

The kerchief has a rounded, gathered front, continuous wrap, rolled seams and a
back knot. Its front hem shares the Flutter morph with the cloth. `Jump` supplies
arm, foot, facial and antenna acting; the shared stage owns the ballistic root
translation. Do not add root elevation to that clip. Fractional-length loops use
normalized frame phase so WalkSoft closes exactly.

Free template sources, licensing and reproduction steps are in `motions/source.json` and `../../docs/noot/free-motions/README.md`. The dance adaptation adds Noot-specific choreographic accents so steps and arm movement remain readable at small sizes.
