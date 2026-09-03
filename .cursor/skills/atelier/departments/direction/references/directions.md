# Direction catalogue

Ten premium directions. Each is a coherent set of defaults for the downstream desks: type, colour, geometry, material, motion, hero device. Pick from the signal table, present two, recommend one. When a client rejects one, present the next; do not decorate the rejected one.

A direction is not a look to copy. It is the set of decisions that make a site read as made on purpose. Every value here is a default that `tokens.css` records; the desks may override with a written reason.

Contents: 1 Signal table. 2 Quiet editorial. 3 Studio mono. 4 Swiss grid. 5 Vitrine. 6 Warm analogue. 7 Luxe dark. 8 Character-led. 9 Cinematic scroll. 10 Tool density. 11 Honest brutalist. 12 Hybrids and the order of fallback.

## 1. Signal table

Read the brief and the intake card. Match the strongest signals; the row gives two candidates in order.

| Brief signals | First candidate | Second candidate |
|---|---|---|
| Long reading, essays, documentation with narrative, a publication, "calm", "trust" | Quiet editorial | Warm analogue |
| A studio, agency or portfolio; the work must speak; "straightforward", "craft" | Studio mono | Swiss grid |
| Institutional, engineering, industrial, "precise", "no nonsense", data with hierarchy | Swiss grid | Tool density |
| Consumer app with media or a stage object; controls over content; "Apple", "fluid" | Vitrine | Character-led |
| Health, food, home, journaling, "warm", "human", "handmade" | Warm analogue | Quiet editorial |
| Luxury, audio hardware, fashion, automotive, "exclusive", "cinematic" but product-first | Luxe dark | Cinematic scroll |
| Education, games, kids or family, a mascot exists, "playful", "friendly" | Character-led | Warm analogue |
| Brand launch, campaign, a single product story, "wow", "immersive" | Cinematic scroll | Luxe dark |
| A tool, dashboard, editor, admin, developer product, "fast", "dense", "keyboard" | Tool density | Swiss grid |
| Culture, fashion, music, a manifesto, "raw", "honest", "anti-corporate" | Honest brutalist | Studio mono |
| "Make it premium" with no other signal | Quiet editorial | Vitrine |
| Guessed brief (archaeology) for a consumer product | Vitrine | Quiet editorial |
| Guessed brief for a B2B or internal tool | Tool density | Swiss grid |

## 2. Quiet editorial

One idea: a reading room. One column, one voice, nothing floats.

Choose when: the content is words and the user's job is to read or decide slowly. Avoid when: the primary task is a control (play, buy, configure) or the content is a dense list.

- Type: display serif with a text sans. Default Instrument Serif (display, 39 to 61 px, weight 400) with Inter or Geist (body 17 px, UI 14 px). Upgrade: Tiempos Headline or Canela with Untitled Sans. Italic serif for section labels; sentence case everywhere.
- Scale: ratio 1.25 from 17 px; line-height 1.55 body, 1.1 display; measure 62 to 68 ch.
- Colour: canvas L 0.985 with chroma 0.004 of the brand hue; text L 0.22; one accent, chroma at most 0.12, used for links and the single primary button. Dark mode: canvas L 0.17, text L 0.94, accent L 0.76.
- Geometry: single column 640 to 720 px; section gaps 96 px desktop, 64 px mobile; radius set 0, 8, 16 px; no capsules except one button if any.
- Material: solid surfaces; 1 px lines at 3:1; no shadows; no blur.
- Motion dialect: editorial fade. Content fades and rises 8 px on first paint, 400 ms, staggered 30 ms, at most five items. Nothing else moves.
- Hero device: a single sentence in the display serif with one line of sans beneath. No image unless the image is the subject.
- Signature details: hanging punctuation on the display line; a rule above the footer only; numerals in old-style figures in running text, tabular in tables.
- Pitfalls: a centred body paragraph; a display serif used under 28 px; more than one accent; "eyebrow" labels on every section.
- Reference mechanism: aveen.co's stacked eyebrow, serif display and sans body with 12 and 24 px gaps; the New York Times' single column with a sans for meta.

## 3. Studio mono

One idea: a flat file. Everything is a list at one size; the work is the only image.

Choose when: a studio, agency, engineer, photographer or portfolio where the work must carry the page. Avoid when: the content needs hierarchy across many levels, or the audience expects guidance.

