---
name: direction
description: The creative direction desk. Turns the brief into one idea, chooses a premium direction from the catalogue (and the next one if the client says no), reads references as mechanisms rather than looks, writes the kill list, holds the AI-slop catalogue, and runs the final audit that decides ship or loop. The front desk calls it second on any redesign or new site, and first on "make it premium" or "this looks generic" jobs.
---

# Direction

Studio-grade work is not more polish. It is fewer decisions, made on purpose, and carried through. This desk makes the few decisions: the idea, the direction, what to borrow, what to kill. It also says no at the end, with a score.

Conventions: `[source: ...]` is traceable to section 9. `[house]` is a studio rule.

## 1. When the front desk calls this desk

- Step 2 of the run sheet on every redesign, new site, brand or creative job: produce `concept.md`.
- Step 8 on every job: audit the QA evidence with the rubric and decide.
- First on "make it premium", "looks generic", "looks AI-generated": run the sixty-second triage (section 4.1) and the slop catalogue before anything else.
- When a client rejects a direction: present the next candidate from `references/directions.md`. Never decorate the rejected one further. `[house]`
- Once per session, read `references/practice.md`: the studio flow (kickoff, discovery, two-direction presentation, the rally, critique, hand-off, case study), the six methods for finding the one idea, the one-mechanism rule for innovation, and the surface table for work that is not a web page. `[house]`

## 2. Inputs required

- `brief.md` from strategy with the primary task in one sentence. No brief, no concept.
- The intake card's references and dislikes.
- For audits: the QA report with capture files and measurements. Never audit from code.

## 3. Decisions this desk owns

### 3.1 Choosing a direction

Open `references/directions.md`. Match the brief to the signal table there; it returns two candidates. Present both in `concept.md` with one recommended. The catalogue has ten directions; each carries its own type pairing, palette recipe, geometry, motion dialect, hero device and pitfalls, so the downstream desks receive a coherent set of defaults rather than a mood.

| Situation | Default | Escape hatch |
|---|---|---|
| Brief is complete and the client is available | Two candidates, one recommended | One candidate if the intake card names a reference whose mechanisms map onto exactly one direction |
| Brief has guessed lines (archaeology) | Two candidates from different families (one quiet, one expressive) | None |
| Client rejected the recommended direction | The second candidate, then the next row in the table | A hybrid only when the client names which mechanism from each; write both mechanisms down |
| Existing product with tokens that work | Keep the direction; name it in `concept.md` and extend its kill list | New direction only if the brief's problem is the direction itself |
| Client asks for a copy of a reference | Name the reference's mechanisms and choose the direction they belong to; borrow the mechanisms | Never borrow palette, pairing and layout together from one source |

### 3.2 Reading references properly

References set a bar; they are not a source of pixels. For each of three references, write the mechanism, not the look. `[house]`

| Read this | Write this |
|---|---|
| The headline group | "eyebrow (sans, tertiary) / display (serif, 49 px) / body (sans, 16 px) stacked with 12 and 24 px gaps" |
| The controls | "controls float in a translucent capsule bar; content scrolls beneath" |
| The rhythm | "one column, 640 px, 96 px between sections, 24 px between groups" |
| The voice | "italic serif for section labels; sentence case; numbers tabular" |
| The motion | "nothing moves except one set piece in the hero; the rest is static" |
| The material | "solid surfaces, 1 px lines at 3:1, one soft tinted shadow on the floating layer" |

Use three references: one for hierarchy and rhythm, one for material and motion, one for voice. otherkind.design, for example, gives: a wordmark that is a live vector (set piece), a single 14 px sans at one size for all running text, engagement list with years right-aligned in a tertiary tone, 20 px radius cards on a 0.97 lightness canvas, and no other motion. Borrow those mechanisms into whatever direction fits the brief; do not set the client's site in a black display serif because otherkind did. `[house]`

### 3.3 Divergence before the idea

Four structural options in `concept.md` before a single idea is written; a structure is what is on the page, in what order, at what weight, and what the user can do there. Skin (type, colour, radius) does not count as a difference. One option keeps the current structure so that leaving it is a decision; two or more change it. Each option names what it does for the primary task and the return ritual, and what it costs (rows above the fold, taps, state to keep). Carry two into the direction presentation, choose one, and say which line of the brief chose it. Source the options from `references/practice.md` section 10 (the six methods) and from the competitor map's empty quadrant. `[source: Crazy 8s, Google Ventures sprint; house]`

| Situation | Default | Escape hatch |
|---|---|---|
| Intake scope is rethink or new | Four options, two carried, one chosen | None |
| Intake scope is refresh | One option (the current structure) named as such; skip to the idea | None |
| All four options keep the old structure | Not divergence; rewrite until two change it | None |
| The chosen option is the current structure on a rethink | Allowed only with a written reason from the ritual or the metric; the reskin test still applies | None |

### 3.4 The one idea

One line, no adjectives, a device or metaphor every later decision can be checked against. "A shop window: content behind glass, controls in front." "A reading room: one column, one voice, nothing floats." "A control panel: everything is a switch or a readout." If the idea needs a gradient or a glow to work, it is not an idea. `[source: Bierut; house]`

Test: take any element on the screen and ask what the idea says about it. If the idea has no opinion, the element is decoration or the idea is too weak.

Rejection rule: if the sentence describes the build being replaced ("the list is the whole product" for a page that is already a list), it is a description, not an idea; run the six methods in `references/practice.md` section 10 until a sentence passes the three-decisions test. On a rethink, the idea must also name the one new mechanism (`concept.md`), which the interaction desk then specifies. `[house]`

### 3.5 The kill list

Walk every element and ask what it is earning. Remove decoration without meaning, second accents, badges that do not change a decision, icons that do not aid recognition, motion on frequent interactions, boxes whitespace could replace, words that add no information. Expect to remove 20 to 40 percent of what was there. Five items minimum in `concept.md`; the QA desk checks each one is gone. `[house]`

### 3.6 Decisions nobody else made

Premium is the absence of accidents plus a few decisions nobody else made. The first half is measured by QA. The second half is this list: at least three, each checkable in the render. A typographic voice that cannot be swapped for the default without loss; a composition device that carries the idea; material used with intent; a character that behaves; restraint you can point at (the accent in four places and nowhere else). If the list is empty, the work is a clean template. `[house]`

## 4. Rules

### 4.1 Sixty-second triage

Any yes means the work is not at the bar. Numbers refer to `references/slop-catalogue.md`.

- Letter-spaced uppercase labels on more than one element? (1)
- A coloured side stripe, tinted icon square or badge carrying no data? (2, 4, 7)
- A dot, ring or pulse pretending to be live? (3, 40)
- A gradient, glow, halo, aurora or blur on content? (11 to 16)
- Text below 4.5:1, or pale text on a pale chip? (20, 21)
- More than one accent hue? (colour desk)
- Mixed radii or a local radius tweak? (28, 29)
- A mascot with arc-stroke eyes, a scaling oval mouth or limbs cut by a container edge? (50, 51)
- Layout that jumps between states, or idle motion on more than one figure? (39, 45)
- Three equal cards, a bento of equal boxes, a "trusted by" carousel? (23, 24, 42)

### 4.2 The studio mindset, as rules

1. One idea per screen, and the idea is not a style. Style is the residue of a strong idea. `[source: Bierut]`
2. Simplicity only on the far side of complexity: research first, then make the complicated simple. `[source: COLLINS 101 rules]`
3. Constraints first. Six to eight colours, one typeface in a fixed size system tied to a grid; disable as much as possible. `[source: Teenage Engineering]`
4. Prototype in the medium; designer and engineer in one loop; solve one problem at a time. `[source: Work and Co; Instrument]`
5. Motion is a behavioural system: documented timing and easing rules, not decoration. `[source: DIA; Studio Dumbar]`
6. The interface is a physical object: respond instantly, be interruptible, hint in the direction of the gesture. `[source: WWDC18 Fluid Interfaces]`
7. Technology earns its place: if a render or a video tells the story better than WebGL, use it. `[source: Active Theory]`
8. Feeling before look. `[source: Made Thought]`
9. If it will look dated in 18 months it is a campaign asset, not a system decision. `[source: Order; DIA]`
10. Tempo over volume. A studio embedded with a founding team wins by returning the ball fast and well, not by a large first delivery. `[source: otherkind, tennis-rally model]`

### 4.3 Perception rules the director enforces

- Proximity beats similarity: inter-group gap at least 2 times intra-group. Common region only when whitespace fails. `[source: NN/g Gestalt]`
- One figure per screen; if everything is elevated, nothing is. `[source: NN/g]`
- Text-heavy pages scan in an F; front-load key words and use real subheads. Sparse pages scan in a Z; the primary action sits at the end. `[source: NN/g eyetracking]`
- One element may differ (Von Restorff). Three highlights are none. `[source: Laws of UX]`
- Simultaneous contrast: never judge a colour pair out of context; never place saturated complements edge to edge. `[source: Albers]`
- Aesthetic-usability effect: craft buys forgiveness, so it is not cosmetic. `[source: Laws of UX]`

## 5. Defaults

- Two candidate directions, one recommended, from the catalogue.
- Three references, each reduced to one mechanism.
- Kill list of five or more.
- Decisions-nobody-else-made list of three or more.
- Ship gate: audit average at or above 8.0 with no category under 7 and zero slop hits in the core loop. `[house]`

## 6. Anti-patterns (direction-specific)

- Choosing a look before the primary task is written. Fix: no concept without a brief.
- A concept that is a list of adjectives. Fix: rewrite as a device or metaphor.
- Borrowing a whole reference. Fix: mechanisms only, and never palette, pairing and layout from one source.
- Decorating a rejected direction. Fix: next catalogue row.
- Softening audit scores to ship. Fix: a 6 is a 6; the top five findings become the next brief.
- Averaging categories to hide a weak one. Fix: report the lowest category first.
- Adding a gradient "for energy", an icon because a heading "looked bare", a badge, a local radius, a hover animation, a centred paragraph. Each is a drift back to template. `[house]`

## 7. Hand-off artefact

Fill `templates/concept.md`. Sections: the one idea; two candidate directions with the recommendation; three references as mechanisms; kill list; decisions nobody else made; what must stay.

For audits, produce the score table below inside the QA report's decision section.

### The audit rubric

Score each category 0 to 10 from QA evidence. Start at 10; subtract 2 per failed check; subtract 1 per slop hit landing in that category (a hit counts once). Never average to hide a weak category; a 10/10/10/4 is a 4.

| Category | Checks (each is binary) |
|---|---|
| A Hierarchy | One primary element; primary action found within 2 s at arm's length; section gaps visibly larger than in-section gaps; one accented element; reading order matches intent |
| B Typography | One ratio scale with at most 7 steps, all sizes on it; measure 45 to 75 ch; body line-height 1.4 to 1.6; caps tracked 5 to 12 percent and lowercase never tracked; tabular figures on numbers; at most 2 families and 3 weights, chosen for a stated reason |
| C Layout | One grid, edges on it, one alignment axis; reading column at most 720 px; spacing on scale (spot-check 10); asymmetric where content is unequal; groupings survive at 390 px; primary object sized to the viewport |
| D Colour | Body 4.5:1, large text and UI 3:1, measured; one accent used only for action, focus, selection; no pure black or white surfaces; neutrals carry the hue; no meaning by colour alone; light and dark are two tuned systems |
| E Surfaces | At most 3 elevation levels; one shadow system, no glows; blur only on a control layer with fallback; one shape language with concentric nesting; borders at 3:1 or absent |
| F Components | Hover, focus-visible, active, disabled states present; focus ring 3:1; targets 44 pt touch and 32 px pointer; same role same style; one icon set; empty, loading and error states designed |
| G Motion | Tokens only; every animation has a stated meaning; interruptible; frequent interactions have minimal motion; no perpetual idle motion except one figure; reduced motion honoured |
| H Character | One illustration style; expression by posture, lids and brows; irregular blink; no cropping through a body; peaks use anticipation, action, settle within 900 ms; reaction pools with no immediate repeat |
| I Copy | Headline makes a specific claim; labels are the user's words; one CTA per section, verb first; sentence case; numbers formatted |
| J Craft | Ten measurements spot-checked, all on scale; optical alignment corrected; no orphans in headlines; dark mode designed; nothing fails "what is this earning" |
| K Reskin test (rethink and new only) | Before and after side by side at 25 percent zoom (`scripts/capture.mjs` both, same viewport): structure differs, not only skin; the one idea is legible at that zoom; the one new mechanism exists in the render and serves the primary task; the chosen divergence option is the one built; a stranger's one-line description of each would differ. Under 7 on a rethink is a reskin: loop, with the divergence options as the next brief |

