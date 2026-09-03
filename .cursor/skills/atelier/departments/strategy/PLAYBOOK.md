---
name: strategy
description: The strategy desk. Finds out who the users are, what job they hire the product for and what the one task per screen is, whether or not a client is available to ask (project archaeology reads the repo instead). Translates client words into decisions, applies HCI laws and Nielsen's heuristics as numeric checks, budgets cognitive load, and writes the brief every other desk works from. The front desk calls it first on every job.
---

# Strategy

Nothing on a screen is defensible until you can say who is looking at it, what job they hired it for, and what the one task on this screen is. This desk produces that knowledge cheaply from real signals, converts it into numbers and ends in a brief. Visual rules live at the other desks; do not duplicate them here.

Conventions: `[source: ...]` is traceable to section 9. `[house]` is a studio rule; follow it unless the brief overrides.

## 1. When the front desk calls this desk

Always first. Three modes; state which one you are in and run only that section set.

| Mode | Trigger | Sections | Output | Time box |
|---|---|---|---|---|
| Intake with a client | A human can answer questions | 3.1, 3.3, 4, 8 | Intake card, brief | 30 min |
| Project archaeology | No client; only the repo, the live site or a URL | 3.2, 3.3, 4, 8 | Intake card with guesses labelled, brief | 60 min |
| Usability review | The screen exists and the job is a review | 5, 6, 7, 8.3 as a table, then the checklist | Heuristic table with evidence | 45 min per screen |

Longer than the time box means you are researching to avoid deciding. `[house]`

## 2. Inputs required

- The job type from the front desk routing table.
- Access to at least one of: the client, the repo, the live product, analytics, tickets or reviews.
- `templates/intake.md` and `templates/brief.md`.

## 3. Decisions this desk owns

### 3.1 Running the intake conversation

The eight intake questions are in the front desk. How to ask them so the answers are usable:

| Client says | It usually means | Ask next | Write on the card |
|---|---|---|---|
| "Make it premium" or "more modern" | The current build has accidents (off-scale spacing, weak hierarchy) and no idea | "Show me two things you think are premium and tell me what you notice first" | The two mechanisms they noticed |
| "Like Apple" or "like Linear" | Restraint, one typeface, a control layer that floats, fast motion | "Which screen, and what would you keep if you could keep one thing" | The one thing, as a mechanism |
| "Playful" or "fun" | Character, colour in containers, spring motion; not confetti | "Playful for whom, and what must still feel serious" | The tone words and the never word |
| "Clean" | Fewer elements, more space, one accent | "What would you remove first" | The kill list seed |
| "It looks AI-generated" or "like a template" | Slop signals present (see direction desk catalogue) | "Which parts" | The specific signals to kill |
| "Our users are everyone" | The client has not segmented | "Who used it yesterday, on what device, for how long" | The primary persona from that answer |
| "We need a team section, pricing, testimonials" | Sections, not a story | "Which one does a visitor need to decide" | The primary task of the page |
| "Something creative, scroll animations" | A brand or campaign context, or a wish | "What must the visitor be able to do with scrolling turned off" | Whether creative-web is routed |

Default: when a client uses a style word, convert it to a mechanism before writing it down. Escape hatch: if they cannot, write the word in quotes and mark it as a guess to test with two candidate directions. `[house]`

### 3.2 Project archaeology (no client available)

Learn what the product is for from what it already contains. Twenty minutes of reading answers intake lines 1 to 4; lines 5 to 8 are written as labelled guesses.

