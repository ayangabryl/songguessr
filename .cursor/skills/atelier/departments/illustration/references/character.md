# Character animation method

The full method for a mascot that moves in a web UI: Disney's principles as pixel and millisecond numbers, a physiologically correct blink and gaze, breathing, reaction pools, hue transitions, performance, reduced motion and the freeze-frame QA sheet. `../PLAYBOOK.md` decides whether there is a character and how it is drawn and rigged; this file says how it moves. Tokens (`--dur-*`, `--ease-*`) come from `../../motion/PLAYBOOK.md`.

Conventions: `[source: ...]` is traceable to section 15; `[house]` is a studio rule. Examples are Noot (SongGuessr's sprout: `src/components/NootRig.tsx`, `src/components/Mascot.tsx`, `src/noot.css`); every rule is general.

## 1. Order of work

1. Rig (one piece, origins written next to each part; playbook rules 19 to 26).
2. Blink (section 4). If the blink is on a metronome nothing else will save the face.
3. Idle: breathing and life signs (sections 6 and 7).
4. Reactions with pools (sections 8 and 9), then the face channel (section 10).
5. Hue transitions (section 11), reduced motion (section 12), performance (section 13).
6. QA with `freeze.mjs` (section 14).

Debugging "it looks wrong": 80 % of the time it is `transform-origin` or a blink on a fixed loop. `[house]`

## 2. Rig recap and origins

| Part | `transform-box` | Origin | Why |
|---|---|---|---|
| root | `view-box` | feet, absolute (Noot `120px 226px`) | squash keeps the figure planted |
| torso (if separate) | `fill-box` | `50% 100%` | breathing grows upward from the feet |
| brow | `fill-box` | inner end (`100% 50%` left, `0% 50%` right) | brows hinge at the nose bridge |
| eye (squint) | `fill-box` | `50% 22%` | scaling from the top makes the lower lid rise, which is a smile |
| lid (blink) | `fill-box` | none needed; translates from `-104%` to `0` | a lid slides down; the eye never deforms |
| pupil | `fill-box` | `center` | saccades translate; a pupil never scales |
| mouth | `fill-box` | `50% 18%` | a smile grows down and out; a frown flips about the same anchor |
| accessory | `fill-box` | attachment point | follow-through swings from the joint |

Without `transform-box: fill-box`, SVG origins are measured from the viewBox corner and "rotate about centre" spins around the canvas. `[source: MDN transform-box]` Artwork units are not pixels: Noot's paths live in a 1200-unit space under `scale(0.19)`, so `translate(14px)` on a pupil is 2.7 px on screen. Write the conversion next to every translate in artwork space. `[house]`

State is driven by attributes, not classes: `data-pose="win" data-variant="twist"` on the host; CSS binds the animation to the pair; the framework only flips attributes. `[house]`

## 3. Disney's 12 principles as numbers

Tuned for a light body at 200 to 264 px; heavier characters scale durations up about 1.3x and amplitudes down. `[source: Thomas and Johnston; Williams; house numbers]`

| Principle | Applies to a web mascot? | Rule | Number |
|---|---|---|---|
| Squash and stretch | Yes | scale X and Y inversely so volume is roughly preserved; feet anchored | 5 to 8 % per axis on a hop (`scale(1.06, 0.94)` landing); 1 to 2 % for idle |
| Anticipation | Yes | opposite micro-move before every one-shot: crouch before hop | 80 to 120 ms (Noot's win crouch is 14 % of 1.4 s = 196 ms: over budget, trim to 120) |
| Staging | Yes | one idea per pose; silhouette reads at 64 px with the face hidden | test at 64 px, greyscale |
| Straight ahead vs pose to pose | Pose to pose only | keyframes at rest, crouch, apex, land, settle; the browser interpolates | 5 to 7 keyframes per one-shot, never 20 |
| Follow-through and overlapping action | Yes | accessory and cheeks start after and end after the body | 40 to 80 ms lag (`animation-delay: 60ms`, duration +80 ms) |
| Slow in and slow out | Yes | no linear limb move | `--ease-out` for settles; `--ease-land` for landings |
| Arcs | Yes | a hop travels on an arc: translateY plus a rotate of opposite sign at apex | rotate 3 to 9 deg at apex, 0 at rest |
| Secondary action | Yes, one | a blink at apex, a leaf flick on landing, notes while listening | one per reaction, never two |
| Timing | Yes | light body means quick | tap 500 ms, hop 1.2 to 1.4 s, slump 1.7 s; weight is duration, not amplitude |
| Exaggeration | Yes, capped | push the apex past plausible, settle exactly to 1:1 | apex scale at most 1.08 |
| Solid drawing | Yes | no part changes size between poses; mouths scale, they do not redraw | bounding box identical at rest, 0 px |
| Appeal | Yes | asymmetry in gesture, symmetry in the face at rest | tilt -3 then +2 deg; never a perfectly symmetric pose held |

Beat structure for every one-shot: anticipation 80 to 120 ms, action 200 to 300 ms, settle 300 to 500 ms on `--ease-land` (1.7 % overshoot). A 1.4 s hop therefore spends roughly 120 ms crouching, 280 ms in the air, 400 ms landing and settling, and the rest in a small second hop. `[house]`

## 4. Blink

Humans blink irregularly. A fixed loop is the fastest way to make a face read as a toy.

Physiology `[source: Bentivoglio 1997; Doughty 2001; Doughty 2002; eNeuro 2024; PLoS ONE 2018; PMC 2025]`:
- Rate: 10 to 20 per minute at rest (Bentivoglio: 17 per minute in primary gaze, 26 in conversation); about 4 to 5 per minute while reading (Bentivoglio 4.5; Doughty reports the same drop for reading and screen work). A mascot beside a task the user is reading sits at the low end.
- Interval: mean about 6.4 s with standard deviation 2.4 s at rest, a coefficient of variation of 0.375; the studio floor is CV at or above 0.25. Intervals are multimodal, never constant.
- Duration: 100 to 400 ms whole blink; median 170 to 190 ms in high-speed video, 280 ms reads well at 200 px.
- Shape: the lid closes faster than it opens, roughly 1:2 (closure about 0.15 s, reopening about 0.25 s; phases 116 / 30 / 216 ms in one study). Close over total therefore lands between 0.20 and 0.45.
- Doubles: 10 to 15 % of blinks are followed by a second within about 150 ms of reopening. `[house, from the multimodal interval data]`
- Both lids move together, always; one draw call drives both.
- Brows dip 1 to 2 % of character height on a blink and recover with the opening (Noot: 9 artwork units, 1.7 px). `[house]`

Pass sheet (what `freeze.mjs --blink` checks over 60 s):

| Measure | Pass |
|---|---|
| Blink count in 60 s | 6 to 20 |
| Interval coefficient of variation | at least 0.25 |
| Close over total, per blink | 0.20 to 0.45 |
| Each blink total | 100 to 400 ms |
| Doubles (gap under 600 ms) | at least 1 |
| Left and right lid transforms | identical every frame |

Rules `[house]`:
1. Schedule with `setTimeout` and drive with the Web Animations API so each phase is a fixed number of milliseconds regardless of the gap before it. CSS keyframes with a re-rolled `animation-duration` stretch the blink with the cycle (a 10 s cycle turns a 220 ms blink into 460 ms); if you must, clamp the cycle to 3.5 to 7 s.
2. Draw intervals from a log-normal (median 4 s, sigma 0.45) or a gamma distribution and clamp to 1.5 to 8 s. Noot uses the sum of two uniforms over 1.6 to 7.6 s; both pass the sheet. Never a constant, never a fixed sequence.
3. The lid comes down. Either a lid part translating from `-104 %` to `0`, or a lid-less eye scaling from a bottom origin. Never a centre origin: the eye pinches to a line and reads as a squeeze.
4. `composite: 'add'` on the brow dip so it stacks on the brow's expression transform instead of replacing it.
5. A large gaze shift (over 30 % of eye travel) or a head-turn pose triggers a blink at its onset. `[source: Evinger 1994, 97 % of gaze shifts over 33 deg]`
6. Suppress blinks while an expression closes the eyes (win squint, timeout heavy lids) and for the first 300 ms of any reaction; the pose carries the moment.

Scheduler and lid animation (runs in the browser against Noot's rig; the two lid curves describe a muscle, not a UI transition, and are the only non-token curves allowed on a character) `[house; source: MDN Web Animations API]`:

```js
const BLINK_MS = 280;                                   // close 34 %, hold 12 %, open 54 %
const lids = document.querySelectorAll('.noot-lid');
const brows = document.querySelectorAll('.noot-brow');
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const nextGapMs = () => Math.min(8000, Math.max(1500, Math.exp(Math.log(4000) + 0.45 * gauss())));   // log-normal, median 4 s, clamp 1.5 to 8 s
const blinkOnce = () => {
  for (const lid of lids) lid.animate([
    { transform: 'translateY(-104%)', easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },   // lid drops fast
    { transform: 'translateY(0%)', offset: 0.34 },
    { transform: 'translateY(0%)', offset: 0.46, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    { transform: 'translateY(-104%)' },                                              // lifts slower
  ], { duration: BLINK_MS, fill: 'none' });
  for (const brow of brows) brow.animate(
    [{ transform: 'translateY(0)' }, { transform: 'translateY(9px)', offset: 0.38 }, { transform: 'translateY(0)' }],   // 9 art units = 1.7 px
    { duration: BLINK_MS + 80, easing: 'ease-in-out', composite: 'add', fill: 'none' });
};
let timer;
const schedule = () => { timer = setTimeout(() => { blinkOnce(); if (Math.random() < 0.13) setTimeout(blinkOnce, BLINK_MS + 90); schedule(); }, nextGapMs()); };
schedule();
window.__stopBlink = () => clearTimeout(timer);         // unmount and route change call this
```

Expected over 60 s: about 13 blinks plus 1 or 2 doubles, CV about 0.4, close over total 0.34.

## 5. Gaze

Eyes fixate, then jump. They do not drift. `[source: Scholarpedia, saccades 20 to 100 ms, fixations 200 ms to seconds]`
- A saccade every 2 to 6 s, drawn at random. Travel 1 to 3 % of the character's width (Noot: 14 artwork units, 2.7 px, 1.1 %), about 8 to 12 % of the eye's own width. More reads as looking away.
- Dart in 30 to 60 ms (`steps(1, end)` or a 40 ms ease-out), hold 1 to 3 s, dart again. Return to centre more often than not; the resting gaze is toward the user.
- Look at what the user touches: pointer on the primary control moves the pupils toward it; typing moves them toward the input. Set `--gaze-x` and `--gaze-y` on the host from `pointerenter` and `focus` handlers; the pupil transform reads them. `[house]`
- Head follows eyes on large shifts, 100 to 200 ms later, at 30 to 50 % of the amplitude (root rotate 1 to 2 deg). Eyes lead, head follows, never the reverse. `[house]`
- The eye highlight is fixed to the eye, not the pupil; it is a reflection of the room. A highlight riding the pupil is the dead-eye tell. `[house]`
- Pupils stop (`animation: none`) whenever an expression closes the lids, so nothing pokes through a squint (Noot does this for win, streak, timeout and lose).

Noot's CSS saccade cycle (9 s, four fixations, `steps(1, end)`) passes because the fixations are unequal; a JS scheduler drawing 2 to 6 s gaps is preferred for a new rig. `[house]`

## 6. Breathing

Resting adults breathe 12 to 20 times a minute. `[source: American Lung Association; StatPearls]`
- Period 3 to 4 s (Noot: 3.4 s), `ease-in-out`, infinite, only while idle.
- Amplitude: scaleY 1 to 2 % on the torso group only, scaleX -0.5 % to keep volume, origin at the feet. The head rides up at most 1.5 px; accessories lag 60 ms. The body breathes; the cut-out does not bob. Noot breathes on the root at 0.8 % scaleY with a 1.5 px rise, which is inside the range but a torso group is the default for a new rig. `[house]`
- Breathing and blink must not share a period or a multiple (3.4 s breath with a 6.8 s blink locks into a rhythm). The random blink cycle handles this; verify over 60 s.
- Breathing pauses for any one-shot reaction and resumes from phase 0 with `animation-fill-mode: both`; no snap.

## 7. Idle life signs

Breathing alone is a screensaver. `[house; source: Duolingo idle behaviour]`
- Interval 6 to 12 s uniform random after the previous sign ends; duration 1.8 to 2.4 s.
- Pool of at least 3, no immediate repeat: `sway` (weight shift 5 px, 3 deg), `peek` (lean -4 px, -6 deg, pupils aside, blink at onset), `bop` (two 4 to 5 px bounces).
- Life signs are quieter than reactions: amplitude at most 50 % of the smallest reaction, no props, mouth change under 5 %.
- Pointer over the character or a reaction cancels the pending sign; the interval restarts on return to idle.

## 8. Reaction pools

One reaction per event reads as mechanical by the third time. `[source: Duolingo character system; house]`

| Event | Face (from the event) | Body variants (2 to 4, same energy) | Duration | Props |
|---|---|---|---|---|
| play / listening | mouth 1.08 x 1.12, brows rest | groove (nod 1.4 deg, -4 px), bop-beat (0.55 s), sway-beat (4 px, 3.5 deg) | loop, 1.1 s bar | notes float up, 0.9 s stagger |
| win | lower lids up 50 %, brows -14 px, mouth 1.7 x 2.1 | hop (-26 px, land 1.06 x 0.94), twist (-30 px, -9 then +8 deg), double (two hops) | 1.4 s | sparks, 0.18 s stagger |
| streak (win chained) | win face | double hop, bigger (-30 and -24 px, 5 deg) | 1.8 s, after win | sparks |
| lose | brows in and up 14 deg, mouth flipped 0.72 x 0.6, upper lids down 18 % | droop (+4 px, -2.5 then +1.5 deg), headshake (4 deg x4, then slump) | 1.2 s | none |
| timeout | heavy lids 50 %, mouth 0.9 x 0.3 | slump (+6 px, held 30 % of clip) | 1.7 s | none |
| tap | lids 55 %, mouth 1.5 x 1.8 | bounce (+4 px crouch, -12 px pop) | 0.5 s, `--ease-land` | none |
| skip | mouth 0.8 x 0.5 | sidestep (-7 px, +5 px, back) | 0.6 s | none |
| switch (hue) | lids 60 %, mouth 1.45 x 1.7 | crouch, hop with 7 deg tip, land; recolour at apex | 0.9 s | 3 sparks, once |

Picking without repeats (from `Mascot.tsx`):

```js
const pick = (pool, previous) => { const options = pool.length > 1 && previous ? pool.filter((v) => v !== previous) : pool; return options[Math.floor(Math.random() * options.length)]; };
// once per pose entry: variant = pick(POOLS[pose], last[pose]); last[pose] = variant; host.dataset.variant = variant
```

Rules `[house]`:
- Pick once per pose entry and store `last[pose]`; never pick during render more than once (Noot uses React's "adjust state when a prop changes" pattern).
- Variants share duration, easing and amplitude ceiling; only the gesture differs. A 40 px hop beside a 12 px hop is two energies, not two variants.
- Interruptible: a new event restarts the one-shot from the current pose. Restart by setting `animation: none`, forcing a reflow (`getBoundingClientRect()`), then removing the inline property. Never remount the SVG; it kills the colour cross-fade and resets the blink cycle.
- Contextual variety: streak bigger than win; timeout heavier than lose; tap (deliberate) bigger than hover (ambient).
- Result poses hold 600 to 2000 ms then return to idle; input stays enabled throughout. `[source: motion playbook rule 19]`

## 9. Face and body as separate channels

- Body channel: the root transform. Face channel: brows, lids, mouth, pupils. Props channel: notes, sparks. Each has its own animation or transition; none is a keyframe of another. A win face can sit on any win gesture and a blink can land during a sway. `[house]`
- Face leads body by 0 to 60 ms on reactions the character initiates (smile, then hop) and trails by about 60 ms on reactions imposed on it (slump, then sad face). `[house]`
- Face transitions are tweens at `--dur-2` to 260 ms on `--ease-out`; body reactions are keyframed one-shots. The mix is what makes an expression arrive during the anticipation crouch.

## 10. Expression design

Lids and brows carry emotion; the mouth confirms it. `[source: Duolingo and Rive; house]`

| Emotion | Upper lid | Lower lid | Brows | Mouth (one path, transformed) |
|---|---|---|---|---|
| neutral | open | open | rest | rest |
| happy / win | open | raised 40 to 50 % (scale from top) | up 10 to 14 px, outward 6 deg | scale 1.5 to 1.7 x 1.8 to 2.1 |
| listening | open | raised 5 to 10 % | rest | scale 1.08 x 1.12 |
| sad / lose | down 15 to 20 % (scale from bottom) | rest | inner ends up, 14 deg | rotate 180 deg about top anchor, scale 0.7 x 0.6, translate +10 px |
| tired / timeout | down 50 % | rest | inner ends up, 8 deg | scaleY 0.3 |
| surprised / tap | wide (scaleY at most 1.05) | open | up 14 px, no rotate | scale 1.5 x 1.8 |
| thinking / sceptical | one lid down 30 % | rest | one brow up 6 px | scaleX 0.8, translateX 4 px |

Rules `[house]`:
- Mouths scale and shift; they never swap to a different path mid-state. If "o" versus smile is unavoidable, cross-fade opacity over 80 to 120 ms between two paths sharing the top-centre anchor.
- Pupils never sit still for more than 4 s; the highlight stays; lids never scale below 0.04 (a hairline reads as closed, 0 reads as deleted).
- At rest, brows differ by at most 2 deg and lids by 0. Asymmetry is an expression (sceptical) or a gesture (tilt), never a default.
- Every expression reads at 64 px in greyscale. If it needs colour or 200 px, push lids or brows 20 % further.

## 11. Hue transitions

The UI hue (level, theme, mood) recolours the character; the character performs the change. `[house]`
- Register palette variables with `@property { syntax: '<color>'; inherits: true }` so the variables interpolate; one transition on the host cross-fades every `fill: var(--ill-*)`. Unregistered custom properties snap. `[source: MDN @property]`
- Duration `--dur-3` on `--ease-in-out`, the same clock as the UI's own theme transition; the character must finish within 100 ms of the UI or it reads as a separate system. Chromium wedges the transition when a `var()` sits inside the `transition` shorthand; use the longhands, or a literal with a comment naming the token (Noot: 420 ms literal).
- With a performance (switch pose): delay the transition to the apex (Noot: `transition-delay: 280ms; transition-duration: 300ms` inside a 900 ms hop) so the character lands already wearing the new colour.
- Flat-art alternative: a `clip-path: inset()` wipe. Duplicate the body group, new colour on top, animate `clip-path` from `inset(0 0 100% 0)` to `inset(0)` over `--dur-3`, bottom-up. Wipes are for brand moments; the cross-fade is the default. `[source: W3C CSS Masking, clipPath]`
- Only palette colours change (body, belly, shade, cheek). Ink, whites, pupils and metal stay fixed; check every palette against the eye white at 3:1 or better.

## 12. Reduced motion

`prefers-reduced-motion` removes movement, not life. `[source: MDN prefers-reduced-motion; Apple HIG Accessibility; WCAG 2.2 SC 2.3.3]`
- Keep: blink (randomised, at most 280 ms, a lid translation inside the eye is not vestibular motion), expression tweens, colour cross-fade, pupil saccades at reduced amplitude (at most 1 % of width).
- Drop: breathing, life signs, hops, sways, head shakes, props, any translate or rotate on the root. Reactions become a pose swap with a 120 ms cross-fade: win is the win face for 1.2 s, then neutral.
- A CSS `animation: none !important` block only silences CSS animations. Noot's blink is WAAPI on `.noot-lid`, so it survives the block while breathing, life signs and pupils stop; say so in a comment or the next refactor kills the blink. `[house]`
- Test with `Emulation.setEmulatedMedia` (`prefers-reduced-motion: reduce`) in the QA capture matrix; `motion-audit.mjs --reduced` lists transform animations outside the character.

```css
@media (prefers-reduced-motion: reduce) {
  .root, .pupil, .note, .spark { animation: none !important; transform: none !important; }
  .face > * { transition-duration: 120ms; }
}
```

## 13. Performance

- Animate `transform` and `opacity` only. No `filter`, no `fill` keyframes (colour goes through the registered-variable transition), no path morphing, no width or height. `[source: motion playbook rule 27]`
- `will-change: transform` on the root only, so the rig is one compositor layer. On 40 paths it makes 40 layers and the fills stop being one raster. `[source: MDN will-change]`
- No `filter` or `drop-shadow` anywhere on the rig; grounding is a drawn shadow shape.
- One `<svg>`, at most 60 nodes animated at any moment; props are 2 to 3 paths each, never particle systems.
- Give the host a fixed size per breakpoint so the character never triggers layout around it.
- Budget: 0 long animation frames at or above 50 ms during a reaction; `Performance.getMetrics` `LayoutCount` does not increase while a pose plays. `[source: web.dev LoAF]`

## 14. QA with freeze.mjs

Method (from `../../qa/PLAYBOOK.md` section 4.6):

```
bash scripts/chrome.sh
node scripts/freeze.mjs <url> .mascot <outDir>/poses --poses=idle,play,win,lose,tap,timeout --fractions=0,0.25,0.5,0.75,1 --blink=.noot-lid --wait=.mascot
```

The script sets `data-pose` on the host for each pose, pauses every finite animation and seeks it to each fraction, writes a 2x crop per frame, compares the bounding box at the first and last fraction (floor 0.5 px), then samples the lid transform per frame for 60 s and prints the blink sheet. Run it once per variant by setting `data-variant` first (`--pose-attr` can target the variant attribute in a second run).

Read the frames for: unbroken silhouette (no straight cut through a limb); identical ground line across poses; apex rotate of opposite sign to the landing tilt; eyes closed only where the expression says so; recolour visibly under way at about 0.45 of a switch; no clipping at the container edge.

A passing run looks like this:

```
Bounding box drift between first and last fraction (floor 0.5 px)
┌─────────┬───────────┬─────────┬────────┐
│ (index) │ pose      │ driftPx │ pass   │
├─────────┼───────────┼─────────┼────────┤
│ 0       │ 'idle'    │ 0       │ 'pass' │
│ 1       │ 'win'     │ 0       │ 'pass' │
│ 2       │ 'lose'    │ 0       │ 'pass' │
│ 3       │ 'tap'     │ 0       │ 'pass' │
└─────────┴───────────┴─────────┴────────┘
Sampling blinks for 60 s...
{ blinks: 13, meanGapMs: 4410, cv: 0.42, doubles: 2, closeOverTotal: 0.35, totalsMs: [280, 283, 280, 281, ...] }
Blink sheet: 6 to 20 blinks, CV >= 0.25, close/total 0.20 to 0.45, each 100 to 400 ms -> pass
```

Failures and their causes: `blinks: 15, cv: 0.04` is a fixed interval; `closeOverTotal: 0.5` is a symmetric blink; `totalsMs` over 400 is a blink stretched by a re-rolled CSS cycle; `driftPx: 2.3` on win is a root origin not at the feet or a pose that does not return to 1:1; `doubles: 0` over several runs means the double probability is missing.

Variants: trigger each event ten times and read `host.dataset.variant`; at least two distinct values per event and never the same value twice in a row.

Alive versus toy `[house]`:
- Alive: irregular blink; gaze that lands on what the user touches; breathing that pauses for a reaction and resumes; an accessory that arrives late; variants you cannot predict; a face that changes 60 ms before the body on its own actions.
- Toy: a blink you can count along to; a bob on a loop; fixed pupils; the same hop every win; a smile that is a different drawing; a limb cut straight; a figure that floats; a colour that snaps.
- Ten-second test: watch idle for 10 s at 1x. If you can describe the loop, it is a toy.

Anti-patterns specific to timing (rig and drawing slop is in `../PLAYBOOK.md` section 6): blink origin at centre; eyes blinking out of sync; pupils on a `linear infinite` drift; breathing as a whole-body `translateY` bob; life signs as loud as reactions or on a fixed 8 s timer; variants with different energies; `will-change` on every path; remounting the SVG to restart; reduced motion that deletes the blink and the expression; a recolour on a different clock from the UI.

## 15. Sources

- Bentivoglio et al. 1997, Analysis of blink rate patterns in normal subjects (17 per min at rest, 4.5 reading, 26 in conversation), Movement Disorders 12(6) https://doi.org/10.1002/mds.870120629
- Doughty 2001, Consideration of three types of spontaneous eyeblink activity in normal humans: during reading and video display terminal use, in primary gaze, and while in conversation, Optometry and Vision Science 78(10) https://doi.org/10.1097/00006324-200110000-00011
- Doughty 2002, Further assessment of gender- and blink pattern-related differences in the spontaneous eyeblink activity in primary gaze (10.3 per min, interval 6.4 s with SD 2.4 s) https://doi.org/10.1002/j.1538-9235.2002.tb01504.x
- eNeuro 2024, blink duration 78 to 392 ms, median 170 to 192 ms, multimodal intervals https://www.eneuro.org/content/11/3/ENEURO.0296-23.2024
- PLoS ONE 2018, high-speed video: closure about 0.15 s, opening about 0.25 s https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0196125
- PMC 2025, blink phases 116 / 30 / 216 ms, total 100 to 400 ms https://pmc.ncbi.nlm.nih.gov/articles/PMC12638546/
- Evinger et al. 1994, gaze-evoked blinks accompany 97 % of gaze shifts over 33 deg https://link.springer.com/article/10.1007/BF00227203
- Scholarpedia, human saccadic eye movements (20 to 100 ms; fixations 200 ms to seconds) http://www.scholarpedia.org/article/Human_saccadic_eye_movements
- American Lung Association, respiratory rate 12 to 20 per min https://www.lung.org/blog/respiratory-rate-vital-signs ; StatPearls https://www.ncbi.nlm.nih.gov/books/NBK537306/
- Thomas and Johnston, The Illusion of Life: Disney Animation (1981); summary of the 12 principles https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- Richard Williams, The Animator's Survival Kit (overlapping action, successive breaking of joints) https://en.wikipedia.org/wiki/The_Animator%27s_Survival_Kit
- Duolingo, How Duolingo animates its world characters (idle behaviour, state machines) https://blog.duolingo.com/world-character-visemes/ ; Rive, Duolingo's Video Call brings Lily to life https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- MDN, Web Animations API https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API ; `Element.animate()` https://developer.mozilla.org/en-US/docs/Web/API/Element/animate ; `Document.getAnimations()` https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations
- MDN, `prefers-reduced-motion` https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion ; `transform-box` https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box ; `@property` https://developer.mozilla.org/en-US/docs/Web/CSS/@property ; `will-change` https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
- W3C CSS Masking Level 1, `clipPath` https://www.w3.org/TR/css-masking-1/#ClipPathElement ; SVG 2 clipping https://www.w3.org/TR/SVG2/render.html
- W3C WCAG 2.2, SC 2.3.3 Animation from Interactions https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions ; Apple HIG Accessibility (reduce motion) https://developer.apple.com/design/human-interface-guidelines/accessibility
- Material 3 motion, expressive springs and physics (spatial versus effects tokens) https://m3.material.io/styles/motion/overview ; Apple HIG Motion https://developer.apple.com/design/human-interface-guidelines/motion
- web.dev, Long Animation Frames (50 ms threshold) https://web.dev/articles/long-animation-frames
