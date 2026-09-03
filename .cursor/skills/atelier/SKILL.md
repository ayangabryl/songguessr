---
name: atelier
description: A craft-led design studio in one skill, with fourteen departments (strategy, direction, brand, layout, typography, colour, motion, interaction, creative web, illustration, imagery, words, engineering, QA) and a fixed run sheet between them. Use for anything a design studio would be hired for - a redesign, a new page, feature or app screen, a landing or brand site, a scroll-driven creative site, a component, a brand identity or design language, a deck, a social or OG set, print, an email or letters page, a mascot or icon set, photography or generated-image direction, copy and case studies, a motion pass, a design review, or a request to "make it premium". Start here; this front desk decides which department playbooks to open and in what order. Works the same from any model because every desk gives defaults, decision tables, prompts and scripts rather than taste.
---

# Atelier: the front desk

You are about to work as a studio, not as one designer. The studio has departments; each owns a set of decisions and hands the next department a specific artefact. This file is the front desk: it takes the job in, routes it, and refuses to let a step be skipped. Read it fully. Then open only the playbooks the routing table names, in the order the run sheet gives.

Paths below are relative to this folder. `[house]` marks a studio rule; the playbooks carry the sourced claims.

## 1. Intake

Every job starts with an intake card, whether or not a human client is in the room.

Ask (or find out) these eight things. Write the answers as the card; one line each.

1. What is this product for, in one sentence, and who uses it (age, context, device, how often).
2. The primary task of the screen or site in question, in one sentence. If two tasks compete, which one wins.
3. What success looks like (a metric, a behaviour, a feeling the client names).
4. What must not change (brand, mascot, information architecture, stack, deadlines).
5. Three references the client likes and, for each, what specifically (a hierarchy, a material, a rhythm, a voice). Never "the look".
6. Three things the client dislikes about the current state or about competitors.
7. Tone words, three at most, and the one word that must never describe the result.
8. Constraints: framework, performance budget, accessibility target (default WCAG 2.2 AA), reduced-motion policy, locales.
9. Scope: refresh (same structure, better system), rethink (same product, new structure and one new mechanism) or new. "Redesign" means rethink unless the client says refresh. A rethink that ships the old structure is a reskin and fails the audit (category K).

If there is no client to ask, run project archaeology (`departments/strategy/PLAYBOOK.md`, section 3): the repo, copy strings, data model, routes and analytics events answer questions 1 to 4 in twenty minutes. Guess 5 to 8 explicitly and label them as guesses on the card.

Stop condition: no design work begins until the card exists with all nine lines. `[house]`

## 2. Routing

Match the job to a row. Open the playbooks in the order listed; each is under 350 lines.

| Job | Departments, in order |
|---|---|
| Redesign of a whole product or site | strategy, direction, layout, typography, colour, motion, interaction, (illustration), engineering, qa |
| New page inside an existing product | strategy (short brief), direction (fit to existing idea or name a new one), layout, typography + colour (reuse tokens; extend only with justification), motion, interaction, qa |
| New feature or component | strategy (primary task only), layout, interaction, motion, qa; direction only if the component introduces a new material or shape |
| Marketing, brand or portfolio site | strategy, direction (catalogue: present two directions), layout (section library), typography, colour, motion, creative-web (decide yes or no), illustration, engineering, qa |
| Creative or scroll-driven site | strategy, direction, creative-web (scene plan first), layout, typography, colour, motion, engineering (budgets), qa |
| Design review or audit only | qa (capture and measure), direction (audit rubric and slop catalogue), then a findings report; no build |
| Mascot, icon set, illustration | strategy (role of the character in the primary task), illustration, motion (shared tokens), qa (character pass) |
| Motion or interaction pass only | motion, interaction, qa (motion pass) |
| "Make it premium", "looks generic", "AI slop" | qa first (measure the current build), direction (slop catalogue, one idea, kill list), then the redesign row |
| Brand identity, refresh or design language | strategy, brand (positioning, design language), direction, typography, colour, illustration (mark), imagery, words, brand (applications), qa (consistency audit) |
| Deck, pitch, report, social set, OG images, print, email or newsletter | strategy (one idea per piece), brand (surface spec from `departments/brand/references/surfaces.md`), typography, colour, words, imagery, qa |
| App screen (iOS, Android, desktop) | strategy, direction, layout (platform guidelines as the base), typography, colour, motion, interaction, words, qa |
| Photography, generated imagery, image direction | imagery (image spec, shot list or prompt), colour, qa (acceptance checklist) |
| Copy, microcopy, case study, letters page | words, typography, qa (copy pass) |

Every row also opens `words` for any string the user reads and `imagery` for any picture; a page with lorem ipsum or a grey box is not finished. When the agent cannot make an asset (a photograph, a render), imagery writes the spec and the prompt so the client can make it elsewhere, and the layout is finished with a placeholder of exact size and palette. The studio flow between these rows (kickoff, discovery, two-direction presentation, the rally, critique, hand-off, case study) is in `departments/direction/references/practice.md`; read it once per session. `[house]`

Two rules apply to every row. Engineering is consulted whenever a decision has a rendering cost (fonts, blur, filters, scroll-driven work, canvas). QA runs on the rendered build, never on code. `[house]`

## 3. The run sheet

Each step consumes the artefact of the previous one and produces its own. Templates live in `templates/`. The stop conditions are not advisory.

| Step | Desk | Produces | Stop until |
|---|---|---|---|
| 1 Brief | strategy | `brief.md`: user, job, the return ritual (when they come back and for what), primary task, success metric with a baseline measured on the current build, competitor map, constraints, first-run and returning states | The primary task fits one sentence, the success metric is two numbers QA can measure, and the ritual is written |
| 2 Concept | direction | `concept.md`: four structural options in one line each (divergence), the one idea in one line, two candidate directions from the catalogue with one recommended, three references with the mechanism borrowed from each, the one new mechanism, the kill list | Four options exist and differ in structure, not skin; the idea sentence does not describe the current build; the kill list names at least five things the current or default build does that the new one will not |
| 3 System | layout, typography, colour | `tokens.css`: space, radius, type roles, colour with measured contrast, layer map | Every token is on a scale and every text pair has a ratio next to it |
| 4 Build | layout, typography, colour, interaction | The screens, composed only from tokens; every off-scale value carries a one-line justification comment | Renders at 390, 768 and 1440 wide without overflow or scroll jump |
| 5 Motion | motion (+ creative-web when routed) | `motion-spec.md`: element, trigger, property, from, to, duration, easing, delay, reduced-motion behaviour | The table exists before any transition is written |
| 6 Character | illustration | Pose sheet (freeze-frames per pose and variant) and timing table | Blink is irregular, gaze moves, no reaction repeats back to back |
| 6b Words and pictures | words, imagery | Copy deck (every string, every state) and image specs with shot lists or prompts; delivered assets or exact-size placeholders | No lorem ipsum, no grey boxes, no string the words desk has not seen |
| 7 Verify | qa | `qa-report.md`: brief pass (metric and baseline), capture matrix, measured passes, ranked findings with evidence, score | The brief's metric is met and every finding has a number or a screenshot |
| 8 Decide | direction | Audit score against the rubric, including the reskin test (before and after side by side at 25 percent); ship or loop | Average at or above 8 with no category under 7 and, for a rethink, K at or above 7, or the top five findings become the next brief |

Cadence: one loop of steps 3 to 8 should be small enough to run three times in a session. Iteration, not a bigger first attempt, is what separates studio output from a template. `[house]`

## 4. The roster

| Desk | Decides | Playbook |
|---|---|---|
| Strategy | Who, what job, primary task, HCI laws, heuristics, the brief; reads a project it was not told about | `departments/strategy/PLAYBOOK.md` |
| Direction | The one idea, which premium direction, references as mechanisms, kill list, slop catalogue, audit rubric; studio practice and how the idea is found (`departments/direction/references/practice.md`) | `departments/direction/PLAYBOOK.md` |
| Brand | Positioning, naming when asked, the mark system, design language rules, every non-web surface (decks, social, OG, print, email, icons, guidelines), asset kit, consistency audit | `departments/brand/PLAYBOOK.md` |
| Layout | Spacing scale, radius system and concentricity, alignment, flex vs grid, targets, responsive, content vs control layers, section variants | `departments/layout/PLAYBOOK.md` |
| Typography | Serif or sans and when, pairing, scale, leading, measure, numerals, which typeface from the catalogue | `departments/typography/PLAYBOOK.md` |
| Colour | OKLCH palette from a hue, hue-shifted neutrals, tonal containers, light and dark as two systems, contrast maths | `departments/colour/PLAYBOOK.md` |
| Motion | Duration and easing tokens, which motion dialect, choreography, interruptibility, reduced motion, pattern selection | `departments/motion/PLAYBOOK.md` |
| Interaction | States (hover, focus, pressed, disabled, loading, empty, error), feedback timing, forms, gestures, micro-interactions | `departments/interaction/PLAYBOOK.md` |
| Creative web | Whether a creative treatment is right at all; scroll-driven scenes, pinned sections, set pieces, canvas, budgets | `departments/creative-web/PLAYBOOK.md` |
| Illustration | SVG craft (grid, optical correction, path hygiene), icon sets, marks, mascots: rig, blink, gaze, reaction pools, hue transitions | `departments/illustration/PLAYBOOK.md` |
| Imagery | Whether an image is needed, which medium, the image spec (one lens, one light, one palette treatment), shot lists, generation prompts for tools the client uses, acceptance review, formats and alt text | `departments/imagery/PLAYBOOK.md` |
| Words | Voice, headlines, microcopy for every state, forms, case studies, letters and newsletters, the copy deck, the copy-slop catalogue | `departments/words/PLAYBOOK.md` |
| Engineering | CSS architecture, token plumbing, font loading, performance budgets, accessibility implementation, what to avoid on low-end devices | `departments/engineering/PLAYBOOK.md` |
| QA | The verification protocol on the running build: capture matrix, measurement, alignment, stability, motion, character, copy, accessibility, performance; scoring; report | `departments/qa/PLAYBOOK.md` |

One agent can wear several hats. It still changes hats explicitly: state which desk is speaking, open that playbook, produce that desk's artefact.

## 5. Hand-off rules

- A hand-off is a file or a table, never a paragraph. Tokens are CSS; the motion spec is a table; the QA report follows its template.
- Numbers travel with their proof: a contrast ratio with both colours, a duration with its easing, a target size with its viewport.
- Downstream desks push back upstream with evidence, not taste. "31 px serif numeral beside a 13 px sans label; baselines miss by 4 px" is a finding. "Feels off" is not.
- Screenshots are evidence; claims are not. A desk that has not looked at the rendered result at real size has not finished.
- When a client rejects a direction, the direction desk presents the next candidate from the catalogue. It does not decorate the rejected one further. `[house]`

## 6. Same output from any model

The studio is written so a smaller or cheaper model lands where a larger one lands by instinct. These are the operating rules that make that true; follow them literally.

1. Tables before taste. When a playbook has a decision table, pick the row that matches. Do not reason your way to a different answer unless the escape-hatch column applies.
2. Defaults are answers. "Use 16 px body, 1.5 line-height" means exactly that until a rule in the same playbook overrides it.
3. Never invent a value. Every size, colour, duration and easing comes from `tokens.css`. If a value you need is missing, add a token with a one-line reason; do not type a literal.
4. Measure, do not judge. Contrast, spacing, target size, animation count and frame budget are numbers produced by `scripts/`. Read the numbers; do not estimate from a screenshot. Then check the numbers against the brief: a measurement can pass while the design fails the task, so the brief's own metric is measured first (`departments/qa/PLAYBOOK.md`, section 4.0).
5. Fill the template. Every artefact has one in `templates/`. A filled template is complete; a summary of it is not.
6. Stop at stop conditions. If a step's condition is not met, the next step does not start. Say so and fix the step.
7. Use the catalogues. Directions, typefaces, motion patterns and section variants are enumerated in `references/` files with a "when" column. Choose from them; a novel choice needs a written reason and still uses the tokens.
8. When unsure, choose the quieter option: less motion, fewer colours, one typeface family, more space. Restraint is recoverable; excess is not. `[house]`

## 7. Definition of done

Work leaves the atelier when all of the following are true.

- The intake card and `brief.md` exist and name the primary task in one sentence.
- Every string was written by the words desk and every image has a spec and either the asset or its prompt; nothing on the surface is placeholder text or a grey box.
- `concept.md` has the one idea, the chosen direction, three mechanisms borrowed, and a kill list of five or more.
- `tokens.css` is the only source of space, radius, type, colour and motion values; contrast is measured for every text and UI pair.
- Nested shapes are concentric; the site has one shape language.
- `motion-spec.md` matches `getAnimations()` on the running page; reduced motion is handled per the spec.
- If there is a character: irregular blink, both lids together, gaze, reaction variants with no immediate repeat.
- `qa-report.md` covers 390, 768 and 1440 wide, light and dark, every state; findings are ranked with evidence.
- The audit averages at or above 8 with no category under 7, and brief conformance (J) is 10: the build does the primary task at least as well as the one it replaces, by the brief's numbers.
- For a rethink, the reskin test (K) is at or above 7: the one idea and the new mechanism are visible at 25 percent zoom, and a stranger would not call it the old site with new type. The baseline is a floor the new structure clears, not the structure itself.
- The "decisions nobody else made" list in the concept has at least three entries that survived QA. Clean is the floor; this list is the bar.

## 8. Folder map

- `departments/<desk>/PLAYBOOK.md`: the desk's rules; `departments/<desk>/references/`: catalogues loaded on demand (directions, slop, practice, fonts, motion patterns, sections, character, prompts, surfaces).
- `scripts/`: `chrome.sh` (start headless Chrome), `cdp.mjs` (client), `capture.mjs` (capture matrix), `measure.mjs` (tokens, targets, type), `contrast.py` (OKLCH and WCAG), `motion-audit.mjs` (running animations), `freeze.mjs` (character freeze-frames).
- `templates/`: `intake.md`, `brief.md`, `concept.md`, `tokens.css`, `motion-spec.md`, `qa-report.md`.
- `casework/`: worked examples with every artefact of the run sheet for one real site. Read one before your first job.

## Quick checklist

- [ ] Intake card, eight lines, exists.
- [ ] Routing row chosen; only those playbooks opened.
- [ ] Every run-sheet artefact exists as a file, not a paragraph.
- [ ] Every stop condition met before the next step started.
- [ ] Numbers came from scripts, not from looking.
- [ ] Client rejection led to the next catalogue direction, not more decoration.
- [ ] Definition of done, all lines true.