| Step | Read | Extract | Minutes |
|---|---|---|---|
| 1 | README, package manifest, deployment config | Product name, stack, platform, who deploys it, constraints (line 8) | 3 |
| 2 | Routes, navigation, page or screen list | The information architecture; the screen with the most routes into it is the primary screen | 3 |
| 3 | Copy strings (i18n files, JSX text, headings, error messages, empty states) | Vocabulary, tone, the verbs the product uses for its own actions; the primary task is the verb the copy repeats most | 4 |
| 4 | Data model (schema, migrations, types) | The nouns; what is counted, scored, saved or shared; the success metric is usually a counted noun (streak, order, post) | 4 |
| 5 | Analytics events, feature flags, settings | What the team measures and toggles; frequency of use can be inferred from what has a setting | 2 |
| 6 | Existing design tokens, CSS, assets, mascot, logo | What must not change (brand, character), what is inconsistent (candidates for the kill list) | 3 |
| 7 | Git log subjects for the last 50 commits | What the team is working on; recent pain | 1 |

Write the intake card from the extraction. Every line taken from the repo gets the file path in parentheses; every guessed line gets "(guess)". Then write the brief. The direction desk treats guessed lines as risks and proposes two directions instead of one. `[house]`

Reading the primary task from a codebase: the primary task is the action that (a) has the largest control, (b) is reached from the most routes, (c) appears most in analytics events and (d) whose noun is the thing counted in the data model. When these disagree, (d) wins: products are built around the thing they count.

### 3.3 Task analysis and the primary task per screen

- Every screen has exactly one primary task, a verb phrase with no "and": "hear the clip and guess" is two; "guess the song" is one, hearing is a step. `[house]`
- Secondary tasks (at most 3) are visually subordinate: smaller, at the edge or behind one tap. Everything else is tertiary and leaves the first layer.
- Write the flow with counts: trigger, steps (taps, keystrokes, decisions), completion, what happens next. Count decisions separately from taps; a decision costs more (Hick). Target for a repeated core loop: at most 3 decisions and 5 taps. `[house]`
- Position follows frequency times severity: high frequency goes where the hand already is (bottom centre on mobile, at the pointer on desktop); high severity (destructive, irreversible) goes far from high-frequency targets and behind undo. `[source: Fitts; Nielsen 3, 5]`
- Frequency test: a control used in under 10 percent of sessions does not belong in the first layer. Measure; do not vote.

### 3.4 Knowing the users

Use what exists before interviewing anyone. Every persona line points at one of these. `[house]`

| Source | Tells you | Cannot tell you | Bias to correct |
|---|---|---|---|
| Analytics (funnels, events, device mix, session length) | Where people drop, what they touch, session length | Why | Survivorship |
| Support tickets, in-app feedback | The vocabulary users use; the top 5 failure modes | The silent majority | Complainers over-represent experts |
| Store reviews, Reddit, Discord | Emotional register, comparisons, the job in their words | Frequency | Read 1-star and 5-star; weight 3-star highest |
| Session recordings (10 to 20) | Hesitation, rage taps, scroll-past, hover before acting | Intent | Watch at 2x; log the first 10 s and the failures |
| Search logs, autocomplete misses | What people type versus what you named things | Everything else | Count distinct users, not queries |
| Five switch interviews (20 min) | The trigger, the previous solution, the four forces | Scale | Ask for the last time, never "usually" |

Jobs to be done `[source: Christensen and Moesta; NN/g]`: one statement per user type, "When [situation], I want to [motivation], so I can [outcome]", with the functional, emotional and social layers named. A screen that serves only the functional layer feels like a form. The one idea in the brief amplifies a pull or removes an anxiety; it never adds a feature.

The return ritual `[house]`: for any product people come back to (feeds, tools, games, dashboards), write one line before the JTBD: when they return (time of day, cadence), what they come back for (the thing they check first), and what tells them it was worth it. A redesign that does not change something about the ritual is a refresh; say so on the intake card. Example: "Hacker News: 2 to 5 visits a day, first look is for new threads since the last visit, then the comment counts; worth it when one thread is alive."

Competitor map `[house]`: required for every rethink and every brand job. Six competitors or adjacent products on two axes named by the brief's tension (dense vs airy, expert vs beginner, warm vs technical, list vs feed). Place the client. Write one line per competitor on the mechanism it owns. The empty quadrant is a candidate position, not automatically the right one; the direction desk reads this map before divergence.

