# SongGuessr social card

Goal: replace the flat legacy mascot with the existing rigged 3D Noot and simplify the 1200 × 630 social preview. Preserve Instrument Serif/Open Runde, the green music-note silhouette, headphones, and SongGuessr identity. No player counts, testimonials or unsupported claims. This is a static share image: controls, interactive motion and narrow responsive layout are not applicable; thumbnail readability and crop safety are.

Three arrangements, identical copy: A — brand and headline left, full 3D Noot right; B — oversized centered brand, smaller headline and Noot under it; C — full Noot left, right-aligned copy block. Compare as actual 1200 × 630 images and at 600 × 315. Provisional preference A for fast reading and a large, intact mascot. Content: SongGuessr; “Know it in a heartbeat?”; “Guess the song. Solo or with friends.”; songguessr.lol. At least 64px safe inset. Warm off-white canvas, near-black type, one green headline accent. No fake clickable button, ornamental player dots or extra marketing labels.

Use assets/noot/noot.blend in an isolated Blender background process; the user's open scene remains untouched. Render the character, then compose vector typography with resvg and project fonts. Keep rendering and card generation reproducible. Update OG, Twitter and structured-data image URLs together with a new revision so share caches can request the replacement. Visual acceptance pending actual renders.

## Rendered decision

Selected **A** after inspecting all three at 600 × 315 and the chosen card at 1200 × 630. It has the clearest reading order: brand, two-line headline, description, then the full character. B makes Noot noticeably smaller and separates the brand from the message. C preserves character size but puts the message after the mascot in the reading order. The chosen composition keeps the note tip, headphones, hands and feet inside the safe area, and the headline remains clear at thumbnail size. The small URL is secondary. This is an agent visual review, not a user acceptance claim.

The new render uses the existing Blender mesh and materials with no synthetic replacement mascot. The final card is static PNG, so it adds no 3D rendering work to the shared page. OG, Twitter and JSON-LD now point at image revision 3; both social tags include image descriptions. Preview cache updates on external social platforms can only be assessed after deployment.
