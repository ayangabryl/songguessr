---
name: illustration
description: Decides whether to illustrate at all, which illustration style from the studio catalogue, and how vector artwork is built - the SVG grid, path hygiene, optical correction, icon sets, marks and wordmarks, and mascots (one-piece rig, pose language, reaction variant pools, hue transitions, grounding, expression through lids and brows). The front desk calls this desk at run-sheet step 6 (Character), for the "Mascot, icon set, illustration" routing row, for marketing and brand sites, and whenever a redesign adds empty states, an icon set or a figure. The blink, gaze and timing method is in references/character.md.
---

# Illustration desk

You are the illustrator and the character animator. You own every drawn thing: icons, marks, spot illustration and the mascot, plus how the mascot is rigged and posed. You do not own duration or easing tokens (that is `../motion/PLAYBOOK.md`) or the palette (that is `../colour/PLAYBOOK.md`); you consume both. `[house]` marks a studio rule; everything else carries a source listed in section 9.

## 1. When the front desk calls this desk

- Run-sheet step 6 (Character): the system and screens exist, `motion-spec.md` exists, and there is a figure to pose. Output is the pose sheet and timing table (section 7).
- Routing row "Mascot, icon set, illustration": this desk leads, after strategy has written the character's role in the primary task.
- Marketing, brand or portfolio sites: hero and section illustration decisions, the mark, the favicon.
- Any redesign that adds an empty state, an onboarding step or an icon set; any component that ships an icon-only button.
- QA reports a failed character pass (section 4.6 of `../qa/PLAYBOOK.md`) or mismatched icon weights.
- Requests phrased as "it looks like a toy", "the eyes are dead", "the icons look like they came from three sets". `[house]`

## 2. Inputs required

| Artefact | Why this desk needs it | Stop if missing |
|---|---|---|
| `brief.md` (primary task, tone words, audience, device) | Decides whether to illustrate at all and which style row applies | Yes |
| `concept.md` (the one idea, kill list) | Illustration must serve the idea; the kill list usually names the slop style to avoid | Yes |
| `tokens.css` (colour, radius, `--dur-*`, `--ease-*`) | Icons take stroke and radius from the system; the rig takes its timing from the tokens | Yes |
| `motion-spec.md` | The character's beats are rows in it, not a second spec | Yes for a mascot; no for icons |
| Existing artwork (source vectors, the rig, brand mark) | Never redraw what exists; normalise it | No; note "new artwork" on the hand-off |

## 3. Decisions this desk owns

### 3.1 Whether to illustrate at all

| Situation | Default | Escape hatch |
|---|---|---|
| Empty state, first run, zero results | Yes: one spot illustration, at most 160 px tall, plus one line of copy and one action | Icon at 48 px when the state is seen more than once per session |
| Error, offline, permission denied | Yes, small (96 px), same family as the empty states | Icon only inside dense tools |
| Hero of a marketing or brand site | Maybe: only if `concept.md` names the illustration as one of the three mechanisms | A photograph or a product screenshot when the idea is the product itself |
| Onboarding steps | Yes for consumer products, at most three steps; no for tools | Icons at 48 px for tools |
| Decoration (blobs behind cards, corner doodles, background shapes) | No | None `[house]` |
| Feature grid of a landing page | Icons at 24 or 48 px, one set | Spot illustration only when the features are abstract and the brief's tone words include warm or playful |
| Mascot or character | Only when strategy has written its role in the primary task (feedback, guide, reward) | None; a mascot without a job is decoration `[house]` |

### 3.2 Style catalogue

Default is flat geometric with a single hue-family palette taken from `../colour/PLAYBOOK.md` (one hue, tones by lightness, one accent). Change rows only when the direction in `concept.md` asks for it. `[house]`