Verdict: studio grade at or above 8 in every category with zero slop hits (K included on a rethink); competent at or above 6 everywhere with at most 3 hits; template otherwise. Report the lowest category first, then the slop hits by number and location, then the top five fixes ordered by impact with the categories each affects.

## 8. Checklist (five minutes)

- [ ] Brief read; primary task in one sentence.
- [ ] Two candidate directions from the catalogue; one recommended; the next one named for rejection.
- [ ] Three references reduced to mechanisms; no palette, pairing and layout borrowed together.
- [ ] One idea written without adjectives; it has an opinion about every element.
- [ ] Kill list of five or more, each concrete.
- [ ] Decisions nobody else made: three or more, each checkable in the render.
- [ ] Sixty-second triage run on the current build; hits recorded by number.
- [ ] For audits: scored from QA evidence, lowest category reported first, no averaging.

## 9. Sources

Studios and practice
- Pentagram, Michael Bierut, How To and interviews: https://www.pentagram.com/work/how-to ; https://www.designweek.co.uk/issues/9-15-march-2015/ten-questions-for-michael-bierut/
- COLLINS, 101 Design Rules: https://wearecollins.com/story/101-design-rules/
- Work and Co, principles; Order case study: https://order.design/project/work-and-co
- Instrument, Design to Code: https://www.instrument.com/latest/design-to-code
- Active Theory, Craft Matters: https://lbbonline.com/news/Craft-Matters-by-Active-Theory
- DIA, Mitch Paone, time is the material: https://mitchpaone.substack.com/p/time-is-the-material-from-motion
- Studio Dumbar and DIA on motion in branding: https://the-brandidentity.com/insight/how-to-meaningfully-incorporate-motion-into-branding-with-studio-dumbar-dia-and-connor-campbell
- Koto, values: https://koto.com/about
- Made Thought, The Aesthetic of Feeling: https://shop.designmiami.com/blogs/news/the-aesthetic-of-feeling
- Order, profile: https://order.design/profile
- Teenage Engineering, Jesper Kouthoofd: https://scandinavianmind.com/human-touch-interview-jesper-kouthoofd-teenage-engineering/
- otherkind, the tennis-rally model: https://the-brandidentity.com/interview/why-otherkinds-founders-built-the-design-studio-they-wished-existed ; https://www.otherkind.design
- IDEO, Field Guide to Human-Centered Design: https://designthinking.ideo.com/

Apple
- WWDC18 Designing Fluid Interfaces: https://developer.apple.com/videos/play/wwdc2018/803/
- WWDC25 Meet Liquid Glass (219) and Get to know the new design system (356): https://developer.apple.com/videos/play/wwdc2025/219/ ; https://developer.apple.com/videos/play/wwdc2025/356/
- HIG Motion, Typography, Colour, Layout: https://developer.apple.com/design/human-interface-guidelines/

Perception
- Laws of UX: https://lawsofux.com/
- NN/g Gestalt and eyetracking: https://www.nngroup.com/articles/gestalt-proximity/ ; https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/
- Albers, Interaction of Color: https://www.albersfoundation.org/alberses/teaching/interaction-of-color
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