Personas: at most 3, behavioural, 8 lines each, every line tagged (A) analytics, (T) tickets, (R) reviews, (S) sessions, (I) interview, or deleted. Merge personas that share job, context and pain. `[source: NN/g; house format]`

Assumption mapping `[source: Bland and Osterwalder]`: list every belief the design depends on; plot importance against evidence; test the high-importance, low-evidence quadrant first with the cheapest test that can prove you wrong; carry the top 3 unresolved into the brief as risks.

## 4. Rules: HCI laws with numbers

| Law | Statement | Consequence for the screen | Source |
|---|---|---|---|
| Fitts | Time grows with distance and shrinks with target width | Primary action at least 44 by 44 pt and nearest the resting hand or pointer; edges and corners are infinite-width targets | Laws of UX; Apple HIG |
| Hick | Time grows with log2(n + 1) choices | At most 5 to 7 equal options per decision point; beyond that, group or disclose; one obvious default | Laws of UX |
| Miller and Cowan | Working memory holds about 4 chunks | Never ask the user to hold more than 4 things; chunk digits; at most 7 rows before a divider | Cowan 2001 |
| Doherty | Respond under 400 ms | Acknowledge within 100 ms; complete or show progress by 400 ms; spinner only for 1 to 10 s; percentage beyond 10 s | Laws of UX; NN/g |
| Jakob | Users spend most of their time elsewhere | Navigation, search, playback and forms behave like the platform; novelty goes into content, character and craft | Laws of UX |
| Tesler | Complexity is conserved | Per feature, decide who absorbs it; the system pays unless the user gains real control | Laws of UX |
| Postel | Accept liberally, emit conservatively | Inputs accept typos, diacritics, articles, partial titles; outputs use one canonical format | Laws of UX |
| Zeigarnik | Incomplete tasks stay in memory | Show loop progress ("Try 2 of 5"); leave a visible open loop for return; never silently reset | Laws of UX |
| Peak-end | Memory is the peak plus the end | Spend the motion and copy budget on the reveal and the round end | Laws of UX |
| Von Restorff | One different item is remembered | Exactly one visually distinct element per screen, and it is the primary action or the answer | Laws of UX |
| Gestalt proximity | Near means related | Inter-group gap at least 2 times the intra-group gap | NN/g |
| Gestalt similarity | Same look means same behaviour | Identical treatment only for identical roles | NN/g |
| Gestalt common region | A boundary groups harder than proximity | One region for the control cluster; none for content that whitespace already groups | NN/g |
| Gestalt continuity | The eye follows aligned edges | One shared edge or centre axis per column; 2 px off reads as two groups | NN/g |

Cognitive load budget `[source: Sweller; house numbers]`: one point per visible control, distinct type size, distinct colour role, unlabelled icon, number to compare, badge or dot; two points per invented pattern, colour-only state, or text under 4.5:1. Primary-task screens: at most 12 points, 7 controls in the first layer, 3 type sizes, 1 accent, 0 unlabelled non-standard icons. Dense tools may go to 20 with a stated reason. Reduce by removing, then grouping, then hiding behind one tap; never by shrinking.

Accessibility is the fourth persona, with numbers `[source: WCAG 2.2; MedlinePlus; WHO]`: colour vision deficiency in about 8 percent of men, so no meaning by hue alone; 2.2 billion people with a vision impairment, so text at least 4.5:1, UI 3:1, 200 percent zoom and reflow at 320 px; motor: targets at least 24 by 24 px (2.5.8) with the studio at 44, 8 px between targets, every gesture has a button, keyboard reaches everything with a visible ring; cognitive: one task per screen, reading age about 12, no auto-advance, reduced motion honoured; hearing: anything with sound is usable silent, with a visible playback state.

## 5. Nielsen's heuristics as a review table `[source: NN/g]`

Score 0 (violated in the core loop), 1 (violated at the edge), 2 (met). Any 0 is a blocker. Evidence comes from the rendered build.