| Style | Use when | Not when | Craft notes |
|---|---|---|---|
| Flat geometric (default) | Product UI, empty states, mascots, most brands | The direction is editorial or archival | Fills only, no outlines; 3 to 5 tones from one hue family; shapes on the grid of section 3.3 |
| Line | Editorial, documentation, technical products, icon sets | Small sizes under 20 px with detail; dark mode without re-tuning weight | One stroke weight per set; `stroke-linecap: round` or `square`, never mixed; `currentColor` |
| Duotone | Marketing sections, hero art on a restrained brand | Icons; anything under 48 px | Two tones from the hue family plus one neutral; the darker tone carries the silhouette |
| Grain or riso | Studio, culture, music, print-led directions | Product UI, anything animated (grain shimmers) | Grain is a static PNG or SVG `feTurbulence` baked once, never live `filter` on moving parts |
| 3D-rendered | Launch pages where the object is the product | Anything the user reads next to; low-end targets; icons | Export as image (AVIF or WebP), not inline; one light direction across the whole set |
| Photographic | Real people, places, products; trust-led brands | Mascots, icons, tools | Art direction is a colour and crop decision; grade toward the hue family |

### 3.3 Grid and size

| Artefact | Grid | Stroke at that grid | Render sizes to test |
|---|---|---|---|
| Icon | 24 with 2 px padding (20 px live area) | 1.5 or 2 (one per set) | 16, 20, 24 |
| Mark, favicon, badge glyph | 64 | 3 or 4, or fills only | 16, 32, 48 |
| Spot and hero illustration | 256 or larger, multiples of 64 | Fills; if lines, 4 at 256 | 96, 160, 320 |
| Mascot rig | One viewBox for every pose (Noot: 240 x 240, figure on y 12 to 228) | Fills | 200, 264, and 64 for the silhouette test |

### 3.4 Pose language for a mascot

Every pose is a whole-body transform on the root plus a face channel. The face comes from the event; the body variant comes from the pool (section 4, rule 27). Values are Noot's, tuned for a light body at 200 to 264 px; heavier characters scale durations up about 1.3x and amplitudes down. `[house]`

| Pose | Body (root transform) | Eyes (lids) | Mouth (one path, transformed) | Brows | Duration |
|---|---|---|---|---|---|
| idle | breathe: scale 0.994 x 1.008, 3.4 s loop; life sign every 6 to 12 s | open; blink per `references/character.md` | rest | rest | loop |
| listening (play) | groove: translateY -4 px, rotate 1.4 deg, 1.1 s loop | lower lid up 5 to 10 % | scale 1.08 x 1.12 | rest | loop |
| thinking | lean 3 px, rotate -2 deg, hold | one lid down 30 % | scaleX 0.8, translateX 4 px | one brow up 6 px | hold, then idle |
| win | hop -26 px, land squash 1.06 x 0.94 | lower lids up 50 % (scaleY 0.5 from top) | scale 1.7 x 2.1 | up 14 px, rotate 6 deg outward | 1.4 s |
| lose | droop +4 px, rotate -2.5 then +1.5 deg | upper lids down 18 % (origin 50 % 88 %) | rotate 180 deg about top anchor, scale 0.72 x 0.6 | inner ends up, 14 deg | 1.2 s |
| tap | crouch +4 px, pop -12 px, `--ease-land` | lids 55 % | scale 1.5 x 1.8 | up 14 px, no rotate | 0.5 s |
| timeout | slump +6 px, held 30 % of the clip | upper lids down 50 % | scale 0.9 x 0.3 (flat) | inner ends up, 8 deg | 1.7 s |

## 4. Rules

SVG craft
1. Draw on the grid of section 3.3. Every anchor of a fill sits on a whole unit; every stroke centreline sits on a half unit so a 1 px edge renders crisp at 1x. `[source: Material Design icon guidelines; Bjango]`
2. One stroke weight per set: 1.5 or 2 at 24. Strokes never scale with the artwork; when an icon is shown at 16, use the 16 px cut or `vector-effect: non-scaling-stroke`. `[source: Material Design icon guidelines; house]`
3. Ship `viewBox`, never `width` and `height`, on inline SVG; size from CSS. `[source: MDN viewBox]`
4. Recolourable icons use `fill="currentColor"` or `stroke="currentColor"` and inherit `color`. Marks and illustrations use palette variables (`fill: var(--ill-1)`). `[source: MDN currentColor]`
5. Path hygiene before hand-off: merge overlapping shapes into one path, delete hidden or duplicate points, expand every `transform="matrix(...)"` into coordinates, keep one `fill-rule` per file (`evenodd` for counters, `nonzero` otherwise), round coordinates to two decimals. Run SVGO with `removeViewBox` disabled. `[source: SVGO; MDN fill-rule]`
6. No raster effects on vectors: no `filter`, no `feGaussianBlur`, no drop shadow around a glyph. Shadows are drawn shapes. `[house]`

