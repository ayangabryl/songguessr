# Prompt library

Scaffolds for the prompt template in `../PLAYBOOK.md` section 5, one per medium and one per direction from `../../direction/references/directions.md`. Fill the angle-bracket fields from the image spec; keep the field order (models weight the first fields most). Hex anchors come from `tokens.css` via `python3 ../../../scripts/contrast.py "oklch(L C H)"`, never from memory. Every scaffold ends with a "review against" line naming which of the 10 acceptance points (`../PLAYBOOK.md` rule 17) most often fail for that direction. `[house]`

Model notes. Midjourney: append `--ar W:H`, `--style raw` and `--s 30 to 80` for photo-real, `--no <list>` for the negative list, `--seed <n>` once a frame is approved. Flux 2: no negative prompts; rewrite each "no X" as a positive ("seamless plain backdrop", "bare surface"); hex codes are read literally ("in colour #2b5fbf"). Ideogram and DALL-E: prose, negative list as a final sentence beginning "Without". Firefly: keep content credentials on export. A photographer or illustrator reads the same fields as a brief. `[source: Midjourney parameter list; Black Forest Labs FLUX.2 prompting guide; Adobe Firefly content credentials]`

Contents: 1 Per medium. 2 Quiet editorial. 3 Studio mono. 4 Swiss grid. 5 Vitrine. 6 Warm analogue. 7 Luxe dark. 8 Character-led. 9 Cinematic scroll. 10 Tool density. 11 Honest brutalist. 12 Photographer or illustrator brief template.

## 1. Per medium

Change only the lens, light and material lines when moving between directions; the direction scaffolds below fill the rest.

| Medium | Lens and camera line | Light line | Material line | Typical negative additions |
|---|---|---|---|---|
| Photography, product or object | 50 mm, f/4, full-frame, tripod, eye level | soft window light from camera left, single source | matte surfaces, natural texture, no retouching beyond dust | no people, no hands unless the spec says so, no reflections of the room |
| Photography, portrait | 85 mm, f/2.8, full-frame, tripod at eye level | north window from camera left, no fill | natural skin, no smoothing | no smiling at camera, no crossed arms, no props, no logos on clothing |
| Photography, place or room | 35 mm, f/5.6, full-frame, tripod, camera level | overcast exterior light through the windows | real materials, no staging beyond tidying | no people, no signage, no converging verticals |
| Generated photo-real | as above, plus `--style raw --s 40` (Midjourney) or a named camera body (Flux) | one named source only | as above | no text, no logos, no watermark, no extra fingers, no bokeh balls, no lens flare |
| 3D render, product or material | 50 mm equivalent, camera 15 degrees above, subject 60 to 70 percent of frame | clay or matte studio: one large softbox key, fill at 25 percent from the opposite side | matte or brushed, no gloss, no glass, no chrome | no gradient blob, no glass sphere, no floating shapes, no reflections of an environment map |
| Product capture (not prompted; captured) | 2x, viewport 1440 by 900 or 390 by 844, zoom 100 percent | the product's own theme | real data, mid-task state | no fake chrome, no shadow, no tilt, no Lorem ipsum |
| Typographic image (OG, social) | none; laid out in HTML or a design tool at 1200 by 630 | none | one canvas tone, wordmark, title in the display face | no photograph, no gradient, no more than 8 words |
| Spot illustration (hand to `../../illustration/PLAYBOOK.md`) | none; flat geometric, no perspective | implied top left, one shade tone | flat fills, no outlines, no gradients | no text, no face, no character, no drop shadow, no 3D |

## 2. Quiet editorial

Medium: one editorial photograph per article when the image is the subject; otherwise none. Ratio 3:2 or 16:9 under the type, `--r-0` when it touches the margins.

```text
Subject: <the article's object, singular: a printed page, a tool, a place named in the text>
Setting: <where it actually lives; one plain surface; nothing arranged>
Composition and framing: subject on the right third, 10 % headroom, camera level, 50 % of frame, room to breathe on the left
Lens and camera: 50 mm, f/4, full-frame, tripod, eye level
Light: soft north window from camera left, single source, gradual shadow edge
Palette: near-white paper, warm grey, one ink tone ; hex anchors <#canvas L 0.985> <#text L 0.22> <#accent C <= 0.12>
Material and texture: paper, matte, fine natural grain, no added grain
Mood: unhurried, exact
Aspect ratio: 3:2
Negative: no text, no logos, no people, no gradients, no lens flare, no bokeh balls, no colour cast away from the hue
Midjourney suffix: --ar 3:2 --style raw --s 40 --no text, logo, people, gradient, lens flare
```
Review against: points 1 (palette drifts warm), 5 (horizon), 8 (each article's picture looks like a different photographer).

## 3. Studio mono

Medium: the work itself, captured or photographed; no people, no props. Ratio 1:1 or 4:5 in a 2-up grid at `--r-3`.

```text
Subject: <one shipped artefact: a printed poster, a screen showing the shipped UI, a bound book>
Setting: on a plain L 0.97 grey surface, nothing else, no table edge visible
Composition and framing: centred, artefact fills 80 % of frame, camera square to the artefact, no perspective
Lens and camera: 50 mm, f/8, full-frame, tripod, camera perpendicular to the surface
Light: one large softbox overhead, even, shadow edge soft, one faint contact shadow
Palette: neutral grey, black, white only ; hex anchors #f7f7f7 #1a1a1a
Material and texture: matte paper or matte screen, no glare, no reflections
Mood: plain, factual
Aspect ratio: 1:1
Negative: no text other than what is printed on the artefact, no hands, no props, no colour cast, no vignette, no drop shadow beyond the contact shadow
Midjourney suffix: --ar 1:1 --style raw --s 30 --no hands, props, vignette, colour cast
```
Review against: points 2 (a second light sneaks in as a reflection), 6 (resolution: the artefact's own type must stay legible), 8.

## 4. Swiss grid

Medium: photography of the institution's real objects or places, or a product capture; images are grid elements, flush to columns. Ratio 4:3 or 16:9, radius 0.

```text
Subject: <one object or building the institution owns, as a document>
Setting: in situ, frontal, nothing staged
Composition and framing: subject dead centre or flush to one edge of the frame, verticals parallel to the frame edge, 5 % headroom
Lens and camera: 35 mm, f/8, full-frame, tripod, camera level (shift lens or perspective correction so verticals are straight)
Light: overcast daylight, even, no strong shadows
Palette: neutral, near-monochrome, one accent allowed only if the object carries it ; hex anchors #fdfdfd #1f1f1f <#accent C 0.20 hue 25 or 260>
Material and texture: concrete, steel, paper; matte; sharp edge to edge
Mood: precise, documentary
Aspect ratio: 4:3
Negative: no people, no text, no dramatic light, no shallow focus, no converging verticals, no vignette, no warm cast
Midjourney suffix: --ar 4:3 --style raw --s 30 --no people, text, vignette, tilt
```
Review against: points 5 (verticals), 7 (subject must land on the grid edge the layout gives it), 9 (haze and flare are common in "architectural" outputs).

## 5. Vitrine

Medium: the product on its stage; 3D render when the object is not yet real, photograph in hand when it is. Ratio 16:10 or 4:5 in a `--r-4` stage on `--surface-2`; figure with a transparent ground when it overlaps the stage edge.

```text
Subject: <the product or stage object, one unit, hero angle three-quarter front>
Setting: floating 20 mm above a seamless matte surface tinted to the container tone, no horizon line
Composition and framing: object fills 65 % of frame, centred, camera 20 degrees above, 12 % headroom, room below for the control capsule
Lens and camera: 50 mm equivalent, f/8, subject fully in focus
Light: one large soft key from top left, fill at 25 % from the right, one soft contact shadow, single specular highlight
Palette: tonal container and one accent ; hex anchors <#surface-2 L 0.955> <#container L 0.93 C 0.05> <#accent L 0.52 C 0.14>
Material and texture: matte polymer or anodised metal, no gloss, no glass
Mood: tactile, calm
Aspect ratio: 16:10
Negative: no gradient blob, no glass sphere, no chrome, no floating extra shapes, no lens flare, no reflections of a room, no text
Midjourney suffix: --ar 16:10 --style raw --s 50 --no gradient, glass, chrome, lens flare, text
```
Review against: points 1 (renders default to a purple-blue cast), 2 (two key lights), 9 (glow around the object).

## 6. Warm analogue

Medium: photography of real objects and hands in soft daylight; uncropped on the paper canvas. Ratio 3:2, `--r-2`.

```text
Subject: <a real object from the product's world in someone's hands: a bowl, a notebook, a plant, a loaf>
Setting: a wooden or linen surface, morning, a home not a studio
Composition and framing: hands and object on the right two thirds, 10 % headroom, camera slightly above eye level, face out of frame
Lens and camera: 50 mm, f/2.8, full-frame, handheld, natural
Light: soft window light from camera left, single source, warm, no fill
Palette: cream, oat, terracotta or olive ; hex anchors <#canvas L 0.97 C 0.012 hue 80> <#ink L 0.25 hue 60> <#accent hue 40 or 120 C 0.12>
Material and texture: linen, wood grain, ceramic, matte; natural grain, no added film filter
Mood: warm, unhurried
Aspect ratio: 3:2
Negative: no faces, no text, no logos, no brown gradient, no paper texture overlay, no lens flare, no HDR, no oversaturated food
Midjourney suffix: --ar 3:2 --style raw --s 60 --no face, text, logo, lens flare, hdr
```
Review against: points 4 (hands: finger count and joint direction), 1 (orange oversaturation past C 0.06 on large areas), 9.

## 7. Luxe dark

Medium: the product, lit, on the dark canvas; photograph or render. Ratio 16:9 full-bleed or 4:5 beside type, radius 0 or 24, not both.

```text
Subject: <the product, one unit, three-quarter view, the material visible>
Setting: a dark matte surface fading into darkness, no visible horizon, no props
Composition and framing: product on the right third, 60 % of frame, camera slightly below eye level, 8 % headroom, empty left for type
Lens and camera: 85 mm, f/5.6, full-frame, tripod
Light: one hard source from top right, sharp shadow edge, one controlled specular line along the edge; no fill, no rim light
Palette: near-black with a faint tint of the brand hue, one metal accent ; hex anchors <#canvas L 0.14 C 0.008> <#text L 0.90> <#accent hue 80 or 240 C 0.08>
Material and texture: brushed metal, matte black, leather; no gloss beyond the single specular
Mood: still, exact
Aspect ratio: 16:9
Negative: no glow, no neon, no lens flare, no smoke, no particles, no gradient backdrop, no rim light, no reflections of a room, no text
Midjourney suffix: --ar 16:9 --style raw --s 40 --no glow, neon, lens flare, smoke, particles, gradient
```
Review against: points 9 (glow and haze appear by default in dark outputs), 2 (rim light counts as a second source), 1 (blue-purple shadows).

## 8. Character-led

Medium: illustration and the mascot, handed to `../../illustration/PLAYBOOK.md`; photography only of real learners, candid. This scaffold is the brief the imagery desk writes for the illustration desk.

```text
Subject: <one object from the primary task, not the mascot: a book, a badge, a map pin>
Setting: on the canvas tone, no floor, one contact ellipse
Composition and framing: 1:1, object fills 70 % of the box, centred, at most 160 px tall at 1x for empty states
Lens and camera: none; flat geometric, frontal, no perspective (illustration style row "flat geometric")
Light: implied top left, one shade tone
Palette: 3 to 5 tones of the character's hue family plus one neutral ; hex anchors <#container L 0.92 C 0.12 to 0.18> <#accent> <#shade>
Material and texture: flat fills, no outlines, no gradients, no grain
Mood: friendly, clear
Aspect ratio: 1:1
Negative: no text, no face, no second character, no drop shadow, no 3D, no confetti, no Corporate Memphis people
```
Review against: points 3 (glyph-like marks), 8 (must match the mascot's palette formula), 10 (confetti and sparkles on the never list).

## 9. Cinematic scroll

Medium: photography or video frames of the product or subject that resolve from detail to whole; the images are the material. Ratio 16:9 at 64 rem and wider, 4:5 at 390 via `<picture>`, radius 0.

```text
Subject: <the product or subject, first as an extreme detail (a texture, a seam, a dial), then whole>
Setting: a dark or neutral environment that reads as one place across every scene
Composition and framing: detail frame fills 100 %; whole frame places the subject on the left third with 10 % headroom; the copy column (480 px) stays clear on the right
Lens and camera: 85 mm macro for the detail, 50 mm for the whole, same camera height across scenes
Light: one hard source from the same direction in every scene; shadows fall the same way from detail to whole
Palette: the scene sets the palette and the UI text is white or black by measured contrast ; hex anchors <#canvas between scenes L 0.12> <#accent for the one CTA>
Material and texture: the real material, sharp, no haze
Mood: resolving, deliberate
Aspect ratio: 16:9 (and a 4:5 crop of each frame with the subject still on its third)
Negative: no lens flare, no anamorphic streaks, no fog, no particles, no text, no letterbox bars baked in, no colour shift between frames
Midjourney suffix: --ar 16:9 --style raw --s 40 --seed <fixed per scene> --no lens flare, fog, particles, text
```
Review against: points 8 (a set of 4 to 8 frames must share lens, light and grade; fix the seed), 6 (frames are shown at 2400 wide), 9.

## 10. Tool density

Medium: product captures; no photography on the product. For the marketing hero, one abstract material render at most. Ratio 16:10 at `--r-3`, 1 px border at 3:1.

```text
Subject: <a single slab or block of one matte material with one machined feature (a channel, a step, a grid of holes)>
Setting: on a seamless studio sweep the same tone as the material, nothing else
Composition and framing: slab fills the right two thirds, left third empty for the headline, camera 15 degrees above, 10 % headroom
Lens and camera: 85 mm equivalent, f/8, tripod
Light: one large softbox from top left, gradual shadow edge, one specular line along the feature
Palette: cool neutral with a faint cast of the signal hue ; hex anchors <#canvas L 0.99 C 0.004> <#surface-2> <#accent C 0.14>
Material and texture: brushed or bead-blasted metal, matte, no fingerprints
Mood: precise, quiet
Aspect ratio: 16:10
Negative: no text, no logos, no gradients, no glass, no glow, no floating shapes, no people, no reflections of a room
Midjourney suffix: --ar 16:10 --style raw --s 40 --no text, logo, gradient, glass, glow
```
Review against: points 7 (the empty third must be truly empty for the headline), 1, 3 (machined "labels" become text artefacts).

## 11. Honest brutalist

Medium: unstyled photographs at their natural ratio, documentary; or none. Radius 0, 1 px black rule around the image, no crop rule beyond the source ratio.

```text
Subject: <the real thing as found: the venue, the garment on a rail, the record sleeve, the printed poster on a wall>
Setting: where it is, as it is; do not tidy
Composition and framing: frontal, centred or flush left, camera level, whatever headroom the scene gives; keep the source ratio
Lens and camera: 35 mm, f/8, full-frame, handheld or tripod, on-camera flash allowed as the one hard source
Light: available light or one direct flash; no softening, no fill
Palette: as found; black, white and one full-chroma accent if the object carries it ; hex anchors #ffffff #000000 <#accent C >= 0.22>
Material and texture: as found; sharp; no grade
Mood: direct, unedited
Aspect ratio: source ratio (3:2 from most cameras); no crop
Negative: no distressed texture overlay, no glitch effect, no fake film border, no vignette, no colour grade, no retouching, no added text
Midjourney suffix: --ar 3:2 --style raw --s 20 --no texture overlay, glitch, film border, vignette
```
Review against: points 10 (costume brutalism: textures and glitch on the never list), 3, 5 (level is still required; raw is not crooked).

## 12. Photographer or illustrator brief template

One page. Send with the image spec and the shot list; the maker fills the blank lines. The imagery desk keeps a copy in `imagery.md`. `[house]`

```markdown
# Brief: <project>, <shoot or illustration set>
Purpose: <one sentence: what these pictures do on the page, and which primary task they serve>
Audience: <who looks at them, on what device, at what size (hero 1200 px wide; team 320 px wide)>
Direction: <name from the direction catalogue> ; reference mechanisms: <3 references, each with the one mechanism borrowed, never "the look">

## Image spec (binding for every frame)
Subject: <...> ; never in frame: <...>
Framing: <ratios per region>; subject on the <left|right> third; headroom 10 %; horizon level; eyes at 40 % on portraits
Lens: <35|50|85> mm full-frame equivalent, f/<n>
Light: <one source and quality>; shoot window <date, hours> so the light matches across the set
Palette treatment: grade toward hue <n>; midtones within 20 deg; large areas C <= 0.06; skin neutral; hex anchors <#> <#> <#>
Texture/grain: <matte; grain <= ISO 800; no filters>
Never: <text, logos, gradients, lens flare, glow, stock tells, plus the concept kill list>

## Shot list
| # | Region | Subject | Framing and ratio | Lens | Light | Count (selects) | Reference mechanism |
|---|---|---|---|---|---|---|---|
| 1 | Hero | <...> | 16:9, subject right third | 50 mm | window left | 3 | <ref: how it places the object against empty space> |
| 2 | Team | <each person, seated> | 4:5, eyes at 40 % | 85 mm | north window | 1 per person | <ref: identical distance and chair> |

## Deliverables and formats
Selects: <n> frames per row above, colour-graded to the hex anchors, plus untouched originals
Sizes: hero 2400 by 1350; section 1600 wide at ratio; team 1600 by 2000 (4:5); each also at 1x
Formats: 16-bit TIFF or full-resolution JPEG (quality 95) masters; the studio encodes AVIF and WebP; file names `<region>-<subject>-<variant>-<width>w.<ext>`
Provenance: photographer or illustrator name, date, camera or software, edits made; content credentials kept on export where the tool supports them

## Usage rights
<all media, worldwide, <n> years, including social and print; model releases for every person; the studio may crop and grade; no resale by either party>

## Deadline
Selects by: <date> ; masters by: <date> ; one round of re-selects within <n> days

## Budget
_____________________ (day rate or fixed fee, expenses, usage; left blank for the maker to quote)
```