| # | Heuristic | Check | Typical failure |
|---|---|---|---|
| 1 | Visibility of system status | After every action, is the response visible within 100 ms? | Play pressed, nothing changes until audio buffers |
| 2 | Match with the real world | Are labels the user's words from tickets and search logs? | "Reroll" where users say "new song" |
| 3 | User control and freedom | Undo, cancel, back without penalty? | Skip is irreversible and unconfirmed |
| 4 | Consistency and standards | Same thing, same look, same place; platform conventions kept? | Play icon differs between two places |
| 5 | Error prevention | Mistakes constrained, defaulted or confirmed before they happen? | Free text with exact-match scoring |
| 6 | Recognition over recall | Everything needed is visible, not memorised? | Meaning only in a tooltip |
| 7 | Flexibility and efficiency | Accelerators for returning users that novices never see? | No Enter to submit, no Space to play |
| 8 | Aesthetic and minimalist | Does anything compete with the primary task? | Six top-bar controls, three badges |
| 9 | Recover from errors | Plain language, precise, suggests the fix? | "Something went wrong" |
| 10 | Help and documentation | Is help unnecessary, and otherwise in context? | Rules only in a first-run modal |

## 6. Defaults: copy, states, glanceability

Error prevention hierarchy, cheapest first `[source: Nielsen 5 and 9; Norman]`: constrain, default, forgive (Postel), undo (5 to 10 s window, visible), confirm (only irreversible and costly; the button names the action, never "OK").

Message formula, one sentence each, in order: what happened, why if the user can act on it, what to do now. Sentence case, no codes, no exclamation marks, no "oops". `[house]`

| Situation | Bad | Good |
|---|---|---|
| Network | "Error 503" | "Couldn't load the next song. Check your connection and try again." plus Retry |
| Validation | "Invalid input" | "Pick a song from the list so we can check it." |
| Empty results | "No results" | "No songs match 'nirvna'. Try the artist name." |
| Destructive | "Are you sure?" | "Skip this song? Your streak stays at 12." with Skip and Keep guessing |
| State loss | silent reset | "You were on try 3 of 5. Pick up where you left off?" |

First run and returning `[house]`: design both; the default state is the returning user's. First run: one sentence of purpose, the primary control primed by size and position (never pulsing), no modal tutorial. Returning: purpose collapses to the wordmark, last choices restored, progress read first (Zeigarnik). Expert layer: shortcuts, long press, swipe; invisible until used.

Glanceability test `[source: Rayner; house]`: about 12 fixations and 10 to 12 words in 3 seconds. Show the screenshot for 3 s (or blur 6 px and view a thumbnail) and ask: what is this, what do I do first, what state is it in. Rules that pass: headline at most 8 words; the primary control is the largest or highest-contrast interactive shape; one state indicator; nothing above the primary control except identity and state.

## 7. Anti-patterns

- Demographic personas with no evidence tags. Rebuild from signals or delete.
- Interviewing about "usually". Ask about the last time.
- A brief with two ideas joined by "and", or an idea that is a style word.
- A success metric that is an output ("ship redesign") or unmeasurable ("delight", "legible", "structural"). Fix: two numbers with viewports, one for the primary task and one baseline read from the current build (for a scanning task: items fully above the fold, `scripts/measure.mjs --count=<row>`); QA measures both and a miss is S1. `[house]`
- Accepting a brief whose primary task is scanning or comparing (feeds, lists, tables, search results) without a density baseline. Every redesign of a list must show at least as many items above the fold as the build it replaces, at 1440x900 and 390x844, unless the brief says why fewer is right. The baseline is a floor the new structure clears, never the structure: write it as "at least N", and hand direction the ritual and the competitor map so the structure comes from them. `[house]`
- A rethink brief with no ritual line and no competitor map. The build that follows will be the old page with new type, because nothing else was on the table. `[house]`
- Treating tickets as the population; they are the loud 2 percent.
- Confirmation dialogs instead of undo.
- Error copy that names the system's state instead of the user's next step.
- First-run tutorial modals; if the loop needs a lecture, the loop is wrong.
- Heuristic review scored from code or a design file instead of the rendered build.
- Adding a control because one user asked, without a frequency number.
- Skipping archaeology because "it is obvious what this app does". Read the data model anyway; it is ten minutes.
- Writing style words on the intake card ("clean", "premium") instead of mechanisms.