- Type: one grotesk at one size for all running text, with a mono for meta. Default Hanken Grotesk or Inter at 14 px / 20 px with Commit Mono or Geist Mono at 12 px. Upgrade: ABC Monument Grotesk with Monument Grotesk Mono (what otherkind.design sets its whole site in). Display only for the wordmark.
- Scale: two sizes for text (14 and 12 px) plus one wordmark size that fills the viewport width. No intermediate headings; section labels are the same 14 px in weight 500.
- Colour: canvas L 0.97 (about #F7F7F7), text L 0.10 to 0.20, tertiary text L 0.62 for years and meta; no accent colour at all, or one underline colour. Dark mode optional; if present, canvas L 0.13, text L 0.92.
- Geometry: a single centred column of 320 to 400 px on desktop for all text; work tiles in a 2-up grid with 20 px radius and a 16 px gap; page margins 24 px; footer pinned with mono clocks or status.
- Material: none. No lines, no shadows, no blur. Grouping by whitespace only.
- Motion dialect: none, except one set piece. otherkind's hero is a live vector wordmark with draggable bezier anchors, a precision crosshair cursor with an X and Y readout, and a "reset" affordance that appears once touched. Nothing else on the page moves.
- Hero device: the wordmark itself, as large as the viewport allows, made interactive in one crafted way.
- Signature details: engagement list with the year right-aligned in tertiary tone; team as illustrated (pixel-art) full-body portraits in white 20 px cards; mono footer links underlined.
- Pitfalls: adding headings "for hierarchy"; a second column of text; hover effects on tiles; a wordmark set in a stock display face.
- Reference mechanism: otherkind.design as described; also the Grilli Type or Klim foundry sites for single-size running text.

## 4. Swiss grid

One idea: the grid is visible in the result. Every edge lands on a column; type does the work.

Choose when: institutional, engineering, industrial, information-rich marketing, exhibitions, anything where precision is the brand. Avoid when: the audience wants warmth or the product has a character.

- Type: one neo-grotesk, three weights, large size jumps. Default Inter Tight or Schibsted Grotesk (display 61 to 98 px weight 500, body 16 px weight 400, meta 13 px). Upgrade: Söhne, Neue Haas Grotesk, Suisse Int'l. No serif.
- Scale: ratio 1.5 from 16 px (16, 24, 36, 54, 81); tracking on display negative 2 percent; measure 56 to 64 ch.
- Colour: white or L 0.99 canvas; text black L 0.12; one saturated accent at chroma 0.2 (a red at hue 25 or a blue at hue 260) on at most 5 percent of the area. Dark mode: inverse discipline, canvas L 0.12, accent L 0.70.
- Geometry: 12 columns with 24 px gutters at 1280 px max; asymmetric spans (4 and 8, 3 and 9); radius 0 everywhere; hairlines as structure.
- Material: 1 px black rules at 100 percent; no shadows; tables as design elements.
- Motion dialect: tool snap. 150 ms opacity and 4 px moves; hover changes colour only.
- Hero device: a headline spanning 8 columns at 81 px with a 4-column meta block beside it (date, place, index number).
- Signature details: numbered sections (01, 02) in tabular mono; rules that stop at column edges; captions set flush left with the image edge.
- Pitfalls: centring anything; rounding a corner; a second typeface; equal-width cards.
- Reference mechanism: Josef Müller-Brockmann's grid systems; Braun's product pages; Vignelli's NYC subway signage for a single face at fixed sizes.

## 5. Vitrine

One idea: a shop window. Content sits behind glass; controls float in front.

Choose when: a consumer app with a stage object (media player, game, map, camera, product configurator) and a small set of controls. Avoid when: the page is mostly text, or controls outnumber content.

- Type: display serif for the headline and the one large numeral, sans for everything else. Default Instrument Serif (display 44 to 61 px) with Open Runde or Inter (UI 14 to 16 px, weight 500 for controls). Upgrade: GT Alpina or Canela with SF Pro on Apple platforms.
- Scale: ratio 1.25; controls 14 to 16 px; one display numeral at 44 px italic where a value matters (time, score).
- Colour: canvas L 0.985; a tonal stage container at L 0.93 to 0.95 with chroma 0.05 of the accent hue; accent chroma 0.14 to 0.18 used for the single primary control and the selected state. Dark mode: canvas L 0.16, stage L 0.22, accent L 0.74 with on-accent ink chosen by measured contrast.
- Geometry: two layers. Content layer: a stadium or 28 px radius stage at 40 to 55 percent of viewport height. Control layer: capsules (999 px radius), 44 to 56 px tall, floating 16 px below the stage; nested radii concentric (inner = outer minus padding).
- Material: control layer is translucent (backdrop blur 16 to 24 px, surface alpha 0.7) with a 1 px inner highlight and one soft tinted shadow; content layer is solid. Glass never on glass; at most two blurred elements per screen. Reduce-transparency fallback to a solid surface.
- Motion dialect: spring for the control layer (indicator glides with 6 percent overshoot, 360 ms), soft blur for value swaps, editorial fade for stage content. One set piece: the stage object reacts (a character, a disc, a waveform).
- Hero device: the stage with its object, headline beneath in the serif, transport capsule beneath that.
- Signature details: a segmented control whose indicator is a capsule that glides and resizes; the large italic numeral beside a small sans label; the accent hue changes per mode and the whole palette follows.
- Pitfalls: glass on cards; blur on text; three floating bars; a stage smaller than the controls.
- Reference mechanism: Apple's iOS 26 control layer over content (capsules, concentric corners, morphing controls); Spotify's now-playing stage with controls beneath.

## 6. Warm analogue

One idea: paper and ink. A page you could print, with a couple of tactile controls.

Choose when: health, food, journaling, home, education for adults, anything "human" where trust is built by calm. Avoid when: the brand is technical or the content is dense data.

- Type: a warm serif for body and display, a humanist sans for UI. Default Fraunces (display, optical size on, weight 300 to 500) or Newsreader (body 17 px) with Manrope or Public Sans (UI 14 px). Upgrade: GT Sectra or Domaine with Graphik.
- Scale: ratio 1.25; body line-height 1.6; measure 60 to 66 ch.
- Colour: cream canvas L 0.97 with chroma 0.012 at hue 80; ink L 0.25 at hue 60 (never pure black); one accent from the warm side (terracotta hue 40, olive hue 120, or ochre hue 80) at chroma 0.10 to 0.13. Dark mode: warm charcoal L 0.19 at hue 60, ink L 0.92 at hue 80, accent L 0.76.
- Geometry: single column 640 px or a 2-column 5 and 7 split; radius set 4, 10, 16 px (soft, not capsule); section gaps 80 px.
- Material: solid surfaces one lightness step apart; 1 px lines in the ink at alpha 0.16; buttons with a 1 px inset highlight and a 1 px bottom shadow (a press you can feel); no blur.
- Motion dialect: editorial fade with 6 px moves; buttons depress 1 px on press (120 ms). No springs.
- Hero device: a paragraph as the hero, first line in the display serif, with one photograph of a real object, uncropped, on the paper.
- Signature details: old-style numerals in text; small caps (real, not synthesised) for section labels; a hairline rule with a centred ornament used exactly once.
- Pitfalls: grain and paper textures (fake); brown gradients; more than one warm accent; rounded capsules (they belong to Vitrine).
- Reference mechanism: Readwise Reader's cream reading surface; Matter's serif body with sans UI; Kinfolk's rhythm of one image to one paragraph.

## 7. Luxe dark

One idea: a lit object in a dark room. One product, one light source, slow time.

Choose when: luxury, audio or camera hardware, fashion, automotive, high-end software where the product image is the argument. Avoid when: the product is a tool used for hours (dark by default fatigues in bright rooms) or the content is text-heavy.

- Type: a light display serif or a wide grotesk at large sizes; a sans for small text. Default Fraunces at weight 300 or Bricolage Grotesque at 200 for display (61 to 98 px), Geist for UI (13 to 15 px). Upgrade: Canela Light, PP Editorial New, or GT Alpina Fine, with Aeonik or Söhne.
- Scale: ratio 1.414; large display, small everything else; tracking on display negative 1 to 2 percent; generous line-height 1.65 on body because the contrast is inverted.
- Colour: canvas L 0.13 to 0.16 with chroma 0.008 of the brand hue (never pure black); text L 0.90 at weight 400 (never pure white); text-2 L 0.68; one accent of low chroma (0.06 to 0.10) reading as a metal (hue 80 gold, hue 240 steel) used on at most 3 percent of the area. Light mode exists as a secondary theme: canvas L 0.96, text L 0.18.
- Geometry: full-bleed imagery, 1200 px content max; radius 0 or 24 px, not both; section gaps 128 px desktop.
- Material: surfaces are lightness steps (L 0.16, 0.19, 0.23), no lines; a single soft shadow on the one elevated object; no blur; no glow (a lit object is lit by its image, not by a CSS halo).
- Motion dialect: editorial fade with long durations (520 to 800 ms) and ease-out; images scale from 1.02 to 1.0 on reveal; nothing bounces. Optional scroll-driven set piece for the product reveal.
- Hero device: the product, large, lit, on the dark canvas, headline set small beneath or beside it.
- Signature details: a horizontal rule as a light line at alpha 0.12; specifications in a two-column table in tabular figures; a single accent line under the primary button, not a filled button.
- Pitfalls: neon accents; glowing borders; gradient text; dark mode used because it "looks premium" on a text product.
- Reference mechanism: Teenage Engineering's product pages (one object, fixed type sizes, few colours); Nothing's spec tables; Leica's uncluttered dark stage.

## 8. Character-led

One idea: the character is the interface's host. Everything else is a stage for it.

Choose when: a mascot exists or is wanted; education, games, kids and family, onboarding-heavy consumer apps. Avoid when: the audience is professional and the task is serious, or the character cannot be animated well (a static mascot is worse than none).

- Type: a rounded or friendly sans for everything, one display weight. Default Open Runde or Bricolage Grotesque (display 39 to 49 px weight 600, body 16 px weight 400). Upgrade: Roobert, Circular, or Untitled Sans with a rounded display.
- Scale: ratio 1.25; large controls (48 to 56 px); labels 14 px weight 500.
- Colour: saturated tonal containers at chroma 0.12 to 0.18 with L 0.92 (light) or 0.28 (dark) carrying the character's hue; text on containers chosen by measured contrast; one accent per mode. The character's palette is a formula of the same hue so the mascot and the UI change together.
- Geometry: capsules and 20 to 28 px radii, concentric; a stage at 45 percent of viewport height for the character with its feet on a visible floor (a contact shadow), never clipped by the container.
- Material: solid tonal surfaces; a soft, hue-carrying shadow under the primary control only; no blur.
- Motion dialect: spring (overshoot 6 to 8 percent, 320 to 480 ms) for controls and the character's body; soft blur for value swaps; the character has its own tokens (blink 240 to 300 ms irregular at 1.6 to 7.6 s, breathing 4 s, reaction pools with no immediate repeat). Idle motion is allowed only on the character.
- Hero device: the character on its stage, reacting to the first action.
- Signature details: the character's hue drives the palette; reactions have variants; the mascot's gaze follows the pointer within 8 degrees.
- Pitfalls: arc-stroke eyes and a scaling oval mouth; limbs cut by a container edge; a loop that never rests; confetti; more than one character.
- Reference mechanism: Duolingo's character state machines and idle blinks; Headspace's tonal containers; this repo's Noot rig (one-piece SVG with per-part transform origins).

## 9. Cinematic scroll

One idea: a film you scroll. Scenes pin, the object resolves, copy arrives when the picture is ready.

Choose when: a brand launch, a single product story, a campaign; the visitor has come to be shown something. Avoid when: the visitor came to do something (buy, sign up, read documentation) or the budget cannot cover real imagery and performance work.

- Type: a large grotesk or a fine serif for scene copy at 49 to 98 px; small sans for captions. Default Inter Tight or Instrument Serif with Geist. Upgrade: PP Neue Montreal or Söhne Breit; GT Alpina for a serif voice.
- Scale: ratio 1.5; two sizes per scene (display and caption); measure 30 to 40 ch for scene copy.
- Colour: the scene's imagery sets the palette; UI text white or black by measured contrast over the image; one accent for the single CTA; dark canvas L 0.12 between scenes.
- Geometry: full-bleed scenes of 100 to 300 viewport heights of scroll each; copy in a 480 px column pinned to one side; radius 0 or 24 px.
- Material: imagery and video are the material; UI is text only; no cards.
- Motion dialect: scroll-driven. CSS `animation-timeline: view()` for reveals and `scroll()` for scrubs where the story is linear; GSAP ScrollTrigger when a scene pins and a timeline scrubs. One scene, one idea. The story must read with scrolling turned off (reduced motion renders static sections). Budget: main-thread work under 8 ms per frame; hero media under 3 MB.
- Hero device: the product or subject resolving from a detail to the whole as the first scene scrubs.
- Signature details: a progress rail at the viewport edge showing scene position; captions set in tabular figures with a scene index; a single CTA repeated at scene ends in the same position.
- Pitfalls: scroll-jacking the main content; parallax on text; a scene that hides the CTA; horizontal scroll sections; autoplaying sound; a site that only works at 1440 px wide.
- Reference mechanism: Apple product pages (pin, scrub, resolve); Linear's release pages for restraint in the same technique.

## 10. Tool density

One idea: a control panel. Every pixel is either a control or a readout; nothing decorates.

Choose when: dashboards, editors, admin, developer tools, anything used for hours with a keyboard. Avoid when: the visitor is new and needs to be sold or taught.

- Type: one sans with a mono for values. Default Geist with Geist Mono, or Inter with JetBrains Mono; UI 13 to 14 px, body 14 px, headings 16 to 20 px; weights 400 and 500 only. Upgrade: Untitled Sans or Söhne with Berkeley Mono.
- Scale: ratio 1.125; line-height 1.45; tabular numerals everywhere numbers appear.
- Colour: neutral canvas L 0.99 (light) or 0.15 (dark) with chroma 0.004; text L 0.20 / 0.92; one signal hue at chroma 0.14 for selection, focus and the primary action; semantic colours (success, warning, danger) on the same lightness rungs, never as fills on text rows.
- Geometry: app shell with a fixed left rail (240 to 280 px) and a fluid canvas; density 4 px base with 8 and 12 px gaps; radius 6 to 8 px; row height 32 to 36 px single-line, 52 to 60 px for title plus meta; 44 px targets on touch via pointer: coarse. For a list or feed page (news, results, index) the column runs 60 to 72 rem, not a 44 rem prose measure, and the count of rows above the fold is the number the direction is judged by.
- Material: 1 px lines at 3:1 for structure; surfaces one lightness step apart; one shadow level for popovers; no blur.
- Motion dialect: tool snap. 120 to 200 ms, ease-out, opacity and 2 to 4 px moves; menus open origin-aware at 150 ms and close at 100 ms; no springs; hover changes surface lightness by 0.03.
- Hero device: none on the product; on the marketing page, a real screenshot at full fidelity at 1200 px.
- Signature details: a command palette; keyboard shortcut hints in mono beside menu items; empty states with one action; an inline "saved" state that fades after 1.2 s.
- Pitfalls: cards inside cards; badges on every row; a marketing gradient leaking into the app; animations over 200 ms; icon buttons without names; "airing out" a dense list until a third of the rows fit (density is the idea, not the enemy).
- Reference mechanism: Linear's density and motion timing; Raycast's command palette; Figma's property panel spacing.

## 11. Honest brutalist

One idea: the structure is the style. Show the bones: borders, system type, hard edges, no depth.

Choose when: culture, fashion, music, a manifesto, an independent publication; when the client says "raw" or "anti-corporate" and means it. Avoid when: the audience needs to be reassured (finance, health), or the product is a daily tool.

- Type: a system stack or a single mono; large sizes. Default the system UI stack (`ui-sans-serif, system-ui`) or Departure Mono / JetBrains Mono for everything at 16 px and 49 to 98 px display; weight 400 only. Upgrade: Basis Grotesque, Favorit, or a single weight of Monument Grotesk.
- Scale: two sizes (text and display), ratio irrelevant; measure up to 80 ch is acceptable because the tone is a document.
- Colour: white L 1.0 and black L 0.0 are allowed here as the one exception in the studio; one accent at full chroma (0.22 or more) used as a fill on hover or selection; no greys.
- Geometry: full-width rows separated by 1 px black rules; no max width, or 1600 px; radius 0; padding 16 to 24 px; a visible grid of boxes with borders.
- Material: borders only; hover inverts the row (black on white becomes white on black); no shadows; no blur.
- Motion dialect: tool snap or none. Inversions are instant (0 ms) or 80 ms. A marquee is permitted only if it carries real, changing information.
- Hero device: the title set as large as the viewport at weight 400 with the navigation as a row of underlined words beneath.
- Signature details: visible underlines on all links; tables with every rule drawn; images unstyled at their natural ratio; footers that list everything.
- Pitfalls: brutalism as a costume (distressed textures, glitch effects); illegible sizes; missing focus states because "it is raw"; inverting text below 4.5:1.
- Reference mechanism: Bloomberg Businessweek's rules-and-type layouts; Balenciaga's system-font product grid; Craigslist's honesty of structure.

## 12. Hybrids and the order of fallback

- A hybrid is two mechanisms, named. "Vitrine controls on a Quiet editorial page" means the capsule control layer and the serif display, with everything else from Quiet editorial. Write which desk defaults come from which direction in `concept.md`.
- Fallback order after a rejection: the second candidate from the signal table, then the quieter neighbour (Quiet editorial or Studio mono), then the more expressive neighbour (Vitrine or Character-led). Never re-present a rejected direction with more decoration.
- If a client rejects three directions, the brief is wrong. Return to strategy and re-run the intake questions 5 to 7.