Optical correction `[source: Bjango, optical adjustments; Material Design icon keyline shapes]`
7. A circle glyph is about 10 % larger than a square glyph of the same nominal size; a triangle is 10 to 15 % larger and shifted toward its point (a play triangle sits about 6 % of the button width right of geometric centre).
8. Round glyphs overshoot the grid by 1 to 2 % at 64 and above; at 24 they sit on the keyline (the overshoot is under a quarter pixel).
9. Centre on the visual centre, not the bounding box: compare the glyph's `getBBox()` centre with the ink's centre of mass; a chevron moves 1 px toward its opening.
10. Horizontal strokes read heavier than vertical ones at the same width; at 24 keep them equal, at 64 and above thin horizontals by 5 to 8 %.

Icon sets `[source: Material Design icon guidelines; Apple HIG Icons; WCAG 2.2 SC 4.1.2]`
11. One stroke weight, one corner radius (2 at 24), one perspective (flat frontal), one optical size per set. Mixing sets is a finding.
12. 24 px box, 2 px padding, ink within the 20 px live area; the same visual weight across the set (a filled circle and an outlined square must look equally heavy).
13. Every icon-only button has a name (`aria-label` or visually hidden text) and a 44 px touch target from `../layout/PLAYBOOK.md`. `measure.mjs` lists offenders.
14. Filled and outlined variants of the same icon share every anchor; the fill is the outline's interior. Toggle state by swapping fill, not by swapping drawings.

Marks and wordmarks `[source: Google favicon guidance; house]`
15. A mark ships a single-colour version first. Colour is applied to it, never baked into it.
16. Test at 16 px (favicon), 32 and 48 px. Below 32 the mark drops interior detail; write the 16 px cut as a separate file.
17. Clean silhouette test: fill the mark black, view at 32 px, then squint. If it cannot be told from a circle or a blob, simplify until it can. Do the same for every mascot pose at 64 px. `[house]`
18. Wordmarks are outlined text (`<path>`), kerned by hand at the display size, then locked. Never ship `<text>` in a logo.

Mascots and characters `[house; source: Rive and Duolingo modular actor]`
19. The rig is one piece. The body is one unbroken path; limb highlights are static parts of the silhouette; all motion is whole-body on the root. No limb is cut from a shading path and rotated: the straight edge shows the moment it moves (Noot's rig history documents this failure in `src/components/NootRig.tsx`).
20. Whole-body transforms hinge at the ground contact: `transform-box: view-box; transform-origin: <x> <ground y>` on the root (Noot: `120px 226px`). Face parts use `transform-box: fill-box` with an origin written next to the part.
21. Nothing clips the character: `svg { overflow: visible }`, no `overflow: hidden` on any ancestor within hop height (30 px at 264 px), no `clip-path` on the root. Clip paths are for lids and interior shading only.
22. One viewBox and one ground line for every pose; the bounding box at rest is identical (0 px) in every `data-pose`. `freeze.mjs` measures it.
23. Grounding: draw a contact shadow (an ellipse under the feet, `--ill-shade` at 20 % opacity) that scales down and fades as the body rises: at hop apex `scale(0.7)` and opacity 0.5x rest. Or draw the floor line into the scene. A figure with neither floats.
24. Expression lives in the lids and brows; the mouth confirms it. Happy is the lower lid rising (scale the eye from its top origin), not an arc drawn as the eye. Sad is the upper lid dropping and inner brow ends rising. Eyes are volumes with lids, never strokes.
25. The mouth is one path that scales and shifts per pose (section 3.4). It never swaps to another drawing mid-state; a swap pops.
26. Lids are separate parts: a copy of the eye white in body colour, clipped to the eye (`<clipPath>` of the white), parked at `translateY(-104%)`, slid down for a blink. Squint (origin top) and blink (lid) want different origins, so they are different parts.
27. Reaction variant pools: 2 to 4 body gestures per event with the same duration, easing and amplitude ceiling; pick with no immediate repeat; write `data-pose` and `data-variant` on the host so QA can read them. The face is identical across variants of one event.
28. Hue transitions for theme, level or mood: register palette variables with `@property { syntax: '<color>' }` and transition the variables on the host at `--dur-3` with `--ease-in-out`; every `fill: var(--ill-*)` follows. Alternative for a brand moment: a `clip-path: inset()` wipe over a duplicate body group at `--dur-3`. Ink, whites and pupils never change hue.
29. Timing comes from `../motion/PLAYBOOK.md`: `--dur-*` for beats, `--ease-out` for settles, `--ease-land` for landings. The blink, gaze, breathing and reaction method with its numbers is `references/character.md`; read it before rigging.

## 5. Defaults

Icon skeleton (24 grid, 2 px stroke on half-pixels, recolourable):

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 12.5h16M12 4.5v16"/>
</svg>
```

Two-path fill mark on a 64 grid (the streak flame in `src/components/StreakBadge.tsx`: a body path and a smaller core path in a lighter tone, no strokes, so nothing needs a half-pixel):

```svg
<svg viewBox="0 0 64 64" aria-hidden="true">
  <path class="flame-body" d="M33 6C41 14 50 24 50 38 50 50 42 58 32 58 22 58 14 50 14 38 14 31 17 26 21 21 20 27 23 31 27 31 31 31 30 22 29 19 28 16 31 10 33 6Z"/>
  <path class="flame-core" d="M32 33C36 38 42 41 42 46.5 42 51.5 37.5 54.5 32 54.5 26.5 54.5 22 51.5 22 46.5 22 41 28 38 32 33Z"/>
</svg>
```

Rig group tree (back to front; z-order is document order):

```
svg.figure (viewBox 0 0 240 240; overflow: visible)
└─ g.root            whole-body poses; transform-box: view-box; origin 120px 226px (feet)
   ├─ g.shadow       contact ellipse; counter-scales with hop height
   ├─ path.body      torso and limb highlights, one unbroken path
   ├─ g.accessory    secondary action; origin at its attachment point
   └─ g.face
      ├─ g.brow-l / g.brow-r   origin at the inner end
      ├─ g.eye-l / g.eye-r     white, iris, pupil, highlight; origin 50% 22% for squints
      │  └─ path.lid           body colour, clipped to the white, parked at translateY(-104%)
      └─ path.mouth            origin 50% 18%; scaled and shifted, never swapped
```

Hue transition on the host (cross-fade default; `@property` makes the variables interpolate):

```css
@property --ill-body { syntax: '<color>'; inherits: true; initial-value: #86c217; }
@property --ill-shade { syntax: '<color>'; inherits: true; initial-value: #629f08; }
.figure-host { --ill-body: #86c217; --ill-shade: #629f08;
  transition-property: --ill-body, --ill-shade; transition-duration: var(--dur-3); transition-timing-function: var(--ease-in-out); }
.figure-host .body { fill: var(--ill-body); }
.figure-host .shade { fill: var(--ill-shade); }
```

If Chromium leaves the registered property stuck at its initial value, the `var()` is inside a `transition` shorthand; keep the longhands as above or write the literal `320ms` with a comment naming `--dur-3` (the workaround documented in `src/noot.css`). `[house]`

Contact shadow keyed to the hop:

```css
@keyframes hop { 0% { transform: translateY(0) } 40% { transform: translateY(-26px) scale(0.965, 1.045) } 58% { transform: translateY(0) scale(1.06, 0.94) } 100% { transform: translateY(0) } }
@keyframes hop-shadow { 0% { transform: scale(1); opacity: 0.2 } 40% { transform: scale(0.7); opacity: 0.1 } 58% { transform: scale(1.05); opacity: 0.22 } 100% { transform: scale(1); opacity: 0.2 } }
[data-pose='win'] .root { animation: hop var(--dur-4) var(--ease-out) both; }
[data-pose='win'] .shadow { animation: hop-shadow var(--dur-4) var(--ease-out) both; transform-box: fill-box; transform-origin: center; }
```

Variant pick with no immediate repeat (from `src/components/Mascot.tsx`):

```js
const pick = (pool, previous) => { const options = pool.length > 1 && previous ? pool.filter((v) => v !== previous) : pool; return options[Math.floor(Math.random() * options.length)]; };
const POOLS = { play: ['default', 'bop', 'sway'], win: ['default', 'twist', 'double'], lose: ['default', 'shake'] };
```

## 6. Anti-patterns

| Slop | Fix |
|---|---|
| A limb cut off at the container edge, or a straight cut where a limb was sliced from the body to rotate it | One unbroken body path; whole-body transforms; `overflow: visible` and no clipping ancestor (rules 19 to 21) |
| Character floating with no shadow or floor | Contact shadow that scales with hop height, or a drawn floor line (rule 23) |
| Arc "^^" eyes for happy | Lower lid rises: scale the eye from its top origin to 0.5; the eye stays a volume (rule 24) |
| Metronome blink (fixed interval, symmetric close and open) | Log-normal intervals clamped 1.5 to 8 s, close to open 1:2, doubles 10 to 15 %; `references/character.md` section 4 |
| Single reaction repeated every time | Pool of 2 to 4 with no immediate repeat and `data-variant` written (rule 27) |
| Stroke widths that change with scale (a 2 px icon at 48 px with a 4 px stroke beside a 2 px one) | One optical size per set; separate 16 and 48 cuts or `vector-effect: non-scaling-stroke` (rule 2) |
| Gradient-mesh 3D blobs and glass spheres as decoration | Section 3.1 says no decoration; if depth is the idea, the 3D row of 3.2 as an exported image, once |
| "Corporate Memphis" default people (tiny heads, noodle limbs, purple skin) | Pick a style row on purpose; if people are needed, draw them at the brief's tone or use photography |
| Emoji as icons | One icon set on the 24 grid with `currentColor`; emoji render differently per platform and cannot be recoloured |
| Mismatched icon set weights (a 1.5 outline beside a 2 filled beside a Material glyph) | One set, one weight, one radius; `measure.mjs` and a 24 px contact sheet (rule 11) |
| Glow, drop shadow or blur around the character | Remove the filter; grounding comes from the contact shadow, emphasis from pose (rule 6) |
| A mascot with no job in the primary task | Cut it, or give it one (feedback, guide, reward) in `brief.md` (section 3.1) |
| Mouth swaps to a different drawing per emotion | One mouth path, transformed per pose (rule 25) |

## 7. Hand-off artefact

Deliverables: the artwork files, a contact sheet, and for a mascot the pose sheet and timing table. The timing rows are also added to `motion-spec.md`.

Icon or mark sheet (one row per glyph):

| Glyph | Grid | Stroke | Sizes tested | Silhouette at 32 px | Label on every use | File |
|---|---|---|---|---|---|---|
| search | 24 | 2 | 16, 20, 24 | pass | yes | `icons/search.svg` |

Pose sheet (freeze-frames from `../../scripts/freeze.mjs`, one row per pose and variant):

| Pose | Variant | Frames (0, 25, 50, 75, 100 %) | Drift px | Lids | Mouth | Brows | Props |
|---|---|---|---|---|---|---|---|
| win | twist | `poses/win-twist-0.png` ... `poses/win-twist-100.png` | 0.0 | scaleY 0.5 | 1.7 x 2.1 | -14 px, 6 deg | sparks x3 |

Timing table (values are tokens; `from` and `to` are literal):

| Beat | Trigger | Property | From | To | Duration | Easing | Reduced motion |
|---|---|---|---|---|---|---|---|
| win hop | `intent = win` | transform translateY, scale | 0, 1 | -26 px, 1.06 x 0.94 land | `--dur-4` | `--ease-out`, land `--ease-land` | face only, 120 ms crossfade |
| hue switch | level change | `--ill-*` | old palette | new palette | `--dur-3` | `--ease-in-out` | kept |
| blink | scheduler | lid translateY | -104 % | 0 % | 280 ms (physiology, not a token) | lid curves | kept |

Below the tables: the style row chosen from 3.2, the palette variables used, the blink sheet output from `freeze.mjs --blink`, and the ten-second idle verdict (section 8).

## 8. Checklist

- [ ] Section 3.1 row chosen; no decorative illustration; a mascot has a written job.
- [ ] Style row chosen from 3.2; palette is one hue family from `tokens.css`.
- [ ] Every icon on the 24 grid, 2 px padding, one stroke weight, one radius; strokes on half-pixels, fills on whole pixels.
- [ ] `viewBox` only; `currentColor` on icons; paths merged, no baked `matrix()`, one `fill-rule`.
- [ ] Circles 10 % larger than squares; triangles shifted toward the point; visual centre checked with `getBBox()`.
- [ ] Mark passes the black silhouette test at 32 px; single-colour version exists; 16 px cut exists.
- [ ] Every icon-only button named; targets 44 px on touch.
- [ ] Rig is one piece; root origin at the ground contact; `overflow: visible`; bounding box drift 0 px across poses.
- [ ] Contact shadow or floor line present and scaling with hop height.
- [ ] Happy is a rising lower lid; sad is a dropping upper lid; no arc eyes; one mouth path.
- [ ] Every event has 2 to 4 variants, no immediate repeat, `data-variant` written.
- [ ] Hue change transitions registered variables at `--dur-3`; ink and whites fixed.
- [ ] `freeze.mjs` poses clean at every fraction; blink sheet passes (`references/character.md` section 13).
- [ ] Ten-second idle watch: the loop cannot be described.

## 9. Sources

- Material Design, Designing icons (24 dp grid, 2 dp padding, 2 dp stroke, keyline shapes, consistent weight) https://m3.material.io/styles/icons/designing-icons
- Apple Human Interface Guidelines, Icons (optical weight, consistent perspective, size cuts) https://developer.apple.com/design/human-interface-guidelines/icons
- Bjango, Optical adjustments (circle versus square area, triangle shift, visual centre, horizontal stroke weight) https://bjango.com/articles/opticaladjustments/
- MDN, `viewBox` https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox ; `fill-rule` https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill-rule ; `currentColor` https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#currentcolor_keyword ; `vector-effect` https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/vector-effect ; `@property` https://developer.mozilla.org/en-US/docs/Web/CSS/@property ; `transform-box` https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box
- SVGO, SVG optimiser (plugins: merge paths, remove hidden elements, convert transforms) https://svgo.dev/
- W3C CSS Masking Level 1, `clipPath` element https://www.w3.org/TR/css-masking-1/#ClipPathElement
- Google Search Central, favicon guidelines (multiples of 48 px, legible at 16 px) https://developers.google.com/search/docs/appearance/favicon-in-search
- W3C WCAG 2.2, SC 4.1.2 Name, Role, Value https://www.w3.org/WAI/WCAG22/Understanding/name-role-value
- Nielsen Norman Group, Empty-state design https://www.nngroup.com/articles/empty-state-interface-design/
- Rive, Duolingo's Video Call brings Lily to life (modular actor, state machine) https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- Duolingo, How Duolingo animates its world characters https://blog.duolingo.com/world-character-visemes/
- Wikipedia, Corporate Memphis (the default-people style to avoid) https://en.wikipedia.org/wiki/Corporate_Memphis
- Thomas and Johnston, The Illusion of Life; 12 principles summary https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
