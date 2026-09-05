# Noot

The game and the development preview at `/?noot-studio` use the same Three.js character.

- `geometry.ts` sculpts one closed pear-and-note surface from a signed-distance field. Skin weights blend hips, head, note stem and a separate flexible tip. Hands and feet use smoothly joined volumes. Facial surfaces use the same body profile.
- `face.ts` keeps eyes, iris and pupils on one curved surface. Eyelids close over the eyes; the smile ribbon morphs into smiles, open mouths and frowns. The eyes never squash or stick out as stacked disks.
- `headgear.ts` builds separate accessories on a head mount: charcoal headphones, peach kitten headphones, a daisy, or none. The headphone bridge sits behind the note with clearance throughout head and note movement.
- `motion.ts` supplies damped springs and asymmetric blinks. `model.ts` choreographs anticipation, strides, weight shifts and settling. Feet alternate contact while walking; the note follows head movement with a small delay.
- `scene.ts` owns rendering, light/dark lighting, pointer tracking, pause/speed, resizing, visibility suspension and GPU disposal. Reduced motion settles to a static expression. `Noot3D.tsx` retains the vector fallback for loading and unavailable WebGL.
- `preferences.ts` saves headgear and listening mood locally and synchronizes open tabs. Music moods are user-selected animation presets; they do not analyze or classify song audio.

The studio offers rotation, replay, pause, speed, lighting, palettes, outfits, happy/sad listening, dancing, walking, running, waving, pets and celebrations. New action tokens replay gestures without rebuilding the model. During game skips, the ruler owns horizontal travel and the rig supplies a run, double hop or bound (cycling with each event); measured canvas speed adjusts running cadence; the final skip moves toward the result's open side before settling into the loss expression.

Run `npm run test:noot` for topology, skin weights, locomotion, replay, pause, accessory selection, low-frame-rate stability and reduced-motion checks. Run `npm run build` for production validation.

The default studio comparison shows the supplied photo, original vector source and live 3D at calibrated character heights. Eyelid meshes share the physical skin material, with complementary eye/lid masks and a subtle closure crease. Headphone pads contact the cheeks; connected rails and hinges carry the bridge into the shells.

Reference poses: hold an earcup, curious shrug and one-arm cheer. Shoulder pitch and elbow bends ease independently. Ear cups pivot around their fixed hinges; spring-driven ear decorations and flower respond to gait, arm angular velocity and landing cues. Motion is constrained procedural spring animation, not a general rigid-body collision simulation. Calm playback occasionally triggers an earcup hold. Rest body and limb dimensions are unchanged by these poses.