## 8. Hand-off artefact

Fill `templates/intake.md`, then `templates/brief.md`. The brief is one page, eight fields, no adjectives in the one idea; rewrite until each field is one to three lines. Downstream desks read only the brief; if something matters, it is in the brief.

Worked example (this repo's game):

```
Brief: SongGuessr, main play screen
Problem      Recordings show about 6 s median between load and first play; the top bar
             (six controls) and the difficulty switch draw the first fixations.
User         Break player: when I have five minutes on my phone, one hand, sound on, I want
             to prove I know this song fast, so I can feel sharp and keep my streak.
Primary task Guess the song (play, listen, type, pick a suggestion).
             Secondary: skip, change difficulty, reroll. Tertiary: theme, filters, settings.
Success      Median time to first play under 3 s; guess-submit rate per round at least 85 percent.
             Baseline: whole round and result above the fold at 1440x900, 1280x660 and 390x844
             (current build: yes, yes, yes) so no viewport regresses.
Constraints  One column, one screen; five difficulty hues as OKLCH tokens; light and dark;
             Noot SVG rig with reaction pools; React and Vite on Cloudflare Workers.
One idea     The stage has one performer: the play button is the only thing that asks to be touched.
Non-goals    No onboarding modal; no new modes; no social features.
Risks        Hue read as meaning (test: deuteranopia simulation); suggestions under 400 ms on
             3G (test: throttled recording); streak is the return hook (test: hidden cohort).
```

## Checklist (yes or no, five minutes)

1. Primary task stated as one verb phrase with no "and"?
2. Primary control found first in a 3-second glance?
3. At most 7 controls in the first layer and 12 load points?
4. Every label uses a word from tickets, reviews or search logs (or the repo's own copy)?
5. Every action acknowledges within 100 ms and finishes or shows progress by 400 ms?
6. Loop progress visible without a tooltip?
7. Exactly one visually distinct element, and it is the primary action or the answer?
8. Every state conveyed by something other than hue?
9. Wrong actions undoable rather than confirmed?
10. First-run and returning states both designed?
11. Targets at least 44 pt with 8 px between, keyboard-reachable, visible focus?
12. Top 3 assumptions written with a test?
13. Intake card has eight lines, guesses labelled?

## 9. Sources

- Laws of UX: https://lawsofux.com/
- NN/g, 10 usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- NN/g, response time limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- NN/g, personas versus jobs to be done: https://www.nngroup.com/articles/personas-jobs-be-done/
- NN/g, Gestalt proximity, similarity, common region: https://www.nngroup.com/articles/gestalt-proximity/ https://www.nngroup.com/articles/gestalt-similarity/ https://www.nngroup.com/articles/common-region/
- Bland and Osterwalder, Testing Business Ideas: https://www.strategyzer.com/library/testing-business-ideas
- Cowan, The magical number 4 in short-term memory (2001): https://doi.org/10.1017/S0140525X01003922
- Sweller, Cognitive load theory (1988): https://doi.org/10.1016/S0364-0213(88)80023-7
- Norman, The Design of Everyday Things: https://mitpress.mit.edu/9780262525671/
- Rayner, Eye movements in reading (1998): https://doi.org/10.1037/0033-2909.124.3.372
- WCAG 2.2 (1.4.3, 1.4.4, 1.4.10, 2.5.8): https://www.w3.org/TR/WCAG22/
- Apple HIG, Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Material Design, touch targets: https://m3.material.io/foundations/designing/structure
- MedlinePlus, colour vision deficiency: https://medlineplus.gov/genetics/condition/color-vision-deficiency/
- WHO, blindness and vision impairment: https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment
