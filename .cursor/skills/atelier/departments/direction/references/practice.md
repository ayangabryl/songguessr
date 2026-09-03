# Studio practice: how the work flows and where the idea comes from

The playbooks say what each desk decides. This file says how a job moves through the studio and how the one idea is found, so that the flow is a studio's and not a template's. It is written from how small craft studios work (otherkind, Pentagram teams, DIA, Studio Dumbar: 4 to 12 people, one director, specialists who hand each other artefacts) and reduced to steps an agent can run. `[house]` unless sourced.

Contents: 1 Flow. 2 The rally. 3 Kickoff. 4 Discovery. 5 Direction presentation. 6 Build weeks. 7 Critique. 8 Hand-off. 9 Case study. 10 Finding the one idea. 11 Innovation without slop. 12 Working in the open. 13 Scope: what a studio designs. 14 Sources.

## 1. Flow

| Phase | Output | Who signs | Length in an agent session |
|---|---|---|---|
| Kickoff | Intake card, project archaeology, risks | strategy | First 10 minutes |
| Discovery | Brief with numeric metric and baseline; competitor and reference read | strategy, direction | Next 10 |
| Direction | Two directions presented as one-screen concepts, one recommended; kill list | direction | 15 |
| System | Tokens, type spec, colour proof, motion tokens | layout, typography, colour, motion | 15 |
| Build | Screens or surfaces from tokens; imagery briefs; copy deck | all build desks | The bulk |
| Verify | QA report with brief pass, score | qa | 10 per loop |
| Decide | Ship or loop; the top five findings become the next brief | direction | 2 |
| Hand-off | Asset kit, tokens, spec, rationale | engineering, brand | 10 |
| Case study | Project page copy and images | words, imagery | 10 |

Three loops of System to Decide fit in one session. A job that has had one loop is a draft. `[house]`

## 2. The rally

The studio works like a tennis rally, not a reveal: short volleys with the client, each one a concrete artefact (a screen, a token sheet, a paragraph), each returned with a decision. Never disappear for a "big reveal"; never send a paragraph where a screen would do. In an agent session the client is the user; the rally is: show the artefact, name the decision it asks for, propose the default, move on unless they object. `[source: otherkind founders interview; house]`

Rules of the rally:
1. Every volley carries one decision and one default.
2. A rejected volley gets the next catalogue option, not more decoration on the rejected one.
3. Silence is consent to the default; note it as an assumption in the brief.
4. Three volleys on the same decision means the brief is wrong. Go back to strategy.

## 3. Kickoff

Read before asking. Project archaeology (`../../strategy/PLAYBOOK.md` section 3.2) answers what the product is, who uses it and what it must not lose. Then ask the eight intake questions (`../../../SKILL.md` section 1). Write the risks now: what could make the work fail even if it is beautiful (a metric the client will judge by, a stakeholder's favourite, a technical limit, a launch date).

Kickoff artefact: intake card plus a five-line risk list. `[house]`

## 4. Discovery

- Users: 3 to 5 signals from the product itself (analytics events, support tags, copy strings, store reviews) before any persona. Personas are the last resort and are labelled as guesses.
- Competitors: 6 on two axes named by the brief's tension (dense vs airy, expert vs beginner, warm vs technical). Place the client. The empty quadrant is a candidate position, not automatically the right one.
- References: 3 per direction candidate, each read as a mechanism ("how the hero uses one interactive idea", "how the nav gets out of the way"), never as a look to copy. Write the mechanism in one line.
- Baseline: measure the current build on the brief's metric (items above the fold, taps to primary action, load, contrast failures) so the redesign has a number to beat.

Discovery artefact: `brief.md` with the metric and baseline, plus the competitor map and the reference mechanisms in `concept.md`. `[house]`

## 5. Direction presentation

Two directions, never one and never four. Each as a single screen (the hero or the primary screen) built from real content, with a one-line idea, the catalogue direction it comes from, three mechanisms borrowed, and what it kills. Recommend one and say why in two sentences tied to the brief's tone words and metric. Show them side by side at the same size on the same canvas. `[source: Pentagram and Collins presentation practice; house]`

Client says no: present the next catalogue direction. Client says "make it more premium": run the slop catalogue on the current screen first; premium is the absence of the catalogue items plus one idea nobody else made, not an addition.

## 6. Build weeks

- Tokens before screens. Screens only from tokens. Off-scale values carry a one-line reason.
- Real content from day one: real copy, real data, real images or a filled prompt for them (`../../imagery/PLAYBOOK.md`). Lorem ipsum hides layout failures.
- States before polish: empty, loading, error, first run, returning, success, before any hover.
- Every desk hands its artefact as a file. A hand-off in chat is not a hand-off.
- Small loops: System to Decide three times beats one long build.

## 7. Critique

Critique is a QA pass with people in it. Run it on the rendered build at real size, in both themes, at 390 and 1440.

Format (20 minutes): 1) The maker states the brief's primary task and metric, nothing else. 2) Silent look, 3 minutes, everyone writes findings as "element, what, evidence". 3) Findings read out, S1 first, no fixes yet. 4) Fixes proposed only for S1 and S2. 5) Direction decides ship or loop. Taste is allowed only when attached to a measurable ("the headline is 44 px next to 13 px meta; the jump is 3.4x, the scale says 2.4x"). `[source: NN/g design critique guidance; house]`

Words that end a critique sentence early: "feels", "pops", "clean", "premium", "modern". Replace each with the number or the screenshot.

## 8. Hand-off

To engineering or the client: `tokens.css`, the type spec, the colour proof, `motion-spec.md`, the copy deck, the imagery briefs and delivered assets in the kit structure (`../../brand/PLAYBOOK.md` when the file exists), the QA report, and a one-page rationale that repeats the one idea and the kill list. The rationale is what keeps the design intact after the studio leaves. `[house]`

## 9. Case study

Written by the words desk, images by imagery. Structure and word counts in `../../words/PLAYBOOK.md`. The mechanism to copy is otherkind's project blurb: what we did, how (two or three mechanisms), the outcome with a number and a timeframe, credit to partners, then the images. 120 to 250 words. The case-study images are real captures at 2x on the brand canvas, one crop ratio, no device mockups unless the direction chose them. `[source: otherkind.design projects; house]`

Also write the internal case (`../../../casework/README.md`): what QA found, what looped, the lesson. The internal case is how the studio gets better; the external one is how it gets work.

## 10. Finding the one idea

The one idea is a sentence that a stranger could use to redraw the design. "The stage has one performer." "Every pixel is a control or a readout." "The list is the whole product." It is found, not decorated onto the work, by one of these methods, run in order until one yields a sentence: `[house]`

1. Constraint inversion: take the brief's hardest constraint and make it the idea. Dense list, small screen: the idea is density itself, judged by rows above the fold.
2. Primary task as stage: what is the one thing the user does; give it the whole screen and demote everything else into one bar.
3. Mechanism transplant: take one mechanism from a reference in an unrelated field (a ledger's tabular column, a film title's kerning, a train timetable's rules) and make it carry the hierarchy.
4. Material honesty: what is this product actually made of (text, numbers, sound, photographs, code); let that material be the visual language and remove everything that pretends otherwise.
5. Remove until it breaks: delete elements one at a time from the current screen; the last thing that could not be removed is the idea.
6. Character or voice: if the brand has a character, mascot or a strong voice, the idea is how it behaves, not how it looks.

Test: write the sentence, then list three decisions that follow from it that nobody else would make (the "decisions nobody else made" field in `concept.md`). If you cannot list three, it is a mood, not an idea.

## 11. Innovation without slop

Innovation in a studio is one mechanism per project done properly, not many effects. Choose exactly one of: an interaction (a live-editable wordmark, a scrubbed product sequence), a layout mechanism (a ledger column, a vitrine), a typographic mechanism (an optical-size axis carrying hierarchy), a motion mechanism (one physical model for every transition), a character (a rig with a real blink), a material (one honest texture across all surfaces). Everything else stays on the defaults. `[house]`

Checks before an innovation ships:
- It serves the primary task or the brand's positioning sentence; if it serves neither it is decoration.
- It has a reduced-motion and a no-JS fallback that still reads.
- It costs less than the engineering budget (`../../engineering/PLAYBOOK.md`).
- It is not in the slop catalogue (`slop-catalogue.md`) and not the default of the current year (the catalogue names them).
- A second, smaller model following the playbooks could build it from the spec. If only the author can build it, it is not specified.

## 12. Working in the open

Studios that publish well are trusted more: a letters page, a notes page, an open changelog of the design system. The mechanism at letters.otherkind.design is a plain, well-set page of short first-person letters, one idea each, no chrome; it works because the typography and spacing are the design and nothing competes with the words. When a client or the studio wants "content", propose that shape first: one column, one family, a measure of 60 to 70 characters, generous leading, dated entries, an index. `[source: letters.otherkind.design; house]`

## 13. Scope: what a studio designs

The atelier is not limited to web pages. The same run sheet applies; the surface changes the desk order and the QA method:

| Surface | Desks in order | QA method |
|---|---|---|
| Web product, site, page, component | strategy, direction, layout, typography, colour, motion, interaction, imagery, words, engineering, qa | Scripts on the rendered build |
| Mobile or desktop app screen | strategy, direction, layout (platform HIG or Material as the base), typography, colour, motion, interaction, words, qa | Captures at device sizes, platform HIG checklist, contrast scripts on exported frames |
| Brand identity, refresh, design language | strategy, brand, direction, typography, colour, illustration (mark), imagery, words, brand (applications), qa | Consistency audit across 5 touchpoints, mark tests at 16 px and 8 mm |
| Deck, pitch, report | strategy (one idea per slide), brand (template), typography, words, imagery, qa | 30 words per slide, 24 pt minimum, one idea per slide |
| Social set, OG images, ads | brand (templates), imagery, words, qa | Safe areas, type at 5 percent of shortest side, one message |
| Print (card, poster, book) | brand, typography, colour (CMYK proof), imagery, words, qa | Bleed, resolution, ink limits, minimum sizes |
| Email, newsletter, letters page | words, typography, brand, engineering (email constraints), qa | 600 px column, plain text first, contrast |
| Illustration, icon set, mascot | strategy (role), illustration, motion, colour, qa | Freeze-frames, silhouette test, blink sheet |
| Photography or generated imagery | imagery (spec and prompts), colour, qa | Acceptance checklist against the image spec |

When the agent cannot produce the asset itself (a photograph, a 3D render, a generated image), it produces the specification and the prompt (`../../imagery/references/prompts.md`) so the client can produce it elsewhere, and it designs with a placeholder of the exact dimensions and palette so the layout is finished either way.

## 14. Sources

- otherkind founders on building the studio they wished existed (the rally model): https://the-brandidentity.com/interview/why-otherkinds-founders-built-the-design-studio-they-wished-existed
- otherkind projects (case blurb mechanism): https://www.otherkind.design/projects?project=cloudflare
- Dear Designer letters (working in the open): https://letters.otherkind.design/
- Nielsen Norman Group, design critiques: https://www.nngroup.com/articles/design-critiques/
- Pentagram, how we work: https://www.pentagram.com/about
- Michael Bierut, "How to" (presenting two directions, the idea sentence): https://www.harpercollins.com/products/how-to-michael-bierut
- Studio Dumbar and DIA on motion in branding: https://the-brandidentity.com/insight/how-to-meaningfully-incorporate-motion-into-branding-with-studio-dumbar-dia-and-connor-campbell
- Rams, ten principles for good design (remove until it breaks): https://www.vitsoe.com/gb/about/good-design
